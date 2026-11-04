from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

from .core import ROOT, AREAS, UTC, Http, Store, ProviderError, configure, instant, windows
from .sources import ENTSOE_DATASETS, OPEN_PRICE_ZONES, entsoe, charts, gie

# Directed links; import/export remain separate records, never netted at ingestion.
BORDERS = [('BG','RO'),('BG','GR'),('BG','RS'),('RO','RS'),('RO','HU'),
           ('RS','HU'),('HU','SK'),('SK','PL'),('SK','CZ'),('PL','CZ')]
AGSI_AREAS = ['BG','RO','HU','SK','PL','CZ','EU']
ALSI_AREAS = ['GR','PL','EU']


def log(message):
    print(datetime.now(UTC).isoformat(timespec='seconds'),message,flush=True)


def plan(sources, areas, datasets=None):
    for source in sources:
        if source=='entsoe':
            for dataset in ENTSOE_DATASETS:
                for area in areas:
                    if not datasets or dataset in datasets:
                        yield source,dataset,area
            for dataset in ('physical_flow','scheduled_flow','capacity'):
                if datasets and dataset not in datasets:
                    continue
                for left,right in BORDERS:
                    if left in areas and right in areas:
                        yield source,dataset,f'{left}-{right}'
                        yield source,dataset,f'{right}-{left}'
        elif source=='energy-charts':
            # Alternate endpoints to respect each endpoint's own token bucket.
            for area in areas:
                for dataset in ('generation','physical_flow','scheduled_flow','day_ahead_price'):
                    if datasets and dataset not in datasets:
                        continue
                    if dataset!='day_ahead_price' or area in OPEN_PRICE_ZONES:
                        yield source,dataset,area
        elif source in ('gie-agsi','gie-alsi'):
            for area in AGSI_AREAS if source=='gie-agsi' else ALSI_AREAS:
                if area=='EU' or area in areas:
                    yield source,'gas_storage' if source=='gie-agsi' else 'lng',area


def collect(store, http, source, dataset, area, start, end, refresh=False):
    if not refresh and store.completed(source,dataset,area,start,end):
        return 0
    try:
        if source=='entsoe':
            rows,raw = entsoe(http,area,dataset,start,end)
        elif source=='energy-charts':
            rows,raw = charts(http,area,dataset,start,end)
        else:
            rows,raw = gie(http,source,area,start,end)
        # Each page is archived. Save page-specific rows with their own raw response.
        count = 0
        for raw_source,request,payload,content_type in raw:
            raw_id = store.raw(raw_source,request,payload,content_type)
            if len(raw)==1:
                page_rows = rows
            else:
                from .sources import parse_gie
                page_rows = parse_gie(json.loads(payload),source,area,start,end)
            count += store.save(source,dataset,area,page_rows,raw_id)
        store.checkpoint(source,dataset,area,start,end,'success' if count else 'empty',count)
        log(f'{source} {dataset} {area} {start.date()}..{end.date()}: {count} observations')
        return count
    except (ProviderError,ValueError,KeyError,TypeError) as error:
        message = str(error) if isinstance(error,ProviderError) else f'{source}: invalid provider payload ({type(error).__name__})'
        store.checkpoint(source,dataset,area,start,end,'failed',0,message)
        log(f'FAILED {dataset} {area}: {message}')
        return -1


def run(args, store, http, incremental=False):
    # Business dates use Sofia; all persisted intervals and query boundaries are UTC.
    today = datetime.now(ZoneInfo('Europe/Sofia')).date()
    start = instant(args.start or (today-timedelta(days=365)).isoformat())
    end = instant(args.end or (today+timedelta(days=1)).isoformat())
    if end<=start:
        raise ProviderError('end must be after start (end is exclusive)')
    failures = 0
    for source,dataset,area in plan(args.sources.split(','),args.areas.split(','),args.datasets.split(',') if args.datasets else None):
        if incremental:
            # Refresh overlap for corrections and tomorrow's already-published electricity prices.
            overlap = 14 if source.startswith('gie') else 3
            a = instant((today-timedelta(days=overlap)).isoformat())
            b = instant((today+timedelta(days=2)).isoformat())
            ranges = [(a,b)]
        else:
            ranges = windows(start,end,days=366 if source.startswith('gie') else args.chunk_days)
        for a,b in ranges:
            if collect(store,http,source,dataset,area,a,b,args.refresh or incremental)<0:
                failures += 1
    return failures


def report(store):
    from psycopg.rows import dict_row
    with store.conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM energy.coverage ORDER BY source,dataset,area,metric')
        coverage = cur.fetchall()
        cur.execute("SELECT source,dataset,area,status,count(*) AS windows,sum(row_count) AS observations FROM energy.collection_chunks GROUP BY 1,2,3,4 ORDER BY 1,2,3,4")
        chunks = cur.fetchall()
        cur.execute('SELECT count(*) AS count FROM energy.observation_revisions')
        revisions = cur.fetchone()['count']
    result = {'generated_at':datetime.now(UTC),'coverage':coverage,'chunks':chunks,'revisions':revisions}
    directory = ROOT / '.data'
    directory.mkdir(exist_ok=True)
    (directory/'coverage.json').write_text(json.dumps(result,default=str,indent=2))
    log(f'Coverage written to .data/coverage.json: {sum(r["observations"] for r in coverage):,} observations, {len(coverage)} series')
    return result


def main():
    configure()
    parser = argparse.ArgumentParser(description='TEMO energy data collection (UTC end-exclusive ranges)')
    parser.add_argument('command',choices=['backfill','update','worker','report','weather','weather-forecast'])
    parser.add_argument('--start')
    parser.add_argument('--end')
    parser.add_argument('--sources',default='entsoe,gie-agsi,gie-alsi,energy-charts')
    parser.add_argument('--areas',default=','.join(AREAS))
    parser.add_argument('--datasets')
    parser.add_argument('--chunk-days',type=int,default=31)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--interval',type=int,default=3600)
    args = parser.parse_args()
    if any(x not in AREAS for x in args.areas.split(',')):
        parser.error('Choose supported two-letter market codes')
    if any(x not in ('entsoe','gie-agsi','gie-alsi','energy-charts') for x in args.sources.split(',')):
        parser.error('Unknown source')
    if args.interval < 900:
        parser.error('Worker interval must be at least 900 seconds')
    if not 1<=args.chunk_days<=365:
        parser.error('Chunk size must be 1..365 days')
    logging.basicConfig(level=logging.ERROR)
    store = None
    try:
        store = Store()
        if args.command=='report':
            report(store)
            return
        store.lock(args.command if args.command in ('weather','weather-forecast') else 'market')
        http = Http()
        if args.command in ('weather','weather-forecast'):
            from .weather import era5, forecast
            if args.command=='weather':
                era5(store,args)
            else:
                forecast(store,args)
        elif args.command=='worker':
            while True:
                run(args,store,http,incremental=True)
                report(store)
                log(f'Next electricity/gas refresh in {args.interval} seconds')
                time.sleep(args.interval)
        else:
            failed = run(args,store,http,incremental=args.command=='update')
            report(store)
            if failed:
                sys.exit(2)
    except KeyboardInterrupt:
        log('Collection interrupted; completed chunks will resume safely')
    except Exception as error:
        # Database and vendor exceptions can contain credentials/URLs: never dump them.
        log(str(error) if isinstance(error,ProviderError) else f'Collection stopped ({type(error).__name__}); check configuration and connectivity')
        sys.exit(1)
    finally:
        if store:
            store.close()
