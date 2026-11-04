"""Weather reference points, explicitly not national or capacity-weighted averages."""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import io
import zipfile
from contextlib import ExitStack
from datetime import datetime, timedelta

from .core import ROOT, UTC, Observation, ProviderError, instant, number

POINTS = {
    'BG':('Sofia',42.70,23.32),'RO':('Bucharest',44.43,26.10),
    'RS':('Belgrade',44.82,20.46),'HU':('Budapest',47.50,19.04),
    'GR':('Athens',37.98,23.73),'SK':('Bratislava',48.15,17.11),
    'PL':('Warsaw',52.23,21.01),'CZ':('Prague',50.08,14.44),
}
VARIABLES = ['2m_temperature','10m_u_component_of_wind','10m_v_component_of_wind',
             '100m_u_component_of_wind','100m_v_component_of_wind','surface_solar_radiation_downwards']
METRICS = {'t2m':('temperature_2m','degC'),'u10':('wind_u_10m','m/s'),
    'v10':('wind_v_10m','m/s'),'u100':('wind_u_100m','m/s'),
    'v100':('wind_v_100m','m/s'),'ssrd':('solar_radiation','W/m2')}


def point_dimensions(area, latitude=None, longitude=None):
    name,lat,lon = POINTS[area]
    return {'reference_point':name,'latitude':lat if latitude is None else round(float(latitude),4),
            'longitude':lon if longitude is None else round(float(longitude),4),
            'spatial_scope':'nearest_grid_point'}


def era5(store,args):
    from ecmwf.datastores import Client
    import requests
    import xarray as xr
    from .cli import log
    start = instant(args.start or (datetime.now(UTC)-timedelta(days=365)).date().isoformat())
    # ERA5T has roughly five days of latency. The last 90 days are conservatively provisional.
    end = min(instant(args.end) if args.end else datetime.now(UTC),
              instant((datetime.now(UTC)-timedelta(days=5)).date().isoformat()))
    if start>=end:
        raise ProviderError('copernicus-era5: date window is inside the publication lag')
    client = Client(url=os.environ.get('CDSAPI_URL','https://cds.climate.copernicus.eu/api'),
                    key=os.environ['CDSAPI_KEY'],maximum_tries=2,timeout=60)
    directory = ROOT/'.data'/'weather'
    directory.mkdir(parents=True,exist_ok=True)
    for area in args.areas.split(','):
        if not args.refresh and store.completed('copernicus-era5','weather',area,start,end):
            continue
        name,lat,lon = POINTS[area]
        # Fetch the following midnight too: accumulated radiation is end-labelled.
        request = {'variable':VARIABLES,'date':[start.date().isoformat(),end.date().isoformat()],
                   'location':{'latitude':lat,'longitude':lon},'data_format':'netcdf'}
        key = hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest()[:16]
        state_file = directory/f'{area}-{key}.json'
        target = directory/f'{area}-{key}.nc'
        try:
            if not target.exists():
                if state_file.exists():
                    remote = client.get_remote(json.loads(state_file.read_text())['request_id'])
                else:
                    remote = client.submit('reanalysis-era5-single-levels-timeseries',request)
                    state_file.write_text(json.dumps({'request_id':remote.request_id,'request':request}))
                    log(f'ERA5 {area}: request submitted; job ID saved for resuming')
                partial = target.with_suffix('.part')
                remote.download(str(partial))
                partial.replace(target)
            raw_id = store.raw('copernicus-era5',request,target.read_bytes(),'application/zip' if zipfile.is_zipfile(target) else 'application/x-netcdf')
            rows = []
            with ExitStack() as stack:
                if zipfile.is_zipfile(target):
                    archive = stack.enter_context(zipfile.ZipFile(target))
                    parts = []
                    for name in archive.namelist():
                        if name.endswith('.nc'):
                            # Write only the basename, never trust archive paths.
                            part = directory/(target.stem+'-'+os.path.basename(name))
                            part.write_bytes(archive.read(name))
                            parts.append(stack.enter_context(xr.open_dataset(part)))
                    ds = xr.merge(parts,compat='no_conflicts')
                else:
                    ds = stack.enter_context(xr.open_dataset(target))
                dims = point_dimensions(area,ds.latitude.values.item(),ds.longitude.values.item())
                for var,(metric,unit) in METRICS.items():
                    if var not in ds:
                        continue
                    series = ds[var].squeeze()
                    for stamp,value in zip(series.valid_time.values,series.values):
                        t = instant(str(stamp).replace('000000000','000000')+'Z')
                        if not start<=t<end:
                            continue
                        val = number(value)
                        if var=='t2m' and val is not None:
                            val -= 273.15
                        if var=='ssrd':
                            # Hourly ERA5 accumulation is labelled at the END of its hour.
                            t -= timedelta(hours=1)
                            val = val/3600 if val is not None else None
                        if not start<=t<end:
                            continue
                        quality = 'provisional' if t>datetime.now(UTC)-timedelta(days=90) else 'reported'
                        rows.append(Observation(metric,t,t+timedelta(hours=1),val,unit,dims,quality=quality))
            count = store.save('copernicus-era5','weather',area,rows,raw_id)
            store.checkpoint('copernicus-era5','weather',area,start,end,'success' if count else 'empty',count)
            log(f'ERA5 {area}: {count} reference-point observations')
        except requests.HTTPError as error:
            status = error.response.status_code if error.response is not None else 0
            message = f'copernicus-era5: HTTP {status}; accept ERA5 time-series dataset terms in CDS account' if status==403 else f'copernicus-era5: HTTP {status}'
            store.checkpoint('copernicus-era5','weather',area,start,end,'failed',0,message)
            raise ProviderError(message) from None


def forecast(store,args):
    from ecmwf.opendata import Client
    import eccodes as ec
    from .cli import log
    client = Client(source='ecmwf',resol='0p25',maximum_retries=2,retry_after=5)
    # Keep every forecast run separately. Do not invent a historical forecast archive.
    steps = list(range(0,145,3))+list(range(150,241,6))
    params = ['2t','10u','10v','100u','100v','ssrd']
    latest = client.latest(type='fc',stream='oper',step=240,param='2t')
    run = latest.replace(tzinfo=UTC)
    directory = ROOT/'.data'/'weather'
    directory.mkdir(parents=True,exist_ok=True)
    run_directory = directory/f'ecmwf-{run:%Y%m%d%H}'
    run_directory.mkdir(exist_ok=True)
    target = run_directory/'complete.grib2'
    if not args.refresh and all(store.completed('ecmwf','weather_forecast',a,run,run+timedelta(hours=240)) for a in args.areas.split(',')):
        log('ECMWF forecast run already archived')
        return
    request = {'date':run.strftime('%Y%m%d'),'time':run.hour,'type':'fc','stream':'oper',
               'step':steps,'param':params}
    if not target.exists():
        log(f'ECMWF {run.isoformat()}: downloading selected global fields to extract reference points')
        import time
        # Cache each lead independently, throttle downloads and publish the combined
        # artifact atomically. An interrupted global download is never a complete run.
        for step in steps:
            part = run_directory/f'{step:03d}.grib2'
            if part.exists():
                continue
            partial = part.with_suffix('.part')
            client.retrieve(dict(request,step=step),target=str(partial))
            partial.replace(part)
            log(f'ECMWF cached forecast lead +{step}h')
            time.sleep(1.5)
        partial = target.with_suffix('.part')
        with partial.open('wb') as output:
            for step in steps:
                output.write((run_directory/f'{step:03d}.grib2').read_bytes())
        partial.replace(target)
    raw_id = store.raw('ecmwf',request,target.read_bytes(),'application/x-grib')
    area_rows = {a:[] for a in args.areas.split(',')}
    accumulated = {}
    mapping = {'2t':('temperature_2m','degC'),'10u':('wind_u_10m','m/s'),
               '10v':('wind_v_10m','m/s'),'100u':('wind_u_100m','m/s'),
               '100v':('wind_v_100m','m/s'),'ssrd':('solar_radiation','W/m2')}
    with target.open('rb') as file:
        while (handle := ec.codes_grib_new_from_file(file)) is not None:
            try:
                short = ec.codes_get(handle,'shortName')
                step = int(ec.codes_get(handle,'endStep'))
                t = run+timedelta(hours=step)
                if short not in mapping:
                    continue
                metric,unit = mapping[short]
                next_step = next((s for s in steps if s>step),step)
                for area,rows in area_rows.items():
                    name,lat,lon = POINTS[area]
                    point = ec.codes_grib_find_nearest(handle,lat,lon)[0]
                    dims = point_dimensions(area,point['lat'],point['lon'])
                    value = number(point['value'])
                    begin,stop = t,run+timedelta(hours=next_step) if next_step>step else t+timedelta(microseconds=1)
                    if short=='2t' and value is not None:
                        value -= 273.15
                    if short=='ssrd':
                        previous = accumulated.get(area)
                        accumulated[area] = (step,value)
                        if step==0 or previous is None or previous[1] is None or value is None:
                            continue
                        begin = run+timedelta(hours=previous[0])
                        stop = t
                        value = (value-previous[1])/((step-previous[0])*3600)
                    else:
                        dims['temporal_support']='instantaneous_sample'
                    rows.append(Observation(metric,begin,stop,value,unit,dims,
                        run.isoformat(),'forecast',run))
            finally:
                ec.codes_release(handle)
    for area,rows in area_rows.items():
        count = store.save('ecmwf','weather_forecast',area,rows,raw_id)
        store.checkpoint('ecmwf','weather_forecast',area,run,run+timedelta(hours=240),'success' if count else 'empty',count)
        log(f'ECMWF {area}: {count} forecast observations, issued {run.isoformat()}')
