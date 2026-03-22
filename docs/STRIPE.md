# Stripe billing setup

## 1. Environment variables

Add these in **Vercel** (and `.env.local` for development):

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Secret key from [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from the webhook endpoint (`whsec_...`) |
| `STRIPE_PRICE_PRO` | **Price ID** for Wist Pro recurring price (`price_...`) |
| `STRIPE_PRICE_CREATOR` | **Price ID** for Wist Creator recurring price (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL, e.g. `https://your-domain.com` (used for Checkout / Portal return URLs) |

Optional: `VERCEL_URL` is used as a fallback if `NEXT_PUBLIC_APP_URL` is unset (not ideal for production).

## 2. Database

Run `supabase-add-stripe-columns.sql` in the Supabase SQL editor so `profiles` has:

- `stripe_customer_id`
- `stripe_subscription_id`

## 3. Stripe Dashboard

1. **Products** → create **Pro** and **Creator** products with **recurring** monthly prices. Copy each **Price ID** into `STRIPE_PRICE_PRO` and `STRIPE_PRICE_CREATOR`.

2. **Customer portal**  
   [Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal) — enable so users can update payment methods and cancel.

3. **Webhooks**  
   Add endpoint: `https://YOUR_DOMAIN/api/webhooks/stripe`  
   Events to send:

   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

4. Local testing: use [Stripe CLI](https://stripe.com/docs/stripe-cli):

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` locally.

## 4. App routes

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Body `{ "tier": "pro" \| "creator" }` — returns `{ url }` for Checkout |
| `POST /api/stripe/portal` | Opens Billing Portal (requires existing `stripe_customer_id`) |
| `POST /api/stripe/verify-session` | Body `{ "sessionId": "cs_..." }` — syncs tier after redirect |
| `POST /api/webhooks/stripe` | Stripe webhook (raw body, signature verified) |

User-facing page: **`/dashboard/subscription`**.

## 5. Tier mapping

Active subscription prices are mapped via env:

- Price matching `STRIPE_PRICE_PRO` → `profiles.subscription_tier = 'pro'`
- Price matching `STRIPE_PRICE_CREATOR` → `'creator'`
- Canceled / ended subscription → `'free'` (unless tier is `enterprise`, which is never downgraded by Stripe)

`enterprise` is intended for manual / sales-led accounts.
