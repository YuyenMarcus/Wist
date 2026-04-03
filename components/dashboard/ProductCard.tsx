'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Trash2, MoreHorizontal, Check, FolderInput, TrendingDown, TrendingUp, Minus, ShoppingBag, EyeOff, PackageX, ImageIcon, X, AlertTriangle, Pin } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { isAdultContent } from '@/lib/content-filter';
import { affiliateUrl } from '@/lib/amazon-affiliate';
import { useTranslation } from '@/lib/i18n/context';

interface ProductItem {
  id: string;
  title: string | null;
  price: number | null;
  image: string | null;
  url: string;
  collection_id?: string | null;
  current_price?: number | null;
  image_url?: string | null;
  price_change?: number | null;
  price_change_percent?: number | null;
  previous_price?: number | null;
  last_price_check?: string | null;
  price_check_failures?: number | null;
  out_of_stock?: boolean;
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
  onHide?: (id: string) => void;
  onPinItem?: (id: string) => void;
  adultFilterEnabled?: boolean;
  index?: number;
  tier?: string | null;
  pinnedItemId?: string | null;
  amazonTag?: string | null;
}

export default function ProductCard({ item, userCollections = [], onDelete, onHide, onPinItem, adultFilterEnabled = false, index = 0, tier, pinnedItemId, amazonTag }: Props) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const router = useRouter();
  const buyUrl = affiliateUrl(item.url, amazonTag);
  
  const formatPrice = (price: number | null | undefined): string => {
    if (!price || price === 0) return 'Price not available';
    return `$${price.toFixed(2)}`;
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  const price = item.current_price || item.price;
  const imageUrl = localImageUrl ?? item.image_url ?? item.image;
  const title = item.title || 'Untitled Item';
  const domain = getDomain(item.url);
  const isNsfw = adultFilterEnabled && isAdultContent(item.title);

  // Close menu on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    setIsMenuOpen(false);
    if (onDelete) await onDelete(item.id);
  };

  const handleChangeImage = () => {
    setEditedImageUrl(imageUrl || '');
    setIsEditingImage(true);
    setIsMenuOpen(false);
  };

  const handleSaveImage = async () => {
    const trimmedUrl = editedImageUrl.trim();
    if (!trimmedUrl) { setIsEditingImage(false); return; }
    setIsSavingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('items')
        .update({ image_url: trimmedUrl })
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setLocalImageUrl(trimmedUrl);
      setIsEditingImage(false);
    } catch (err: any) {
      console.error('Error updating image:', err);
      alert('Failed to update image: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleHide = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('items')
        .update({ status: 'hidden' })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error hiding item:', error);
        return;
      }

      setIsMenuOpen(false);
      if (onHide) {
        onHide(item.id);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Error hiding item:', err);
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={`group relative rounded-xl overflow-hidden border transition-all duration-300 ${
        item.out_of_stock
          ? 'border-red-200 dark:border-red-900/40 hover:border-red-300 hover:shadow-lg'
          : 'border-beige-200 dark:border-dpurple-700 hover:border-violet-500 hover:shadow-lg'
      }`}
    >
      {/* Image Container + Title Overlay — isolate keeps badges/title layers inside the card (no bleed over header/modals) */}
      <div className="relative isolate aspect-[2/3] overflow-hidden bg-beige-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${isNsfw ? 'blur-xl scale-110' : ''} ${item.out_of_stock ? 'grayscale opacity-60' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50">
            <span className="text-lg sm:text-2xl font-medium text-zinc-400">
              {title.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* NSFW Overlay */}
        {isNsfw && (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-zinc-900/40">
            <EyeOff className="w-6 h-6 sm:w-8 sm:h-8 text-white/80 mb-1" />
            <span className="text-white/90 text-xs sm:text-sm font-bold tracking-wider">18+</span>
          </div>
        )}
        
        {/* Badges - Top Left: stacked vertically */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[2] flex flex-col gap-1">
          {/* Site Favicon Badge */}
          {domain && (
            <div title={domain}>
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full pl-1 pr-1.5 sm:pl-1.5 sm:pr-2 py-0.5 sm:py-1 shadow-sm">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                  alt={domain}
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm"
                  loading="lazy"
                />
                <span className="text-[8px] sm:text-[10px] font-medium text-zinc-600 max-w-[50px] sm:max-w-[70px] truncate capitalize">
                  {domain.split('.')[0]}
                </span>
              </div>
            </div>
          )}
          {/* Price Drop Badge */}
          {item.price_change != null && item.price_change < 0 && !item.out_of_stock && (
            <span className="inline-flex items-center gap-0.5 sm:gap-1 bg-green-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-lg animate-pulse">
              <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">Price Drop!</span>
              <span className="sm:hidden">Drop!</span>
            </span>
          )}
          {/* Out of Stock Badge */}
          {item.out_of_stock && (
            <span className="inline-flex items-center gap-0.5 sm:gap-1 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-lg">
              <PackageX className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">Out of Stock</span>
              <span className="sm:hidden">OOS</span>
            </span>
          )}
        </div>

        {/* Out-of-Stock Overlay Bar */}
        {item.out_of_stock && (
          <div className="absolute inset-x-0 top-1/2 z-[2] -translate-y-1/2 bg-red-600/90 backdrop-blur-sm py-1.5 sm:py-2 text-center">
            <span className="text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <PackageX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Out of Stock
            </span>
          </div>
        )}

        {/* Loading Overlay */}
        {isMoving && (
          <div className="absolute inset-0 z-[4] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs font-medium text-zinc-600">Moving...</span>
            </div>
          </div>
        )}

        {/* Menu Button - Top Right Corner - Always visible on mobile */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[3] opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
          <button 
            ref={menuButtonRef}
            onClick={() => {
              if (!isMenuOpen && menuButtonRef.current) {
                const rect = menuButtonRef.current.getBoundingClientRect();
                const menuWidth = 192;
                const menuHeight = 320;
                let left = rect.right - menuWidth;
                if (left < 8) left = 8;
                let top = rect.bottom + 6;
                if (top + menuHeight > window.innerHeight - 8) {
                  top = rect.top - menuHeight - 6;
                  if (top < 8) top = 8;
                }
                setMenuPos({ top, left });
              }
              setIsMenuOpen(!isMenuOpen);
            }}
            className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white text-zinc-600 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal size={14} className="sm:hidden" />
            <MoreHorizontal size={16} className="hidden sm:block" />
          </button>
        </div>

        {/* Dropdown Menu - Portaled to body to escape overflow:hidden + transform */}
        {isMenuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsMenuOpen(false)} />
            <div
              className="fixed w-48 bg-beige-50 dark:bg-dpurple-900 rounded-lg shadow-xl border border-beige-200 dark:border-dpurple-600 p-1 z-[9999] max-h-[70vh] overflow-y-auto"
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-semibold text-zinc-400 px-2 py-1.5 uppercase tracking-wider">
                Move to...
              </div>
              
              <button
                onClick={() => handleMoveToCollection(null)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-dpurple-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              >
                <FolderInput size={14} />
                <span>{t('No collection')}</span>
                {!item.collection_id && (
                  <Check size={14} className="ml-auto text-violet-500" />
                )}
              </button>

              <div className="h-px bg-zinc-100 my-1" />

              {userCollections.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-zinc-400">
                  No collections yet
                </div>
              ) : (
                userCollections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => handleMoveToCollection(col.id)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-dpurple-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    <span className="truncate">{col.name}</span>
                    {item.collection_id === col.id && (
                      <Check size={14} className="ml-auto text-violet-500" />
                    )}
                  </button>
                ))
              )}

              <div className="h-px bg-zinc-100 my-1" />
              <button
                onClick={handleChangeImage}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-dpurple-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              >
                <ImageIcon size={14} />
                <span>Change Image</span>
              </button>

              <div className="h-px bg-zinc-100 my-1" />

              <button
                onClick={handleMarkAsPurchased}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-green-50 text-green-600 transition-colors"
              >
                <ShoppingBag size={14} />
                <span>Just Got It!</span>
              </button>

              <button
                onClick={handleHide}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-dpurple-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              >
                <EyeOff size={14} />
                <span>Hide</span>
              </button>

              {onPinItem && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onPinItem(item.id);
                  }}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                    pinnedItemId === item.id
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                      : 'hover:bg-amber-50 dark:hover:bg-amber-950/30 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <Pin size={14} />
                  <span>{pinnedItemId === item.id ? 'Unpin from Profile' : 'Pin to Profile'}</span>
                </button>
              )}

              {onDelete && (
                <>
                  <div className="h-px bg-zinc-100 my-1" />
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
          </>,
          document.body
        )}

        {/* (favicon badge is in the stacked badges section above) */}

        {/* Visit Link Button - Bottom Right */}
        <a
          href={buyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-[3] opacity-0 transition-opacity duration-200 group-hover:opacity-100 p-1.5 sm:p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-dpurple-800 text-zinc-600 dark:text-zinc-300"
          onClick={(e) => e.stopPropagation()}
          title="Visit product page"
        >
          <ExternalLink size={14} className="sm:hidden" />
          <ExternalLink size={16} className="hidden sm:block" />
        </a>

        {/* Title - Seamless overlay at bottom of image */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-8 pb-2 px-2 sm:px-3">
          <h3 className="font-medium text-white text-xs sm:text-sm line-clamp-2 drop-shadow-sm">
            {title}
          </h3>
        </div>
      </div>

      {/* Image Edit UI */}
      {isEditingImage && (
        <div className="bg-white dark:bg-dpurple-900 p-3 sm:p-4 border-t border-beige-200 dark:border-dpurple-700">
          <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Image URL</label>
          <input
            type="url"
            value={editedImageUrl}
            onChange={(e) => setEditedImageUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveImage(); if (e.key === 'Escape') setIsEditingImage(false); }}
            placeholder="https://..."
            autoFocus
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800 border border-violet-300 dark:border-violet-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-800"
            disabled={isSavingImage}
          />
          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={handleSaveImage} disabled={isSavingImage} className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-violet-500 text-white text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50">
              <Check size={12} /> Save
            </button>
            <button onClick={() => setIsEditingImage(false)} disabled={isSavingImage} className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-zinc-100 text-zinc-600 text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Section - Price, History, Buy */}
      <div className="bg-white dark:bg-dpurple-900 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-b-xl">
        {/* Price with change indicator */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {price && price > 0 && (
            <p className="text-zinc-900 dark:text-white text-xs sm:text-sm font-bold">
              {formatPrice(price)}
            </p>
          )}
          
          {/* Price Change Badge */}
          {item.price_change != null && item.price_change !== 0 && (
            <span 
              className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-full ${
                item.price_change < 0 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}
              title={`Was ${formatPrice(item.previous_price || 0)}`}
            >
              {item.price_change < 0 ? (
                <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              ) : (
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              {Math.abs(item.price_change_percent || 0).toFixed(0)}%
            </span>
          )}
        </div>
        
        {/* Show previous price if there was a change */}
        {item.previous_price && item.price_change !== 0 && (
          <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 sm:mt-1 line-through">
            Was {formatPrice(item.previous_price)}
          </p>
        )}

        {/* In Stock / Out of Stock (Pro and above) */}
        {tier && tier !== 'free' && (
          <p className={`text-[10px] sm:text-xs font-medium mt-1 sm:mt-1.5 ${item.out_of_stock ? 'text-red-500' : 'text-emerald-500'}`}>
            {item.out_of_stock ? 'Out of Stock' : 'In Stock'}
          </p>
        )}

        {/* Scrape issues only — no "last checked" timestamps (price change uses arrows above) */}
        {(item.price_check_failures ?? 0) > 0 && (
          <div className="flex items-center gap-1 mt-1 sm:mt-1.5">
            <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-amber-500" />
            <span className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              {(item.price_check_failures ?? 0) >= 3 ? 'Check failed' : 'Price may be outdated'}
            </span>
          </div>
        )}

        {/* Action Buttons - hidden until hover on desktop, always visible on mobile */}
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-2">
          <Link 
            href={`/dashboard/item/${item.id}`}
            className="flex-1 inline-flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-dpurple-800 hover:bg-zinc-200 dark:hover:bg-dpurple-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            History
          </Link>
          
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            Buy
          </a>
        </div>
      </div>
    </motion.div>
  );
}

