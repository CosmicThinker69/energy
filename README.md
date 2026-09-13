# TEMO Energy Intelligence

A full-stack customer portal for European electricity-market analytics, built with Next.js 16 App Router, React 19, TypeScript, PostgreSQL, and Recharts.

## Configuration

Requires Node.js 22 or newer and PostgreSQL. Copy `.env.example` to `.env` and set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
STREAMLIT_ENTSOE_URL=https://your-streamlit-service.example/
```

The application reads `DATABASE_URL` only on the server. Keep real credentials in local `.env` files or deployment secrets; never commit them.

## Database setup

Authentication data lives in a dedicated `portal` PostgreSQL schema and does not modify tables in `public`:

```sh
npm install
npm run db:migrate
npm run db:seed
```

Migrations are tracked in `portal.schema_migrations` and are safe to run repeatedly. Seeding is an explicit development/testing step and is never performed by application startup.

The seed command creates:

| Email                 | Password | Plan         |
| --------------------- | -------- | ------------ |
| basic@demo.com        | Demo123! | Basic        |
| professional@demo.com | Demo123! | Professional |
| premium@demo.com      | Demo123! | Premium      |

Public registration always assigns Basic. Plan and account-status changes are administrative database operations for now; customers cannot change their own plan through registration, Settings, or the account API.

## Run locally

```sh
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For production, configure `DATABASE_URL` in the deployment environment, run migrations as a release step, then build and start the application:

```sh
npm run db:migrate
npm run build
npm start
```

Do not run `db:seed` as part of normal production startup.

## Authentication and authorization

- Users, sessions, and password-reset tokens persist in `portal.users`, `portal.sessions`, and `portal.password_reset_tokens`.
- Passwords use salted scrypt hashes. Browser cookies contain only an opaque random token; PostgreSQL stores its SHA-256 hash.
- Normal server sessions expire after 24 hours. Remember Me sessions and persistent cookies expire after 30 days.
- Every authenticated request joins the session to the current user row, so plan changes and disabled status take effect immediately.
- Reset tokens expire after 15 minutes, are stored hashed, are one-use, and revoke all user sessions after a successful password change.
- Password-reset delivery is isolated behind `src/lib/server/mail.ts`. No provider is configured yet, so development reports that delivery is unavailable without exposing the token in an API response or log.
- `canAccess()` in `src/lib/config.ts` remains the single permission source. Server pages gate dashboard viewers, Explorer, and Reports before rendering; their APIs independently return 401 for missing sessions and 403 for insufficient plans.

## Architecture

| Boundary                     | Location                              | Responsibility                                  |
| ---------------------------- | ------------------------------------- | ----------------------------------------------- |
| Catalogue and access policy  | `src/lib/config.ts`                   | Plan hierarchy and resource permissions         |
| PostgreSQL pool              | `src/lib/server/db.ts`                | Shared server-only connection pool              |
| Account repository           | `src/lib/server/repository.ts`        | Parameterized account/session/reset persistence |
| Authentication/authorization | `src/lib/server/auth.ts`              | Cookie sessions and reusable server checks      |
| Password-reset delivery      | `src/lib/server/mail.ts`              | Provider-independent mail boundary              |
| Database migrations and seed | `migrations/`, `scripts/`             | Repeatable schema setup and explicit test data  |
| Deterministic market model   | `src/lib/market.ts`                   | Simulated energy-market data                    |
| Dashboard viewer             | `src/components/dashboard-viewer.tsx` | Native and configured Streamlit viewer boundary |

The ENTSO-E dashboard is embedded from the server-configured `STREAMLIT_ENTSOE_URL` with Streamlit's `embed=true` mode. Portal authentication and plan checks run before the iframe is rendered.

> TODO: The Streamlit Railway domain remains publicly reachable in this phase. A future reverse-proxy integration must make the service private so direct requests cannot bypass portal subscription permissions.

## Data conventions

Native market data and research remain simulated. The separate ENTSO-E Streamlit dashboard uses real data from its own PostgreSQL-backed service. There are no Airflow or payment connections yet. Native historical values are deterministic, interval timestamps and date filters use UTC, and longer windows require daily or monthly resolution.

## Validation

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The database integration tests cover registration, duplicates, password checks, hashed sessions and resets, Remember Me, logout, reset revocation, status changes, and live plan changes. Browser tests cover direct URL and API authorization in addition to the existing portal workflows.

Design context is documented in `PRODUCT.md` and `DESIGN.md`.
