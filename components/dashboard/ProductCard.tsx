'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Trash2, MoreHorizontal, Check, FolderInput, TrendingDown, TrendingUp, Minus, ShoppingBag } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface ProductItem {
  id: string;
  title: string | null;
  price: number | null;
  image: string | null;
  url: string;
  collection_id?: string | null;
  current_price?: number | null;
  image_url?: string | null;
  // Price tracking fields
  price_change?: number | null;
  price_change_percent?: number | null;
  previous_price?: number | null;
  last_price_check?: string | null;
}

interface PriceHistoryPoint {
  price: number;
  date: string;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  item: ProductItem;
  userCollections?: Collection[];
  onDelete?: (id: string) => void;
}

export default function ProductCard({ item, userCollections = [], onDelete }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false); // Loading state for moving items
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Format price
  const formatPrice = (price: number | null | undefined): string => {
    if (!price || price === 0) return 'Price not available';
    return `$${price.toFixed(2)}`;
  };

  const price = item.current_price || item.price;
  const imageUrl = item.image_url || item.image;
  const title = item.title || 'Untitled Item';

  // Fetch price history for mini chart
  useEffect(() => {
    async function fetchPriceHistory() {
      setHistoryLoading(true);
      const { data, error } = await supabase
        .from('price_history')
        .select('price, created_at')
        .eq('item_id', item.id)
        .order('created_at', { ascending: true })
        .limit(30); // Last 30 data points for the sparkline

      if (!error && data && data.length > 0) {
        setPriceHistory(data.map(d => ({
          price: Number(d.price),
          date: d.created_at
        })));
      }
      setHistoryLoading(false);
    }

    fetchPriceHistory();
  }, [item.id]);

  // Generate mock data for preview when no real data exists
  const getMockOrRealData = () => {
    if (priceHistory.length >= 2) {
      return priceHistory;
    }
    
    // Generate mock data based on current price to show what chart will look like
    const basePrice = price || 100;
    const mockData: PriceHistoryPoint[] = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Create slight price variations for visual effect (±5%)
      const variation = 1 + (Math.sin(i * 0.8) * 0.05);
      mockData.push({
        price: Number((basePrice * variation).toFixed(2)),
        date: date.toISOString()
      });
    }
    return mockData;
  };

  const chartData = getMockOrRealData();
  const isUsingMockData = priceHistory.length < 2;
  
  // Determine chart color based on price trend
  const getChartColor = () => {
    if (chartData.length < 2) return '#8b5cf6'; // violet for no data
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    if (lastPrice < firstPrice) return '#22c55e'; // green for price drop
    if (lastPrice > firstPrice) return '#ef4444'; // red for price increase
    return '#8b5cf6'; // violet for no change
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMoveToCollection = async (collectionId: string | null) => {
    setIsMoving(true); // Show loading overlay
    try {
      // Get current user to verify ownership
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to move items');
        setIsMoving(false);
        return;
      }

      console.log('🔄 Moving item:', item.id, 'to collection:', collectionId);

      // First, check if item exists in items table
      const { data: itemCheck, error: itemCheckError } = await supabase
        .from('items')
        .select('id, user_id')
        .eq('id', item.id)
        .eq('user_id', user.id)
        .maybeSingle();

      let updateResult;
      
      if (itemCheck && !itemCheckError) {
        // Item is in items table - update it
        console.log('📦 Item found in items table, updating...');
        console.log('📝 Update details:', { itemId: item.id, collectionId, userId: user.id });
        updateResult = await supabase
          .from('items')
          .update({ collection_id: collectionId })
          .eq('id', item.id)
          .eq('user_id', user.id)
          .select();
        
        console.log('📊 Update result:', { 
          data: updateResult.data, 
          error: updateResult.error,
          dataLength: updateResult.data?.length 
        });
      } else {
        // Item not found by ID - check if item with same URL already exists for this user
        // This prevents duplicates when moving items created via paste link
        console.log('🔍 Item not found by ID, checking for existing item by URL...');
        const { data: existingItem } = await supabase
          .from('items')
          .select('id, user_id')
          .eq('url', item.url)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingItem) {
          // Item with same URL exists - update it instead of creating duplicate
          console.log('📦 Found existing item with same URL, updating...');
          updateResult = await supabase
            .from('items')
            .update({ collection_id: collectionId })
            .eq('id', existingItem.id)
            .eq('user_id', user.id)
            .select();
        } else {
          // Item doesn't exist - check products table as last resort
          console.log('🔍 No existing item found, checking products table...');
          const { data: productCheck } = await supabase
            .from('products')
            .select('id, user_id, title, url, price, image')
            .eq('id', item.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (productCheck) {
            // Check again if item with same URL exists (race condition protection)
            const { data: doubleCheck } = await supabase
              .from('items')
              .select('id')
              .eq('url', productCheck.url || item.url)
              .eq('user_id', user.id)
              .maybeSingle();

            if (doubleCheck) {
              // Item was created between checks - update it
              console.log('📦 Item created between checks, updating...');
              updateResult = await supabase
                .from('items')
                .update({ collection_id: collectionId })
                .eq('id', doubleCheck.id)
                .eq('user_id', user.id)
                .select();
            } else {
              // Create a new item entry linked to this product
              console.log('📦 Item found in products table, creating items entry...');
              
              const { data: newItem, error: createError } = await supabase
                .from('items')
                .insert({
                  user_id: user.id,
                  title: productCheck.title || item.title || 'Untitled',
                  url: productCheck.url || item.url,
                  current_price: productCheck.price ? parseFloat(productCheck.price.toString()) : (item.price ? parseFloat(item.price.toString()) : null),
                  image_url: productCheck.image || item.image_url || item.image || null,
                  collection_id: collectionId,
                  status: 'active'
                })
                .select()
                .single();

              if (createError) {
                // If insert fails due to duplicate URL, try to update instead
                if (createError.code === '23505' || createError.message.includes('duplicate') || createError.message.includes('unique')) {
                  console.log('⚠️ Duplicate detected, updating existing item...');
                  const { data: existingByUrl } = await supabase
                    .from('items')
                    .select('id')
                    .eq('url', productCheck.url || item.url)
                    .eq('user_id', user.id)
                    .maybeSingle();
                  
                  if (existingByUrl) {
                    updateResult = await supabase
                      .from('items')
                      .update({ collection_id: collectionId })
                      .eq('id', existingByUrl.id)
                      .eq('user_id', user.id)
                      .select();
                  } else {
                    console.error('❌ Error creating item entry:', createError);
                    alert('Failed to move item: ' + createError.message);
                    setIsMoving(false);
                    return;
                  }
                } else {
                  console.error('❌ Error creating item entry:', createError);
                  alert('Failed to move item: ' + createError.message);
                  setIsMoving(false);
                  return;
                }
              } else {
                updateResult = { data: [newItem], error: null };
              }
            }
          } else {
            console.error('⚠️ Item not found in either items or products table');
            alert('Failed to move item: Item not found');
            setIsMoving(false);
            return;
          }
        }
      }
      
      if (updateResult.error) {
        console.error('❌ Error moving item:', updateResult.error);
        alert('Failed to move item: ' + updateResult.error.message);
        setIsMoving(false);
        return;
      }

      if (!updateResult.data || updateResult.data.length === 0) {
        console.error('⚠️ No rows updated. Item may not exist or you may not own it.');
        alert('Failed to move item: Item not found or you do not have permission');
        setIsMoving(false);
        return;
      }

      console.log('✅ Successfully moved item:', updateResult.data[0]);
      setIsMenuOpen(false);
      setIsMoving(false);
      
      // Force a page refresh to ensure collections and items are in sync
      window.location.reload();
    } catch (err: any) {
      console.error('❌ Error moving item:', err);
      alert('Failed to move item: ' + (err.message || 'Unknown error'));
      setIsMoving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    if (onDelete) {
      onDelete(item.id);
    }
  };

  const handleMarkAsPurchased = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('items')
        .update({ status: 'purchased' })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking as purchased:', error);
        alert('Failed to mark as purchased: ' + error.message);
      } else {
        setIsMenuOpen(false);
        // Trigger page reload to update the list
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Error:', err);
      alert('Failed to mark as purchased');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative bg-white rounded-xl overflow-hidden border border-zinc-200 hover:border-violet-500 hover:shadow-lg transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50">
            <span className="text-2xl font-medium text-zinc-400">
              {title.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Price Drop Badge - Shows when price dropped significantly (>5%) */}
        {item.price_change != null && item.price_change < 0 && (item.price_change_percent || 0) <= -5 && (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
              <TrendingDown className="w-3 h-3" />
              Price Drop!
            </span>
          </div>
        )}

        {/* Loading Overlay */}
        {isMoving && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs font-medium text-zinc-600">Moving...</span>
            </div>
          </div>
        )}

        {/* Menu Button - Top Right Corner - Always visible on mobile */}
        <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 z-10" ref={menuRef}>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white text-zinc-600 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Menu - Positioned to avoid overflow on mobile */}
            {isMenuOpen && (
              <div className="absolute right-0 sm:right-0 top-full mt-2 w-44 sm:w-48 bg-white rounded-lg shadow-xl border border-zinc-200 p-1 z-20 max-h-[70vh] overflow-y-auto">
                <div className="text-xs font-semibold text-zinc-400 px-2 py-1.5 uppercase tracking-wider">
                  Move to...
                </div>
                
                {/* Option to remove from collection */}
                <button
                  onClick={() => handleMoveToCollection(null)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
                >
                  <FolderInput size={14} />
                  <span>Uncategorized</span>
                  {!item.collection_id && (
                    <Check size={14} className="ml-auto text-violet-500" />
                  )}
                </button>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                {/* List user collections */}
                {userCollections.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-zinc-400">
                    No collections yet
                  </div>
                ) : (
                  userCollections.map(col => (
                    <button
                      key={col.id}
                      onClick={() => handleMoveToCollection(col.id)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
                    >
                      <span className="truncate">{col.name}</span>
                      {item.collection_id === col.id && (
                        <Check size={14} className="ml-auto text-violet-500" />
                      )}
                    </button>
                  ))
                )}

                {/* Mark as Purchased Option */}
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                <button
                  onClick={handleMarkAsPurchased}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
                >
                  <ShoppingBag size={14} />
                  <span>Just Got It!</span>
                </button>

                {/* Delete Option */}
                {onDelete && (
                  <>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                    <button
                      onClick={handleDelete}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-red-50 text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Visit Link Button - Bottom Right */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          onClick={(e) => e.stopPropagation()}
          title="Visit product page"
        >
          <ExternalLink size={16} />
        </a>
      </div>

      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-medium text-zinc-900 text-sm mb-2 line-clamp-2">
          {title}
        </h3>
        
        {/* Price with change indicator */}
        <div className="flex items-center gap-2">
          {price && price > 0 && (
            <p className="text-zinc-900 dark:text-white text-sm font-bold">
              {formatPrice(price)}
            </p>
          )}
          
          {/* Price Change Badge */}
          {item.price_change != null && item.price_change !== 0 && (
            <span 
              className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                item.price_change < 0 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}
              title={`Was ${formatPrice(item.previous_price || 0)}`}
            >
              {item.price_change < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3" />
              )}
              {Math.abs(item.price_change_percent || 0).toFixed(0)}%
            </span>
          )}
        </div>
        
        {/* Show previous price if there was a change */}
        {item.previous_price && item.price_change !== 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-through">
            Was {formatPrice(item.previous_price)}
          </p>
        )}

        {/* Mini Price Chart */}
        <div className="mt-3 relative">
          <div className="h-12 w-full">
            {historyLoading ? (
              <div className="h-full w-full bg-zinc-100 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke={getChartColor()}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {isUsingMockData && !historyLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded">
              <span className="text-[10px] text-zinc-400 font-medium px-2 py-1 bg-white/80 rounded">
                Price tracking starts soon
              </span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="mt-3 flex items-center gap-2">
          {/* View History Link */}
          <Link 
            href={`/dashboard/item/${item.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <BarChart3 className="w-3 h-3" />
            History
          </Link>
          
          {/* Buy Button */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-2 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            Buy
          </a>
        </div>
      </div>
    </motion.div>
  );
}

