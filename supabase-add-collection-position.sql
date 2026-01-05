-- Add position field to collections table for custom ordering
-- Run this in Supabase Dashboard → SQL Editor

-- Add position column (defaults to created_at timestamp for existing collections)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS position integer;

-- Set initial positions based on created_at order
-- This gives existing collections a position based on when they were created
UPDATE collections 
SET position = sub.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as row_number
  FROM collections
) sub
WHERE collections.id = sub.id AND collections.position IS NULL;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS collections_position_idx ON collections(user_id, position);

-- Add comment
COMMENT ON COLUMN collections.position IS 'Custom order position for collections. Lower numbers appear first.';

