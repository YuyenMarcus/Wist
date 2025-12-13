-- Add is_public and share_token columns to products table
-- Run this in your Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_is_public ON products(is_public);
CREATE INDEX IF NOT EXISTS idx_products_share_token ON products(share_token);

-- Update RLS policies to allow public access
-- (You may need to adjust these based on your existing policies)

-- Allow public to view public products
CREATE POLICY IF NOT EXISTS "Public can view public products" ON products
FOR SELECT TO anon, authenticated
USING (is_public = true);

-- Allow owners to update visibility
CREATE POLICY IF NOT EXISTS "Owners can update visibility" ON products
FOR UPDATE TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

