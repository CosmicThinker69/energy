ALTER TABLE portal.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'portal.users'::regclass
  ) THEN
    ALTER TABLE portal.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS portal.dashboards (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE
    CHECK (char_length(slug) BETWEEN 2 AND 80)
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  viewer_type text NOT NULL
    CHECK (viewer_type IN ('native', 'streamlit', 'external-html')),
  native_key text,
  source_url text CHECK (source_url IS NULL OR char_length(source_url) <= 2048),
  minimum_plan text NOT NULL
    CHECK (minimum_plan IN ('basic', 'professional', 'premium')),
  badge text CHECK (badge IS NULL OR char_length(badge) <= 40),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES portal.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES portal.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboards_viewer_source_check CHECK (
    (viewer_type = 'native' AND native_key IS NOT NULL AND source_url IS NULL)
    OR
    (viewer_type IN ('streamlit', 'external-html') AND native_key IS NULL AND source_url IS NOT NULL)
  ),
  CONSTRAINT dashboards_source_protocol_check CHECK (
    source_url IS NULL OR source_url ~* '^https?://'
  )
);

CREATE INDEX IF NOT EXISTS dashboards_enabled_order_idx
  ON portal.dashboards (enabled, sort_order, title);
