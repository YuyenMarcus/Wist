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
  const [priceStatus, setPriceStatus] = useState<any>(null);

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
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('price, recorded_at')
        .eq('item_id', itemId)
        .gte('recorded_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days only
        .order('recorded_at', { ascending: true })
        .limit(100); // Limit to 100 most recent entries

      if (historyError) {
        console.error("History Error:", historyError);
      }

      // Format data
      if (historyData && historyData.length > 0) {
        console.log("Raw History Data:", historyData); // Check console to see real data

        const formattedHistory = historyData.map(entry => {
          const dateObj = new Date(entry.recorded_at);
          return {
            price: Number(entry.price), // Force number
            // Create a simple string like "12/24"
            date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`, 
            fullDate: dateObj.toLocaleDateString()
          };
        });
        
        console.log("Formatted History:", formattedHistory); // Debug: see formatted data
        setHistory(formattedHistory);
      } else {
        console.log("No history found for this item.");
      }
      
      setLoading(false);
    }

    fetchData();
    
    // Fetch price status
    async function fetchPriceStatus() {
      if (!params || !params.id) return;
      
      const itemId = params.id as string;
      try {
        const response = await fetch(`/api/items/${itemId}/check-price`, {
          method: 'POST',
        });
        
        const data = await response.json();
        if (data.success) {
          setPriceStatus(data);
        }
      } catch (error) {
        console.error('Error fetching price status:', error);
      }
    }
    
    fetchPriceStatus();
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
                
                <div className="mt-6 flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold text-gray-900">${currentPrice.toFixed(2)}</span>
                  {history.length > 1 && (
                    <span className={`text-sm font-semibold ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                      {isCheaper ? '▼' : '▲'} ${Math.abs(diff).toFixed(2)}
                    </span>
                  )}
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
            
            {/* Price Status Component - Shows Cached Data */}
            {priceStatus && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Price Tracking Status</h3>
                <div className="space-y-4">
                  {/* Current Price */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Current Price</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${priceStatus.currentPrice ? parseFloat(priceStatus.currentPrice).toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  
                  {/* Price Change Trend */}
                  {priceStatus.priceChange !== null && priceStatus.priceChange !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Price Change</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold ${
                          priceStatus.priceChange < 0 ? 'text-green-600' : priceStatus.priceChange > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {priceStatus.priceChange < 0 ? '▼' : priceStatus.priceChange > 0 ? '▲' : '→'} 
                          ${Math.abs(priceStatus.priceChange).toFixed(2)}
                        </span>
                        {priceStatus.priceChangePercent && (
                          <span className={`text-sm font-semibold ${
                            priceStatus.priceChange < 0 ? 'text-green-600' : priceStatus.priceChange > 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            ({priceStatus.priceChangePercent}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Data Points Count */}
                  {priceStatus.dataPoints !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Data Points</span>
                      <span className="text-sm text-gray-700 font-medium">
                        {priceStatus.dataPoints} {priceStatus.dataPoints === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  )}
                  
                  {/* Last Checked */}
                  {priceStatus.lastChecked && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Last Checked</span>
                      <span className="text-sm text-gray-500">
                        {new Date(priceStatus.lastChecked).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {/* Next Check */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Next Check</span>
                    <span className="text-sm font-semibold text-violet-600">
                      {priceStatus.hoursUntilNextCheck > 0 
                        ? `In ${priceStatus.hoursUntilNextCheck} hour${priceStatus.hoursUntilNextCheck !== 1 ? 's' : ''}`
                        : 'Soon'}
                    </span>
                  </div>
                  
                  {/* Status Message */}
                  <div className="mt-4 p-4 bg-violet-50 rounded-lg border border-violet-100">
                    <p className="text-sm text-violet-700 text-center font-medium">{priceStatus.message}</p>
                    {priceStatus.cached && (
                      <p className="text-xs text-violet-600 text-center mt-2">
                        Showing cached data • Automatic updates every 24 hours
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Chart Card */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <h2 className="mb-6 text-lg font-bold text-gray-900">Price History</h2>
              
              <div className="h-80 w-full">
                {history.length > 0 ? (
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
                        dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} 
                        activeDot={{ r: 6, fill: '#4f46e5' }} 
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-gray-400 space-y-4 px-4">
                    <p className="text-base font-medium">No price history yet.</p>
                    {priceStatus ? (
                      <div className="text-sm text-gray-500 text-center space-y-2 max-w-md">
                        <p className="font-medium">{priceStatus.message}</p>
                        {priceStatus.lastChecked && (
                          <p className="text-xs text-gray-400">
                            Last checked: {new Date(priceStatus.lastChecked).toLocaleString()}
                          </p>
                        )}
                        {priceStatus.hoursUntilNextCheck !== undefined && priceStatus.hoursUntilNextCheck > 0 && (
                          <p className="text-xs text-gray-400">
                            Next check in {priceStatus.hoursUntilNextCheck} hour{priceStatus.hoursUntilNextCheck !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center">We're tracking this item's price. Check back in 24 hours to see price trends!</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <h3 className="font-bold text-gray-900">My Notes</h3>
              <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                {item.note || item.description || "No notes added for this item yet."}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}