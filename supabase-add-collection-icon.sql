-- Add icon field to collections table for custom icons
-- Run this in Supabase Dashboard → SQL Editor

-- Add icon column (stores icon name as string, e.g., "Folder", "Gift", "Heart")
ALTER TABLE collections ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Folder';

-- Add comment
COMMENT ON COLUMN collections.icon IS 'Icon name from lucide-react (e.g., "Folder", "Gift", "Heart"). Defaults to "Folder".';

