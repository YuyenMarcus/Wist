-- Ensure the username column exists and has a unique constraint
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username text;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;

-- Create an index for faster lookups since we'll query this often
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles (username) WHERE username IS NOT NULL;

