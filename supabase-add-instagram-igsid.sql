-- Add instagram_igsid column to profiles for fast DM-to-user matching
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_igsid text;

-- Index for quick lookups when processing Instagram webhook messages
CREATE INDEX IF NOT EXISTS idx_profiles_instagram_igsid ON profiles(instagram_igsid);

COMMENT ON COLUMN profiles.instagram_igsid IS 'Instagram-Scoped User ID, cached after first DM for fast matching';
