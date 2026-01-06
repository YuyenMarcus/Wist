# Admin User Setup Guide

This guide shows you how to create an admin user for testing with email verification bypassed.

## Admin Credentials
- **Email:** julien@nitron.digital
- **Password:** JulienAdam0!
- **Email Verification:** Bypassed (auto-confirmed)

## Method 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Users** (in the left sidebar)
4. Click **"Add User"** → **"Create new user"**
5. Fill in the form:
   - **Email:** `julien@nitron.digital`
   - **Password:** `JulienAdam0!`
   - **Auto Confirm User:** ✅ **Check this box** (this bypasses email verification)
6. Click **"Create User"**
7. Done! The user can now log in immediately.

## Method 2: Using npm Script

1. Make sure you have a `.env.local` file in the project root with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Run the script:
   ```bash
   npm run create-admin
   ```

3. The script will:
   - Create the user if it doesn't exist
   - Update the user if it already exists
   - Set email as confirmed (bypass verification)
   - Set the password

## Method 3: Using API Endpoint

If your Next.js server is running and environment variables are set:

```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/create-user" -Method POST -ContentType "application/json"

# Or using curl (if available)
curl -X POST http://localhost:3000/api/admin/create-user
```

## Verification

After creating the user, you can verify it works:

1. Go to `http://localhost:3000/login`
2. Enter:
   - Email: `julien@nitron.digital`
   - Password: `JulienAdam0!`
3. You should be able to log in immediately without email verification.

## Troubleshooting

### "Missing Supabase credentials" error
- Make sure `.env.local` exists in the project root
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Restart your dev server after adding environment variables

### User already exists but can't log in
- The user might not be confirmed. Use Method 1 (Dashboard) to check "Auto Confirm User"
- Or run the npm script which will update the existing user

### Password doesn't work
- The script/API will update the password. Try running it again.
- Or reset the password in Supabase Dashboard → Authentication → Users

## Security Note

⚠️ **Important:** The service role key has full access to your Supabase project. Never commit it to git or expose it publicly. It should only be used in server-side code or scripts.

