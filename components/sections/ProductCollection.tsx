/**
 * Product Collection section with input, preview, and grid
 */
import { useState, useCallback } from 'react';
import Container from '@/components/layout/Container';
import ProductInput from '@/components/products/ProductInput';
import ProductPreview from '@/components/products/ProductPreview';
import ProductGrid from '@/components/products/ProductGrid';
import { Product, saveProduct, getSavedProducts } from '@/lib/products';

export default function ProductCollection() {
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [gridKey, setGridKey] = useState(0); // Force re-render of grid

  const handleProductFetched = useCallback((product: Product | null, error?: string) => {
    setFetchedProduct(product);
    setFetchError(error || null);
  }, []);

  const handleSave = useCallback((product: Product) => {
    // Check if already saved
    const existing = getSavedProducts();
    const isDuplicate = existing.some(p => p.url === product.url);
    
    if (isDuplicate) {
      alert('This product is already in your collection!');
      return;
    }

    // Save to localStorage
    saveProduct(product);
    
    // Clear preview and refresh grid
    setFetchedProduct(null);
    setGridKey(prev => prev + 1);
  }, []);

  const handleCancel = useCallback(() => {
    setFetchedProduct(null);
    setFetchError(null);
  }, []);

  return (
    <section id="product-collection" className="py-16 md:py-20 bg-[var(--color-bg-secondary)]">
      <Container>
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
          Your Product Collection
        </h2>

        <div className="space-y-8">
          {/* Input Section */}
          <ProductInput
            onProductFetched={handleProductFetched}
            onSave={handleSave}
          />

          {/* Preview Section */}
          {fetchedProduct && (
            <ProductPreview
              product={fetchedProduct}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaved={false}
            />
          )}

          {/* Error Message */}
          {fetchError && fetchedProduct === null && (
            <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300">
              <p className="font-medium">Error fetching product</p>
              <p className="text-sm mt-1">{fetchError}</p>
            </div>
          )}

          {/* Collection Grid */}
          <div className="mt-12">
            <ProductGrid key={gridKey} />
          </div>
        </div>
      </Container>
    </section>
  );
}

