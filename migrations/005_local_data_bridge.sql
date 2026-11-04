-- An outbound local agent serves bounded read operations. The complete market
-- database stays on the local machine; cloud results are short-lived caches.
CREATE TABLE portal.local_data_agents (
  id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL
);
CREATE TABLE portal.local_data_requests (
  id uuid PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  operation text NOT NULL CHECK(operation IN ('market','coverage','observations','quality','collection')),
  args jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed')),
  lease_token uuid,
  lease_until timestamptz,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes'
);
CREATE INDEX local_data_pending ON portal.local_data_requests(status,created_at);
