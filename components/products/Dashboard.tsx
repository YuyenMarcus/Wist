/**
 * Dashboard component - Main product collection interface
 * Integrated with existing design system and API
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '@/components/layout/NavBar';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Product, getSavedProducts, saveProduct, deleteProduct } from '@/lib/products';

interface PreviewData {
  title?: string;
  name?: string;
  price?: string | number;
  image?: string;
  description?: string;
  source?: string;
  url?: string;
}

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  // TODO: Replace this with your actual user object from auth
  // Example: const { data: { user } } = await supabase.auth.getUser()
  const [user, setUser] = useState<{ id?: string } | null>(null);

  // Load saved items on mount
  useEffect(() => {
    const saved = getSavedProducts();
    setItems(saved);
  }, []);

  async function handleFetch() {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Validate URL
    try {
      new URL(url.trim());
    } catch {
      setError('Invalid URL. Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError(null);
    setRetrying(false);
    setPreview(null);

    try {
      // TODO: Get user_id from your auth context
      // Examples:
      //   - Supabase Auth: const { data: { user } } = await supabase.auth.getUser()
      //   - Clerk: const { user } = useUser()
      //   - NextAuth: const { data: session } = useSession()
      const user_id = 'temp-user-id';  // REPLACE THIS with actual user.id from your auth

      const response = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(), 
          save: false,
          user_id  // 👈 Include user_id so backend can save it
        }),
      });

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Try to get text to see what we got
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned invalid response. Please try again.');
      }

      const data = await response.json();

      // Handle API error responses
      if (!data.success || !response.ok) {
        throw new Error(data.error || 'Failed to fetch product');
      }

      // Normalize API response to PreviewData format
      const normalizedPreview: PreviewData = {
        title: data.title || data.name || 'Unknown Item',
        name: data.title || data.name,
        price: data.price || data.priceRaw || null,
        image: data.image || null,
        description: data.description || null,
        source: data.domain || new URL(url.trim()).hostname.replace('www.', ''),
        url: url.trim(),
      };

      setPreview(normalizedPreview);
      setError(null);
    } catch (err: any) {
      // Handle JSON parse errors specifically
      if (err instanceof SyntaxError) {
        setError('Server returned invalid data. Please try again or add manually.');
      } else {
        setError(err.message || 'Failed to fetch product');
      }
      
      // Try retry with fallback
      if (!retrying) {
        setRetrying(true);
        setTimeout(() => {
          setRetrying(false);
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  function savePreview() {
    if (!preview) return;

    const priceValue = preview.price ? (typeof preview.price === 'number' ? preview.price : parseFloat(String(preview.price))) : null;
    const priceString = preview.price ? String(preview.price) : null;

    const item: Product = {
      id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: preview.title || preview.name || 'Unknown Item',
      image: preview.image || '',
      price: priceString,
      priceRaw: priceString,
      currentPrice: priceValue,
      priceHistory: priceValue !== null ? [{ date: new Date().toISOString(), price: priceValue, priceRaw: priceString }] : [],
      description: preview.description || null,
      url: preview.url || url,
      domain: preview.source || new URL(preview.url || url).hostname.replace('www.', ''),
      savedAt: new Date().toISOString(),
    };

    // Check for duplicates
    const existing = getSavedProducts();
    if (existing.some(p => p.url === item.url)) {
      alert('This product is already in your collection!');
      return;
    }

    saveProduct({
      title: item.title,
      image: item.image,
      price: item.price,
      priceRaw: item.priceRaw,
      currentPrice: item.currentPrice,
      priceHistory: item.priceHistory,
      description: item.description,
      url: item.url,
      domain: item.domain,
    });

    setItems([item, ...items]);
    setPreview(null);
    setUrl('');
  }

  function removeItem(id: string) {
    if (confirm('Are you sure you want to remove this product?')) {
      deleteProduct(id);
      setItems(prev => prev.filter(i => i.id !== id));
    }
  }

  function Loader() {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-[var(--color-text-muted)]">Fetching...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] transition-colors duration-300 pb-20">
      <NavBar />

      <main className="max-w-[1200px] mx-auto px-6 pt-28">
        <section className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-brand-blue to-brand-light bg-clip-text text-transparent">
            Collect what inspires you.
          </h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            Paste a product link and Wist will pull title, image and price. Save it to your collection.
          </p>
          
          {/* TEMPORARY DEBUGGER */}
          <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0', border: '1px solid red' }}>
            <p><strong>My Login ID:</strong> {user?.id || 'NOT SET - Replace user state with your auth'}</p>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex gap-4 items-start flex-col md:flex-row">
            {/* Input Card */}
            <div className="flex-1 backdrop-blur-md bg-[var(--color-card)]/80 border border-[var(--color-border)] rounded-2xl p-5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Paste product link
              </label>
              <div className="mt-3 flex gap-3">
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleFetch();
                    }
                  }}
                  placeholder="https://amazon.com/dp/..."
                  className="flex-1 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-brand-blue"
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

              <div className="mt-3 text-sm min-h-[24px]">
                {loading && <Loader />}
                {retrying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-yellow-600 dark:text-yellow-400"
                  >
                    Retrying with fallback…
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500"
                  >
                    {error}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Preview Card */}
            <div className="w-full md:w-96 backdrop-blur-md bg-[var(--color-card)]/80 border border-[var(--color-border)] rounded-2xl p-4">
              <div className="text-sm text-[var(--color-text-secondary)] mb-3">Preview</div>
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  {preview ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <div className="h-40 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] flex items-center justify-center">
                        {preview.image ? (
                          <img
                            src={preview.image}
                            alt={preview.title || preview.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        ) : (
                          <div className="text-[var(--color-text-muted)]">No image</div>
                        )}
                      </div>
                      <div className="font-semibold text-[var(--color-text)] line-clamp-2">
                        {preview.title || preview.name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {preview.price
                          ? preview.price.toString().includes('$')
                            ? preview.price
                            : `$${preview.price}`
                          : 'Price unavailable'}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          onClick={savePreview}
                          className="flex-1"
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setPreview(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      Paste a product link and click Fetch to preview here.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* Collection Grid */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">
            Your Collection
          </h2>
          {items.length === 0 ? (
            <div className="text-[var(--color-text-muted)]">
              You have no saved items — start by pasting a link above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="backdrop-blur-md bg-[var(--color-card)]/80 border border-[var(--color-border)] rounded-2xl p-4"
                  >
                    <div className="h-40 rounded-md overflow-hidden bg-[var(--color-bg-secondary)] flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                          }}
                        />
                      ) : (
                        <div className="text-[var(--color-text-muted)]">No image</div>
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-[var(--color-text)] line-clamp-2">
                          {item.title}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          {item.domain}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-brand-blue">
                        {item.price ? (item.price.includes('$') ? item.price : `$${item.price}`) : '—'}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                      >
                        Open
                      </a>
                      <Button
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                        className="py-2 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

