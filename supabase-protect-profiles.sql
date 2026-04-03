-- ============================================================
-- SECURITY: Protect sensitive profile fields from client-side manipulation
-- ============================================================
-- 
-- Problem: The anon key is public. A malicious user with their JWT can
-- call supabase.from('profiles').update({ is_admin: true }) directly,
-- bypassing the API's safeFields whitelist.
--
-- Fix: A BEFORE UPDATE trigger that forces sensitive columns to keep
-- their old values unless the caller is the service_role (used by
-- admin APIs, Stripe webhooks, and cron jobs).
--
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Ensure UPDATE policy exists (users can only update their own row)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

-- 3. Trigger function: lock sensitive fields for non-service-role callers
CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
RETURNS TRIGGER AS $$
DECLARE
  current_role text := coalesce(current_setting('role', true), '');
BEGIN
  -- Allow writes from: service_role (API admin/cron/stripe),
  -- postgres/supabase_admin (Dashboard SQL editor), and superusers.
  IF current_role NOT IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin', 'dashboard_user')
     AND NOT (SELECT usesuper FROM pg_user WHERE usename = current_role)
  THEN
    NEW.is_admin        := OLD.is_admin;
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.is_banned       := OLD.is_banned;
    NEW.tier_downgraded_at := OLD.tier_downgraded_at;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger
DROP TRIGGER IF EXISTS protect_profiles_sensitive_fields ON profiles;
CREATE TRIGGER protect_profiles_sensitive_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_sensitive_profile_fields();

-- 5. Column-level revokes as additional defense
-- Even if trigger is somehow dropped, these prevent direct column updates
DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE (is_admin) ON profiles FROM authenticated, anon';
  EXECUTE 'REVOKE UPDATE (subscription_tier) ON profiles FROM authenticated, anon';
  EXECUTE 'REVOKE UPDATE (is_banned) ON profiles FROM authenticated, anon';
  EXECUTE 'REVOKE UPDATE (tier_downgraded_at) ON profiles FROM authenticated, anon';
  EXECUTE 'REVOKE UPDATE (stripe_customer_id) ON profiles FROM authenticated, anon';
  EXECUTE 'REVOKE UPDATE (stripe_subscription_id) ON profiles FROM authenticated, anon';
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Some columns do not exist yet — skipping those revokes';
END $$;
