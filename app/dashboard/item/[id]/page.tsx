'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageTransition from '@/components/ui/PageTransition';
import { BarChart3, PackageX, PackageCheck, TrendingDown, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { affiliateUrl } from '@/lib/amazon-affiliate';
import { priceHistoryTimeMs } from '@/lib/price-history-utils';

export default function ItemDetail() {
  const params = useParams(); 
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState('free');
  const [refreshKey, setRefreshKey] = useState(0);
  const [amazonTag, setAmazonTag] = useState<string | null>(null);
  /** Last time we successfully wrote a row to price_history (may differ from last_price_check when checks fail). */
  const [lastSuccessfulTrackAt, setLastSuccessfulTrackAt] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!params || !params.id) return;
      
      const itemId = params.id as string;

      const { data: { user } } = await supabase.auth.getUser();
      let tier = 'free';
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier, amazon_affiliate_id')
          .eq('id', user.id)
          .single();
        tier = profile?.subscription_tier || 'free';
        setUserTier(tier);
        setAmazonTag(profile?.amazon_affiliate_id || null);
      }

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

      // 2. Get Price History — tier-aware range
      const TIER_HISTORY: Record<string, { days: number; limit: number }> = {
        free: { days: 30, limit: 50 },
        pro: { days: 730, limit: 500 },
        creator: { days: 730, limit: 500 },
        enterprise: { days: 730, limit: 500 },
      };
      const histCfg = TIER_HISTORY[tier] || TIER_HISTORY.free;

      const since = new Date(Date.now() - histCfg.days * 24 * 60 * 60 * 1000).toISOString();
      const sinceMs = new Date(since).getTime();

      const { data: allHistoryRows, error: historyError } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', itemId);

      if (historyError) {
        console.error("History Error:", historyError);
      }

      let historyData: any[] = [];
      let lastEverRow: any = null;

      if (allHistoryRows?.length) {
        const sortedDesc = [...allHistoryRows].sort(
          (a, b) => priceHistoryTimeMs(b) - priceHistoryTimeMs(a)
        );
        lastEverRow = sortedDesc[0] ?? null;
        historyData = [...allHistoryRows]
          .filter((e) => priceHistoryTimeMs(e) >= sinceMs)
          .sort((a, b) => priceHistoryTimeMs(a) - priceHistoryTimeMs(b))
          .slice(0, histCfg.limit);
      }

      const lastTrackIso = lastEverRow
        ? String(lastEverRow.created_at ?? lastEverRow.recorded_at ?? '')
        : '';
      setLastSuccessfulTrackAt(lastTrackIso || null);

      // Build chart from real history rows only when checks are failing: we must NOT inject a fake
      // "today" point from current_price — that made the chart look freshly checked while the
      // status line said "Could not verify".
      const curPrice = parseFloat(String(itemData.current_price ?? itemData.price ?? 0));
      const now = new Date();
      const ONE_HOUR = 3_600_000;
      const checkFailures = itemData.price_check_failures ?? 0;
      const trustDisplayedPrice = checkFailures === 0;

      const lastRow = historyData?.length ? historyData[historyData.length - 1] : null;
      const lastHistTs = lastRow ? priceHistoryTimeMs(lastRow) : null;

      const chartData: { timestamp: number; price: number; fullDate: string }[] = [];

      if (historyData?.length) {
        for (const entry of historyData) {
          const t = priceHistoryTimeMs(entry);
          const d = new Date(t || Date.now());
          chartData.push({ timestamp: d.getTime(), price: Number(entry.price), fullDate: d.toISOString() });
        }
      }

      // If checks are failing and the tier window hid all history, still show the last known logged point
      if (trustDisplayedPrice === false && chartData.length === 0 && lastEverRow && priceHistoryTimeMs(lastEverRow)) {
        const t = priceHistoryTimeMs(lastEverRow);
        const d = new Date(t);
        chartData.push({
          timestamp: d.getTime(),
          price: Number((lastEverRow as { price?: unknown }).price),
          fullDate: d.toISOString(),
        });
      }

      if (trustDisplayedPrice && curPrice > 0 && (!lastHistTs || now.getTime() - lastHistTs > ONE_HOUR)) {
        chartData.push({ timestamp: now.getTime(), price: curPrice, fullDate: now.toISOString() });
      }

      if (trustDisplayedPrice && chartData.length === 0 && curPrice > 0) {
        chartData.push(
          { timestamp: now.getTime(), price: curPrice, fullDate: now.toISOString() },
        );
      }

      if (trustDisplayedPrice && chartData.length === 1) {
        const only = chartData[0];
        chartData.push({ timestamp: now.getTime(), price: only.price, fullDate: now.toISOString() });
      }

      setHistory(chartData);
      
      setLoading(false);
    }

    fetchData();
  }, [params, router, refreshKey]);

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

  const rangeDays = history.length > 1
    ? (history[history.length - 1].timestamp - history[0].timestamp) / 86_400_000
    : 0;

  const formatXTick = (ts: number) => {
    const d = new Date(ts);
    if (rangeDays <= 30) return `${d.getMonth() + 1}/${d.getDate()}`;
    if (rangeDays <= 365) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <PageTransition className="min-h-screen bg-gray-50 dark:bg-dpurple-950 p-8 transition-colors">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-violet-400">
          ← Back to Dashboard
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN: Image & Info */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-xl bg-beige-100 dark:bg-dpurple-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-dpurple-700">
              <div className="aspect-square w-full bg-beige-50 dark:bg-dpurple-900 p-6 flex items-center justify-center">
                <img src={item.image_url || item.image} alt={item.title} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="p-6 border-t border-gray-100 dark:border-dpurple-700">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {item.retailer || item.domain || 'Amazon'}
                </div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100 leading-snug">{item.title}</h1>
                
                <div className="mt-6 space-y-3">
                  {/* Current Price */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-zinc-100">{cSym}{currentPrice.toFixed(cDec)}</span>
                    {history.length > 1 && (
                      <span className={`text-sm font-semibold ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                        {isCheaper ? '▼' : '▲'} {cSym}{Math.abs(diff).toFixed(cDec)}
                      </span>
                    )}
                  </div>
                  
                  {/* Stock Status (Pro and above) */}
                  {userTier !== 'free' && (
                    <div className="pt-2 border-t border-gray-100 dark:border-dpurple-700">
                      {item.out_of_stock ? (
                        <div className="flex items-center gap-2 text-red-500">
                          <PackageX className="w-4 h-4" />
                          <span className="text-sm font-semibold">Out of Stock</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-500">
                          <PackageCheck className="w-4 h-4" />
                          <span className="text-sm font-semibold">In Stock</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price change vs previous (no “checked X ago” timestamps) */}
                  <div className="pt-2 border-t border-gray-100 dark:border-dpurple-700 space-y-1.5">
                    {(item.price_check_failures ?? 0) >= 3 ? (
                      <p className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="font-medium">Check failed</span>
                      </p>
                    ) : (item.price_check_failures ?? 0) > 0 ? (
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                        Automated checks couldn&apos;t read the live price (site layout, bot blocking, or temporary errors).
                        The large price is your last saved value in Wist — open the store to confirm.
                        {lastSuccessfulTrackAt && (
                          <>
                            {' '}
                            Last price logged in history:{' '}
                            {new Date(lastSuccessfulTrackAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            .
                          </>
                        )}
                      </p>
                    ) : item.price_change != null && item.price_change !== 0 ? (
                      <p
                        className={`text-sm font-semibold flex items-center gap-1.5 ${
                          item.price_change < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.price_change < 0 ? (
                          <TrendingDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <TrendingUp className="w-4 h-4 shrink-0" />
                        )}
                        {item.price_change_percent != null && Number.isFinite(item.price_change_percent) ? (
                          <span>{Math.abs(item.price_change_percent).toFixed(0)}% vs last price</span>
                        ) : (
                          <span>Price {item.price_change < 0 ? 'down' : 'up'} vs last price</span>
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <a 
                  href={affiliateUrl(item.url, amazonTag)} 
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
            <div className="rounded-xl bg-beige-100 p-6 shadow-sm ring-1 ring-gray-900/5">
              <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-zinc-100">Price History</h2>
              
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
                          dataKey="timestamp"
                          type="number"
                          scale="time"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={formatXTick}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6b7280', fontSize: 12 }}
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
                          labelFormatter={(ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          formatter={(value: number | undefined) => value !== undefined ? [`${cSym}${value.toFixed(cDec)}`, 'Price'] : ['', '']}
                        />
                        <Area 
                          type="stepAfter" 
                          dataKey="price" 
                          stroke="#7c3aed" 
                          strokeWidth={3} 
                          fill="url(#priceGradient)"
                          dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} 
                          activeDot={{ r: 6, fill: '#7c3aed' }} 
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {history.length <= 2 &&
                      history[0]?.price === history[history.length - 1]?.price &&
                      (item.price_check_failures ?? 0) === 0 && (
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Price tracking active — the chart will update as prices change
                      </p>
                    )}
                    {(item.price_check_failures ?? 0) > 0 && history.length > 0 && (
                      <p className="text-xs text-amber-700/90 dark:text-amber-400/90 text-center mt-2 max-w-md mx-auto leading-relaxed">
                        Price checks are failing for this link (site blocking, layout change, etc.), so the chart only shows your{' '}
                        <span className="font-medium">last successful</span> scrapes—not a fresh &quot;today&quot; point until a check succeeds again.
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
              <div className="rounded-xl bg-beige-100 p-6 shadow-sm ring-1 ring-gray-900/5">
                <h3 className="font-bold text-gray-900 dark:text-violet-400 mb-4">Weekly Price Log</h3>
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

            {/* Compare Prices — coming soon (all tiers) */}
            <div className="rounded-xl bg-gradient-to-br from-violet-50/90 to-beige-100 dark:from-dpurple-900/80 dark:to-dpurple-950 p-6 shadow-sm ring-1 ring-violet-200/60 dark:ring-dpurple-600/50">
              <div className="flex flex-col items-center text-center py-2 sm:py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/80 dark:bg-dpurple-800/80 shadow-sm ring-1 ring-violet-100 dark:ring-dpurple-600 mb-4">
                  <BarChart3 className="w-7 h-7 text-violet-500 dark:text-violet-400" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100/90 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-xs font-semibold uppercase tracking-wide mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Coming soon
                </div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-lg mb-1">
                  Compare prices across retailers
                </h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-sm leading-relaxed">
                  We&apos;re building a way to surface the best current price for this product at major stores—right from your wishlist.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </PageTransition>
  );
}