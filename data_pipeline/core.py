from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
AREAS = {
    'BG': '10YCA-BULGARIA-R', 'RO': '10YRO-TEL------P',
    'RS': '10YCS-SERBIATSOV', 'HU': '10YHU-MAVIR----U',
    'GR': '10YGR-HTSO-----Y', 'SK': '10YSK-SEPS-----K',
    'PL': '10YPL-AREA-----S', 'CZ': '10YCZ-CEPS-----N',
}


def configure():
    # Process environment always wins. Only reuse the old extractor's token.
    load_dotenv(ROOT / '.env.data')
    load_dotenv(ROOT / '.env.local')
    load_dotenv(ROOT / '.env')
    if not os.getenv('ENTSOE_API_TOKEN'):
        from dotenv import dotenv_values
        token = dotenv_values(ROOT.parent / 'energy-streamlit' / '.env').get('ENTSOE_API_TOKEN')
        if token:
            os.environ['ENTSOE_API_TOKEN'] = token


def instant(value) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError('Timestamps must include a timezone')
        return value.astimezone(UTC)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, UTC)
    return datetime.fromisoformat(str(value).replace('Z', '+00:00')).replace(
        tzinfo=UTC) if len(str(value)) == 10 else instant(datetime.fromisoformat(str(value).replace('Z', '+00:00')))


def number(value):
    if value is None or isinstance(value, bool) or str(value).strip() in ('', '-', 'N/A', 'null'):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


@dataclass
class Observation:
    metric: str
    start: datetime
    end: datetime
    value: float | None
    unit: str
    dimensions: dict = field(default_factory=dict)
    forecast_run: str = ''
    quality: str = 'reported'
    published_at: datetime | None = None

    def __post_init__(self):
        self.start, self.end = instant(self.start), instant(self.end)
        self.value = number(self.value)
        if self.end <= self.start:
            raise ValueError('Invalid observation interval')
        if self.value is None:
            self.quality = 'missing'


class ProviderError(Exception):
    """Safe to log: never include request URLs, headers, tokens or credentials."""


class Http:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers['User-Agent'] = 'TEMO-Energy/1.0 (cached research data collector)'
        self.last: dict[str, float] = {}

    def get(self, source, url, params=None, headers=None, spacing=0.25):
        for attempt in range(4):
            wait = spacing - (time.monotonic() - self.last.get(source, 0))
            if wait > 0:
                time.sleep(wait)
            self.last[source] = time.monotonic()
            try:
                response = self.session.get(url, params=params, headers=headers, timeout=(15, 90))
            except requests.RequestException:
                if attempt == 3:
                    raise ProviderError(f'{source}: connection failed') from None
                time.sleep(2 ** attempt)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                retry = response.headers.get('Retry-After', '')
                try:
                    delay = float(retry)
                except ValueError:
                    try:
                        delay = (parsedate_to_datetime(retry) - datetime.now(UTC)).total_seconds()
                    except (ValueError, TypeError):
                        delay = 600 if source == 'entsoe' and response.status_code == 429 else 30 * (attempt + 1)
                if attempt == 3:
                    raise ProviderError(f'{source}: HTTP {response.status_code}; retry later')
                time.sleep(max(1, delay))
                continue
            if response.status_code not in (200, 204, 404):
                raise ProviderError(f'{source}: HTTP {response.status_code}')
            return response
        raise ProviderError(f'{source}: retries exhausted')


class Store:
    def __init__(self):
        self.conn = psycopg.connect(os.environ['DATABASE_URL'], autocommit=True)

    def lock(self, group='market'):
        if not self.conn.execute('SELECT pg_try_advisory_lock(hashtext(%s))',('temo-energy-collector-'+group,)).fetchone()[0]:
            raise ProviderError('Another collector is running; retry later')

    def close(self):
        self.conn.close()

    def completed(self, source, dataset, area, start, end):
        row = self.conn.execute('''SELECT status FROM energy.collection_chunks
            WHERE source=%s AND dataset=%s AND area=%s AND window_start=%s AND window_end=%s''',
            (source, dataset, area, start, end)).fetchone()
        return bool(row and row[0] == 'success')

    def checkpoint(self, source, dataset, area, start, end, status, count, message=None):
        self.conn.execute('''INSERT INTO energy.collection_chunks
            (source,dataset,area,window_start,window_end,status,row_count,message)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT
            (source,dataset,area,window_start,window_end) DO UPDATE SET
            status=excluded.status,row_count=excluded.row_count,message=excluded.message,attempted_at=now()''',
            (source,dataset,area,start,end,status,count,message))

    def raw(self, source, request, payload, content_type='application/json'):
        sha = hashlib.sha256(payload).hexdigest()
        return self.conn.execute('''INSERT INTO energy.raw_responses
            (source,request,sha256,content_type,payload_gzip) VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT(source,sha256) DO UPDATE SET sha256=excluded.sha256 RETURNING id''',
            (source, Jsonb(request), sha, content_type, gzip.compress(payload))).fetchone()[0]

    def save(self, source, dataset, area, rows, raw_id):
        values = []
        unique = {}
        for r in rows:
            dimensions = json.dumps(r.dimensions, sort_keys=True, separators=(',', ':'))
            key = hashlib.sha256(dimensions.encode()).hexdigest()
            identity = (r.metric, key, r.start, r.forecast_run)
            unique[identity] = (source,dataset,area,r.metric,Jsonb(r.dimensions),key,
                r.start,r.end,r.forecast_run,r.value,r.unit,r.quality,r.published_at,raw_id)
        values.extend(unique.values())
        with self.conn.transaction(), self.conn.cursor() as cursor:
            cursor.executemany('''INSERT INTO energy.observations
              (source,dataset,area,metric,dimensions,dimension_key,interval_start,interval_end,
               forecast_run,value,unit,quality,provider_published_at,raw_id)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
              ON CONFLICT(source,dataset,area,metric,dimension_key,interval_start,forecast_run)
              DO UPDATE SET value=excluded.value,interval_end=excluded.interval_end,
               unit=excluded.unit,quality=excluded.quality,provider_published_at=excluded.provider_published_at,
               raw_id=excluded.raw_id,last_seen_at=now()''', values)
        return len(values)


def windows(start, end, days=31):
    while start < end:
        stop = min(start + timedelta(days=days), end)
        yield start, stop
        start = stop
