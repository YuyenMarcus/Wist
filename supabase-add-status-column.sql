-- Add status column to items table for "Just Got It" feature
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- This allows items to be tagged as 'active' (wishlist) or 'purchased' (Just Got It feed)

-- Add status column with default value 'active'
ALTER TABLE items ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add constraint to ensure status is either 'active' or 'purchased'
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('active', 'purchased'));

-- Create index for faster queries filtering by status
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status) WHERE status = 'purchased';

-- Optional: Update existing items to have status 'active' (if any exist without status)
UPDATE items SET status = 'active' WHERE status IS NULL;

