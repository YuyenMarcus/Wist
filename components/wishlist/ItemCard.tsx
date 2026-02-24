'use client'

import { motion } from 'framer-motion'
import { Trash2, Edit2, Check, X, MoreHorizontal, FolderInput, TrendingDown, TrendingUp, EyeOff, ShoppingBag } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SupabaseProduct } from '@/lib/supabase/products'
import { isAdultContent } from '@/lib/content-filter'
import { CURRENCY_INFO } from '@/lib/currency'

export interface WishlistItem {
  id: string
  title: string
  price?: string | null
  imageUrl?: string | null
  url: string
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface ItemCardProps {
  item: SupabaseProduct
  isOwner?: boolean
  onDelete?: (id: string) => void
  onReserve?: (id: string) => void
  onUpdate?: (id: string, updatedItem: SupabaseProduct) => void
  onHide?: (id: string) => void
  userCollections?: Collection[]
  adultFilterEnabled?: boolean
  index?: number
}

export default function ItemCard({ item, isOwner = true, onDelete, onReserve, onUpdate, onHide, userCollections = [], adultFilterEnabled = false, index = 0 }: ItemCardProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(item.title || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const title = item.title || 'Untitled Item'
  const imageUrl = item.image || null
  const originalCurrency = (item as any).original_currency || 'USD'
  const currInfo = CURRENCY_INFO[originalCurrency] || CURRENCY_INFO['USD']
  const price = item.price 
    ? `${currInfo.symbol}${typeof item.price === 'number' ? item.price.toFixed(currInfo.decimals) : item.price}` 
    : null
  const isReserved = !!item.reserved_by
  const priceChange = (item as any).price_change ?? null
  const priceChangePercent = (item as any).price_change_percent ?? null
  const previousPrice = (item as any).previous_price ?? null

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };
  const domain = getDomain(item.url)
  const isNsfw = adultFilterEnabled && isAdultContent(item.title)

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStartEdit = () => {
    setEditedTitle(item.title || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditedTitle(item.title || '')
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!isOwner) return
    
    const trimmedTitle = editedTitle.trim()
    if (trimmedTitle === (item.title || '')) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const { supabase } = await import('@/lib/supabase/client')
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Try updating items table first (primary table for user wishlist items)
      let updatedData = null
      let updateError = null

      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .update({ title: trimmedTitle || null })
        .eq('id', item.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (itemsData && !itemsError) {
        // Successfully updated items table
        updatedData = itemsData
        console.log('✅ Title updated in items table:', updatedData.title)
      } else {
        // Try products table as fallback
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .update({ title: trimmedTitle || null })
          .eq('id', item.id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (productsData && !productsError) {
          // Successfully updated products table
          updatedData = productsData
          console.log('✅ Title updated in products table:', updatedData.title)
        } else {
          // Both updates failed
          updateError = productsError || itemsError
          console.error('❌ Failed to update in both tables:', { itemsError, productsError })
        }
      }

      if (updateError || !updatedData) {
        throw new Error(updateError?.message || 'Update failed: No data returned')
      }

      // Update local state immediately with the response from DB
      if (onUpdate) {
        onUpdate(item.id, { ...item, title: updatedData.title })
      }
      
      setIsEditing(false)
    } catch (err: any) {
      console.error('Error updating title:', err)
      alert('Failed to update title: ' + (err.message || 'Unknown error'))
      // Don't close edit mode on error so user can try again
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleMoveToCollection = async (collectionId: string | null) => {
    try {
      const { supabase } = await import('@/lib/supabase/client')
      
      // Get current user to verify ownership
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to move items');
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
            .select('id, user_id')
            .eq('id', item.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (productCheck) {
            // Check again if item with same URL exists (race condition protection)
            const { data: doubleCheck } = await supabase
              .from('items')
              .select('id')
              .eq('url', item.url)
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
                  title: item.title || 'Untitled',
                  url: item.url,
                  current_price: item.price ? parseFloat(item.price.toString()) : null,
                  image_url: item.image || null,
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
                    .eq('url', item.url)
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
                    return;
                  }
                } else {
                  console.error('❌ Error creating item entry:', createError);
                  alert('Failed to move item: ' + createError.message);
                  return;
                }
              } else {
                updateResult = { data: [newItem], error: null };
              }
            }
          } else {
            console.error('⚠️ Item not found in either items or products table');
            alert('Failed to move item: Item not found');
            return;
          }
        }
      }
      
      if (updateResult.error) {
        console.error('❌ Error moving item:', updateResult.error);
        alert('Failed to move item: ' + updateResult.error.message);
        return;
      }

      if (!updateResult.data || updateResult.data.length === 0) {
        console.error('⚠️ No rows updated. Item may not exist or you may not own it.');
        alert('Failed to move item: Item not found or you do not have permission');
        return;
      }

      console.log('✅ Successfully moved item:', updateResult.data[0]);
      setIsMenuOpen(false);
      
      // Update local state immediately for better UX
      if (onUpdate) {
        onUpdate(item.id, { ...item, collection_id: collectionId } as any);
      }
      
      // Force a page refresh to ensure collections and items are in sync
      window.location.reload();
    } catch (err: any) {
      console.error('❌ Error moving item:', err);
      alert('Failed to move item: ' + (err.message || 'Unknown error'));
    }
  }

  const handleHide = async () => {
    try {
      const { supabase } = await import('@/lib/supabase/client')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('items')
        .update({ status: 'hidden' })
        .eq('id', item.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error hiding item:', error)
        return
      }

      setIsMenuOpen(false)
      if (onHide) {
        onHide(item.id)
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      console.error('Error hiding item:', err)
    }
  }

  // Close menu on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMenuOpen])

  // Get collection_id from item (might be in different fields)
  const itemCollectionId = (item as any).collection_id || null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.25, 0.1, 0.25, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative mb-3 sm:mb-6 break-inside-avoid"
    >
      <div className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-white border transition-all duration-300 ${
        isHovered 
          ? 'border-violet-500 shadow-lg -translate-y-1' 
          : 'border-zinc-100 shadow-sm'
      } ${isReserved && !isOwner ? 'opacity-60' : ''}`}>
        
        {/* Image Container */}
        <div className="relative w-full bg-zinc-50">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={title}
              className={`w-full h-auto max-h-48 sm:max-h-96 object-cover transition-transform duration-700 group-hover:scale-105 ${isNsfw ? 'blur-xl scale-110' : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50 text-zinc-400 text-sm font-medium">
              <span className="text-lg sm:text-2xl font-medium text-zinc-300">
                {title.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* NSFW Overlay */}
          {isNsfw && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900/40">
              <EyeOff className="w-6 h-6 sm:w-8 sm:h-8 text-white/80 mb-1" />
              <span className="text-white/90 text-xs sm:text-sm font-bold tracking-wider">18+</span>
            </div>
          )}

          {/* Price Drop Badge */}
          {priceChange != null && priceChange < 0 && (priceChangePercent || 0) <= -5 && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
              <span className="inline-flex items-center gap-0.5 sm:gap-1 bg-green-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-lg animate-pulse">
                <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">Price Drop!</span>
                <span className="sm:hidden">Drop!</span>
              </span>
            </div>
          )}

          {/* Site Favicon Badge - Bottom Left */}
          {domain && (
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-10" title={domain}>
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

          {/* Reserved Badge */}
          {isReserved && !isOwner && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
              <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg">
                <span className="text-xs font-medium text-zinc-900">Claimed</span>
              </div>
            </div>
          )}

          {/* Menu Button - Always visible on mobile, visible on hover on desktop */}
          {isOwner && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 z-20">
              <button
                ref={menuButtonRef}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isMenuOpen && menuButtonRef.current) {
                    const rect = menuButtonRef.current.getBoundingClientRect()
                    const menuWidth = 192
                    const menuHeight = 320
                    let left = rect.right - menuWidth
                    if (left < 8) left = 8
                    let top = rect.bottom + 6
                    if (top + menuHeight > window.innerHeight - 8) {
                      top = rect.top - menuHeight - 6
                      if (top < 8) top = 8
                    }
                    setMenuPos({ top, left })
                  }
                  setIsMenuOpen(!isMenuOpen)
                }}
                className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white text-zinc-600 transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal size={14} className="sm:hidden" />
                <MoreHorizontal size={16} className="hidden sm:block" />
              </button>
            </div>
          )}

          {/* Guest Reserve Overlay */}
          {!isOwner && (
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 transition-opacity duration-300 flex items-center justify-center ${
              isHovered && !isReserved ? 'opacity-100' : 'opacity-0'
            }`}>
              {!isReserved && onReserve && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onReserve(item.id)
                  }}
                  className="px-4 py-2 bg-violet-500 text-white rounded-full text-sm font-medium hover:bg-violet-600 transition-colors shadow-sm"
                >
                  Reserve
                </button>
              )}
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="p-2.5 sm:p-5">
          {isEditing && isOwner ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-zinc-900 bg-white border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                disabled={isSaving}
              />
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-violet-500 text-white text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} className="sm:hidden" />
                      <Check size={14} className="hidden sm:block" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-zinc-100 text-zinc-600 text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <X size={12} className="sm:hidden" />
                  <X size={14} className="hidden sm:block" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 
                className="font-medium text-zinc-900 text-xs sm:text-sm leading-snug line-clamp-2 cursor-text"
                onDoubleClick={isOwner ? handleStartEdit : undefined}
                title={isOwner ? 'Double-click to edit' : undefined}
              >
                {title}
              </h3>
              
              {price && (
                <div className="mt-1.5 sm:mt-3 flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <span className="inline-block bg-violet-50 text-violet-600 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                    {price}
                  </span>
                  {priceChange != null && priceChange !== 0 && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-full ${
                      priceChange < 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {priceChange < 0 ? (
                        <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      ) : (
                        <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      )}
                      {Math.abs(priceChangePercent || 0).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}

              {/* Footer with History and Buy buttons */}
              <div className="mt-2 sm:mt-4 flex items-end justify-between pt-2 sm:pt-4 border-t border-zinc-100">
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs text-gray-500">Price</span>
                  <span className="text-xs sm:text-lg font-bold text-gray-900">
                    {price || 'N/A'}
                  </span>
                  {previousPrice && priceChange !== 0 && (
                    <span className="text-[9px] sm:text-xs text-zinc-400 line-through">
                      ${typeof previousPrice === 'number' ? previousPrice.toFixed(2) : previousPrice}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-1 sm:gap-2">
                  <Link
                    href={`/dashboard/item/${item.id}`}
                    className="rounded-md sm:rounded-lg bg-gray-100 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-gray-900 transition hover:bg-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    History
                  </Link>

                  {!isOwner && (item as any).gifting_enabled && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md sm:rounded-lg bg-pink-500 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition hover:bg-pink-600 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                      title={(item as any).gifting_message || `Gift this to ${(item as any).profile_name || 'them'}`}
                    >
                      Gift
                    </a>
                  )}

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md sm:rounded-lg bg-violet-600 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition hover:bg-violet-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Buy
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dropdown Menu - Portaled to body to escape overflow:hidden + transform */}
      {isMenuOpen && isOwner && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsMenuOpen(false)} />
          <div
            className="fixed w-48 bg-white rounded-lg shadow-xl border border-zinc-200 p-1 z-[9999] max-h-[70vh] overflow-y-auto"
            style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {userCollections.length > 0 && (
              <>
                <div className="text-xs font-semibold text-zinc-400 px-2 py-1.5 uppercase tracking-wider">
                  Move to...
                </div>
                <button
                  onClick={() => handleMoveToCollection(null)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
                >
                  <FolderInput size={14} />
                  <span>Uncategorized</span>
                  {!itemCollectionId && (
                    <Check size={14} className="ml-auto text-violet-500" />
                  )}
                </button>
                {userCollections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => handleMoveToCollection(col.id)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
                  >
                    <span className="truncate">{col.name}</span>
                    {itemCollectionId === col.id && (
                      <Check size={14} className="ml-auto text-violet-500" />
                    )}
                  </button>
                ))}
                <div className="h-px bg-zinc-100 my-1" />
              </>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsMenuOpen(false)
                handleStartEdit()
              }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
            >
              <Edit2 size={14} />
              <span>Edit Title</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleHide()
              }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
            >
              <EyeOff size={14} />
              <span>Hide</span>
            </button>

            {onDelete && (
              <>
                <div className="h-px bg-zinc-100 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMenuOpen(false)
                    handleDelete()
                  }}
                  disabled={isDeleting}
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
    </motion.div>
  )
}
