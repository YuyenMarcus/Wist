-- Add Creator & Social fields to profiles table
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instagram_handle text;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tiktok_handle text;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS amazon_affiliate_id text;

-- Optional: Add comments for documentation
COMMENT ON COLUMN profiles.website IS 'User website/blog URL';
COMMENT ON COLUMN profiles.instagram_handle IS 'Instagram handle (without @)';
COMMENT ON COLUMN profiles.tiktok_handle IS 'TikTok handle (without @)';
COMMENT ON COLUMN profiles.amazon_affiliate_id IS 'Amazon Associate Store ID for affiliate links';
