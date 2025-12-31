-- RLS Policies for Public Profile Feature
-- Run this in Supabase Dashboard → SQL Editor
--
-- This enables public read access to active items for the public profile feature
-- while maintaining privacy (only active items, not purchased/archived)

-- 1. Ensure RLS is enabled on items table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if they exist (be careful - backup first!)
-- DROP POLICY IF EXISTS "Users can view own items" ON items;
-- DROP POLICY IF EXISTS "Users can delete own items" ON items;

-- 3. Policy: Users can view their own items (all statuses)
-- This allows authenticated users to see all their items (active, purchased, archived)
CREATE POLICY "Users can view own items" ON items
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- 4. Policy: Public can view active items (for public profiles)
-- This allows anyone (anon or authenticated) to view items where status = 'active'
-- CRITICAL: Only active items are visible, preventing exposure of purchase history
CREATE POLICY "Public can view active items" ON items
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- 5. Policy: Users can insert their own items
CREATE POLICY "Users can insert own items" ON items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

-- 6. Policy: Users can update their own items
CREATE POLICY "Users can update own items" ON items
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- 7. Policy: Users can delete their own items
CREATE POLICY "Users can delete own items" ON items
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- Note: The public profile feature uses Service Role Key (admin client) to bypass RLS
-- This is safer than relying on RLS policies, but these policies provide an extra layer
-- of security if the admin client is ever compromised.

