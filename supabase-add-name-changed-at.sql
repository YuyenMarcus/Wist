-- Add name_changed_at column to profiles for 30-day display name change lock
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_changed_at timestamptz;
