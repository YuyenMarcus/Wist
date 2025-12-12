# Multi-User Setup Guide

## Overview

This guide explains how to complete the multi-user setup so each user only sees and can delete their own products.

## ✅ Completed Backend Updates

1. ✅ Backend accepts `user_id` in requests
2. ✅ Spider includes `user_id` in scraped items
3. ✅ Pipeline saves `user_id` to Supabase
4. ✅ SQL files created for database schema and RLS policies

## 📋 Remaining Steps

### Step 1: Update Database Schema

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the SQL from `supabase-add-user-id.sql`:
   ```sql
   ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id text;
   ```

### Step 2: Set Up Row Level Security (RLS)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the SQL from `supabase-rls-policies.sql`
3. This creates policies so users can only see/delete their own products

### Step 3: Integrate Authentication

You need to get the `user_id` from your authentication system. Choose one:

**Option A: Supabase Auth**
```typescript
import { supabase } from '@/lib/supabase/client';

// Get current user
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;

// Or use in component:
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;
```

**Option B: Clerk**
```typescript
import { useUser } from '@clerk/nextjs';

const { user } = useUser();
const userId = user?.id;
```

**Option C: NextAuth**
```typescript
import { useSession } from 'next-auth/react';

const { data: session } = useSession();
const userId = session?.user?.id;
```

**Option D: Custom Auth**
Replace the placeholder `user_id` with your user identifier.

### Step 4: Update Frontend Components

1. **Dashboard Component** (`components/products/Dashboard.tsx`)
   - Line 62: Replace `'temp-user-id'` with actual `user.id` from auth
   - Example:
     ```typescript
     const { data: { user } } = await supabase.auth.getUser();
     const user_id = user?.id;
     ```

2. **ProductGrid Component** - Two options:

   **Option A: Use the new Supabase version**
   - Replace `ProductGrid` import with `ProductGridWithSupabase`
   - Pass `userId` prop: `<ProductGridWithSupabase userId={user.id} />`

   **Option B: Update existing ProductGrid**
   - Replace `getSavedProducts()` with `getUserProducts(userId)`
   - Replace `deleteProduct()` with `deleteUserProduct(userId, productId)`
   - Update to fetch from Supabase instead of localStorage

### Step 5: Update API Endpoints

The `/api/fetch-product` endpoint now accepts `user_id`. Make sure your frontend sends it:

```typescript
body: JSON.stringify({ 
  url: url.trim(),
  user_id: user.id  // Get from your auth
})
```

## 🔒 Security Notes

- **RLS Policies** enforce security at the database level
- Even if frontend code is bypassed, users can only access their own data
- Always verify `user_id` on the backend when possible

## 🧪 Testing

1. **Test User Isolation**
   - Login as User A
   - Add products
   - Login as User B
   - Verify User B doesn't see User A's products

2. **Test Deletion**
   - User A tries to delete User B's product (should fail)
   - User A deletes own product (should succeed)

3. **Test RLS**
   - Try querying Supabase directly with different user tokens
   - Verify only own products are returned

## 📝 Files Modified

- ✅ `scraper-service/app.py` - Accepts and passes user_id
- ✅ `scraper-service/spiders/product_spider.py` - Includes user_id in items
- ✅ `scraper-service/pipelines.py` - Saves user_id to database
- ✅ `pages/api/fetch-product.ts` - Passes user_id to backend
- ✅ `components/products/Dashboard.tsx` - Sends user_id (needs auth integration)
- ✅ `lib/supabase/products.ts` - New helper functions with user filtering
- ✅ `components/products/ProductGridWithSupabase.tsx` - New component for Supabase
- ✅ `supabase-add-user-id.sql` - Database schema update
- ✅ `supabase-rls-policies.sql` - RLS policies

## 🚀 Deployment Checklist

- [ ] Run `supabase-add-user-id.sql` in Supabase
- [ ] Run `supabase-rls-policies.sql` in Supabase
- [ ] Integrate authentication to get `user.id`
- [ ] Update Dashboard component with real user_id
- [ ] Update ProductGrid to use Supabase (or use ProductGridWithSupabase)
- [ ] Test user isolation
- [ ] Test deletion security
- [ ] Deploy backend (Railway)
- [ ] Deploy frontend (Vercel)

