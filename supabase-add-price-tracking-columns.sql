-- Add price tracking columns to items table
-- Run this in Supabase Dashboard → SQL Editor

-- Add last_price_check column to track when item was last checked
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS last_price_check TIMESTAMPTZ DEFAULT NOW();

-- Add price_check_failures column to track failed attempts
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS price_check_failures INTEGER DEFAULT 0;

-- Create index for efficient cron queries (finds items that need checking)
CREATE INDEX IF NOT EXISTS idx_items_last_price_check 
ON items(last_price_check) 
WHERE status = 'active';

-- Add constraint to prevent negative failures
ALTER TABLE items 
ADD CONSTRAINT chk_failures_positive 
CHECK (price_check_failures >= 0);

-- Add comment for documentation
COMMENT ON COLUMN items.last_price_check IS 'Timestamp of last successful price check. Used by cron job to determine which items need checking.';
COMMENT ON COLUMN items.price_check_failures IS 'Number of consecutive failed price checks. Used to identify problematic items.';

