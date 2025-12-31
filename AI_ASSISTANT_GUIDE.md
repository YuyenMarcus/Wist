# 🤖 AI Assistant Guide - Wist Project

**Complete documentation for AI assistants to understand and help with this codebase.**

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Authentication Flow](#authentication-flow)
5. [API Endpoints](#api-endpoints)
6. [Key Files & Their Purposes](#key-files--their-purposes)
7. [Common Patterns & Issues](#common-patterns--issues)
8. [Environment Variables](#environment-variables)
9. [Deployment](#deployment)
10. [Critical Gotchas](#critical-gotchas)

---

## 🎯 Project Overview

**Wist** is a wishlist management application built with:
- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth)
- **Scraping**: Playwright (with stealth plugin), Metascraper (fallback)
- **Deployment**: Vercel (frontend), Railway/Render (scraper service)

### Core Functionality
- Users can add products to their wishlist via URL
- Products are scraped for title, price, image, description
- Users can view, edit, and delete items from their dashboard
- Supports multiple retailers (Amazon, Best Buy, Target, etc.)

---

## 🏗️ Architecture

### **Two-Table System (CRITICAL)**

The project uses a **two-table architecture** that separates global product data from user-specific wishlist items:

#### 1. **`products` Table** (Global Catalog)
- **Purpose**: Shared product database (one product per URL)
- **Contains**: Product metadata (title, price, image, description, URL)
- **Key Point**: URL is UNIQUE - multiple users can reference the same product
- **Never Deleted**: When a user removes an item, the product stays in the catalog

#### 2. **`items` Table** (User's Personal Wishlist)
- **Purpose**: User's personal wishlist links
- **Contains**: Links to products + user-specific data (status, note, wishlist_id)
- **Key Point**: Multiple users can have the same product in their wishlist
- **Deleted on Remove**: When user clicks delete, only the `items` row is removed

### **The "Unlink" Strategy**

When a user deletes an item:
1. ✅ Delete from `items` table (removes user's link)
2. ❌ **NEVER** delete from `products` table (keeps catalog intact)
3. ✅ Other users' items remain unaffected
4. ✅ Product data preserved for future use

### **Data Flow**

```
User adds URL → Check products table → Found? Use data → Insert into items table
User adds URL → Check products table → Not found? Scrape → Insert into products + items
User deletes → Delete from items only → Product stays in catalog
```

---

## 🗄️ Database Schema

### **`products` Table** (Global Catalog)
```sql
- id (uuid, PK)
- url (text, UNIQUE) -- The product URL
- title (text)
- price (text) -- e.g. "19.99"
- price_raw (text) -- e.g. "$19.99"
- image (text) -- Image URL
- description (text)
- domain (text) -- e.g. "amazon.com"
- user_id (uuid, nullable) -- Legacy: some old items have this
- created_at (timestamp)
- last_scraped (timestamp)
- meta (jsonb) -- Additional metadata
- is_public (boolean) -- Public visibility
- share_token (text) -- Sharing token
- reserved_by (uuid, nullable) -- Who reserved/purchased
- reserved_at (timestamp, nullable)
```

### **`items` Table** (User Wishlist)
```sql
- id (uuid, PK)
- user_id (uuid, NOT NULL) -- Owner of this wishlist item
- url (text) -- Product URL (references products.url, not FK)
- title (text) -- Copied from product or custom
- current_price (numeric) -- Current price
- image_url (text) -- Image URL
- retailer (text) -- e.g. "Amazon"
- status (text) -- 'active' (wishlist) or 'purchased'
- note (text) -- User's personal note
- wishlist_id (uuid) -- Links to wishlists table
- created_at (timestamp)
```

### **`profiles` Table**
```sql
- id (uuid, PK, FK to auth.users)
- username (text, UNIQUE)
- full_name (text)
- avatar_url (text)
- bio (text)
- created_at (timestamp)
```

### **`wishlists` Table**
```sql
- id (uuid, PK)
- user_id (uuid, FK)
- title (text)
- visibility (text) -- 'private' or 'public'
- created_at (timestamp)
```

### **`price_history` Table**
```sql
- id (uuid, PK)
- item_id (uuid, FK to items)
- price (numeric)
- created_at (timestamp)
```

---

## 🔐 Authentication Flow

### **Two Auth Methods**

1. **Cookie-Based Auth** (Dashboard/Web)
   - Uses `@supabase/ssr` with Next.js cookies
   - Handled by `middleware.ts` (refreshes session)
   - Used in: Dashboard, account pages

2. **Bearer Token Auth** (Chrome Extension/API)
   - Uses `Authorization: Bearer <token>` header
   - Token obtained via `supabase.auth.getSession()`
   - Used in: Chrome extension, API calls

### **Middleware** (`middleware.ts`)
- **Critical**: Refreshes Supabase session on every request
- Ensures cookies are properly set/refreshed
- Matches all routes except static files

### **Auth Pattern in API Routes**

```typescript
// Pattern 1: Bearer Token (Extension)
const authHeader = request.headers.get('Authorization');
if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user } } = await supabase.auth.getUser();
}

// Pattern 2: Cookie-Based (Dashboard)
const supabase = createServerClient(URL, ANON_KEY, {
  cookies: { getAll, setAll }
});
const { data: { user } } = await supabase.auth.getUser();
```

---

## 🔌 API Endpoints

### **`POST /api/items`** (Main Add Item Endpoint)
- **Purpose**: Add item to user's wishlist
- **Auth**: Bearer token OR cookies
- **Flow**:
  1. Check if URL exists in `products` table
  2. If found → use existing product data
  3. If not found → scrape URL for product data
  4. Insert into `items` table (user's wishlist)
  5. Optionally insert into `products` table if new
- **Body**: `{ url, title?, price?, image_url?, status?, retailer? }`

### **`DELETE /api/delete-item?id=<item_id>`**
- **Purpose**: Remove item from user's wishlist
- **Auth**: Bearer token
- **Flow**:
  1. Verify user owns the item
  2. Delete from `items` table ONLY (unlink strategy)
  3. Handle legacy items in `products` table (cleanup)
- **Returns**: `{ success: true, count: 1 }`

### **`POST /api/items/add`** (Alternative Add Endpoint)
- **Purpose**: Similar to `/api/items` but different implementation
- **Auth**: Bearer token
- **Note**: Checks `products` table for existing URL

### **`GET /api/metadata?url=<url>`**
- **Purpose**: Fetch product metadata from URL
- **Returns**: Scraped product data

### **`POST /api/preview-link`**
- **Purpose**: Preview product before adding
- **Returns**: Product preview data

### **`POST /api/cron/check-prices`**
- **Purpose**: Batch price checking for all items
- **Auth**: Internal (cron job)

---

## 📁 Key Files & Their Purposes

### **Core Application Files**

#### **`app/dashboard/page.tsx`**
- Main dashboard component
- Fetches user's items via `getUserProducts()`
- Handles delete via `handleDelete()`
- Real-time subscriptions to `items` table
- **Key Function**: `fetchItems()` - refreshes item list

#### **`lib/supabase/products.ts`**
- **CRITICAL FILE**: All product/item database operations
- **`getUserProducts(userId)`**: Fetches from BOTH `items` and `products` tables
- Converts database format to `SupabaseProduct` interface
- Handles price conversion (string → number)
- **Note**: Currently queries both tables for backward compatibility

#### **`app/api/delete-item/route.ts`**
- Delete endpoint implementation
- Uses Service Role Key to bypass RLS
- Handles legacy items in `products` table
- Follows "unlink" strategy (never deletes from `products`)

#### **`app/api/items/route.ts`**
- Main add item endpoint
- Checks `products` table first
- Scrapes if product doesn't exist
- Inserts into `items` table

### **Configuration Files**

#### **`next.config.js`**
- **Critical**: Webpack config for Playwright/scraper dependencies
- Excludes server-only packages from client bundle
- Handles `.node` files (native modules)
- Configures dynamic requires for `clone-deep`, `merge-deep`

#### **`middleware.ts`**
- Refreshes Supabase session on every request
- Ensures cookies are properly set
- **Critical**: Without this, auth fails in API routes

#### **`package.json`**
- **Overrides**: Forces specific versions of `clone-deep` and `merge-deep`
- **Engines**: Requires Node >= 18.0.0

### **Scraper Files**

#### **`lib/scraper/index.ts`**
- Main scraper entry point
- Tries Playwright first, falls back to Metascraper
- Returns normalized product data

#### **`lib/scraper/playwright-scraper.ts`**
- Playwright-based scraper with stealth plugin
- Handles dynamic sites (Amazon, Best Buy, etc.)

#### **`lib/scraper/static-scraper.ts`**
- Metascraper-based scraper
- Handles static sites with Open Graph/JSON-LD

---

## 🐛 Common Patterns & Issues

### **1. Price Conversion**
- Database stores prices as `text` or `numeric`
- Frontend expects `number | null`
- **Pattern**: Always convert with `parseFloat()` and handle null/0

```typescript
let priceValue = null;
if (item.current_price !== null && item.current_price !== undefined) {
  const numPrice = typeof item.current_price === 'string' 
    ? parseFloat(item.current_price) 
    : Number(item.current_price);
  priceValue = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
}
```

### **2. Dual Table Queries**
- Dashboard needs to show items from BOTH tables (legacy support)
- **Pattern**: Query both in parallel, combine results

```typescript
const [itemsResult, productsResult] = await Promise.all([
  supabase.from('items').select('...').eq('user_id', userId),
  supabase.from('products').select('...').eq('user_id', userId)
]);
```

### **3. RLS (Row Level Security) Issues**
- Supabase RLS can block operations if user context is missing
- **Solution**: Use Service Role Key for admin operations OR pass user token in headers

```typescript
// For admin operations (delete, etc.)
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY);

// For user operations (with RLS)
const supabase = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

### **4. Column Name Mismatches**
- `items` table uses: `current_price`, `image_url`, `retailer`
- `products` table uses: `price`, `image`, `domain`
- **Pattern**: Map columns when converting between formats

### **5. Legacy Items**
- Some old items are in `products` table with `user_id`
- Delete endpoint handles these separately
- Dashboard queries both tables to show all items

---

## 🔑 Environment Variables

### **Required Variables**

```env
# Supabase (Public - Safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon/public key)

# Supabase (Secret - Server-only)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role key)
# ⚠️ CRITICAL: Required for delete endpoint to bypass RLS
```

### **Where to Set**
- **Local**: `.env.local` (gitignored)
- **Vercel**: Project Settings → Environment Variables
- **Railway**: Environment Variables tab

### **Common Issue**
- `SUPABASE_SERVICE_ROLE_KEY` missing in production → Delete fails
- Check Vercel logs for: `❌ Missing SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Deployment

### **Frontend (Vercel)**
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push to `main`

### **Build Issues**
- **Playwright dependencies**: Handled by `next.config.js` webpack config
- **Missing packages**: Check `package.json` overrides
- **Type errors**: Check TypeScript config

### **Common Build Errors**
1. **"Module not found: playwright-extra-plugin-stealth"**
   - **Fix**: Package is `puppeteer-extra-plugin-stealth` (not playwright)

2. **"Cannot find module 'clone-deep'"**
   - **Fix**: Install `clone-deep`, check `package.json` overrides

3. **"Module parse failed: Unexpected character" (.node files)**
   - **Fix**: Already handled in `next.config.js` with `ignore-loader`

---

## ⚠️ Critical Gotchas

### **1. Two-Table Architecture**
- **NEVER** delete from `products` table when user deletes item
- **ALWAYS** delete from `items` table only
- Products table is shared catalog, items table is user's wishlist

### **2. Service Role Key**
- **Required** for delete endpoint (bypasses RLS)
- **Must be set** in Vercel environment variables
- **Never commit** to git (already in `.gitignore`)

### **3. Price Display**
- Prices can be `null`, `0`, `string`, or `number`
- Always check for null/undefined before displaying
- Convert strings to numbers with `parseFloat()`

### **4. Legacy Items**
- Some items exist in `products` table (old architecture)
- Dashboard queries both tables
- Delete endpoint handles legacy items separately

### **5. Authentication**
- Cookie-based auth requires `middleware.ts` to refresh session
- Bearer token auth requires token in `Authorization` header
- Both methods must verify user before database operations

### **6. Column Name Differences**
- `items.current_price` vs `products.price`
- `items.image_url` vs `products.image`
- `items.retailer` vs `products.domain`
- Always map columns when converting formats

### **7. Webpack Configuration**
- Scraper dependencies must be excluded from client bundle
- Dynamic imports used for scraper to avoid build-time analysis
- `.node` files require special handling

---

## 🔍 Debugging Tips

### **Check Server Logs**
- Vercel: Dashboard → Deployments → View Function Logs
- Look for: `🗑️ DELETE`, `🔍 Item found`, `❌ Error`

### **Common Error Messages**
- `"Item not found in your wishlist"` → Item doesn't exist or wrong user
- `"Missing SUPABASE_SERVICE_ROLE_KEY"` → Environment variable not set
- `"RLS blocked"` → User token not passed to database client
- `"Ghost Items"` → Frontend showing items that don't exist in DB

### **Database Queries**
- Use Supabase Dashboard → Table Editor to inspect data
- Check `items` table for user's items
- Check `products` table for global catalog

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Next.js App Router**: https://nextjs.org/docs/app
- **Playwright**: https://playwright.dev
- **Project README**: `README.md`

---

## 🎯 Quick Reference

### **Add Item Flow**
```
User → POST /api/items → Check products table → Scrape if needed → Insert into items
```

### **Delete Item Flow**
```
User → DELETE /api/delete-item?id=X → Verify ownership → Delete from items only
```

### **Display Items Flow**
```
Dashboard → getUserProducts() → Query items + products tables → Combine → Display
```

---

**Last Updated**: Based on current codebase state
**Maintainer**: Update this doc when architecture changes

