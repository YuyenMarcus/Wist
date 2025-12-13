# Supabase Auth Configuration

## ⚠️ IMPORTANT: Update Supabase Redirect URLs

You must configure Supabase to use your custom domain for auth redirects.

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno
2. Go to **Authentication** → **URL Configuration**

### Step 2: Update Site URL
Set **Site URL** to:
```
https://wishlist.nuvio.cloud
```

### Step 3: Add Redirect URLs
Add these to **Redirect URLs** (one per line):
```
https://wishlist.nuvio.cloud/auth/callback
https://wishlist.nuvio.cloud/dashboard
https://wishlist.nuvio.cloud/login
https://wishlist.nuvio.cloud/signup
```

### Step 4: Save Changes
Click **Save** to apply the changes.

---

## Why This Matters

- **Email confirmation links** will redirect to `wishlist.nuvio.cloud` instead of Vercel preview URLs
- **OAuth callbacks** will work correctly
- **Magic links** will redirect properly
- **Sign out** will redirect correctly

---

## Testing

After updating:
1. Try signing up - you should get an email
2. Click the confirmation link - it should redirect to `wishlist.nuvio.cloud` and confirm your email
3. Try signing in - it should redirect to the dashboard

