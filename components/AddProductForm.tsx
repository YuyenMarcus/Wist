/**
 * Form component for adding products via URL
 */
import { useState } from 'react';
import { NormalizedProduct } from '@/lib/scraper/utils';
import ProductPreview from './ProductPreview';

interface AddProductFormProps {
  onSave: (product: NormalizedProduct) => Promise<void>;
  onManualAdd?: () => void;
}

export default function AddProductForm({ onSave, onManualAdd }: AddProductFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<NormalizedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setProduct(null);
    setShowPreview(true);

    try {
      const response = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch product');
      }

      if (data.data) {
        setProduct(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (productToSave: NormalizedProduct) => {
    try {
      await onSave(productToSave);
      setUrl('');
      setProduct(null);
      setError(null);
      setShowPreview(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  };

  const handleCancel = () => {
    setShowPreview(false);
    setProduct(null);
    setError(null);
  };

  const handleRetry = () => {
    if (url.trim()) {
      handleSubmit(new Event('submit') as any);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste product URL (Amazon, Best Buy, Target, etc.)"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Fetching...' : 'Add Product'}
          </button>
        </div>
        {onManualAdd && (
          <button
            type="button"
            onClick={onManualAdd}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Or add manually
          </button>
        )}
      </form>

      {showPreview && (
        <ProductPreview
          product={product}
          error={error}
          loading={loading}
          onSave={handleSave}
          onCancel={handleCancel}
          onManualAdd={onManualAdd}
          onRetry={handleRetry}
        />
      )}
    </>
  );
}
