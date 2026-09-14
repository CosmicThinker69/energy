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

The seed command creates four development accounts and the initial dashboard registry:

| Email                 | Password | Plan                   |
| --------------------- | -------- | ---------------------- |
| basic@demo.com        | Demo123! | Basic                  |
| professional@demo.com | Demo123! | Professional           |
| premium@demo.com      | Demo123! | Premium                |
| admin@demo.com        | Demo123! | Premium, administrator |

Public registration always assigns Basic with the `user` role. Users cannot assign or change roles through registration, Settings, or the account API.

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
- `canAccessPlan()` in `src/lib/config.ts` applies the Basic < Professional < Premium hierarchy to each dashboard's current `minimum_plan` value. Server pages gate dashboard viewers before rendering; APIs independently return 401 for missing sessions and 403 for insufficient plans.
- Dashboard administration requires the PostgreSQL-backed `admin` role. Normal users receive 403 responses from admin pages and APIs.

## Architecture

| Boundary                     | Location                                       | Responsibility                                  |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Plan access policy           | `src/lib/config.ts`                            | Plan hierarchy and non-dashboard permissions    |
| Dashboard registry           | `src/lib/server/dashboard-repository.ts`       | Parameterized dashboard metadata persistence    |
| Native component registry    | `src/components/native-dashboard-registry.tsx` | Approved native React component mapping         |
| PostgreSQL pool              | `src/lib/server/db.ts`                         | Shared server-only connection pool              |
| Account repository           | `src/lib/server/repository.ts`                 | Parameterized account/session/reset persistence |
| Authentication/authorization | `src/lib/server/auth.ts`                       | Cookie sessions and reusable server checks      |
| Password-reset delivery      | `src/lib/server/mail.ts`                       | Provider-independent mail boundary              |
| Database migrations and seed | `migrations/`, `scripts/`                      | Repeatable schema setup and explicit test data  |
| Deterministic market model   | `src/lib/market.ts`                            | Simulated energy-market data                    |
| Dashboard viewer             | `src/components/dashboard-viewer.tsx`          | Native and configured Streamlit viewer boundary |

The initial seed stores the configured `STREAMLIT_ENTSOE_URL` in `portal.dashboards`. Streamlit dashboards use `embed=true`; portal authentication and current-plan checks run before an iframe is rendered.

## Adding a Streamlit dashboard

The normal Python developer workflow requires no Next.js source change or portal redeployment:

1. Build and deploy the Streamlit dashboard.
2. Sign in to TEMO with an administrator account.
3. Open **Dashboard admin** in the sidebar and select **Add dashboard**.
4. Enter the title, unique lowercase slug, description, and category.
5. Choose **Streamlit**, paste the public HTTP(S) source URL, and select the minimum plan.
6. Add an optional badge such as `LIVE DATA`, set the order, enable it, and save.

The enabled dashboard immediately appears in the catalogue, global dashboard search, sidebar count, and `/dashboards/<slug>`. Administrators can later edit its metadata, plan, badge, URL, enabled state, and order. Disabling removes it from customer discovery and makes its direct route return 404. Deleting removes only the registry metadata; it never deletes the Streamlit service, market data, or analytics tables.

Native dashboards use the same administration form, but `native_key` is restricted to the keys in the native component registry. Adding a new native React implementation still requires a developer; administrators can manage metadata only for registered keys.

> TODO: The Streamlit Railway domain remains publicly reachable in this phase. A future reverse-proxy integration must make the service private so direct requests cannot bypass portal subscription permissions.

## Data conventions

Native market data and research remain simulated. The separate ENTSO-E Streamlit dashboard uses real data from its own PostgreSQL-backed service. Additional Streamlit and external HTML sources can be registered by an administrator. There are no Airflow or payment connections yet. Native historical values are deterministic, interval timestamps and date filters use UTC, and longer windows require daily or monthly resolution.

## Validation

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The database integration tests cover authentication persistence, role defaults, idempotent dashboard seeding, registry validation, disabled records, and live plan changes. Browser tests cover admin authorization and the complete dynamic Streamlit lifecycle in addition to existing portal, native-dashboard, and ENTSO-E workflows.

Design context is documented in `PRODUCT.md` and `DESIGN.md`.
