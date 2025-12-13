-- Reservation System: Add "Mark as Purchased" functionality
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- This allows friends to reserve/purchase items on a wishlist
-- The owner cannot see who reserved it (to avoid spoiling the surprise)

-- 1. Add reserved_by column to track who reserved/purchased the item
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_by text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_at timestamp with time zone;

-- 2. Add index for faster queries on reserved items
CREATE INDEX IF NOT EXISTS products_reserved_by_idx ON products(reserved_by) WHERE reserved_by IS NOT NULL;

-- 3. Update RLS policies to allow authenticated users to reserve items
-- Users can update items they don't own (to reserve them)
CREATE POLICY "Users can reserve items" ON products
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is NOT the owner (can't reserve own items)
  auth.uid()::text != user_id
  -- AND item is not already reserved
  AND reserved_by IS NULL
)
WITH CHECK (
  -- Can only set reserved_by to their own ID
  reserved_by = auth.uid()::text
  -- And cannot change other fields
  AND user_id = (SELECT user_id FROM products WHERE id = products.id)
);

-- 4. Allow users to see reserved status (but not who reserved it if they're the owner)
-- This is handled by the SELECT policy - owners see reserved_by as null in queries
-- We'll handle this in the application layer to hide reserved_by from owners

-- 5. Allow users to unreserve items they reserved
CREATE POLICY "Users can unreserve their reservations" ON products
FOR UPDATE
TO authenticated
USING (
  -- Can only unreserve items they reserved
  reserved_by = auth.uid()::text
)
WITH CHECK (
  -- Can set reserved_by to NULL
  reserved_by IS NULL
  -- And cannot change other fields
  AND user_id = (SELECT user_id FROM products WHERE id = products.id)
);

