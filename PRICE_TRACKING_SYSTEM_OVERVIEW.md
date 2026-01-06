# 🎯 Price Tracking System - Complete Overview

## 📋 Table of Contents
1. [Backend Architecture](#backend-architecture)
2. [Database Schema](#database-schema)
3. [Frontend Components](#frontend-components)
4. [Scraping Service](#scraping-service)
5. [Cron Jobs & Automation](#cron-jobs--automation)
6. [Current Pain Points](#current-pain-points)
7. [Configuration](#configuration)

---

## 🔧 Backend Architecture

### **Tech Stack**
- **Frontend**: Next.js 14 (React 18)
- **Backend**: Next.js API Routes (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Scraping Service**: Python Flask + Scrapy + Playwright
- **Deployment**: 
  - Frontend: Vercel
  - Scraper Service: Railway (or similar Docker platform)

### **API Routes**

#### 1. **Price Check Cron Job** (`app/api/cron/check-prices/route.ts`)
**Purpose**: Automated price checking for all active items

**Key Features**:
- ✅ Batch processing (50 items per batch, max 200 per run)
- ✅ Rate limiting (1 hour minimum between runs)
- ✅ Uses SERVICE_ROLE_KEY to bypass RLS
- ✅ Updates `items.current_price` when price changes
- ✅ Logs price changes to `price_history` table
- ✅ 2-second delay between items (polite scraping)

**Flow**:
```
1. Fetch active items (status='active', ordered by updated_at ASC)
2. For each item:
   - Call scrapeProduct(item.url)
   - Compare newPrice vs oldPrice
   - If different:
     - Update items.current_price
     - Insert into price_history
3. Return summary (checked count, updates count)
```

**Rate Limiting**:
- Checks `price_history.created_at` to determine last run time
- Prevents runs within 1 hour of each other
- Returns 429 status if too soon

**Current Issues**:
- ⚠️ Manual trigger only (no automatic scheduling)
- ⚠️ Limited to 200 items per run
- ⚠️ Simple rate limiting (could use Redis)

---

#### 2. **Item Creation API** (`app/api/items/route.ts`)
**Purpose**: Create new wishlist items (with optional scraping)

**Key Features**:
- ✅ Accepts data from browser extension OR manual dashboard input
- ✅ Falls back to server-side scraping if no extension data
- ✅ Creates entries in both `products` (catalog) and `items` (user wishlist)
- ✅ Handles authentication via cookies or headers

**Flow**:
```
1. Authenticate user (cookie or header)
2. If extension data provided:
   - Use extension data directly
3. Else if URL provided:
   - Call scrapeProduct(url) server-side
4. Create/update products table (catalog)
5. Create items table entry (user wishlist)
6. Return created item
```

---

#### 3. **Product Fetch API** (`pages/api/fetch-product.ts`)
**Purpose**: Fetch product data from URL (used by dashboard)

**Key Features**:
- ✅ Checks Supabase cache first (products table)
- ✅ Falls back to Flask scraper service (`http://localhost:5000`)
- ✅ Returns formatted product data

**Flow**:
```
1. Check products table for cached data (< 6 hours old)
2. If cache hit: return cached data
3. Else: POST to Flask service /api/scrape/sync
4. Save to products table (cache)
5. Return formatted response
```

**Current Issues**:
- ⚠️ Hardcoded `localhost:5000` (needs environment variable)
- ⚠️ No async job support (only sync scraping)

---

## 🗄️ Database Schema

### **Tables Overview**

#### 1. **`items` Table** (User Wishlist Items)
```sql
CREATE TABLE items (
  id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  
  -- Product Info
  title text NOT NULL,
  url text NOT NULL,
  current_price numeric,        -- Current price (for display)
  image_url text,
  retailer text,
  note text,
  
  -- User & Collection
  user_id uuid NOT NULL REFERENCES auth.users(id),
  collection_id uuid REFERENCES collections(id),  -- NEW: Collection support
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'purchased')),
  updated_at timestamptz
);
```

**Key Points**:
- ✅ Stores user-specific wishlist items
- ✅ Links to `collections` table (for organization)
- ✅ `current_price` is the latest price (numeric for calculations)
- ✅ `status` determines if item is active or purchased

---

#### 2. **`price_history` Table** (Price Tracking)
```sql
CREATE TABLE price_history (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

**Key Points**:
- ✅ One entry per price check (even if price unchanged)
- ✅ Cascades delete when item is deleted
- ✅ Used for price charts and drop notifications
- ✅ Currently limited to 100 entries or 90 days (optimization)

**Indexes**:
- `idx_price_history_item_id` - Fast lookups by item
- `idx_price_history_created_at` - Time-based queries

---

#### 3. **`products` Table** (Global Catalog)
```sql
CREATE TABLE products (
  id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  
  -- Product Info
  url text NOT NULL UNIQUE,     -- Unique URL (prevents duplicates)
  title text,
  price text,                   -- Current price (string)
  price_raw text,               -- Raw price string ("$19.99")
  image text,
  description text,
  domain text,
  
  -- Caching
  last_scraped timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb,
  
  -- User & Ownership
  user_id text,                 -- Original creator
  reserved_by text,             -- Reservation system
  reserved_at timestamptz,
  
  -- Sharing
  is_public boolean DEFAULT false,
  share_token text
);
```

**Key Points**:
- ✅ Global catalog (shared across users)
- ✅ URL is unique (one product = one row)
- ✅ Caching: `last_scraped` tracks when data was fetched
- ✅ Used as cache for scraping (6-hour TTL)

---

## 🎨 Frontend Components

### **1. Item Detail Page** (`app/dashboard/item/[id]/page.tsx`)
**Purpose**: Display item details with price history chart

**Features**:
- ✅ Fetches item from `items` or `products` table
- ✅ Fetches price history (last 100 entries or 90 days)
- ✅ Displays price chart using Recharts
- ✅ Shows price change (▲/▼) vs first recorded price
- ✅ "Buy Now" button linking to product URL

**Price History Query**:
```typescript
const { data: historyData } = await supabase
  .from('price_history')
  .select('price, created_at')
  .eq('item_id', itemId)
  .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
  .order('created_at', { ascending: true })
  .limit(100);
```

**Chart Library**: Recharts (`recharts` package)
- LineChart with price over time
- X-axis: Date (MM/DD format)
- Y-axis: Price ($XX.XX format)
- Tooltip shows full date and price

**Current Issues**:
- ⚠️ Shows "Not enough data points yet" if history is empty
- ⚠️ No manual price refresh button
- ⚠️ Chart may be empty if cron hasn't run yet

---

### **2. Item Card** (`components/wishlist/ItemCard.tsx`)
**Purpose**: Display item in timeline/grid view

**Features**:
- ✅ Shows current price badge
- ✅ "History" button → links to `/dashboard/item/[id]`
- ✅ "Buy" button → external link to product URL
- ✅ Hover actions (edit, delete, move to collection)

**Price Display**:
- Shows `item.price` or `item.current_price` formatted as `$${price}`
- Falls back to "N/A" if no price

---

## 🕷️ Scraping Service

### **Python Flask Service** (`scraper-service/app.py`)

**Tech Stack**:
- Flask (web framework)
- Scrapy (web scraping framework)
- Playwright (browser automation fallback)
- Crochet (Twisted reactor management)

**Endpoints**:

#### 1. **`POST /api/scrape/sync`** (Synchronous Scraping)
**Purpose**: Fast scraping for simple sites

**Flow**:
```
1. Check Supabase cache (products table, < 6 hours old)
2. If cache hit: return cached data
3. Else:
   - Try Scrapy scraper (fast, structured data)
   - If fails: Try Playwright (slow, but handles JS/CAPTCHA)
4. Save to products table (cache)
5. Return result
```

**Response**:
```json
{
  "success": true,
  "result": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "image": "https://...",
    "description": "...",
    "domain": "amazon.com"
  }
}
```

#### 2. **`POST /api/scrape`** (Async Scraping)
**Purpose**: Long-running scraping jobs (for complex sites)

**Flow**:
```
1. Create job_id (UUID)
2. Start Scrapy spider in background
3. Return job_id immediately (202 Accepted)
4. Client polls /api/job/<job_id> for status
```

**Response**:
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "url": "https://...",
  "message": "Job created, polling /api/job/<job_id> for status"
}
```

#### 3. **`GET /api/job/<job_id>`** (Job Status)
**Purpose**: Check async job status

**Response (Pending)**:
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "url": "https://...",
  "created_at": "2024-01-01T00:00:00"
}
```

**Response (Completed)**:
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "result": { ... },
  "completed_at": "2024-01-01T00:00:00"
}
```

---

### **Node.js Scraper** (`lib/scraper.ts`)
**Purpose**: Simple server-side scraping (fallback)

**Features**:
- ✅ Uses Cheerio (HTML parsing)
- ✅ Axios for HTTP requests
- ✅ Amazon-specific selectors
- ✅ 10-second timeout

**Current Limitations**:
- ⚠️ Only works for Amazon (hardcoded selectors)
- ⚠️ No CAPTCHA handling
- ⚠️ No JavaScript rendering (fails on SPAs)

**Selectors**:
```typescript
const priceSelectors = [
  '.a-price .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '.a-price-whole',
  '#corePrice_feature_div .a-offscreen'
];
```

---

## ⏰ Cron Jobs & Automation

### **Current Setup**

#### **Manual Cron Endpoint** (`/api/cron/check-prices`)
**Trigger**: Manual HTTP GET request

**How to Run**:
```bash
# Local
curl http://localhost:3000/api/cron/check-prices

# Production (Vercel)
curl https://your-app.vercel.app/api/cron/check-prices
```

**Scheduling Options**:
1. **Vercel Cron Jobs** (recommended)
   - Add to `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/check-prices",
       "schedule": "0 */6 * * *"
     }]
   }
   ```
   - Runs every 6 hours

2. **External Cron Service** (cron-job.org, EasyCron)
   - Set up HTTP GET request to your endpoint
   - Schedule: Every 6-12 hours

3. **GitHub Actions** (free, but limited)
   - Create `.github/workflows/price-check.yml`
   - Runs on schedule (limited to public repos)

**Current Status**: ⚠️ **NOT AUTOMATED** - Manual trigger only

---

### **Cleanup Cron** (`app/api/cron/cleanup/route.ts`)
**Purpose**: Clean up old data

**Tasks**:
- ✅ Delete price_history older than 90 days
- ✅ Clean up orphaned records

**Status**: ⚠️ Manual trigger only

---

## 🐛 Current Pain Points

### **1. Price Tracking Not Automated**
**Issue**: Cron job exists but isn't scheduled
- ✅ Code is ready (`/api/cron/check-prices`)
- ❌ No automatic scheduling
- ❌ Manual trigger only

**Solution**: Set up Vercel Cron or external cron service

---

### **2. Scraper Service Not Deployed**
**Issue**: Flask service runs on `localhost:5000`
- ✅ Code is ready (`scraper-service/`)
- ❌ Not deployed to production
- ❌ Frontend can't reach it in production

**Solution**: Deploy to Railway, Fly.io, or Render

---

### **3. Price History May Be Empty**
**Issue**: Chart shows "Not enough data points yet"
- ✅ Database schema is correct
- ✅ Cron job logs to `price_history`
- ❌ If cron hasn't run, history is empty

**Solution**: 
- Run cron job manually first
- Add "Refresh Price" button to item detail page

---

### **4. Scraping Failures**
**Issue**: Amazon blocks scrapers (CAPTCHA, bot detection)
- ✅ Playwright fallback exists
- ⚠️ May still fail on heavily protected sites
- ⚠️ No retry logic

**Solution**:
- Add retry logic with exponential backoff
- Use proxy rotation (future)
- Consider API alternatives (Keepa, Amazon Product API)

---

### **5. Rate Limiting**
**Issue**: Simple rate limiting (checks `price_history.created_at`)
- ✅ Prevents accidental spam
- ⚠️ Not production-grade (should use Redis)

**Solution**: 
- Add Redis for distributed rate limiting
- Or use Supabase Edge Functions with KV storage

---

## ⚙️ Configuration

### **Environment Variables**

#### **Frontend (.env.local)**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For cron jobs

# Scraper Service (if deployed)
SCRAPER_SERVICE_URL=https://your-scraper.railway.app
# Or local:
# SCRAPER_SERVICE_URL=http://localhost:5000
```

#### **Scraper Service (.env)**
```bash
# Supabase (for caching)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...  # Service role key

# Flask
FLASK_ENV=production
FLASK_DEBUG=False
```

---

### **Supported Retailers**

**Currently Supported**:
- ✅ Amazon (primary focus)
- ⚠️ Others (generic selectors, may not work well)

**Scraping Methods**:
1. **Structured Data** (fast, works for most sites)
2. **Scrapy** (medium speed, handles most sites)
3. **Playwright** (slow, handles JS/CAPTCHA)

**Future Support**:
- Target
- Best Buy
- Walmart
- eBay
- Etsy

---

## 📊 Data Flow Summary

### **Adding an Item**:
```
User adds URL → Extension/Dashboard
  ↓
POST /api/items
  ↓
Check products table (cache)
  ↓
If not cached: Scrape (Flask service or lib/scraper.ts)
  ↓
Save to products table (catalog)
  ↓
Create items table entry (user wishlist)
  ↓
Return item to frontend
```

### **Price Checking**:
```
Cron job triggers (manual or scheduled)
  ↓
GET /api/cron/check-prices
  ↓
Fetch active items (batch of 50)
  ↓
For each item:
  - Scrape current price
  - Compare with DB price
  - If different:
    - Update items.current_price
    - Insert into price_history
  ↓
Return summary
```

### **Viewing Price History**:
```
User clicks "History" button
  ↓
Navigate to /dashboard/item/[id]
  ↓
Fetch item from items/products table
  ↓
Fetch price_history (last 100 entries or 90 days)
  ↓
Format data for Recharts
  ↓
Display chart
```

---

## 🚀 Next Steps

### **Immediate Fixes**:
1. ✅ Set up Vercel Cron for `/api/cron/check-prices`
2. ✅ Deploy Flask scraper service to Railway
3. ✅ Add "Refresh Price" button to item detail page
4. ✅ Test end-to-end flow (add item → wait for cron → check history)

### **Future Enhancements**:
1. Add price drop notifications (email/push)
2. Add more retailer support
3. Add proxy rotation for scraping
4. Add retry logic with exponential backoff
5. Add Redis for job queue and rate limiting
6. Add price alerts (notify when price drops below threshold)

---

## 📝 Notes

- **Price History Retention**: Currently 90 days or 100 entries (whichever comes first)
- **Cron Frequency**: Recommended every 6-12 hours (balance between freshness and rate limits)
- **Batch Size**: 50 items per batch (prevents timeout)
- **Max Items**: 200 per run (prevents timeout, processes in multiple runs)

---

**Last Updated**: 2024-12-19
**Status**: ✅ Backend ready, ⚠️ Needs deployment & automation

