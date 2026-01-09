# Vercel Deployment Guide

This guide will help you deploy your Wist application to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Your Supabase project URL and keys
3. (Optional) Your scraper service URL if using external service

## Quick Deploy via Vercel CLI

### 1. Install Vercel CLI (if not already installed)

```bash
npm i -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy to Vercel

From your project root directory:

```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account/team
- **Link to existing project?** → No (for first deployment)
- **Project name?** → `wist` (or your preferred name)
- **Directory?** → `./` (current directory)
- **Override settings?** → No

### 4. Set Environment Variables

After deployment, you'll need to add environment variables:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Or add them via the Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable for **Production**, **Preview**, and **Development**

### 5. Deploy to Production

```bash
vercel --prod
```

## Deploy via Vercel Dashboard (Web UI)

### 1. Push Your Code to GitHub

Make sure your code is pushed to a GitHub repository.

### 2. Import Project in Vercel

1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### 3. Add Environment Variables

Before deploying, add these environment variables in the Vercel dashboard:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Optional (but recommended):**
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side operations
- `SCRAPER_SERVICE_URL` - If using external scraper service
- `CRON_SECRET` - Secret for cron job authentication (generate a random string)

**How to add:**
1. In project settings, go to **Environment Variables**
2. Click **Add** for each variable
3. Select environments: **Production**, **Preview**, **Development**
4. Save

### 4. Deploy

Click **Deploy** and wait for the build to complete.

## Environment Variables Reference

### Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Optional Variables

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SCRAPER_SERVICE_URL=https://your-scraper-service.railway.app
CRON_SECRET=your-random-secret-string-here
```

## Post-Deployment Checklist

- [ ] Verify your site is accessible at `https://your-project.vercel.app`
- [ ] Test authentication (sign up/login)
- [ ] Test adding items to wishlist
- [ ] Test extension integration (update extension manifest with production URL)
- [ ] Set up custom domain (optional)
- [ ] Configure cron jobs (already set in `vercel.json`)

## Cron Jobs

Your `vercel.json` already includes cron job configuration:
- `/api/cron/check-prices` - Runs daily at midnight UTC

Make sure to:
1. Enable cron jobs in Vercel Dashboard → Settings → Cron Jobs
2. Set `CRON_SECRET` environment variable
3. Verify cron endpoint is protected with the secret

## Troubleshooting

### Build Fails

- **Error: Playwright not found** → Playwright is excluded from client bundle, this is expected
- **Error: Missing environment variables** → Add all required env vars in Vercel dashboard
- **Error: Module not found** → Check that all dependencies are in `package.json`

### Runtime Errors

- **CORS errors** → Check that CORS headers are configured in `next.config.js`
- **Database connection errors** → Verify Supabase URL and keys are correct
- **Authentication errors** → Check Supabase auth configuration

### Extension Not Working

1. Update `wist-extension/manifest.json` with production URL:
   ```json
   "host_permissions": [
     "https://your-project.vercel.app/*"
   ]
   ```
2. Update `wist-extension/background.js` with production API URL:
   ```javascript
   const API_BASE_URL = "https://your-project.vercel.app";
   ```

## Next Steps

1. **Set up custom domain** (optional):
   - Go to Project Settings → Domains
   - Add your custom domain
   - Update DNS records as instructed

2. **Enable Analytics** (optional):
   - Vercel Analytics is available in the dashboard
   - Enable for production monitoring

3. **Set up monitoring**:
   - Consider adding error tracking (Sentry, etc.)
   - Monitor API usage and performance

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Discord: https://vercel.com/discord
