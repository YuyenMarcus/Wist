-- Username/Handle Setup for Public Sharing
-- Run this in Supabase Dashboard → SQL Editor
--
-- This adds username support to profiles for sharing links like /u/marcus

-- 1. Add username column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_set_at timestamp with time zone;

-- 2. Create unique index on username (usernames must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username) WHERE username IS NOT NULL;

-- 3. Add constraint to ensure username format (alphanumeric, underscore, hyphen)
-- Usernames should be 3-30 characters, alphanumeric with _ and -
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS profiles_username_format 
CHECK (
  username IS NULL OR (
    length(username) >= 3 AND 
    length(username) <= 30 AND
    username ~ '^[a-zA-Z0-9_-]+$'
  )
);

-- 4. Function to check if username is available
CREATE OR REPLACE FUNCTION is_username_available(check_username text)
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE LOWER(username) = LOWER(check_username)
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Update RLS to allow users to view profiles by username (for public sharing)
-- This allows looking up a user by username without authentication
CREATE POLICY "Public can view profiles by username" ON profiles
FOR SELECT
TO anon, authenticated
USING (username IS NOT NULL);

-- Note: Users can only UPDATE their own profile (existing policy should handle this)

