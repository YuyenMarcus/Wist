-- Add out_of_stock column to items table (if not already present)
ALTER TABLE items ADD COLUMN IF NOT EXISTS out_of_stock boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_check_failures integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_items_out_of_stock ON items(out_of_stock) WHERE out_of_stock = true;
