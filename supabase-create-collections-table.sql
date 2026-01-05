-- Create collections table for organizing wishlist items into custom lists
-- Run this in Supabase Dashboard → SQL Editor
--
-- Collections allow users to organize their items into custom categories
-- (e.g., "Living Room", "Kitchen", "Gift Ideas", etc.)

CREATE TABLE IF NOT EXISTS collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Collection Information
  name text NOT NULL,
  slug text NOT NULL,                    -- URL-friendly identifier (e.g., "living-room")
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ensure unique slug per user
  UNIQUE(user_id, slug)
);

-- Indexes
CREATE INDEX collections_user_id_idx ON collections(user_id);
CREATE INDEX collections_slug_idx ON collections(slug);

-- Enable Row Level Security (RLS)
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own collections
CREATE POLICY "Users can view own collections" ON collections
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own collections
CREATE POLICY "Users can insert own collections" ON collections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own collections
CREATE POLICY "Users can update own collections" ON collections
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own collections
CREATE POLICY "Users can delete own collections" ON collections
FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Add collection_id to items table to link items to collections
-- Uncomment if you want to link items to collections:
-- ALTER TABLE items ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;
-- CREATE INDEX items_collection_id_idx ON items(collection_id);

