-- Create price_history table for tracking price changes over time
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on item_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(item_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see price history for their own items
CREATE POLICY "Users can view own price history"
  ON price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = price_history.item_id
      AND items.user_id = auth.uid()
    )
  );

-- Create policy: Service role can insert price history (for cron jobs)
-- Note: Service role key bypasses RLS, so this is mainly for documentation
CREATE POLICY "Service can insert price history"
  ON price_history
  FOR INSERT
  WITH CHECK (true);



