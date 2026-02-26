-- One-time fix: Items with NULL status were hidden from the dashboard.
-- Run this in Supabase Dashboard → SQL Editor to restore visibility.
UPDATE items SET status = 'active' WHERE status IS NULL;
