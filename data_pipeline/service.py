"""Resumable initial imports followed by provider-aware continuous collection.

Run as a separate service/Windows task. Never launched by a web request.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from .core import ROOT, UTC, Store, configure


def execute(arguments, name):
    directory=ROOT/'.data'
    directory.mkdir(exist_ok=True)
    log=directory/f'{name}.log'
    # Keep bounded logs. Actual data and revision provenance live in PostgreSQL.
    if log.exists() and log.stat().st_size>10_000_000:
        log.replace(log.with_suffix('.previous.log'))
    with log.open('a',encoding='utf-8') as output:
        output.write(f'\n{datetime.now(UTC).isoformat()} Starting {name}\n')
        output.flush()
        return subprocess.run([sys.executable,'-u','-m','data_pipeline',*arguments],
                              cwd=ROOT,stdout=output,stderr=subprocess.STDOUT).returncode


def main():
    configure()
    guard=Store()
    guard.lock('service')
    (ROOT/'.data').mkdir(exist_ok=True)
    (ROOT/'.data'/'collector.pid').write_text(str(__import__('os').getpid()))
    # A fixed bootstrap end makes interrupted chunks resumable across calendar days.
    state_file=ROOT/'.data'/'service-state.json'
    if state_file.exists():
        state=json.loads(state_file.read_text())
    else:
        day=datetime.now(ZoneInfo('Europe/Sofia')).date()
        state={'start':(day-timedelta(days=365)).isoformat(),'end':day.isoformat(),'bootstrap':{}}
        state_file.write_text(json.dumps(state,indent=2))
    ranges=['--start',state['start'],'--end',state['end'],'--chunk-days','365']
    stages=[
        ('core-history',['backfill','--sources','entsoe','--datasets','day_ahead_price,generation,load',*ranges]),
        ('gas-history',['backfill','--sources','gie-agsi,gie-alsi',*ranges]),
        ('secondary-history',['backfill','--sources','energy-charts',*ranges]),
        ('energy-forecast-history',['backfill','--sources','entsoe','--datasets',
            'load_forecast,wind_solar_forecast,generation_forecast,imbalance_price,imbalance_volume',*ranges]),
    ]
    try:
        # Refresh before enrichment so publication latency is not tied to backlog size.
        execute(['update','--datasets','day_ahead_price,generation,load,load_forecast,wind_solar_forecast,generation_forecast'],'current-data')
        for name,args in stages:
            if state['bootstrap'].get(name):
                continue
            while True:
                code=execute(args,name)
                if code in (0,2):
                    # 2 means partial provider failures; these are visible in collection status.
                    state['bootstrap'][name]={'finished_at':datetime.now(UTC).isoformat(),'exit_code':code}
                    state_file.write_text(json.dumps(state,indent=2))
                    break
                time.sleep(60)
        next_market=next_forecast=next_weather=0
        next_reconcile=time.monotonic()+7*24*3600
        while True:
            now=time.monotonic()
            if now>=next_market:
                execute(['update'],'current-data')
                next_market=now+3600
            if now>=next_forecast:
                execute(['weather-forecast'],'weather-forecast')
                next_forecast=time.monotonic()+6*3600
            if now>=next_weather:
                # Recheck preliminary ERA5T through the full finalisation window.
                execute(['weather','--start',(datetime.now(UTC)-timedelta(days=95)).date().isoformat()], 'weather-refresh')
                next_weather=time.monotonic()+24*3600
            if now>=next_reconcile:
                for name,args in stages:
                    execute(args,name)
                next_reconcile=time.monotonic()+7*24*3600
            time.sleep(30)
    finally:
        guard.close()


if __name__=='__main__':
    main()
