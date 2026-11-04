# Hosted portal with a local market-data computer

The complete market history stays in this computer's PostgreSQL `energy` schema. The local collector continues to grow it. The Railway database retains accounts, sessions, dashboard metadata and a small, temporary request/result queue. It does not receive a copy of the full market database.

The local agent makes authenticated outbound HTTPS requests to the existing Railway `energy` app. It claims only predefined read operations: market aggregates, coverage, native observation pages, collection status and quality. There is no arbitrary SQL or shell-command endpoint. Local PostgreSQL is not exposed over the internet. Its agent connection is read-only and has a 30-second statement timeout.

Browser access still uses the existing account and subscription checks. Agent authentication uses a separate server-only random token. Tokens and local database credentials live in ignored configuration and are never sent to browsers or committed.

## Running services

Two Windows scheduled tasks start at sign-in:

- **TEMO Energy Data Collector**: historical enrichment and provider refreshes.
- **TEMO Local Data Agent**: reconnecting data access for the hosted portal.

The computer must stay awake, connected to the internet and signed in. If the agent disconnects, market APIs return a clear 503 availability response; they do not substitute simulated values. The account/login system remains hosted.

```powershell
Get-ScheduledTask -TaskName 'TEMO Energy Data Collector','TEMO Local Data Agent'
Start-ScheduledTask -TaskName 'TEMO Local Data Agent'
Get-Content .data/local-data-agent.stdout.log -Tail 20
Get-Content .data/local-data-agent.stderr.log -Tail 20
```

To reinstall the agent task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-local-data-agent.ps1
```

To run it manually after stopping the task:

```powershell
npm run data:agent
```

## Configuration

On the Railway **energy** service:

```dotenv
DATA_BACKEND=local-agent
MARKET_DATA_MODE=stored
LOCAL_DATA_AGENT_TOKEN=<server-only random token>
DATABASE_URL=<existing Railway private connection>
```

Its pre-deploy command is `node scripts/migrate-production.mjs`. In this mode the production migration runner installs the portal queue without creating a duplicate cloud market schema. Existing accounts and Streamlit tables are preserved. The web start command remains unchanged.

In this computer's ignored `.env.local`:

```dotenv
DATABASE_URL=<local PostgreSQL connection>
LOCAL_DATA_CLOUD_URL=https://energy-production-c147.up.railway.app
LOCAL_DATA_AGENT_TOKEN=<same server-only random token>
```

Provider keys remain local in ignored `.env.data` and the existing extractor configuration. The agent does not need a public tunnel or access to Railway's database credentials.

## Request lifecycle

The web app checks account permissions, creates or reuses a bounded request, and waits up to 35 seconds for the local agent. The agent runs at most three read operations at once. Jobs are claimed atomically with expiring leases; expired/stale replies cannot overwrite a newer lease. Concurrent identical requests share a job. Results are cached briefly (20 seconds normally, one minute for coverage, fifteen minutes for quality) and removed after expiry. Agent heartbeats distinguish an offline computer from an empty dataset.

Changes to collector code or the agent script require restarting the corresponding local scheduled task. Changes to portal routing, API code or migration files require deploying the `energy` app. No market-data migration is needed for those deployments.
