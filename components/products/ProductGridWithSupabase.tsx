/**
 * Product collection grid component - Updated for Supabase with user filtering
 * 
 * TODO: Replace 'user' object with your actual auth context/user object
 * Examples:
 *   - Supabase Auth: const { data: { user } } = await supabase.auth.getUser()
 *   - Clerk: const { user } = useUser()
 *   - NextAuth: const { data: session } = useSession(); const user = session?.user
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getUserProducts, SupabaseProduct } from '@/lib/supabase/products';
import { supabase } from '@/lib/supabase/client';

interface ProductGridProps {
  onUpdate?: () => void;
  userId: string;  // TODO: Get this from your auth context
}

export default function ProductGridWithSupabase({ onUpdate, userId }: ProductGridProps) {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    if (!userId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await getUserProducts(userId);
      
      if (fetchError) {
        throw fetchError;
      }
      
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [userId]);

  useEffect(() => {
    if (onUpdate) {
      onUpdate();
    }
  }, [products, onUpdate]);

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product?')) {
      return;
    }

    console.log("Deleting Product ID:", productId); // Debug log

    // 1. Simple Delete Command (Let RLS handle the security)
    const { error, count } = await supabase
      .from('products')
      .delete({ count: 'exact' }) // Ask Supabase how many rows were deleted
      .eq('id', productId);

    // 2. Debugging Results
    if (error) {
      console.error("❌ Supabase Error:", error.message);
      alert("Error deleting!");
    } else if (count === 0) {
      console.warn("⚠️ Success, but 0 items deleted. ID Mismatch?");
      alert("Could not delete item (Permission denied or ID wrong)");
    } else {
      console.log("✅ Successfully deleted from DB");

      // 3. Remove from screen
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  if (loading) {
    return (
      <Card className="text-center py-12 backdrop-blur-md bg-[var(--color-card)]/80">
        <p className="text-[var(--color-text-muted)] text-lg">Loading products...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-12 backdrop-blur-md bg-[var(--color-card)]/80">
        <p className="text-red-500 text-lg">Error: {error}</p>
        <Button onClick={loadProducts} className="mt-4">Retry</Button>
      </Card>
    );
  }

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
                    alt={product.title || 'Product'}
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
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                  {product.title || 'Untitled Product'}
                </h3>

                <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between">
                    {product.price ? (
                      <span className="text-xl font-bold text-brand-blue">
                        ${product.price.toFixed(2)}
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
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

