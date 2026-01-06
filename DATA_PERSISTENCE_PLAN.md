# Sprint 2: Data Persistence Plan

## Current State

- ✅ Product interface updated with `priceHistory` support
- ✅ LocalStorage working for basic product storage
- ⏳ Need to handle `priceHistory` array in save/load functions
- ⏳ Need to support price updates (add new entry to history)

## Tasks

### Task 1: Update LocalStorage Functions

**File**: `lib/products.ts`

**Changes Needed**:
1. When saving a product, initialize `priceHistory` if not present
2. When loading products, ensure backward compatibility (old products without `priceHistory`)
3. Add function to update price and append to history

### Task 2: Price Update Logic

**New Function**: `updateProductPrice(productId, newPrice, newPriceRaw)`
- Find product by ID
- Compare new price with current price
- If different, add entry to `priceHistory`
- Update `currentPrice` and `priceRaw`
- Update `lastPriceCheck`

### Task 3: Supabase Integration (Optional)

**If using Supabase**:
- Update schema to support `priceHistory` (JSONB column)
- Add migration script
- Update `lib/supabase/wishlist.ts` functions

## Implementation

### Step 1: Update `lib/products.ts`

```typescript
// Add price update function
export function updateProductPrice(
  productId: string,
  newPrice: number | null,
  newPriceRaw: string | null
): Product | null {
  const products = getSavedProducts();
  const productIndex = products.findIndex(p => p.id === productId);
  
  if (productIndex === -1) return null;
  
  const product = products[productIndex];
  const currentPrice = product.currentPrice;
  
  // Only update if price changed
  if (currentPrice !== newPrice) {
    // Initialize priceHistory if missing (backward compatibility)
    if (!product.priceHistory) {
      product.priceHistory = [];
    }
    
    // Add new price entry
    product.priceHistory.push({
      date: new Date().toISOString(),
      price: newPrice,
      priceRaw: newPriceRaw,
    });
    
    // Update current price
    product.currentPrice = newPrice;
    product.priceRaw = newPriceRaw;
    product.price = newPriceRaw || (newPrice ? String(newPrice) : null);
    product.lastPriceCheck = new Date().toISOString();
    
    // Save back to localStorage
    products[productIndex] = product;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    
    return product;
  }
  
  return product;
}
```

### Step 2: Backward Compatibility

```typescript
export function getSavedProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const products = stored ? JSON.parse(stored) : [];
    
    // Migrate old products to new format
    return products.map((p: any) => ({
      ...p,
      currentPrice: p.currentPrice ?? (p.price ? parseFloat(p.price) : null),
      priceHistory: p.priceHistory ?? (p.price ? [{
        date: p.savedAt || new Date().toISOString(),
        price: p.price ? parseFloat(p.price) : null,
        priceRaw: p.priceRaw || p.price,
      }] : []),
      lastPriceCheck: p.lastPriceCheck || p.savedAt,
    }));
  } catch (e) {
    console.error('Error loading products:', e);
    return [];
  }
}
```

### Step 3: UI Integration

**Add Price Check Button** (optional):
- Button to re-scrape product and update price
- Shows price change indicator (up/down arrow)
- Displays price history chart (future enhancement)

## Testing

1. Save a product
2. Verify `priceHistory` is initialized
3. Update price using `updateProductPrice()`
4. Verify new entry added to `priceHistory`
5. Load products and verify backward compatibility

## Next Steps

- [ ] Implement price update function
- [ ] Add backward compatibility migration
- [ ] Test with existing localStorage data
- [ ] (Optional) Add Supabase support
- [ ] (Future) Price drop alerts using history









