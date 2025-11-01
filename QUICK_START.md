# Quick Start Guide

Get Wist running in 5 minutes.

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

## Step 1: Clone & Install

```bash
git clone <your-repo-url>
cd wist
npm install
npx playwright install --with-deps
```

## Step 2: Set Up Supabase

1. Go to https://supabase.com and create a project
2. Open SQL Editor
3. Copy and paste the contents of `supabase/schema.sql`
4. Run the SQL
5. Go to Settings → API
6. Copy your Project URL and anon key

## Step 3: Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
NODE_ENV=development
```

## Step 4: Run

```bash
npm run dev
```

Visit http://localhost:3000

## Step 5: Test

Try pasting a product URL:
- Amazon: `https://www.amazon.com/dp/B08N5WRWNW`
- Best Buy: Any product page
- Target: Any product page

## What's Next?

- See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- See [RUNBOOK.md](./RUNBOOK.md) for operational guide

## Troubleshooting

**Playwright install fails:**
```bash
# On Windows, you may need Visual C++ Redistributable
# Download from Microsoft

# On Linux/Mac, ensure dependencies are installed
npx playwright install-deps
```

**Supabase connection errors:**
- Verify your `.env.local` file has correct values
- Check Supabase dashboard → Settings → API
- Ensure RLS policies are created (from schema.sql)

**Scraper returns 403:**
- Some sites block automated access
- Try a different product URL
- Use the "Manual Add" option if available
