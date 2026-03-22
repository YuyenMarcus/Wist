-- Add messenger_psid column to profiles for Messenger DM-to-user matching
-- Run this when you're ready to support Messenger linking (connect flow)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS messenger_psid text;

CREATE INDEX IF NOT EXISTS idx_profiles_messenger_psid ON profiles(messenger_psid);

COMMENT ON COLUMN profiles.messenger_psid IS 'Facebook Messenger Page-Scoped User ID (PSID), for DM-to-wishlist linking';
