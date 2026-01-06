'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function SaveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('saving');
  const [error, setError] = useState('');

  // Get data from URL
  const url = searchParams?.get('url') || null;
  const title = searchParams?.get('title') || null;
  const price = searchParams?.get('price') || null;
  const image = searchParams?.get('image') || null;
  const retailer = searchParams?.get('retailer') || null;
  const description = searchParams?.get('description') || null;

  useEffect(() => {
    const saveItem = async () => {
      if (!url) return;

      try {
        // We use the internal API, which works perfectly with cookies here
        const response = await fetch('/api/items/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            url,
            title,
            price: price ? parseFloat(price) : 0,
            image_url: image,
            retailer,
            description: description || ''
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          // Redirect to dashboard after 1 second
          setTimeout(() => router.push('/dashboard'), 1000);
        } else {
          setStatus('error');
          setError(data.error || 'Failed to save');
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Network error');
      }
    };

    saveItem();
  }, [url, title, price, image, retailer, description, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
        {status === 'saving' && (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Saving to Wist...</h2>
            <p className="mt-2 text-gray-500">{title || 'Product'}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Saved!</h2>
            <p className="mt-2 text-gray-500">Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl">
              ✕
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Could not save</h2>
            <p className="mt-2 text-red-500">{error}</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SavePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SaveContent />
    </Suspense>
  );
}

