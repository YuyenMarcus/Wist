/**
 * Homepage with product addition form
 */
import { useState } from 'react';
import Head from 'next/head';
import AddProductForm from '@/components/AddProductForm';
import { NormalizedProduct } from '@/lib/scraper/utils';

export default function Home() {
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (product: NormalizedProduct) => {
    try {
      // TODO: Get actual user ID from auth session
      const userId = 'user-placeholder'; // Replace with actual auth

      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save product');
      }

      setMessage('Product added to wishlist!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleManualAdd = () => {
    // TODO: Implement manual add modal/form
    alert('Manual add feature coming soon!');
  };

  return (
    <>
      <Head>
        <title>Wist - Product Wishlist Manager</title>
        <meta name="description" content="Save and manage your product wishlist" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Wist</h1>
            <p className="text-gray-600">Your reliable product wishlist manager</p>
          </header>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.includes('Error')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {message}
            </div>
          )}

          <AddProductForm onSave={handleSave} onManualAdd={handleManualAdd} />

          <footer className="mt-16 text-center text-sm text-gray-500">
            <p className="mb-2">
              Data fetched from source — prices may change.
            </p>
            <div className="space-x-4">
              <a href="/affiliate-disclosure" className="hover:text-gray-700">
                Affiliate Disclosure
              </a>
              <a href="/terms" className="hover:text-gray-700">
                Terms
              </a>
              <a href="/privacy" className="hover:text-gray-700">
                Privacy
              </a>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
