-- Add bio column to profiles table with character limit constraint
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio text;

-- Add check constraint to enforce 150 character limit
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_bio_length_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_bio_length_check 
CHECK (char_length(bio) <= 150);

