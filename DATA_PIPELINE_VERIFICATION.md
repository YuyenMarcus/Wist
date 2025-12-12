# Data Pipeline Verification Guide

## ✅ Current Status: System is Working!

The reactor conflict is resolved, and the scraping service is returning 200 OK responses.

## 📊 Data Flow Overview

```
1. User enters URL in frontend
   ↓
2. Frontend calls: POST /api/fetch-product
   ↓
3. Next.js API calls: POST http://localhost:5000/api/scrape/sync
   ↓
4. Flask service scrapes (Scrapy or Playwright fallback)
   ↓
5. Flask returns JSON: { success: true, result: { title, price, image, ... } }
   ↓
6. Next.js API maps response and returns to frontend
   ↓
7. Frontend (ProductInput) creates Product object with price history
   ↓
8. Parent component saves to localStorage via saveProduct()
   ↓
9. Data stored in browser localStorage under key: 'wist_products'
```

## 📍 Where Data is Stored

### Current Storage: Browser localStorage

**Location:** Browser's localStorage  
**Key:** `'wist_products'`  
**Format:** JSON array of Product objects  
**File:** `lib/products.ts` (functions: `saveProduct()`, `getSavedProducts()`)

**Product Structure:**
```typescript
{
  id: string,
  title: string,
  image: string,
  price: string | null,  // Backward compatibility
  priceRaw: string | null,
  currentPrice: number | null,
  priceHistory: [{ date: string, price: number, priceRaw: string }],
  description: string | null,
  url: string,
  domain: string,
  savedAt: string,
  lastPriceCheck?: string
}
```

## 🧪 How to Verify Data Storage

### Method 1: Browser DevTools

1. **Open your app**: `http://localhost:3000`
2. **Open DevTools**: Press `F12` or `Ctrl+Shift+I`
3. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
4. **Navigate to**: Local Storage → `http://localhost:3000`
5. **Look for key**: `wist_products`
6. **Click on it** to see the JSON data

### Method 2: Console Test

1. **Open browser console** (F12)
2. **Run this command**:
   ```javascript
   JSON.parse(localStorage.getItem('wist_products'))
   ```
3. **You should see** an array of product objects

### Method 3: Test the Full Pipeline

1. **Start Flask service**: `python app.py` (in scraper-service/)
2. **Start Next.js**: `npm run dev` (in root)
3. **Open browser**: `http://localhost:3000`
4. **Paste Amazon URL**: `https://www.amazon.com/dp/B08N5WRWNW`
5. **Click "Fetch"**
6. **Check terminal**: Should see scraping activity
7. **Check browser**: Product should appear in the UI
8. **Check localStorage**: Open DevTools → Application → Local Storage → `wist_products`

## 🔍 What to Look For

### ✅ Success Indicators:

**In Python Terminal:**
```
✅ Job abc123... found item: Sony WH-1000XM5...
✅ Job abc123...: Scrapy succeeded!
```

**In Browser Network Tab:**
- `POST /api/fetch-product` → 200 OK
- Response contains: `{ success: true, title: "...", price: ... }`

**In Browser localStorage:**
- Key `wist_products` exists
- Contains array with at least one product object
- Product has `title`, `price`, `image`, `priceHistory` fields

### ❌ Potential Issues:

**If data doesn't appear in localStorage:**
- Check if `onProductFetched` callback is saving the product
- Check browser console for errors
- Verify `saveProduct()` is being called

**If scraping works but data is wrong:**
- Check Flask service response format
- Verify Next.js API mapping (`pages/api/fetch-product.ts`)
- Check ProductInput component data transformation

## 📝 Next Steps (Optional)

### Option 1: Keep localStorage (Current)
- ✅ Simple, no backend needed
- ✅ Works offline
- ❌ Data lost if browser cache cleared
- ❌ Not synced across devices

### Option 2: Add Supabase (Future)
- ✅ Persistent storage
- ✅ Sync across devices
- ✅ User authentication
- ❌ Requires Supabase setup

**To add Supabase later:**
1. Set up Supabase project
2. Create `wishlist_items` table
3. Update `saveProduct()` to also save to Supabase
4. Add user authentication

## 🎯 Current Status Summary

- ✅ **Scraping**: Working (Scrapy + Playwright fallback)
- ✅ **API**: Returning 200 OK
- ✅ **Data Flow**: Flask → Next.js → Frontend → localStorage
- ✅ **Storage**: Browser localStorage (working)
- ✅ **Price History**: Structure in place (ready for price tracking)

**Everything is working!** The data pipeline is complete and functional.



