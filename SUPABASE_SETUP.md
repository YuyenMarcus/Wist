# Supabase Setup Guide

## Step 1: Create the Table in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno
2. Click **SQL Editor** (icon on the left that looks like a terminal `>_`)
3. Click **New Query**
4. Copy and paste the SQL from `supabase-schema.sql`
5. Click **Run** (bottom right)
6. You should see **Success** in the results

## Step 2: Get Your Service Role Key

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy the `service_role` key (⚠️ **Keep this secret!**)
3. Add it to your `.env.local` file:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 3: Configure Flask Service (Optional)

If you're using the Python Flask scraper service, create a `.env` file in the `scraper-service/` directory:

```bash
# scraper-service/.env
SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
SUPABASE_KEY=your-service-role-key-here
```

Then install dependencies:
```bash
cd scraper-service
pip install -r requirements.txt
```

## Step 4: How It Works

### Caching Logic

1. **Check Cache First**: When a product URL is requested, the system checks Supabase for cached data
2. **Cache Freshness**: If found and less than 6 hours old, return cached data immediately
3. **Scrape if Needed**: If not cached or expired, scrape the product
4. **Save to Cache**: After scraping, save the result to Supabase for future requests

### Benefits

✅ **Protect from Bans**: If 50 people check the same Amazon product, you only scrape it once  
✅ **Faster Responses**: Cached products return instantly  
✅ **Data Persistence**: Products are saved even if users close the tab  
✅ **Price Tracking**: Can track price history over time  

## Step 5: Test It

1. Make sure your `.env.local` has:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)

2. Restart your dev server:
   ```bash
   npm run dev
   ```

3. Try scraping a product URL - the first request will scrape, subsequent requests within 6 hours will use cache!

## Troubleshooting

### "Supabase not configured" warning
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Restart your dev server after adding environment variables

### Cache not working
- Check Supabase Dashboard → Table Editor → `products` table
- Verify the table was created successfully
- Check browser console for any errors

### Flask service cache not working
- Make sure `scraper-service/.env` exists with `SUPABASE_URL` and `SUPABASE_KEY`
- Check Flask service logs for Supabase connection messages

