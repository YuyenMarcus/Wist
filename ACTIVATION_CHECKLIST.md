# 🚀 Supabase Activation Checklist

## ✅ Step 1: Create the Database Table

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno
2. Click **SQL Editor** (terminal icon `>_` on the left sidebar)
3. Click **New Query**
4. Copy the SQL from `supabase-schema.sql` (or use the SQL below)
5. Click **Run** (bottom right)
6. You should see **Success** ✅

### Quick SQL (if you prefer to copy from here):

```sql
-- Create the 'products' table to store scraped data
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  url text not null unique,        -- The Amazon/Etsy URL (Unique ID)
  title text,
  price text,
  price_raw text,                  -- Stores "$19.99"
  image text,
  description text,
  domain text,                     -- 'amazon', 'etsy', etc.
  
  last_scraped timestamp with time zone default timezone('utc'::text, now())
);

-- Turn on Security (Row Level Security)
alter table products enable row level security;

-- 1. Allow Public to READ data (so your frontend can show products)
create policy "Public Read" on products
for select using (true);

-- 2. Allow Backend to INSERT/UPDATE (We will use the Service Role Key for this)
create policy "Service Write" on products
for all using (true) with check (true);
```

---

## ✅ Step 2: Get Your Service Role Key

1. In Supabase Dashboard, go to **Settings** (gear icon) → **API**
2. Copy the **Project URL** (should be: `https://ulmhmjqjtebaetocuhno.supabase.co`)
3. Scroll down to **Project API keys**
4. Find the **`service_role`** key (⚠️ **SECRET - Don't share publicly!**)
5. Copy it (starts with `eyJ...`)

---

## ✅ Step 3: Configure Flask Service

1. Open `scraper-service/.env` (I just created it for you)
2. Replace `your-service-role-key-here` with your actual service role key
3. Save the file

The file should look like:
```bash
SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbWhtanFqdGViYWV0b2N1aG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM5NTMwMywiZXhwIjoyMDgwOTcxMzAzfQ.xxxxx
```

4. Install dependencies:
```bash
cd scraper-service
pip install -r requirements.txt
```

---

## ✅ Step 4: Verify Next.js Environment

Check that `.env.local` has the service role key:

```bash
# Should contain:
NEXT_PUBLIC_SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (your anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (your service role key)
```

---

## ✅ Step 5: Test the Setup

### Test 1: Start Flask Service
```bash
cd scraper-service
python app.py
```

You should see:
```
✅ Supabase connected for caching
Starting Wist Scraper Service...
Service will be available at http://0.0.0.0:5000
```

### Test 2: Start Next.js (if not already running)
```bash
npm run dev
```

### Test 3: Test Product Fetching

1. Go to: http://localhost:3000/dashboard
2. Paste an Amazon URL (e.g., `https://www.amazon.com/dp/B08XYZ...`)
3. Click **Fetch**

**First Request:**
- Should take ~3-5 seconds (scraping)
- Check Flask terminal: Should see scraping logs
- Check Supabase Dashboard → **Table Editor** → `products` table
- You should see the product appear! ✅

**Second Request (same URL):**
- Should be **INSTANT** (< 0.5 seconds)
- Check Flask terminal: Should see `✅ Found in Cache (Database): ...`
- No scraping happens! ✅

---

## 🐛 Troubleshooting

### "Supabase not configured" warning
- Check that `scraper-service/.env` exists and has correct keys
- Restart Flask service after creating `.env`

### "Table not found" error
- Make sure you ran the SQL in Step 1
- Check Supabase Dashboard → Table Editor → `products` should exist

### Cache not working
- Check Flask terminal for Supabase connection message
- Verify service role key is correct (not anon key)
- Check Supabase Dashboard → Table Editor → `products` table has data

### Products not saving
- Check Flask terminal for errors
- Verify RLS policies are set correctly (Step 1)
- Check that service role key has write permissions

---

## 🎉 Success Indicators

✅ Flask service shows: `✅ Supabase connected for caching`  
✅ First scrape saves to Supabase (check Table Editor)  
✅ Second scrape is instant (cache hit)  
✅ Flask terminal shows: `✅ Found in Cache (Database): ...`

You're all set! 🚀

