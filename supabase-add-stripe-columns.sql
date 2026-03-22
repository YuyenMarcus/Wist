-- Stripe Customer Portal + Checkout: link Stripe customer to Supabase profile.
-- Run in Supabase SQL Editor (or migrate) before enabling billing.

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_subscription_id text;

-- One Stripe customer per profile (enforced when not null)
create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id (cus_...) for Billing Portal';
comment on column public.profiles.stripe_subscription_id is 'Active Stripe Subscription id (sub_...), if any';
