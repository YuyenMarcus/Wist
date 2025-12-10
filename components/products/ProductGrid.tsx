/**
 * Product collection grid component
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Product, getSavedProducts, deleteProduct } from '@/lib/products';

interface ProductGridProps {
  onUpdate?: () => void;
}

export default function ProductGrid({ onUpdate }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);

  const loadProducts = () => {
    const saved = getSavedProducts();
    setProducts(saved);
  };

  useEffect(() => {
    loadProducts();
    
    // Listen for storage changes (from other tabs)
    const handleStorageChange = () => {
      loadProducts();
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (onUpdate) {
      onUpdate();
    }
  }, [products, onUpdate]);

  const handleDelete = (productId: string) => {
    if (confirm('Are you sure you want to remove this product?')) {
      deleteProduct(productId);
      loadProducts();
      if (editingId === productId) {
        setEditingId(null);
        setEditedProduct(null);
      }
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditedProduct({ ...product });
  };

  const handleSaveEdit = () => {
    if (!editedProduct) return;
    
    const products = getSavedProducts();
    const index = products.findIndex(p => p.id === editedProduct.id);
    
    if (index !== -1) {
      products[index] = editedProduct;
      localStorage.setItem('wist_products', JSON.stringify(products));
      loadProducts();
      setEditingId(null);
      setEditedProduct(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedProduct(null);
  };

  if (products.length === 0) {
    return (
      <Card className="text-center py-12 backdrop-blur-md bg-[var(--color-card)]/80">
        <p className="text-[var(--color-text-muted)] text-lg">
          No products saved yet. Start by adding a product above!
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence>
        {products.map((product) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="h-full flex flex-col backdrop-blur-md bg-[var(--color-card)]/80">
              {/* Image */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] mb-4">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                    No Image
                  </div>
                )}
                
                {/* Domain Badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant="blue">{product.domain}</Badge>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col">
                {editingId === product.id && editedProduct ? (
                  <>
                    <input
                      type="text"
                      value={editedProduct.title}
                      onChange={(e) =>
                        setEditedProduct({ ...editedProduct, title: e.target.value })
                      }
                      className="text-lg font-semibold mb-2 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                    <textarea
                      value={editedProduct.description || ''}
                      onChange={(e) =>
                        setEditedProduct({ ...editedProduct, description: e.target.value || null })
                      }
                      placeholder="Description..."
                      className="text-sm mb-2 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] min-h-[50px] focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                    />
                    <input
                      type="text"
                      value={editedProduct.price || ''}
                      onChange={(e) =>
                        setEditedProduct({ ...editedProduct, price: e.target.value || null })
                      }
                      placeholder="Price"
                      className="text-xl font-bold text-brand-blue mb-2 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSaveEdit}
                        className="text-xs"
                      >
                        Save
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold line-clamp-2 flex-1">
                        {product.title}
                      </h3>
                      <Button
                        variant="ghost"
                        onClick={() => handleEdit(product)}
                        className="text-xs ml-2"
                      >
                        ✏️
                      </Button>
                    </div>

                    {product.description && (
                      <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2 flex-1">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between">
                        {product.price ? (
                          <span className="text-xl font-bold text-brand-blue">
                            {product.price}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">
                            Price N/A
                          </span>
                        )}
                        
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(product.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-blue hover:underline mt-2 inline-block"
                      >
                        View Product →
                      </a>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

