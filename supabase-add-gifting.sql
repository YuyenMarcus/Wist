ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gifting_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gifting_message text;
