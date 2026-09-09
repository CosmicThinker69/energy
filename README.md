# TEMO Energy Intelligence

A full-stack demonstration of a customer portal for European electricity-market analytics. Built with Next.js App Router, TypeScript, Node.js, React, Recharts, and locally bundled Inter Variable.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To serve an optimized build, run `npm run build` and then `npm start`.

## Demo accounts

| Email                 | Password | Initial plan |
| --------------------- | -------- | ------------ |
| basic@demo.com        | Demo123! | Basic        |
| professional@demo.com | Demo123! | Professional |
| premium@demo.com      | Demo123! | Premium      |

The buttons on the sign-in page fill these credentials. New accounts may choose any plan. Settings lets you switch plans instantly, without a payment flow. A changed plan remains attached to that account across sign-ins.

## What is implemented

- Registration, login, remember me, password visibility, validation, logout, and one-use password recovery.
- Server-side session cookies and hashed passwords. Profiles, tiers, sessions, and reset tokens persist in `.data/accounts.json`.
- An authenticated workspace with search, notifications, account menu, and responsive navigation.
- Market overview with eight KPIs, multi-country price charts, generation mix, market comparison, scheduled-flow network, events, and a live feed.
- Ten discoverable dashboards with centrally configured access tiers and upgrade dialogs.
- Market/date/resolution/comparison controls, interactive charts, interval tables, CSV downloads, fullscreen, and loading/error states.
- Five-second authenticated server-sent events. Live overview numbers and supported dashboards update without reloading.
- Data Explorer with multi-market selection, hundreds of observations, sorting, text filtering, pagination, metric columns, and filtered CSV export.
- Account editing, plan comparison, research reports with downloads, and a help guide.
- A reusable `DashboardViewer` boundary for later native, iframe, Streamlit, and generated-HTML viewers. External viewers are intentionally disabled in this demo.

## Architecture

| Boundary                        | Location                              | Future replacement                               |
| ------------------------------- | ------------------------------------- | ------------------------------------------------ |
| Catalogue, plans, access policy | `src/lib/config.ts`                   | Product/subscription configuration               |
| Account repository              | `src/lib/server/repository.ts`        | PostgreSQL account/session adapter               |
| Authentication/authorization    | `src/lib/server/auth.ts`              | Identity provider or production session service  |
| Deterministic market model      | `src/lib/market.ts`                   | Python/PostgreSQL-backed market repository       |
| Market API                      | `src/app/api/market/route.ts`         | Data query facade with the same response shape   |
| Live stream                     | `src/app/api/stream/route.ts`         | Upstream market-event subscription               |
| Viewer adapter                  | `src/components/dashboard-viewer.tsx` | Approved external dashboard embeds               |
| Client data access              | `src/components/use-market.ts`        | API consumption, cancellation, refresh, download |

`canAccess()` is shared between server endpoints and client affordances. All data, stream, account, and report endpoints enforce authentication. Plan-gated APIs return 403 for insufficient access; changing the UI or calling an endpoint directly does not grant access.

The local repository uses synchronous read/mutate/atomic-write operations in one Node.js process. Set `TEMO_DATA_DIR` to choose a persistent data directory. Use a database repository before running multiple server instances or deploying to ephemeral/serverless filesystems.

## Data conventions

All market data and research are simulated. There are no ENTSO-E, Python, Airflow, payment, or external Streamlit connections.

The model uses deterministic seasonal movement, a midday solar trough, an evening demand ramp, and negative midday intervals in selected renewable-rich markets. Generation technologies reconcile to total output. Imports and exports are positive; net exports equal exports minus imports. Interval timestamps and date filters are UTC; the header update clock uses the browser’s local time.

Daily and calendar-month buckets aggregate hourly observations. Prices and power values are averages; activated energy volumes and negative-hour counts are sums. Long windows require daily or monthly resolution. Live snapshots gently vary around an illustrative current market state; historical CSV exports retain the deterministic dataset.

Password recovery displays its link in the UI instead of sending email. This is an explicit demonstration convenience, not a production recovery channel. Links expire after 15 minutes. Remember me persists the cookie for 30 days; otherwise the cookie is scoped to the browser session and the server session lasts at most 24 hours.

## Validation

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
# With the app running on port 3000:
npm run test:e2e
node scripts/visual-audit.mjs
```

Browser tests cover authentication and recovery, tier restrictions and upgrades, all ten dashboards, filters, CSV downloads, Data Explorer, mobile navigation, search, and reports. The visual audit checks accessibility and viewport overflow and writes screenshots to `artifacts/`.

Design context is documented in `PRODUCT.md` and `DESIGN.md`.
