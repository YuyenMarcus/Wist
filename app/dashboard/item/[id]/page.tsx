'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ItemDetail() {
  const params = useParams(); 
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
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
                    <span className="text-4xl font-extrabold text-gray-900">${currentPrice.toFixed(2)}</span>
                    {history.length > 1 && (
                      <span className={`text-sm font-semibold ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                        {isCheaper ? '▼' : '▲'} ${Math.abs(diff).toFixed(2)}
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
                      <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                          formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'Price'] : ['', '']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#4f46e5" 
                          strokeWidth={3} 
                          dot={{ r: 5, fill: '#4f46e5', strokeWidth: 0 }} 
                          activeDot={{ r: 6, fill: '#4f46e5' }} 
                          isAnimationActive={true}
                        />
                      </LineChart>
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
                            <span className="text-sm font-semibold text-gray-900">${w.price.toFixed(2)}</span>
                            {diff !== null && diff !== 0 && (
                              <span className={`text-xs font-medium ${diff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {diff < 0 ? '↓' : '↑'} ${Math.abs(diff).toFixed(2)}
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

          </div>
        </div>
      </div>
    </div>
  );
}