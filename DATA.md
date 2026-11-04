# TEMO data foundation

## What is implemented

The overview, implemented dashboards and Data Explorer read published PostgreSQL `energy` observations. There is no synthetic-data mode. Reports and unsupported analytics views are hidden until backed by verified implementations; Ask TEMO's uploaded-document library remains a separate system.

Open `/data` to inspect coverage, filter sources/datasets/areas, browse native observations and export pages. `/api/data/status` exposes coverage to signed-in users; `/api/data` and `/api/data/quality` require Professional or Premium access. Provider credentials, raw response bodies and database credentials are never exposed by these routes.

Sources are independent records, including when they share the same upstream measurements. Nothing fills a provider gap with a synthetic value. Native intervals survive ingestion; dashboard buckets use overlap-duration weights, preserve negative prices, and withhold incompletely covered series. Generation consumption is stored separately from output. Pumped-storage generation is included in total output but excluded from the renewable numerator. The renewable share covers reported solar, wind, non-pumped hydro and biomass; it excludes waste's unknown biogenic share and other unclassified technologies.

## Local configuration and deployment

**Current hosting arrangement:** the complete market database and collectors stay local. The hosted Railway portal reads through the authenticated outbound agent described in [LOCAL-DATA-ACCESS.md](LOCAL-DATA-ACCESS.md). Railway retains its existing account database; the full history is not uploaded. The following connection notes describe how the original local import was established.

The previously configured Railway PostgreSQL endpoint refused connections during implementation. The working local PostgreSQL connection from `energy-streamlit/.env` is now set in **ignored** `app/.env.local`; the original Railway URL remains in `.env`. The portal and collectors therefore share the local database. The existing Streamlit tables in `public` remain intact; all new market tables are in `energy`, and account/catalogue tables are in `portal`.

Provider keys are in ignored `.env.data`. The local ENTSO-E key is reused from the sibling extractor if `ENTSOE_API_TOKEN` is absent. Shell environment variables take precedence. No provider key belongs in a `NEXT_PUBLIC_` setting.

For the current hybrid setup, Railway's `DATABASE_URL` continues to point to its existing private account database. The local agent's `DATABASE_URL` points to the full local market database. `DATA_BACKEND=local-agent` on Railway routes market reads through the agent. Do not upload `.env` files or `.venv-data`, and do not seed production demo accounts. A future fully hosted market database would require a separate deliberate data migration.

## Reproduce collection

From `app` on Windows:

```powershell
python -m venv .venv-data
.venv-data\Scripts\python.exe -m pip install -r data_pipeline/requirements.txt
npm run db:migrate
.venv-data\Scripts\python.exe -m data_pipeline backfill --sources entsoe --datasets day_ahead_price,generation,load --start 2025-11-04 --end 2026-11-05 --chunk-days 365
.venv-data\Scripts\python.exe -m data_pipeline backfill --sources gie-agsi,gie-alsi --start 2025-11-04 --end 2026-11-05
.venv-data\Scripts\python.exe -m data_pipeline backfill --sources energy-charts --start 2025-11-04 --end 2026-11-04 --chunk-days 365
.venv-data\Scripts\python.exe -m data_pipeline weather --start 2025-11-04 --end 2026-11-04
.venv-data\Scripts\python.exe -m data_pipeline weather-forecast
.venv-data\Scripts\python.exe -m data_pipeline update
.venv-data\Scripts\python.exe -m data_pipeline report
```

Dates are UTC and the end is exclusive. The current partial day and already-published next-day prices are collected by `update`. `--areas BG,RO` narrows a run. `--refresh` bypasses successful collection checkpoints; normal repeated backfills skip successful windows. Empty and failed windows are eligible for retry. `report` writes ignored `.data/coverage.json`, containing exact live counts and coverage rather than promised completeness.

The source-native electricity demand/generation forecasts and imbalance price/volume adapters also work through `backfill`/`update`. Historical ENTSO-E forecasts downloaded now are **not** historical as-of snapshots: the wrapper's `createdDateTime` is query time, not original forecast issue time. Their `forecast_run` is collection time and `provider_published_at` stays null. ECMWF runs have an actual model issue time and are archived separately. A year of old ECMWF operational runs cannot be recreated from the rolling open-data archive.

Directional ENTSO-E physical/scheduled flow and day-ahead capacity adapters cover the selected regional borders. `update` checks them; extended ENTSO-E border history can be explicitly requested:

```powershell
.venv-data\Scripts\python.exe -m data_pipeline backfill --sources entsoe --datasets physical_flow,scheduled_flow --start 2025-11-04 --end 2026-11-04 --chunk-days 31
```

Border values refer to the named direction, not a complete national balance. The native flow chart uses Energy-Charts' country-neighbour scheduled exchanges; it does not draw invented border capacities or infer congestion from physical flows.

## Continuous refresh

`data_pipeline.service` resumes core imports, secondary history and the additional ENTSO-E forecast/imbalance history, then refreshes electricity/gas hourly, ECMWF every six hours and ERA5 daily. The ERA5 refresh overlaps 95 days to catch provisional revisions; electricity overlaps three days and gas fourteen days. A weekly historical reconciliation retries failed windows. The main cycle is sequential and its timing depends on provider response times. Initial enrichment may delay the start of steady-state polling; the service performs a current-data refresh before enrichment.

On this machine the **TEMO Energy Data Collector** Windows scheduled task starts the hidden collector at sign-in and is also started immediately when installed. The task runs as the current ordinary Windows user and prevents duplicate task instances. PostgreSQL advisory locks additionally prevent overlapping collector groups. This runs while the computer is awake and the user is signed in; it is not cloud hosting.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-data-task.ps1
Get-ScheduledTask -TaskName 'TEMO Energy Data Collector'
Get-Content .data/current-data.log -Tail 20
Get-Content .data/service-state.json
```

Logs, cached weather files, saved CDS job IDs, bootstrap state and the collector PID live in ignored `.data`. Completed weather downloads are published atomically; individual ECMWF leads are cached to resume interrupted downloads. GIE pages and compressed raw provider responses are stored in PostgreSQL. This history plus indexes uses several GB; provision persistent storage accordingly.

## Provider audit, checked 4 November 2026

| Provider                                                                                                                              | Validated data                                                                                   | Access and operational constraints                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ENTSO-E API guide](https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html)                      | Prices, generation, load, load/generation/wind/solar forecasts; directional flow/capacity probes | Existing token works. Requests are bounded to a year or smaller windows; client throttles conservatively and honours 429 cooldowns. Original-owner reuse rights must be assessed per dataset; access is not a blanket resale licence.                                                                                                                                              |
| [Energy-Charts documentation](https://api.energy-charts.info/)                                                                        | Generation/load helpers, scheduled exchanges, physical flows; HU/PL/CZ open price checks         | Current documented default is 2 requests/minute **per endpoint**, including power, with dynamic reductions. Client spaces calls 31 seconds, honours `Retry-After`, and caches responses. CC BY 4.0 with attribution except restricted price zones. BG/RO/RS/GR/SK price imports are excluded; HU/PL/CZ are on the explicitly open SMARD list and response licence text is checked. |
| [GIE API manual](https://www.gie.eu/transparency-platform/GIE_API_documentation_v005.pdf)                                             | Storage for BG/RO/HU/SK/PL/CZ and EU; LNG for GR/PL and EU                                       | Key validated on AGSI and ALSI. Pagination uses 300 entries, follows `last_page`, and checks aggregate identities. EU uses `type=eu`, not `country=EU`. Gas days start at 06:00 Brussels, preserving 23/25-hour DST days. Provider `updatedAt` lacks a timezone and is retained in raw data rather than labelled UTC.                                                              |
| [ERA5 point time-series catalogue](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-timeseries)               | Hourly 2m temperature, 10m/100m wind components and solar radiation                              | Provided token works after manual licence acceptance. Uses the purpose-built point time-series dataset, one bounded regional reference point per market. About five days' publication lag; latest data are conservatively provisional for 90 days. Solar accumulations are converted from J/m² to W/m² and shifted to the start of their hour.                                     |
| [ECMWF Open Data](https://www.ecmwf.int/en/forecasts/datasets/open-data) / [official client](https://github.com/ecmwf/ecmwf-opendata) | Ten-day IFS temperature, wind components and solar-radiation forecasts                           | No key. CC BY 4.0 and ECMWF terms. Global GRIB range requests are unavoidable with this service; selected fields are reduced to the same eight reference points. Throttled lead-by-lead downloads avoid mirror bursts. Solar flux is calculated by differencing cumulative forecasts, not dividing each total by a fixed hour.                                                     |

Weather points are Sofia, Bucharest, Belgrade, Budapest, Athens, Bratislava, Warsaw and Prague, using each provider's nearest grid cell. They are explicitly labelled local proxies. National wind/solar predictors need a later extension to capacity-weighted regional grids; these points must not be described as country averages.

## Quality and provenance

- `energy.raw_responses`: compressed original body, safe request parameters, checksum, retrieval timestamp and provider. Authentication parameters/headers are excluded.
- `energy.observations`: independent source, dataset, area, metric, stable dimensions, UTC start/end, native unit, quality, forecast run, first/last seen and raw-response reference.
- The observation key makes repeated ingestion idempotent. A trigger archives changed values, units, quality, end times and publication times in `energy.observation_revisions` before replacement.
- `energy.collection_chunks`: completed, empty and failed request windows. A successful request is not evidence of complete underlying provider coverage.
- `/api/data/quality`: internal interval gaps, publication freshness and duration-weighted hourly price differences for overlapping ENTSO-E/Energy-Charts data. Shared upstream origins are explicitly identified. Leading/trailing missing history must be checked against collection windows. Endpoints are paginated; forecast runs are never silently blended.

## Remaining expansion

The current collectors do not yet ingest plant outages, ENTSOG physical gas flows, JAO allocation history, fuel benchmark prices or Eurostat/Ember structural statistics. No extra key is necessary for the implemented sources. ENTSOG needs point/operator/direction metadata and bounded queries; its [official API manual](https://transparency.entsog.eu/api/archiveDirectories/8/api-manual/ENTSOG_TP_API_UserManual_v3.0.pdf) documents a default 100-row limit and a 60-second query timeout. JAO's large-history coordination and exchange-specific commercial licensing should be resolved before their respective imports. These are explicit later datasets, not simulated replacements.

## Validation

```powershell
.venv-data\Scripts\python.exe -m unittest discover -s data_pipeline/tests -v
npm test
npm run typecheck
npm run build
npx playwright test tests/e2e/data.spec.ts tests/e2e/api.spec.ts
```

Browser tests exercise the real-data portal and require imported historical BG prices and GIE storage. Unit/database tests check duration weighting, negative prices, missing-quarter-hour handling, native curve parsing, pumping separation, gas-day DST, idempotence and revision archiving.
