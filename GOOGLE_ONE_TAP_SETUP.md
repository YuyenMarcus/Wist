# Google One Tap Setup Guide

## Step 1: Get Your Google Client ID from Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno
2. Navigate to: **Authentication** → **Providers** → **Google**
3. Copy your **Client ID** (it should look like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)

## Step 2: Add Client ID to Environment Variables

### For Local Development (.env.local)

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### For Vercel Production

1. Go to: https://vercel.com/dashboard
2. Select your project: **wist**
3. Go to: **Settings** → **Environment Variables**
4. Add:
   - **Name**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - **Value**: Your Google Client ID from Supabase
   - **Environments**: Check all (Production, Preview, Development)
5. Click **Save**

## Step 3: Verify Setup

After adding the environment variable:

1. **Restart your dev server** (if running locally):
   ```bash
   npm run dev
   ```

2. **Redeploy to Vercel** (if deploying):
   ```bash
   vercel --prod
   ```

3. **Test Google One Tap**:
   - Visit your login page: `https://wishlist.nuvio.cloud/login`
   - You should see a Google One Tap notification slide down from the top
   - Click it to sign in with Google

## Troubleshooting

### "One Tap not showing up?"

**Common reasons:**

1. **Localhost vs IP Address**: 
   - ✅ Use: `http://localhost:3000`
   - ❌ Don't use: `http://127.0.0.1:3000`
   - Google blocks IP addresses

2. **Cooldown Period**:
   - If you dismissed it before, Google hides it for a few hours
   - **Solution**: Open in **Incognito Mode** to test

3. **Client ID Mismatch**:
   - Make sure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` matches exactly what's in Supabase
   - Check for extra spaces or typos

4. **Not Logged Out**:
   - One Tap only shows for logged-out users
   - Make sure you're signed out before testing

5. **Browser Console Errors**:
   - Open browser DevTools (F12) → Console
   - Look for error messages
   - Common errors:
     - `"invalid_client"` → Client ID is wrong
     - `"unregistered_origin"` → Domain not added to Google OAuth settings
     - `"browser_not_supported"` → Browser doesn't support One Tap

### "One Tap shows but sign-in fails?"

1. **Check Supabase Google Provider Settings**:
   - Make sure Google provider is **enabled** in Supabase
   - Verify Client ID and Client Secret are correct
   - Check redirect URLs are configured

2. **Check Browser Console**:
   - Look for authentication errors
   - Verify the token is being sent correctly

## Where One Tap Appears

Google One Tap is now integrated on:

- ✅ **Homepage** (`/`) - Only for logged-out users
- ✅ **Login Page** (`/login`) - Always shows for logged-out users
- ✅ **Signup Page** (`/signup`) - Always shows for logged-out users

## Features

- **Auto-detection**: Only shows for logged-out users
- **Smart hiding**: Automatically hides if user is already logged in
- **Error handling**: Logs errors to console for debugging
- **TypeScript support**: Fully typed for better development experience

## Next Steps

After setup, you can:

1. Test the One Tap flow end-to-end
2. Monitor user adoption in Supabase Dashboard → Authentication → Users
3. Customize the appearance (if needed) in the GoogleOneTap component
