-- Fix: Allow users to UPDATE their own items (Required for moving items to collections)
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update their own items" ON items;

-- Create new policy that allows users to update their own items
CREATE POLICY "Users can update their own items" 
ON items FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'items' AND policyname = 'Users can update their own items';

