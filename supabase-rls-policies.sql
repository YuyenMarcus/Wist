-- Row Level Security (RLS) Policies for products table
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- These policies ensure users can only see and delete their own products

-- 1. Enable RLS (if not already enabled)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Public Read" ON products;
DROP POLICY IF EXISTS "Public Insert" ON products;
DROP POLICY IF EXISTS "Public Update" ON products;
DROP POLICY IF EXISTS "Users can view own items" ON products;
DROP POLICY IF EXISTS "Users can delete own items" ON products;

-- 3. Create policy: Users can view their own items
-- This allows authenticated users to SELECT only rows where user_id matches their auth.uid()
CREATE POLICY "Users can view own items" ON products
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- 4. Create policy: Users can delete their own items
-- This allows authenticated users to DELETE only rows where user_id matches their auth.uid()
CREATE POLICY "Users can delete own items" ON products
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- 5. Note: INSERT is handled by the backend service (which uses service_role key)
-- The backend service bypasses RLS, so products can be inserted with user_id
-- If you want users to be able to insert directly from the frontend, add this:
-- CREATE POLICY "Users can insert own items" ON products
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (auth.uid()::text = user_id);







