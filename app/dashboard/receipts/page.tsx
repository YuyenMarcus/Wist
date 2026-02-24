'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';
import { Receipt, FileText, Trash2, ArrowLeft, AlertTriangle, Shield } from 'lucide-react';

export default function ReceiptsPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState('free');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      const tier = profile?.subscription_tier || 'free';
      setUserTier(tier);

      if (['pro_plus', 'creator', 'enterprise'].includes(tier)) {
        const res = await fetch('/api/receipts');
        if (res.ok) {
          const json = await res.json();
          setReceipts(json.receipts || []);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' });
    if (res.ok) setReceipts(prev => prev.filter(r => r.id !== id));
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-dpurple-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  const isPremium = ['pro_plus', 'creator', 'enterprise'].includes(userTier);

  const now = new Date();
  const expiringSoon = receipts.filter(r => {
    if (!r.warranty_expiry) return false;
    const exp = new Date(r.warranty_expiry);
    const diff = exp.getTime() - now.getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-dpurple-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dpurple-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-violet-500" />
                Receipts & Warranties
              </h1>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Track your purchases and warranty expiry dates</p>
            </div>
          </div>

          {!isPremium ? (
            <div className="rounded-xl bg-white dark:bg-dpurple-950 p-12 shadow-sm ring-1 ring-gray-900/5 dark:ring-dpurple-700 text-center space-y-3">
              <Shield className="w-12 h-12 text-gray-300 dark:text-zinc-500 mx-auto" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Wist Pro Feature</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
                Upgrade to Wist Pro to track receipts, warranty dates, and never miss a return window.
              </p>
            </div>
          ) : (
            <>
              {expiringSoon.length > 0 && (
                <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-amber-800">Warranties Expiring Soon</h3>
                  </div>
                  <div className="space-y-1">
                    {expiringSoon.map(r => (
                      <p key={r.id} className="text-sm text-amber-700">
                        <span className="font-medium">{r.title}</span> — expires {new Date(r.warranty_expiry).toLocaleDateString()}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {receipts.length === 0 ? (
                <div className="rounded-xl bg-white dark:bg-dpurple-950 p-12 shadow-sm ring-1 ring-gray-900/5 dark:ring-dpurple-700 text-center space-y-3">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-zinc-500 mx-auto" />
                  <h2 className="text-lg font-semibold text-gray-600 dark:text-zinc-400">No receipts yet</h2>
                  <p className="text-sm text-gray-400 dark:text-zinc-400">Add receipts from individual item pages to start tracking warranties.</p>
                </div>
              ) : (
                <div className="rounded-xl bg-white dark:bg-dpurple-950 shadow-sm ring-1 ring-gray-900/5 dark:ring-dpurple-700 divide-y divide-gray-100 dark:divide-dpurple-700">
                  {receipts.map(r => (
                    <div key={r.id} className="flex items-start justify-between p-4 hover:bg-gray-50 dark:hover:bg-dpurple-900 transition-colors gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{r.title}</p>
                          {r.items && (
                            <Link
                              href={`/dashboard/item/${r.item_id}`}
                              className="text-xs text-violet-600 hover:underline"
                            >
                              {r.items.title}
                            </Link>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {r.purchase_date && (
                              <span className="text-xs text-gray-500 dark:text-zinc-400">
                                Purchased: {new Date(r.purchase_date).toLocaleDateString()}
                              </span>
                            )}
                            {r.warranty_expiry && (
                              <span className={`text-xs font-medium ${new Date(r.warranty_expiry) < now ? 'text-red-500' : 'text-green-600'}`}>
                                Warranty: {new Date(r.warranty_expiry).toLocaleDateString()}
                                {new Date(r.warranty_expiry) < now && ' (expired)'}
                              </span>
                            )}
                          </div>
                          {r.notes && <p className="text-xs text-gray-400 dark:text-zinc-400 mt-1 line-clamp-2">{r.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {r.receipt_url && (
                          <a
                            href={r.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 dark:text-zinc-400 hover:text-violet-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dpurple-800"
                            title="View receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 text-gray-400 dark:text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dpurple-800"
                          title="Delete receipt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
