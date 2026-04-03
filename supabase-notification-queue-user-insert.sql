-- Adds RLS policy so logged-in users can INSERT into notification_queue for their own items.
--
-- PREREQUISITE: The table must exist. If you see "relation notification_queue does not exist",
-- run `supabase-add-notifications.sql` first (it creates the table + indexes + other policies).
-- This file is safe to run after that; if the table is missing, this script does nothing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_queue'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'notification_queue'
        AND policyname = 'Users can insert notifications for own items'
    ) THEN
      CREATE POLICY "Users can insert notifications for own items"
        ON notification_queue FOR INSERT TO authenticated
        WITH CHECK (
          auth.uid() = user_id
          AND item_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM items
            WHERE items.id = item_id AND items.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END $$;
