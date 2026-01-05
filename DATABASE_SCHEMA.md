# Wist Database Schema

Complete database schema documentation for the Wist application.

## Database: Supabase (PostgreSQL)

---

## 📊 Tables Overview

1. **`products`** - Global product catalog (shared across users)
2. **`items`** - User-specific wishlist items (links to products)
3. **`profiles`** - User profile information
4. **`wishlists`** - User wishlist collections
5. **`price_history`** - Price tracking over time

---

## 📋 Table Schemas

### 1. `products` Table
**Purpose:** Global product catalog. Stores product information that can be shared across multiple users.

```sql
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Product Information
  url text NOT NULL UNIQUE,              -- Product URL (must be unique)
  title text,                            -- Product Title
  price text,                            -- Current Price (e.g. "19.99")
  price_raw text,                        -- Raw price string (e.g. "$19.99")
  image text,                            -- Image URL
  description text,                      -- Product description
  domain text,                           -- Domain (e.g. "amazon.com")
  currency text DEFAULT 'USD',
  
  -- Tracking
  last_scraped timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb,        -- Additional metadata
  
  -- User & Ownership
  user_id text,                          -- Original creator (nullable)
  
  -- Reservation System
  reserved_by text,                      -- Who reserved/purchased the item
  reserved_at timestamptz,               -- When it was reserved
  
  -- Public Sharing
  is_public boolean DEFAULT false,       -- Public visibility flag
  share_token text,                      -- Unique token for sharing
  
  -- Image Source
  image_source text                      -- 'url' or 'storage'
);

-- Indexes
CREATE INDEX products_url_idx ON products(url);
CREATE INDEX products_last_scraped_idx ON products(last_scraped);
CREATE INDEX products_share_token_idx ON products(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX products_is_public_idx ON products(is_public) WHERE is_public = true;
```

**Key Features:**
- ✅ URL is unique (prevents duplicates)
- ✅ Public read access (anyone can view)
- ✅ Supports reservation system
- ✅ Supports public/private sharing

---

### 2. `items` Table
**Purpose:** User-specific wishlist items. Links users to products in their personal wishlist.

```sql
CREATE TABLE items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Product Information
  title text NOT NULL,
  url text NOT NULL,
  current_price numeric,                 -- Current price (numeric for calculations)
  image_url text,                         -- Product image URL
  retailer text,                          -- Retailer name (e.g. "Amazon", "Target")
  note text,                              -- User's personal note
  
  -- User & Wishlist
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wishlist_id uuid REFERENCES wishlists(id) ON DELETE CASCADE,
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'purchased'))
);

-- Indexes
CREATE INDEX items_user_id_idx ON items(user_id);
CREATE INDEX items_wishlist_id_idx ON items(wishlist_id);
CREATE INDEX items_status_idx ON items(status) WHERE status = 'purchased';
CREATE INDEX items_created_at_idx ON items(created_at DESC);
```

**Key Features:**
- ✅ User-specific (each user has their own items)
- ✅ Links to `wishlists` table
- ✅ Status: `'active'` (wishlist) or `'purchased'` (Just Got It feed)
- ✅ Supports price tracking via `price_history` table

**Relationship:**
- Many `items` → One `wishlist` (via `wishlist_id`)
- Many `items` → One `user` (via `user_id`)

---

### 3. `profiles` Table
**Purpose:** User profile information for public sharing and personalization.

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Public Profile
  username text,                          -- Unique username for public sharing (e.g., /u/marcus)
  username_set_at timestamptz,           -- When username was set
  bio text CHECK (char_length(bio) <= 150) -- Bio (max 150 characters)
);

-- Indexes
CREATE UNIQUE INDEX profiles_username_idx ON profiles(username) WHERE username IS NOT NULL;

-- Constraints
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format 
CHECK (
  username IS NULL OR (
    length(username) >= 3 AND 
    length(username) <= 30 AND
    username ~ '^[a-zA-Z0-9_-]+$'
  )
);
```

**Key Features:**
- ✅ Unique username for public profiles (`/u/[username]`)
- ✅ Username format: 3-30 chars, alphanumeric + `_` + `-`
- ✅ Bio limited to 150 characters
- ✅ Links to Supabase Auth users

---

### 4. `wishlists` Table
**Purpose:** User wishlist collections. Each user can have multiple wishlists.

```sql
CREATE TABLE wishlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Wishlist Information
  title text NOT NULL DEFAULT 'My Wishlist',
  visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  
  -- User
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX wishlists_user_id_idx ON wishlists(user_id);
```

**Key Features:**
- ✅ Multiple wishlists per user
- ✅ Visibility: `'private'` or `'public'`
- ✅ Default wishlist created automatically for new users

**Relationship:**
- One `wishlist` → Many `items` (via `items.wishlist_id`)

---

### 5. `price_history` Table
**Purpose:** Track price changes over time for price drop notifications.

```sql
CREATE TABLE price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_price_history_item_id ON price_history(item_id);
CREATE INDEX idx_price_history_created_at ON price_history(created_at DESC);
```

**Key Features:**
- ✅ Tracks price changes for each item
- ✅ Cascades delete when item is deleted
- ✅ Used for price drop notifications

**Relationship:**
- Many `price_history` → One `item` (via `item_id`)

---

## 🔗 Table Relationships

```
auth.users (Supabase Auth)
    ↓
profiles (1:1)
    ↓
wishlists (1:many)
    ↓
items (many:1)
    ↓
price_history (1:many)

products (standalone, referenced by items via URL)
```

**Architecture Pattern:**
- **`products`** = Global catalog (one product URL = one row)
- **`items`** = User-specific links to products (many users can have same product)
- **"Unlink Strategy"**: Deleting an `item` doesn't delete the `product` (product stays in catalog)

---

## 🔒 Row Level Security (RLS) Policies

### `products` Table
```sql
-- Public Read: Anyone can view products
CREATE POLICY "Public Read" ON products
FOR SELECT USING (true);

-- Public Insert: Anyone can insert (via API)
CREATE POLICY "Public Insert" ON products
FOR INSERT WITH CHECK (true);

-- Public Update: Anyone can update (for price updates)
CREATE POLICY "Public Update" ON products
FOR UPDATE USING (true);

-- Users can view their own items
CREATE POLICY "Users can view own items" ON products
FOR SELECT TO authenticated
USING (auth.uid()::text = user_id);

-- Public can view public items
CREATE POLICY "Public can view public items" ON products
FOR SELECT TO anon, authenticated
USING (is_public = true);
```

### `items` Table
```sql
-- Users can only see their own items
CREATE POLICY "Users can view own items" ON items
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own items
CREATE POLICY "Users can insert own items" ON items
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own items
CREATE POLICY "Users can update own items" ON items
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Users can delete own items" ON items
FOR DELETE USING (auth.uid() = user_id);

-- Public can view active items for public profiles
CREATE POLICY "Public can view active items" ON items
FOR SELECT TO anon, authenticated
USING (
  status = 'active' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = items.user_id
    AND profiles.username IS NOT NULL
  )
);
```

### `profiles` Table
```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- Public can view profiles by username
CREATE POLICY "Public can view profiles by username" ON profiles
FOR SELECT TO anon, authenticated
USING (username IS NOT NULL);
```

### `price_history` Table
```sql
-- Users can view price history for their own items
CREATE POLICY "Users can view own price history" ON price_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM items
    WHERE items.id = price_history.item_id
    AND items.user_id = auth.uid()
  )
);

-- Service can insert price history (for cron jobs)
CREATE POLICY "Service can insert price history" ON price_history
FOR INSERT WITH CHECK (true);
```

---

## 📝 Migration Files

All migration files are in the root directory:

1. **`supabase-schema.sql`** - Base `products` table
2. **`supabase-add-status-column.sql`** - Adds `status` to `items`
3. **`supabase-price-history-table.sql`** - Creates `price_history` table
4. **`supabase-public-private-visibility.sql`** - Adds `is_public` and `share_token` to `products`
5. **`supabase-username-setup.sql`** - Adds `username` to `profiles`
6. **`supabase-add-bio-column.sql`** - Adds `bio` to `profiles`
7. **`supabase-reservation-system.sql`** - Adds `reserved_by` and `reserved_at` to `products`
8. **`supabase-add-image-source.sql`** - Adds `image_source` to `products`
9. **`supabase-public-profile-rls.sql`** - RLS policies for public profiles

---

## 🎯 Key Design Decisions

### 1. **Two-Table Architecture**
- **`products`**: Global catalog (one URL = one product)
- **`items`**: User-specific links (many users can have same product)
- **Benefit**: Prevents duplicate scraping, enables sharing

### 2. **"Unlink" Strategy**
- Deleting an `item` does NOT delete the `product`
- Product stays in catalog for other users
- **Benefit**: Preserves global product data

### 3. **Status Field**
- `'active'`: Item is in wishlist
- `'purchased'`: Item moved to "Just Got It" feed
- **Benefit**: Single table for both features

### 4. **Price Tracking**
- `current_price` in `items` table (current value)
- `price_history` table (historical changes)
- **Benefit**: Enables price drop notifications

### 5. **Public Profiles**
- `username` in `profiles` enables `/u/[username]` routes
- `is_public` flag on `items` controls visibility
- **Benefit**: Users can share wishlists publicly

---

## 🔍 Common Queries

### Get User's Wishlist Items
```sql
SELECT * FROM items
WHERE user_id = $1
AND status = 'active'
ORDER BY created_at DESC;
```

### Get Public Profile Items
```sql
SELECT * FROM items
WHERE user_id = (
  SELECT id FROM profiles WHERE username = $1
)
AND status = 'active';
```

### Get Price History for Item
```sql
SELECT * FROM price_history
WHERE item_id = $1
ORDER BY created_at DESC;
```

### Find Product by URL
```sql
SELECT * FROM products
WHERE url = $1;
```

---

## 📚 Additional Resources

- **Supabase Dashboard**: https://supabase.com/dashboard
- **SQL Editor**: Run migrations in Supabase Dashboard → SQL Editor
- **TypeScript Types**: See `types/supabase.ts` for generated types

---

## ✅ Setup Checklist

1. ✅ Run `supabase-schema.sql` (creates `products` table)
2. ✅ Create `items` table (see code references)
3. ✅ Create `profiles` table (Supabase Auth extension)
4. ✅ Create `wishlists` table (see code references)
5. ✅ Run `supabase-add-status-column.sql`
6. ✅ Run `supabase-price-history-table.sql`
7. ✅ Run `supabase-public-private-visibility.sql`
8. ✅ Run `supabase-username-setup.sql`
9. ✅ Run `supabase-add-bio-column.sql`
10. ✅ Run `supabase-reservation-system.sql`
11. ✅ Run `supabase-add-image-source.sql`
12. ✅ Run `supabase-public-profile-rls.sql`

---

**Last Updated:** 2025-01-02
**Database:** Supabase (PostgreSQL)
**Version:** 1.0

