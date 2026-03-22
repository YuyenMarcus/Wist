-- One-time codes to link Facebook Messenger (PSID) to a Wist profile.
-- Run in Supabase SQL Editor once.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS messenger_link_token text;

COMMENT ON COLUMN profiles.messenger_link_token IS
  'User messages the Facebook Page "connect <token>" to set messenger_psid; cleared after successful link.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_messenger_link_token_unique
  ON profiles (messenger_link_token)
  WHERE messenger_link_token IS NOT NULL;

-- Only one Wist account per Messenger user (per Page PSID)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_messenger_psid_unique
  ON profiles (messenger_psid)
  WHERE messenger_psid IS NOT NULL;
