-- Add created_at to profiles (defaults to now for existing rows)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
