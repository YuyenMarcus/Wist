-- Deduplicate Instagram DM webhook deliveries (Meta retries + concurrent requests).
-- Run in Supabase SQL editor once.

CREATE TABLE IF NOT EXISTS instagram_webhook_processed_mids (
  mid text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_webhook_processed_mids_created_at_idx
  ON instagram_webhook_processed_mids (created_at);

COMMENT ON TABLE instagram_webhook_processed_mids IS
  'One row per processed Instagram messaging webhook message.mid; prevents duplicate replies.';

ALTER TABLE instagram_webhook_processed_mids ENABLE ROW LEVEL SECURITY;
