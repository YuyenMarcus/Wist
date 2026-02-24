-- Subscription tier (free, pro, creator)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';

-- Admin flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Banning
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- Banned emails table (blocks sign-up even with new accounts)
CREATE TABLE IF NOT EXISTS banned_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  reason text,
  banned_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banned_emails_email ON banned_emails(email);

-- Set your account as admin (update the email to match yours)
UPDATE profiles SET is_admin = true WHERE email = 'julien@nitron.digital';
UPDATE profiles SET is_admin = true WHERE email = 'julien.marcus.c@gmail.com';
