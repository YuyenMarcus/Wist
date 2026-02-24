-- User's preferred display currency
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';

-- Original currency the item was scraped in
ALTER TABLE items ADD COLUMN IF NOT EXISTS original_currency text DEFAULT 'USD';
