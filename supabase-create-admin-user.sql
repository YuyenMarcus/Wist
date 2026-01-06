-- SQL Script to create admin user in Supabase
-- Run this in Supabase Dashboard → SQL Editor
-- 
-- This creates a user with email verification bypassed
-- Email: julien@nitron.digital
-- Password: JulienAdam0!

-- Note: This uses Supabase's auth.users table directly
-- The user will be created with email_confirmed_at set to now()

DO $$
DECLARE
  v_user_id uuid;
  v_user_email text := 'julien@nitron.digital';
  v_user_password text := 'JulienAdam0!';
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_user_email;

  IF v_user_id IS NOT NULL THEN
    -- Update existing user
    UPDATE auth.users
    SET 
      email_confirmed_at = now(),
      encrypted_password = crypt(v_user_password, gen_salt('bf')),
      updated_at = now(),
      raw_user_meta_data = jsonb_build_object(
        'role', 'admin',
        'updated_by', 'admin-setup-sql'
      ) || COALESCE(raw_user_meta_data, '{}'::jsonb)
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Admin user updated: %', v_user_email;
  ELSE
    -- Create new user
    -- Note: We need to use Supabase's auth functions
    -- This is a simplified version - you may need to use the Supabase Admin API instead
    RAISE NOTICE 'User does not exist. Please use the Supabase Admin API or Dashboard to create the user.';
    RAISE NOTICE 'Alternatively, run: npm run create-admin (after setting up .env.local)';
  END IF;
END $$;

-- Alternative: Use Supabase's built-in function (if available)
-- This is a template - actual implementation depends on your Supabase version
-- 
-- To create the user properly, you have two options:
--
-- Option 1: Use Supabase Dashboard
-- 1. Go to Authentication → Users
-- 2. Click "Add User" → "Create new user"
-- 3. Enter email: julien@nitron.digital
-- 4. Enter password: JulienAdam0!
-- 5. Check "Auto Confirm User" (this bypasses email verification)
-- 6. Click "Create User"
--
-- Option 2: Use the npm script (recommended)
-- 1. Make sure .env.local has:
--    NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
--    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
-- 2. Run: npm run create-admin

