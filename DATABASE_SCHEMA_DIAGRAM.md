# 🗄️ Wist Database Schema Diagram

Visual representation of the Wist database schema with relationships and key fields.

---

## 📊 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         auth.users (Supabase Auth)                    │
│                         ────────────────────────                       │
│  • id (uuid, PK)                                                       │
│  • email                                                               │
│  • created_at                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:1
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            profiles                                     │
│                         ──────────────────                             │
│  • id (uuid, PK) ──────┐                                                │
│  • email               │                                                │
│  • full_name           │                                                │
│  • avatar_url          │                                                │
│  • username (unique)   │                                                │
│  • bio (max 150 chars) │                                                │
│  • updated_at          │                                                │
└────────────────────────┼────────────────────────────────────────────────┘
                         │
                         │ 1:many
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         collections                                     │
│                      ───────────────────                                │
│  • id (uuid, PK)                                                        │
│  • name                                                                 │
│  • slug (unique per user)                                               │
│  • user_id (FK → auth.users)                                           │
│  • icon                                                                 │
│  • color                                                                │
│  • position                                                             │
│  • created_at                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                         │
                         │ 1:many
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            items                                        │
│                      ─────────────────                                  │
│  • id (uuid, PK)                                                        │
│  • title                                                                │
│  • url                                                                  │
│  • current_price (numeric)                                             │
│  • image_url                                                            │
│  • retailer                                                             │
│  • note                                                                 │
│  • user_id (FK → auth.users)                                           │
│  • collection_id (FK → collections, nullable)                          │
│  • status ('active' | 'purchased')                                      │
│  • last_price_check (timestamptz)                                       │
│  • price_check_failures (integer)                                      │
│  • created_at                                                           │
│  • updated_at                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                         │
                         │ 1:many
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       price_history                                     │
│                    ───────────────────                                  │
│  • id (uuid, PK)                                                        │
│  • item_id (FK → items)                                                 │
│  • price (numeric)                                                      │
│  • recorded_at (timestamptz)                                            │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         products (Global Catalog)                       │
│                      ────────────────────────────                        │
│  • id (uuid, PK)                                                        │
│  • url (unique)                                                          │
│  • title                                                                 │
│  • price                                                                 │
│  • price_raw                                                             │
│  • image                                                                 │
│  • description                                                           │
│  • domain                                                                │
│  • currency                                                              │
│  • user_id (original creator)                                            │
│  • reserved_by                                                           │
│  • reserved_at                                                           │
│  • is_public (boolean)                                                   │
│  • share_token                                                           │
│  • image_source                                                          │
│  • last_scraped                                                          │
│  • meta (jsonb)                                                          │
│  • created_at                                                            │
└─────────────────────────────────────────────────────────────────────────┘
                         ▲
                         │ Referenced by URL
                         │ (not FK relationship)
                         │
                    items.url matches products.url


┌─────────────────────────────────────────────────────────────────────────┐
│                         wishlists (Legacy)                              │
│                      ────────────────────                                │
│  • id (uuid, PK)                                                        │
│  • title                                                                 │
│  • visibility ('private' | 'public')                                    │
│  • user_id (FK → auth.users)                                            │
│  • created_at                                                            │
└─────────────────────────────────────────────────────────────────────────┘
                         │
                         │ 1:many (optional)
                         ▼
                    items.wishlist_id (nullable)
```

---

## 📋 Table Details

### 1. **auth.users** (Supabase Auth)
**Purpose:** User authentication (managed by Supabase)

**Key Fields:**
- `id` - UUID primary key
- `email` - User email address

**Relationships:**
- 1:1 → `profiles`
- 1:many → `items`
- 1:many → `collections`
- 1:many → `wishlists`

---

### 2. **profiles**
**Purpose:** User profile information and public sharing

**Key Fields:**
- `id` - UUID (FK → auth.users.id)
- `username` - Unique username for `/u/[username]` routes
- `bio` - User bio (max 150 characters)
- `avatar_url` - Profile picture URL

**Indexes:**
- Unique index on `username` (where not null)

**Relationships:**
- 1:1 ← `auth.users`

---

### 3. **collections**
**Purpose:** User-created collections to organize items

**Key Fields:**
- `id` - UUID primary key
- `name` - Collection name
- `slug` - URL-friendly identifier (unique per user)
- `user_id` - FK → auth.users
- `icon` - Collection icon
- `color` - Collection color
- `position` - Display order

**Constraints:**
- Unique(`user_id`, `slug`)

**Relationships:**
- many:1 ← `items` (via `collection_id`)

---

### 4. **items**
**Purpose:** User-specific wishlist items

**Key Fields:**
- `id` - UUID primary key
- `title` - Product title
- `url` - Product URL (references `products.url`)
- `current_price` - Current price (numeric)
- `image_url` - Product image
- `retailer` - Retailer name
- `note` - User's personal note
- `user_id` - FK → auth.users
- `collection_id` - FK → collections (nullable)
- `status` - 'active' or 'purchased'
- `last_price_check` - Last successful price check timestamp
- `price_check_failures` - Consecutive failure count

**Indexes:**
- `items_user_id_idx` - For user queries
- `items_collection_id_idx` - For collection queries
- `idx_items_last_price_check` - For cron job queries

**Relationships:**
- many:1 → `auth.users`
- many:1 → `collections` (optional)
- 1:many → `price_history`

---

### 5. **price_history**
**Purpose:** Track price changes over time

**Key Fields:**
- `id` - UUID primary key
- `item_id` - FK → items
- `price` - Price at time of recording
- `recorded_at` - Timestamp (replaces `created_at`)

**Indexes:**
- `idx_price_history_item_id` - For item queries
- `idx_price_history_created_at` - For time-based queries

**Relationships:**
- many:1 → `items`

**Note:** Uses `recorded_at` column (not `created_at`) for timestamps

---

### 6. **products** (Global Catalog)
**Purpose:** Shared product catalog (one URL = one product)

**Key Fields:**
- `id` - UUID primary key
- `url` - Product URL (unique)
- `title` - Product title
- `price` - Current price
- `price_raw` - Raw price string
- `image` - Product image URL
- `description` - Product description
- `domain` - Retailer domain
- `currency` - Currency code
- `user_id` - Original creator
- `reserved_by` - Who reserved/purchased
- `reserved_at` - Reservation timestamp
- `is_public` - Public visibility flag
- `share_token` - Unique sharing token
- `image_source` - 'url' or 'storage'
- `last_scraped` - Last scrape timestamp
- `meta` - Additional metadata (jsonb)

**Indexes:**
- `products_url_idx` - Unique index on URL
- `products_last_scraped_idx` - For scraping queries
- `products_share_token_idx` - For sharing queries

**Relationships:**
- Referenced by `items.url` (not a FK, but logical relationship)

---

### 7. **wishlists** (Legacy)
**Purpose:** Legacy wishlist collections (being replaced by `collections`)

**Key Fields:**
- `id` - UUID primary key
- `title` - Wishlist name
- `visibility` - 'private' or 'public'
- `user_id` - FK → auth.users

**Relationships:**
- many:1 ← `items` (via `wishlist_id`, optional)

---

## 🔗 Relationship Summary

```
auth.users
  ├── profiles (1:1)
  ├── collections (1:many)
  ├── items (1:many)
  └── wishlists (1:many)

collections
  └── items (1:many, via collection_id)

items
  ├── price_history (1:many)
  └── products (referenced by URL, not FK)

products
  └── Referenced by items.url (logical relationship)
```

---

## 🔄 Data Flow

### Price Tracking Flow:
```
1. Cron Job (every 24h)
   ↓
2. Query items WHERE last_price_check < 24h ago
   ↓
3. Scrape price from URL
   ↓
4. Update items.current_price
   ↓
5. Update items.last_price_check
   ↓
6. If price changed: INSERT into price_history
```

### Item Creation Flow:
```
1. User adds item via URL
   ↓
2. Check if products.url exists
   ├── Yes: Use existing product
   └── No: Create new product
   ↓
3. Create items row
   ├── Link to user_id
   ├── Link to collection_id (optional)
   └── Reference products.url
```

---

## 📊 Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `items` | `items_user_id_idx` | Fast user queries |
| `items` | `items_collection_id_idx` | Fast collection queries |
| `items` | `idx_items_last_price_check` | Cron job efficiency |
| `price_history` | `idx_price_history_item_id` | Fast item history |
| `price_history` | `idx_price_history_created_at` | Time-based queries |
| `products` | `products_url_idx` | Unique URL lookup |
| `profiles` | `profiles_username_idx` | Username lookup |
| `collections` | `collections_user_id_idx` | User collections |

---

## 🔒 Security (RLS Policies)

- **profiles**: Users can only view/update their own profile
- **collections**: Users can only manage their own collections
- **items**: Users can only view/manage their own items
- **price_history**: Users can view history for their own items
- **products**: Public read, authenticated write
- **wishlists**: Users can only manage their own wishlists

---

## 📝 Notes

1. **Two-Table Architecture**: `products` (global) + `items` (user-specific)
2. **Price Tracking**: `current_price` in `items`, history in `price_history`
3. **Collections**: New system replacing `wishlists` (both supported)
4. **Price History**: Uses `recorded_at` column (not `created_at`)
5. **Cron Job**: Checks items every 24h based on `last_price_check`

---

**Last Updated:** 2025-01-02  
**Database:** Supabase (PostgreSQL)
