-- Allow each authenticated user to read their own profile row (full row, including subscription_tier).
-- Without this, RLS may only allow SELECT when username IS NOT NULL (public profile policy),
-- so users with no username get zero rows from profiles → API treats them as free → 20-item cap.
--
-- Run in Supabase → SQL Editor. Safe to run more than once.

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

COMMENT ON POLICY "Users can read own profile" ON public.profiles IS
  'Lets each user SELECT their own row so subscription_tier and settings work with the anon/JWT client.';
