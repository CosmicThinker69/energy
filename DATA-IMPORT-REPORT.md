# Data import report

Snapshot: 2026-11-04T20:01:36+02:00 (Europe/Sofia).

Total stored observations: **9,708,873**. Collection continues after this snapshot.

| Source          | Dataset             | Observations | Areas | Earliest interval (UTC)   | Latest end (UTC)                 |
| --------------- | ------------------- | -----------: | ----: | ------------------------- | -------------------------------- |
| copernicus-era5 | weather             |      414,712 |     8 | 2025-11-04T00:00:00+00:00 | 2026-10-30T00:00:00+00:00        |
| ecmwf           | weather_forecast    |        3,112 |     8 | 2026-11-04T00:00:00+00:00 | 2026-11-14T00:00:00.000001+00:00 |
| energy-charts   | day_ahead_price     |      105,120 |     3 | 2025-11-04T00:00:00+00:00 | 2026-11-04T00:00:00+00:00        |
| energy-charts   | generation          |    3,214,920 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-04T00:00:00+00:00        |
| energy-charts   | physical_flow       |    1,270,200 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-04T00:00:00+00:00        |
| energy-charts   | scheduled_flow      |    1,585,560 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-04T00:00:00+00:00        |
| entsoe          | day_ahead_price     |      281,824 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-05T23:00:00+00:00        |
| entsoe          | generation          |    2,572,462 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-04T17:30:00+00:00        |
| entsoe          | generation_forecast |        2,113 |     6 | 2026-11-01T00:00:00+00:00 | 2026-11-05T23:00:00+00:00        |
| entsoe          | load                |      227,526 |     8 | 2025-11-04T00:00:00+00:00 | 2026-11-04T17:30:00+00:00        |
| entsoe          | load_forecast       |        3,093 |     8 | 2026-11-01T00:00:00+00:00 | 2026-11-06T00:00:00+00:00        |
| entsoe          | wind_solar_forecast |        6,027 |     8 | 2026-11-01T00:00:00+00:00 | 2026-11-05T23:00:00+00:00        |
| gie-agsi        | gas_storage         |       17,836 |     7 | 2025-11-04T05:00:00+00:00 | 2026-11-03T05:00:00+00:00        |
| gie-alsi        | lng                 |        4,368 |     3 | 2025-11-04T05:00:00+00:00 | 2026-11-03T05:00:00+00:00        |

Core electricity history begins 4 November 2025. Future ends represent already-published prices or forecasts, not future actual generation. Gas coverage follows publication delay; ERA5 follows its own delayed publication window. Weather represents named reference grid points, not national averages.

Quality snapshot (2026-11-04T17:57:57.971Z): 38 series with internal gaps; 0 hourly price disagreements greater than EUR 0.05/MWh in the overlapping last-30-day checks; 0 datasets beyond the configured freshness thresholds. Shared upstream origins mean price agreement is a processing check, not an independent measurement.

Missing intervals remain gaps. Sparse technologies and directional measurements need interpretation from provider metadata; a successful backfill window does not establish complete underlying reporting.

Validation: 6 Python parser tests, 22 Node/database tests and 3 focused Playwright tests passed; TypeScript and production build passed.

The Windows task **TEMO Energy Data Collector** is installed and running. Additional ENTSO-E forecast/imbalance history is queued in its bootstrap; steady-state updates follow. See [DATA.md](DATA.md) for schedules and limitations.

**Deployment status:** data and app changes are local. The configured Railway database refused connections; the app uses local PostgreSQL via ignored `.env.local`, while the original Railway setting remains in `.env`. No cloud deployment or cloud data migration was performed.

Not yet ingested: plant outages, ENTSOG gas flows, JAO history, fuel benchmarks and Eurostat/Ember structural statistics.
