-- Add username_changed_at column to track when username was last changed
-- This enables 30-day lock on username changes
-- Run this in Supabase Dashboard → SQL Editor

-- Add username_changed_at column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changed_at timestamp with time zone;

-- Set username_changed_at for existing users who have a username_set_at
-- This ensures existing users have a baseline for the 30-day lock
UPDATE profiles 
SET username_changed_at = username_set_at 
WHERE username_set_at IS NOT NULL AND username_changed_at IS NULL;
