-- Fix the subscription_tier check constraint to allow all 5 tiers
-- The old constraint may only allow 'free', 'pro', 'creator'

-- Drop existing constraint (safe if it doesn't exist)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

-- Add updated constraint with all 5 valid tiers
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro', 'pro_plus', 'creator', 'enterprise'));

-- Also ensure gifting columns exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gifting_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gifting_message text;

-- Ensure preferred_currency column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';

-- Ensure profile_theme column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_theme text;

-- Ensure auto_activate_queued column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_activate_queued boolean DEFAULT false;
