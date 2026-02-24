'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';
import { Receipt, FileText, Plus, Trash2, Shield, BarChart3, Lock } from 'lucide-react';

export default function ItemDetail() {
  const params = useParams(); 
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [userTier, setUserTier] = useState('free');
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ title: '', purchase_date: '', warranty_expiry: '', receipt_url: '', notes: '' });
  const [savingReceipt, setSavingReceipt] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!params || !params.id) return;
      
      const itemId = params.id as string;

      // 1. Get Item Details - try items table first, then products table
      let itemData = null;
      let itemError = null;

      // Try items table first
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemsData && !itemsError) {
        itemData = itemsData;
      } else {
        // Try products table
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('id', itemId)
          .single();

        if (productsData && !productsError) {
          itemData = {
            ...productsData,
            image_url: productsData.image,
            current_price: productsData.price ? parseFloat(productsData.price) : null,
            retailer: productsData.domain || 'Amazon'
          };
        } else {
          itemError = productsError || itemsError;
        }
      }

      if (itemError || !itemData) {
        console.error("Error fetching item:", itemError);
        router.push('/dashboard'); 
        return;
      }

      setItem(itemData);

      // 2. Get Price History (LIMITED to last 100 entries or 90 days)
      // Note: price_history table uses 'created_at' column, not 'recorded_at'
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('price, created_at')
        .eq('item_id', itemId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days only
        .order('created_at', { ascending: true })
        .limit(100); // Limit to 100 most recent entries

      if (historyError) {
        console.error("History Error:", historyError);
      }

      // Format data
      if (historyData && historyData.length > 0) {
        const formattedHistory = historyData.map(entry => {
          const dateObj = new Date(entry.created_at);
          return {
            price: Number(entry.price),
            date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`, 
            fullDate: dateObj.toLocaleDateString()
          };
        });
        
        // If only 1 point, add the current price as a second point so recharts draws a line
        if (formattedHistory.length === 1) {
          const currentP = parseFloat(itemData.current_price || itemData.price) || formattedHistory[0].price;
          const now = new Date();
          formattedHistory.push({
            price: currentP,
            date: `${now.getMonth() + 1}/${now.getDate()}`,
            fullDate: now.toLocaleDateString()
          });
        }
        
        setHistory(formattedHistory);
      } else {
        // No history entries — build a baseline from item's current/added price
        const rawPrice = itemData.current_price ?? itemData.price ?? null;
        const price = rawPrice !== null ? parseFloat(String(rawPrice)) : NaN;
        
        if (!isNaN(price) && price > 0) {
          const now = new Date();
          const addedDate = itemData.created_at ? new Date(itemData.created_at) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          setHistory([
            {
              price,
              date: `${addedDate.getMonth() + 1}/${addedDate.getDate()}`,
              fullDate: addedDate.toLocaleDateString()
            },
            {
              price,
              date: `${now.getMonth() + 1}/${now.getDate()}`,
              fullDate: now.toLocaleDateString()
            }
          ]);
        }
      }
      
      setLoading(false);
    }

    fetchData();
  }, [params, router]);

  useEffect(() => {
    async function loadReceipts() {
      if (!params?.id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      setUserTier(profile?.subscription_tier || 'free');

      const res = await fetch(`/api/receipts?item_id=${params.id}`);
      if (res.ok) {
        const json = await res.json();
        setReceipts(json.receipts || []);
      }
    }
    loadReceipts();
  }, [params?.id]);

  async function handleSaveReceipt() {
    if (!params?.id || !receiptForm.title.trim()) return;
    setSavingReceipt(true);
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...receiptForm, item_id: params.id }),
      });
      if (res.ok) {
        const json = await res.json();
        setReceipts(prev => [...prev, json.receipt]);
        setReceiptForm({ title: '', purchase_date: '', warranty_expiry: '', receipt_url: '', notes: '' });
        setShowReceiptForm(false);
      }
    } catch (e) {
      console.error('Failed to save receipt:', e);
    } finally {
      setSavingReceipt(false);
    }
  }

  async function handleDeleteReceipt(id: string) {
    const res = await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setReceipts(prev => prev.filter(r => r.id !== id));
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
    </div>
  );

  if (!item) return <div className="p-10 text-center">Item not found</div>;

  // Calculate stats
  const startPrice = history.length > 0 ? history[0].price : (item.current_price ? parseFloat(item.current_price) : 0);
  const currentPrice = item.current_price ? parseFloat(item.current_price) : 0;
  const diff = currentPrice - startPrice;
  const isCheaper = diff < 0;
  const cSym = '$';
  const cDec = 2;

  return (
    <PageTransition className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center text-sm font-medium text-gray-500 hover:text-indigo-600">
          ← Back to Dashboard
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN: Image & Info */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="aspect-square w-full bg-white p-6 flex items-center justify-center">
                <img src={item.image_url || item.image} alt={item.title} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="p-6 border-t border-gray-100">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  {item.retailer || item.domain || 'Amazon'}
                </div>
                <h1 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h1>
                
                <div className="mt-6 space-y-3">
                  {/* Current Price */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold text-gray-900">{cSym}{currentPrice.toFixed(cDec)}</span>
                    {history.length > 1 && (
                      <span className={`text-sm font-semibold ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                        {isCheaper ? '▼' : '▲'} {cSym}{Math.abs(diff).toFixed(cDec)}
                      </span>
                    )}
                  </div>
                  
                  {/* Last Checked Time */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      {item.last_price_check ? (
                        <>
                          Last checked: {(() => {
                            const lastChecked = new Date(item.last_price_check);
                            const now = new Date();
                            const hoursAgo = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60));
                            
                            if (hoursAgo === 0) return 'Less than an hour ago';
                            if (hoursAgo === 1) return '1 hour ago';
                            return `${hoursAgo} hours ago`;
                          })()}
                        </>
                      ) : (
                        'Not checked yet'
                      )}
                    </p>
                  </div>
                </div>

                <a 
                  href={item.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 block w-full rounded-lg bg-violet-600 py-3 text-center font-bold text-white shadow-sm hover:bg-violet-700 transition-colors"
                >
                  Buy Now
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Chart & History */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Price History Chart */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <h2 className="mb-6 text-lg font-bold text-gray-900">Price History</h2>
              
              <div className="h-80 w-full">
                {history.length > 0 ? (
                  <div className="relative h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#6b7280', fontSize: 12}} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#6b7280', fontSize: 12}} 
                          tickFormatter={(val) => `$${val}`} 
                          domain={[(d: number) => Math.floor(d * 0.95), (d: number) => Math.ceil(d * 1.05)]}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                          formatter={(value: number | undefined) => value !== undefined ? [`${cSym}${value.toFixed(cDec)}`, 'Price'] : ['', '']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#7c3aed" 
                          strokeWidth={3} 
                          fill="url(#priceGradient)"
                          dot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }} 
                          activeDot={{ r: 6, fill: '#7c3aed' }} 
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {history.length <= 2 && history[0]?.price === history[history.length - 1]?.price && (
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Price tracking active — the chart will update as prices change
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-gray-400 space-y-3 px-4">
                    <p className="text-base font-medium text-gray-600">No price data available.</p>
                    <p className="text-sm text-gray-500 text-center max-w-md">
                      This item doesn't have a tracked price yet. Add it again with a price to start tracking.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Price Log */}
            {history.length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
                <h3 className="font-bold text-gray-900 mb-4">Weekly Price Log</h3>
                <div className="divide-y divide-gray-100">
                  {(() => {
                    const weeks: { weekLabel: string; price: number; date: Date }[] = []
                    let lastWeek = -1
                    for (const entry of history) {
                      const d = new Date(entry.fullDate)
                      const year = d.getFullYear()
                      const startOfYear = new Date(year, 0, 1)
                      const weekNum = Math.floor(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay()) / 7)
                      const key = year * 100 + weekNum
                      if (key !== lastWeek) {
                        weeks.push({ weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), price: entry.price, date: d })
                        lastWeek = key
                      } else {
                        weeks[weeks.length - 1] = { weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), price: entry.price, date: d }
                      }
                    }
                    return weeks.map((w, i) => {
                      const prev = i > 0 ? weeks[i - 1].price : null
                      const diff = prev !== null ? w.price - prev : null
                      return (
                        <div key={i} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                            <span className="text-sm text-gray-600">{w.weekLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{cSym}{w.price.toFixed(cDec)}</span>
                            {diff !== null && diff !== 0 && (
                              <span className={`text-xs font-medium ${diff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {diff < 0 ? '↓' : '↑'} {cSym}{Math.abs(diff).toFixed(cDec)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* Receipts & Warranties */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-500" />
                  Receipts & Warranties
                </h3>
                {['pro_plus', 'creator', 'enterprise'].includes(userTier) && (
                  <button
                    onClick={() => setShowReceiptForm(!showReceiptForm)}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Receipt
                  </button>
                )}
              </div>

              {!['pro_plus', 'creator', 'enterprise'].includes(userTier) ? (
                <div className="text-center py-6 space-y-2">
                  <Shield className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">Upgrade to <span className="font-semibold text-violet-600">Wist Pro</span> to track receipts and warranties</p>
                </div>
              ) : (
                <>
                  {showReceiptForm && (
                    <div className="mb-4 space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                      <input
                        type="text"
                        placeholder="Receipt title (e.g. Amazon Purchase)"
                        value={receiptForm.title}
                        onChange={e => setReceiptForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Purchase Date</label>
                          <input
                            type="date"
                            value={receiptForm.purchase_date}
                            onChange={e => setReceiptForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Warranty Expiry</label>
                          <input
                            type="date"
                            value={receiptForm.warranty_expiry}
                            onChange={e => setReceiptForm(prev => ({ ...prev, warranty_expiry: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <input
                        type="url"
                        placeholder="Receipt URL (optional)"
                        value={receiptForm.receipt_url}
                        onChange={e => setReceiptForm(prev => ({ ...prev, receipt_url: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                      <textarea
                        placeholder="Notes (optional)"
                        value={receiptForm.notes}
                        onChange={e => setReceiptForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveReceipt}
                          disabled={savingReceipt || !receiptForm.title.trim()}
                          className="px-4 py-2 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          {savingReceipt ? 'Saving...' : 'Save Receipt'}
                        </button>
                        <button
                          onClick={() => setShowReceiptForm(false)}
                          className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {receipts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No receipts added yet</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {receipts.map(r => (
                        <div key={r.id} className="flex items-start justify-between py-3 gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {r.purchase_date && (
                                  <span className="text-xs text-gray-500">Purchased: {new Date(r.purchase_date).toLocaleDateString()}</span>
                                )}
                                {r.warranty_expiry && (
                                  <span className={`text-xs font-medium ${new Date(r.warranty_expiry) < new Date() ? 'text-red-500' : 'text-green-600'}`}>
                                    Warranty: {new Date(r.warranty_expiry).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {r.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{r.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {r.receipt_url && (
                              <a
                                href={r.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors"
                                title="View receipt"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteReceipt(r.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete receipt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Compare Prices */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-violet-500" />
                Compare Prices
              </h3>

              {!['pro', 'pro_plus', 'creator', 'enterprise'].includes(userTier) ? (
                <div className="text-center py-6 space-y-2">
                  <Lock className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">
                    Upgrade to <span className="font-semibold text-violet-600">Wist+</span> to compare prices across retailers
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <BarChart3 className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">No comparisons found yet</p>
                  <p className="text-xs text-gray-400">
                    Price comparison is being rolled out. We&apos;ll automatically find the best prices for this item across retailers.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </PageTransition>
  );
}