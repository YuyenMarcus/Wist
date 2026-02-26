
-- Notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'price_drop',
  old_price numeric,
  new_price numeric,
  price_change_percent numeric,
  sent boolean DEFAULT false,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- If the table already exists, add the is_read column
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_unsent
  ON notification_queue(user_id, sent) WHERE sent = false;

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_unread
  ON notification_queue(user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notification_queue_created
  ON notification_queue(created_at DESC);

-- Add last_notification_sent to profiles if not present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_notification_sent timestamptz;

-- RLS policies
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON notification_queue FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON notification_queue FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_queue' AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications"
      ON notification_queue FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
