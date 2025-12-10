/**
 * Product preview card component with manual editing
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Product } from '@/lib/products';

interface ProductPreviewProps {
  product: Product;
  onSave: (product: Product) => void;
  onCancel?: () => void;
  isSaved?: boolean;
}

export default function ProductPreview({ product, onSave, onCancel, isSaved }: ProductPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product>(product);

  const handleSave = () => {
    onSave(editedProduct);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedProduct(product);
    setIsEditing(false);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="backdrop-blur-md bg-[var(--color-card)]/80">
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          {/* Image */}
          {product.image && (
            <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-secondary)]">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                }}
              />
            </div>
          )}

          {/* Details */}
          <div className="flex flex-col">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editedProduct.title}
                  onChange={(e) =>
                    setEditedProduct({ ...editedProduct, title: e.target.value })
                  }
                  className="text-xl font-semibold mb-2 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <textarea
                  value={editedProduct.description || ''}
                  onChange={(e) =>
                    setEditedProduct({ ...editedProduct, description: e.target.value || null })
                  }
                  placeholder="Add description..."
                  className="text-sm mb-4 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] min-h-[60px] focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                />
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={editedProduct.price || ''}
                    onChange={(e) =>
                      setEditedProduct({ ...editedProduct, price: e.target.value || null })
                    }
                    placeholder="Price (e.g., $29.99)"
                    className="text-2xl font-bold text-brand-blue px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  <input
                    type="text"
                    value={editedProduct.image || ''}
                    onChange={(e) =>
                      setEditedProduct({ ...editedProduct, image: e.target.value })
                    }
                    placeholder="Image URL"
                    className="flex-1 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
                <div className="flex gap-3 mt-auto">
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    Cancel Edit
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    Save Changes
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold line-clamp-2 flex-1">
                    {editedProduct.title}
                  </h3>
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    className="ml-2 text-xs"
                  >
                    ✏️ Edit
                  </Button>
                </div>

                {editedProduct.description && (
                  <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-3">
                    {editedProduct.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <div>
                    {editedProduct.price ? (
                      <span className="text-2xl font-bold text-brand-blue">
                        {editedProduct.price}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Price not available
                      </span>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {editedProduct.domain}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    {onCancel && (
                      <Button variant="ghost" onClick={onCancel}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => onSave(editedProduct)}
                      disabled={isSaved}
                    >
                      {isSaved ? 'Saved' : 'Save Item'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

