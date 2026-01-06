-- Add color field to collections table for custom icon colors
-- Run this in Supabase Dashboard → SQL Editor

-- Add color column (stores color name as string, e.g., "Violet", "Red", "Blue")
ALTER TABLE collections ADD COLUMN IF NOT EXISTS color text DEFAULT 'Violet';

-- Set default color for existing collections
UPDATE collections 
SET color = 'Violet' 
WHERE color IS NULL;

-- Add comment
COMMENT ON COLUMN collections.color IS 'Color name for collection icon (e.g., "Violet", "Red", "Blue"). Defaults to "Violet".';

