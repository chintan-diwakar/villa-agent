CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_direction') THEN
    CREATE TYPE interaction_direction AS ENUM ('in','out');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  display_name text,
  phone_e164 text,
  email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text,
  channel text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bucket text NOT NULL,
  object_key text NOT NULL,
  region text,
  etag text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(bucket, object_key)
);

CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  direction interaction_direction NOT NULL,
  channel text NOT NULL,
  channel_user_id text,
  provider_msg_id text,
  role text,
  agent_name text,
  reply_to_interaction_id uuid REFERENCES interactions(id) ON DELETE SET NULL,
  status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS interaction_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  idx int NOT NULL,
  type text NOT NULL,
  text text,
  asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interaction_parts_order ON interaction_parts(interaction_id, idx);
CREATE INDEX IF NOT EXISTS idx_interactions_convo_ts ON interactions(conversation_id, ts);
CREATE INDEX IF NOT EXISTS idx_interactions_user_ts ON interactions(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_interaction_parts_interaction ON interaction_parts(interaction_id);

CREATE TABLE IF NOT EXISTS user_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  persona_summary text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_state (
  run_id uuid PRIMARY KEY,
  version int NOT NULL,
  status text NOT NULL,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS context_bundles (
  id uuid PRIMARY KEY,
  ts timestamptz NOT NULL,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  channel text NOT NULL,
  bundle jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  type text NOT NULL,
  agent text,
  tool_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_ts ON run_events(run_id, ts);
