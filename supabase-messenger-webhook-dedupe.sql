-- Deduplicate Messenger webhook deliveries (same idea as Instagram).
-- Run in Supabase SQL Editor once.

CREATE TABLE IF NOT EXISTS messenger_webhook_processed_mids (
  mid text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messenger_webhook_processed_mids_created_at_idx
  ON messenger_webhook_processed_mids (created_at);

COMMENT ON TABLE messenger_webhook_processed_mids IS
  'One row per processed Messenger message.mid; prevents duplicate replies.';

ALTER TABLE messenger_webhook_processed_mids ENABLE ROW LEVEL SECURITY;
