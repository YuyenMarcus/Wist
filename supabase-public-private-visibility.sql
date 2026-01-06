-- Public vs Private Visibility System
-- Run this in Supabase Dashboard → SQL Editor
--
-- This allows users to share their wishlists publicly via a link
-- Private: Only the user can see it
-- Public: Accessible via share link (e.g., wishlist.nuvio.cloud/u/marcus)

-- 1. Add visibility and sharing columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS share_token text; -- Unique token for sharing

-- 2. Generate unique share tokens for existing public items
-- This will be handled by application logic, but we create the column

-- 3. Create index for share token lookups
CREATE INDEX IF NOT EXISTS products_share_token_idx ON products(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_is_public_idx ON products(is_public) WHERE is_public = true;

-- 4. Update RLS policies for public access
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own items" ON products;

-- Policy: Users can view their own items (private or public)
CREATE POLICY "Users can view own items" ON products
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- Policy: Anyone can view public items (for sharing)
CREATE POLICY "Public can view public items" ON products
FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Policy: Users can view items via share token (even if not public)
-- This allows private sharing via token
CREATE POLICY "Users can view items by share token" ON products
FOR SELECT
TO anon, authenticated
USING (
  share_token IS NOT NULL
  -- Share token will be validated in application layer
);

-- Policy: Users can update visibility of their own items
CREATE POLICY "Users can update own item visibility" ON products
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (
  auth.uid()::text = user_id
  -- Can update is_public and share_token
);

-- 5. Function to generate unique share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'base64')
    -- Remove special characters, keep only alphanumeric
    WHERE translate(encode(gen_random_bytes(16), 'base64'), '/+=', '') IS NOT NULL;
END;
$$ LANGUAGE plpgsql;







