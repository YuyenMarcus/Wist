/**
 * Product Preview Modal Component
 * Shows scraped product data with edit option and error handling
 */
import { useState } from 'react';
import { NormalizedProduct } from '@/lib/scraper/utils';

interface ProductPreviewProps {
  product: NormalizedProduct | null;
  error: string | null;
  loading: boolean;
  onSave: (product: NormalizedProduct) => void;
  onCancel: () => void;
  onManualAdd?: () => void;
  onRetry?: () => void;
}

export default function ProductPreview({
  product,
  error,
  loading,
  onSave,
  onCancel,
  onManualAdd,
  onRetry,
}: ProductPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<NormalizedProduct | null>(product);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center mt-4 text-gray-600">Fetching product data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isBlocked = error.includes('blocking') || error.includes('automated access');
    const isRateLimited = error.includes('Rate limit');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-center mb-2">Unable to Fetch Product</h3>
          <p className="text-gray-600 text-center mb-6">{error}</p>

          <div className="space-y-3">
            {isBlocked && onManualAdd && (
              <button
                onClick={onManualAdd}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Manually Add Item
              </button>
            )}
            {isRateLimited && onRetry && (
              <button
                onClick={onRetry}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition"
              >
                Retry (Wait a moment)
              </button>
            )}
            <button
              onClick={onCancel}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>

          {isBlocked && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Some sites block automated access. You can add items manually with all the details.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const displayProduct = isEditing && editedProduct ? editedProduct : product;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Product Preview</h2>

        {displayProduct.image && (
          <div className="mb-6">
            <img
              src={displayProduct.image}
              alt={displayProduct.title}
              className="w-full h-64 object-contain bg-gray-100 rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            {isEditing ? (
              <input
                type="text"
                value={editedProduct?.title || ''}
                onChange={(e) =>
                  setEditedProduct({
                    ...editedProduct!,
                    title: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            ) : (
              <p className="text-lg font-semibold">{displayProduct.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            {isEditing ? (
              <input
                type="text"
                value={editedProduct?.priceRaw || ''}
                onChange={(e) =>
                  setEditedProduct({
                    ...editedProduct!,
                    priceRaw: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g., $29.99"
              />
            ) : (
              <p className="text-lg">
                {displayProduct.price
                  ? `${displayProduct.currency || '$'}${displayProduct.price.toFixed(2)}`
                  : displayProduct.priceRaw || 'Price not available'}
              </p>
            )}
          </div>

          {displayProduct.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={editedProduct?.description || ''}
                  onChange={(e) =>
                    setEditedProduct({
                      ...editedProduct!,
                      description: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              ) : (
                <p className="text-gray-600">{displayProduct.description}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <a
              href={displayProduct.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {displayProduct.url}
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 flex space-x-3">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Edit
              </button>
              <button
                onClick={() => onSave(product)}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Add to Wishlist
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedProduct(product);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel Edit
              </button>
              <button
                onClick={() => {
                  if (editedProduct) {
                    onSave(editedProduct);
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Save & Add
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Data fetched from source — prices may change.
        </p>
      </div>
    </div>
  );
}
