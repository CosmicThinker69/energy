CREATE SCHEMA IF NOT EXISTS portal;

CREATE TABLE IF NOT EXISTS portal.users (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(btrim(email))),
  password_hash text NOT NULL,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 100),
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq
  ON portal.users ((lower(email)));

CREATE TABLE IF NOT EXISTS portal.sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL,
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_uq
  ON portal.sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
  ON portal.sessions (expires_at);

CREATE TABLE IF NOT EXISTS portal.password_reset_tokens (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL,
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_uq
  ON portal.password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON portal.password_reset_tokens (expires_at);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON portal.password_reset_tokens (user_id);
