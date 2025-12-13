-- Add image_source column to products table
-- Run this in Supabase Dashboard → SQL Editor

-- Add image_source column to track where the image came from
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_source text DEFAULT 'url';
-- 'url' = from scraped URL
-- 'storage' = uploaded to Supabase Storage

-- Add index for filtering by image source (optional)
CREATE INDEX IF NOT EXISTS products_image_source_idx ON products(image_source) WHERE image_source IS NOT NULL;

