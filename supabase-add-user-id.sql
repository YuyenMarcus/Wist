-- Add user_id column to products table for multi-user support
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add the user_id column (we use text so it works with Clerk, Firebase, or Supabase Auth)
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id text;

-- 2. (Optional) If you want to empty the table to start fresh:
-- TRUNCATE TABLE products;







