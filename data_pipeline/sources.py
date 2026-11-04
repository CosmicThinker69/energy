"""Provider adapters. All returned times are interval starts in UTC."""
from __future__ import annotations

import io
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .core import AREAS, UTC, Observation, ProviderError, instant, number

PSR = {
    'B01':'biomass','B02':'fossil_brown_coal_lignite','B03':'fossil_coal_derived_gas',
    'B04':'fossil_gas','B05':'fossil_hard_coal','B06':'fossil_oil','B07':'fossil_oil_shale',
    'B08':'fossil_peat','B09':'geothermal','B10':'hydro_pumped_storage',
    'B11':'hydro_run_of_river_and_poundage','B12':'hydro_water_reservoir',
    'B13':'marine','B14':'nuclear','B15':'other_renewable','B16':'solar','B17':'waste',
    'B18':'wind_offshore','B19':'wind_onshore','B20':'other',
    'B21':'ac_link','B22':'dc_link','B23':'substation','B24':'transformer','B25':'energy_storage',
}
ENTSOE_DATASETS = ('day_ahead_price','generation','load','load_forecast','wind_solar_forecast',
                   'generation_forecast','imbalance_price','imbalance_volume')
# Only zones explicitly listed under CC BY 4.0 in /price documentation.
OPEN_PRICE_ZONES = {'AT','BE','CH','CZ','DE-LU','DE-AT-LU','DK1','DK2','FR','HU',
                    'IT-North','NL','NO2','PL','SE4','SI'}


def duration(text):
    match = re.fullmatch(r'P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?', text)
    if not match:
        raise ProviderError('entsoe: unsupported interval duration')
    d,h,m,s = (int(v or 0) for v in match.groups())
    result = timedelta(days=d,hours=h,minutes=m,seconds=s)
    if result.total_seconds() <= 0:
        raise ProviderError('entsoe: invalid interval duration')
    return result


def parse_entsoe(payload, dataset, start, end, collected_at=None):
    if payload[:2] == b'PK':
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            return [r for name in archive.namelist() if name.endswith('.xml')
                    for r in parse_entsoe(archive.read(name),dataset,start,end,collected_at)]
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        raise ProviderError('entsoe: invalid XML response') from None
    for node in root.iter():
        node.tag = node.tag.split('}')[-1]
    if root.tag == 'Acknowledgement_MarketDocument':
        if any(n.text == '999' for n in root.findall('.//Reason/code')) and 'no matching data' in ''.join(root.itertext()).lower():
            return []
        raise ProviderError('entsoe: provider rejected query (check parameters or access)')
    published = root.findtext('createdDateTime')
    # ENTSO-E's response document is generated at query time. This is not the original issue time.
    published_at = None
    forecast = dataset.endswith('forecast')
    run = (published_at or collected_at or datetime.now(UTC)).isoformat() if forecast else ''
    rows = []
    for series in root.findall('.//TimeSeries'):
        psr = series.findtext('MktPSRType/psrType')
        metric = PSR.get(psr, psr) if psr else {
            'day_ahead_price':'price','generation':'generation','load':'load',
            'load_forecast':'load','generation_forecast':'generation',
            'imbalance_price':'price','imbalance_volume':'volume',
            'physical_flow':'flow','scheduled_flow':'flow','capacity':'capacity',
        }.get(dataset, dataset)
        dimensions = {}
        for tag,key in [('flowDirection.direction','direction'),('businessType','business_type'),
            ('in_Domain.mRID','in_domain'),('out_Domain.mRID','out_domain'),
            ('inBiddingZone_Domain.mRID','in_domain'),('outBiddingZone_Domain.mRID','out_domain')]:
            if series.findtext(tag):
                dimensions[key] = series.findtext(tag)
        if dataset == 'generation':
            # A75 outBiddingZone means consumption, e.g. pumping. Never add it to generation.
            dimensions['measurement'] = 'consumption' if series.findtext('outBiddingZone_Domain.mRID') else 'generation'
        if dataset in ('scheduled_flow','capacity'):
            for tag in ('contract_MarketAgreement.type','auction.type'):
                if series.findtext(tag):
                    dimensions[tag]=series.findtext(tag)
        currency = series.findtext('currency_Unit.name')
        measure = series.findtext('price_Measure_Unit.name') or series.findtext('quantity_Measure_Unit.name')
        measure = {'MAW':'MW','MWH':'MWh'}.get(measure,measure)
        unit = f'{currency}/{measure or "MWh"}' if currency else measure or 'MW'
        curve = series.findtext('curveType', 'A01')
        if curve not in ('A01','A03'):
            raise ProviderError('entsoe: unsupported curve type')
        for period in series.findall('Period'):
            pstart = instant(period.findtext('timeInterval/start'))
            pend = instant(period.findtext('timeInterval/end'))
            step = duration(period.findtext('resolution'))
            points = sorted(period.findall('Point'),key=lambda p:int(p.findtext('position')))
            for i,p in enumerate(points):
                t = pstart + (int(p.findtext('position'))-1) * step
                # A03 positions hold until the next change; A01 missing positions are genuine gaps.
                stop = min(pend, pstart+(int(points[i+1].findtext('position'))-1)*step) if curve == 'A03' and i+1<len(points) else (pend if curve == 'A03' else min(t+step,pend))
                value = p.findtext('price.amount')
                if value is None:
                    value = p.findtext('imbalance_Price.amount')
                if value is None:
                    value = p.findtext('quantity')
                point_dimensions = dict(dimensions)
                if p.findtext('imbalance_Price.category'):
                    point_dimensions['category'] = p.findtext('imbalance_Price.category')
                # Expand A03 to the declared native resolution; never infer points across A01 gaps.
                while t < stop:
                    if start <= t < end:
                        rows.append(Observation(metric,t,min(t+step,stop),value,unit,point_dimensions,
                            run,'forecast' if forecast else 'reported',published_at))
                    t += step
    return rows


def entsoe(http, area, dataset, start, end):
    token = os.getenv('ENTSOE_API_TOKEN')
    if not token:
        raise ProviderError('entsoe: ENTSOE_API_TOKEN is missing')
    domain = AREAS.get(area)
    params = {'periodStart':start.strftime('%Y%m%d%H%M'),'periodEnd':end.strftime('%Y%m%d%H%M')}
    if dataset == 'day_ahead_price':
        params.update(documentType='A44', in_Domain=domain,out_Domain=domain)
    elif dataset in ('load','load_forecast'):
        params.update(documentType='A65',processType='A16' if dataset=='load' else 'A01',outBiddingZone_Domain=domain)
    elif dataset in ('generation','generation_forecast','wind_solar_forecast'):
        params.update(documentType={'generation':'A75','generation_forecast':'A71','wind_solar_forecast':'A69'}[dataset],
                      processType='A16' if dataset=='generation' else 'A01',in_Domain=domain)
    elif dataset in ('imbalance_price','imbalance_volume'):
        params.update(documentType='A85' if dataset=='imbalance_price' else 'A86',controlArea_Domain=domain)
    elif dataset in ('physical_flow','scheduled_flow','capacity'):
        left,right = area.split('-')
        params.update(documentType={'physical_flow':'A11','scheduled_flow':'A09','capacity':'A61'}[dataset],
                      in_Domain=AREAS[right],out_Domain=AREAS[left])
        if dataset=='capacity':
            params['contract_MarketAgreement.type']='A01'
    else:
        raise ProviderError('entsoe: unsupported dataset')
    response = http.get('entsoe','https://web-api.tp.entsoe.eu/api',dict(params,securityToken=token))
    rows = parse_entsoe(response.content,dataset,start,end,datetime.now(UTC)) if response.status_code != 204 else []
    return rows, [('entsoe',params,response.content,response.headers.get('content-type','application/xml'))]


def parse_charts(payload, dataset, start, end):
    times = payload.get('unix_seconds') or []
    if not times:
        return []
    if dataset == 'day_ahead_price':
        series = [{'name':'price','data':payload.get('price') or []}]
        unit = payload.get('unit','EUR/MWh')
    else:
        series = payload.get('production_types') or payload.get('countries') or []
        unit = 'GW' if dataset in ('physical_flow','scheduled_flow') else 'MW'
    rows = []
    for s in series:
        if len(s['data']) != len(times):
            raise ProviderError('energy-charts: mismatched timestamp and value counts')
        name = re.sub(r'[^a-z0-9]+','_',s['name'].lower()).strip('_')
        for i,(stamp,value) in enumerate(zip(times,s['data'])):
            t = instant(stamp)
            if not start <= t < end:
                continue
            # Ask for one extra endpoint sample; last point without a known duration is not guessed.
            if i+1 >= len(times):
                continue
            stop = instant(times[i+1])
            if stop-t > timedelta(hours=1):
                raise ProviderError('energy-charts: irregular interval; refusing to bridge a data gap')
            dimensions = {'neighbor':s['name'],'positive_direction':'import'} if unit=='GW' else {}
            actual_unit = '%' if name.startswith('renewable_share_') else ('MW' if unit=='GW' else unit)
            rows.append(Observation('flow' if unit=='GW' else name,t,stop,
                None if number(value) is None else number(value)*(1000 if unit=='GW' else 1),
                actual_unit,dimensions))
    return rows


def charts(http, area, dataset, start, end):
    endpoint = {'day_ahead_price':'price','generation':'public_power','physical_flow':'cbpf','scheduled_flow':'cbet'}[dataset]
    if dataset=='day_ahead_price' and area not in OPEN_PRICE_ZONES:
        raise ProviderError('energy-charts: price zone excluded by redistribution terms')
    params = {'bzn' if dataset=='day_ahead_price' else 'country':area if dataset=='day_ahead_price' else area.lower(),
              'start':start.isoformat(),'end':(end+timedelta(hours=1)).isoformat()}
    response = http.get('energy-charts:'+endpoint,'https://api.energy-charts.info/'+endpoint,params,spacing=31)
    if response.status_code==404:
        return [], [('energy-charts',{'endpoint':endpoint,'parameters':params},response.content,'application/json')]
    payload = response.json()
    if dataset=='day_ahead_price' and 'CC BY 4.0' not in payload.get('license_info',''):
        raise ProviderError('energy-charts: response does not confirm open price licence')
    return parse_charts(payload,dataset,start,end), [('energy-charts',{'endpoint':endpoint,'parameters':params},response.content,'application/json')]


def gas_day(value):
    # EU gas day starts at 05:00 UTC in winter and 04:00 UTC in summer (06:00 Brussels).
    return datetime.fromisoformat(value).replace(hour=6,tzinfo=ZoneInfo('Europe/Brussels')).astimezone(UTC)


def parse_gie(payload, source, area, start, end):
    metrics = {'gasInStorage':('storage','TWh'),'full':('full','%'),
        'injection':('injection','GWh/d'),'withdrawal':('withdrawal','GWh/d'),
        'workingGasVolume':('working_gas_volume','TWh'),
        'injectionCapacity':('injection_capacity','GWh/d'),'withdrawalCapacity':('withdrawal_capacity','GWh/d'),
        'sendOut':('send_out','GWh/d'),'dtrs':('send_out_capacity','GWh/d')}
    rows = []
    for item in payload.get('data',[]):
        # Do not accidentally ingest nested company/facility rows into country totals.
        if str(item.get('code','')).upper() != area:
            continue
        t = gas_day(item['gasDayStart'])
        stop = gas_day(item.get('gasDayEnd') or (instant(item['gasDayStart'])+timedelta(days=1)).date().isoformat())
        if not start <= t < end:
            continue
        # Status and timezone-free updatedAt remain in raw payloads, never in series identity.
        dimensions = {}
        for key,(metric,unit) in metrics.items():
            if key in item:
                rows.append(Observation(metric,t,stop,item[key],unit,dimensions,quality='provisional' if item.get('status')=='E' else 'reported'))
        if source=='gie-alsi':
            for key,metric in [('inventory','lng_inventory'),('dtmi','lng_capacity')]:
                if isinstance(item.get(key),dict):
                    rows.append(Observation(metric,t,stop,item[key].get('gwh'),'GWh',dimensions,quality='provisional' if item.get('status')=='E' else 'reported'))
    return rows


def gie(http, source, area, start, end):
    if not os.getenv('GIE_API_KEY'):
        raise ProviderError('gie: GIE_API_KEY is missing')
    base = 'https://agsi.gie.eu/api' if source=='gie-agsi' else 'https://alsi.gie.eu/api'
    rows, raw, page = [], [], 1
    while True:
        params = {'country':area,'from':(start-timedelta(days=1)).date().isoformat(),
                  'to':end.date().isoformat(),'size':300,'page':page}
        if area=='EU':
            params.pop('country')
            params['type']='eu'
        response = http.get(source,base,params,headers={'x-key':os.environ['GIE_API_KEY']},spacing=1.1)
        payload = response.json()
        if not isinstance(payload.get('data'),list):
            raise ProviderError(f'{source}: unexpected response (check key access)')
        rows.extend(parse_gie(payload,source,area,start,end))
        raw.append((source,params,response.content,'application/json'))
        if page >= int(payload.get('last_page',1)):
            break
        page += 1
        if page > 100:
            raise ProviderError(f'{source}: pagination limit exceeded')
    return rows, raw
