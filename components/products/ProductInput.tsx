/**
 * Product input component with scraper integration
 * Enhanced UX with engaging loading messages for long wait times
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Product } from '@/lib/products';

interface ProductInputProps {
  onProductFetched: (product: Product | null, error?: string) => void;
  onSave?: (product: Product) => void;
}

// UX: Different messages based on time elapsed to keep user entertained
const LOADING_MESSAGES = [
  "Locating product...",
  "Negotiating with the server...",
  "Dodging captcha bots...",
  "Extracting structured data...",
  "Parsing product details...",
  "Almost there...",
  "Finalizing extraction...",
];

// Domain-specific optimistic messages
function getOptimisticMessage(domain: string): string {
  if (domain.includes('amazon')) {
    return "Wist is negotiating with Amazon's gates...";
  }
  if (domain.includes('bestbuy')) {
    return "Connecting to Best Buy...";
  }
  if (domain.includes('target')) {
    return "Accessing Target catalog...";
  }
  return "Fetching product data...";
}

export default function ProductInput({ onProductFetched, onSave }: ProductInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const msgIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a product URL');
      return;
    }

    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingMsgIndex(0);

    // UX: Cycle through messages every 1.5s to visualize progress
    msgIntervalRef.current = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);

    try {
      const domain = new URL(url.trim()).hostname.replace('www.', '');
      
      // Show optimistic message immediately for known slow sites
      if (domain.includes('amazon') || domain.includes('bestbuy') || domain.includes('target')) {
        // For slow sites, we could implement async job queue here
        // For now, keep synchronous but show engaging messages
      }

      const response = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim(), save: false }),
      });

      // Validate response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned invalid response. Please try again.');
      }

      const data = await response.json();

      // Check for API error structure
      if (!data.success || !response.ok) {
        throw new Error(data.error || 'Failed to fetch product');
      }

      // Convert API response to Product format with price history support
      const currentPrice = data.price ? parseFloat(String(data.price)) : null;
      const product: Product = {
        id: `temp_${Date.now()}`,
        title: data.title || 'Unknown Item',
        image: data.image || '',
        price: data.priceRaw || (data.price ? String(data.price) : null), // Backward compatibility
        priceRaw: data.priceRaw || null,
        currentPrice: currentPrice,
        priceHistory: currentPrice ? [{
          date: new Date().toISOString(),
          price: currentPrice,
          priceRaw: data.priceRaw || String(currentPrice),
        }] : [],
        description: data.description || null,
        url: url.trim(),
        domain: domain,
        savedAt: new Date().toISOString(),
        lastPriceCheck: new Date().toISOString(),
      };

      onProductFetched(product);
      setUrl(''); // Clear input on success
    } catch (err: any) {
      // Handle JSON parse errors
      let errorMessage = 'Failed to fetch product data';
      if (err instanceof SyntaxError) {
        errorMessage = 'Server returned invalid data. Please try again or add manually.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
      onProductFetched(null, errorMessage);
    } finally {
      setLoading(false);
      if (msgIntervalRef.current) {
        clearInterval(msgIntervalRef.current);
        msgIntervalRef.current = null;
      }
      setLoadingMsgIndex(0);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (msgIntervalRef.current) {
        clearInterval(msgIntervalRef.current);
      }
    };
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleFetch();
    }
  };

  return (
    <Card className="backdrop-blur-md bg-[var(--color-card)]/80">
      <h2 className="text-2xl font-bold mb-4">Add Product</h2>
      <p className="text-[var(--color-text-muted)] mb-6">
        Paste a product link from Amazon, eBay, Etsy, or any e-commerce site
      </p>

      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyPress={handleKeyPress}
          placeholder="https://amazon.com/dp/..."
          className="flex-1 px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand-blue"
          disabled={loading}
        />
        <Button
          variant="primary"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? 'Fetching...' : 'Fetch'}
        </Button>
      </div>

      {/* Loading State with Engaging Messages */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3"
        >
          <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
          <AnimatePresence mode="wait">
            <motion.span
              key={loadingMsgIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-[var(--color-text-muted)]"
            >
              {LOADING_MESSAGES[loadingMsgIndex]}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-red-500 text-sm"
        >
          {error}
        </motion.p>
      )}
    </Card>
  );
}

