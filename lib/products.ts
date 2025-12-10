/**
 * Product management utilities with localStorage
 */

export interface PriceHistoryEntry {
  date: string; // ISO date string
  price: number | null;
  priceRaw: string | null;
}

export interface Product {
  id: string;
  title: string;
  image: string;
  price: string | null; // Current price (for backward compatibility)
  priceRaw: string | null; // Current price raw string
  currentPrice: number | null; // Normalized current price
  priceHistory: PriceHistoryEntry[]; // Price tracking for alerts
  description: string | null;
  url: string;
  domain: string;
  savedAt: string;
  lastPriceCheck?: string; // ISO date of last price check
}

const STORAGE_KEY = 'wist_products';

/**
 * Get all saved products from localStorage
 */
export function getSavedProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error loading products from localStorage:', e);
    return [];
  }
}

/**
 * Save a product to localStorage
 */
export function saveProduct(product: Omit<Product, 'id' | 'savedAt'>): Product {
  const products = getSavedProducts();
  const newProduct: Product = {
    ...product,
    id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    savedAt: new Date().toISOString(),
  };
  
  products.push(newProduct);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  
  return newProduct;
}

/**
 * Delete a product from localStorage
 */
export function deleteProduct(productId: string): void {
  const products = getSavedProducts();
  const filtered = products.filter(p => p.id !== productId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all products
 */
export function clearAllProducts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

