'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Trash2, Edit2, Check, X, MoreHorizontal, FolderInput } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SupabaseProduct } from '@/lib/supabase/products'

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
  userCollections?: Collection[]
}

export default function ItemCard({ item, isOwner = true, onDelete, onReserve, onUpdate, userCollections = [] }: ItemCardProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(item.title || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const title = item.title || 'Untitled Item'
  const imageUrl = item.image || null
  const price = item.price 
    ? `$${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}` 
    : null
  const isReserved = !!item.reserved_by

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

      // Update in database and get the updated row back
      const { data: updatedData, error } = await supabase
        .from('products')
        .update({ title: trimmedTitle || null })
        .eq('id', item.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Supabase update error:', error)
        throw error
      }

      // Verify the update worked
      if (!updatedData) {
        throw new Error('Update failed: No data returned')
      }

      console.log('✅ Title updated successfully:', updatedData.title)

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
      const { data: itemCheck } = await supabase
        .from('items')
        .select('id, user_id')
        .eq('id', item.id)
        .eq('user_id', user.id)
        .single();

      let updateResult;
      
      if (itemCheck) {
        // Item is in items table - update it
        console.log('📦 Item found in items table, updating...');
        updateResult = await supabase
          .from('items')
          .update({ collection_id: collectionId })
          .eq('id', item.id)
          .eq('user_id', user.id)
          .select();
      } else {
        // Item might be in products table - check and update there
        console.log('🔍 Item not in items table, checking products table...');
        const { data: productCheck } = await supabase
          .from('products')
          .select('id, user_id')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (productCheck) {
          // Note: products table doesn't have collection_id, so we need to create an item entry
          // or migrate it. For now, let's create an item entry linked to the product
          console.log('📦 Item found in products table, creating items entry...');
          
          // Create a new item entry linked to this product
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
            console.error('❌ Error creating item entry:', createError);
            alert('Failed to move item: ' + createError.message);
            return;
          }

          updateResult = { data: [newItem], error: null };
        } else {
          console.error('⚠️ Item not found in either items or products table');
          alert('Failed to move item: Item not found');
          return;
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

  // Get collection_id from item (might be in different fields)
  const itemCollectionId = (item as any).collection_id || null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative mb-6 break-inside-avoid"
    >
      <div className={`group relative overflow-hidden rounded-2xl bg-white border transition-all duration-300 ${
        isHovered 
          ? 'border-violet-200 shadow-xl shadow-violet-100/50 -translate-y-1' 
          : 'border-zinc-100 shadow-sm'
      } ${isReserved && !isOwner ? 'opacity-60' : ''}`}>
        
        {/* Image Container */}
        <div className="relative w-full bg-zinc-50">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            // Fallback for missing image
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50 text-zinc-400 text-sm font-medium">
              <span className="text-2xl font-medium text-zinc-300">
                {title.substring(0, 2).toUpperCase()}
              </span>
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

          {/* Hover Actions Overlay */}
          {isOwner ? (
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 transition-opacity duration-300 flex items-end justify-end p-4 gap-2 ${
              isHovered && !isEditing ? 'opacity-100' : 'opacity-0'
            }`}>
              {/* Details Link Button */}
              <Link
                href={`/dashboard/item/${item.id}`}
                className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:bg-violet-500 hover:text-white transition-colors shadow-sm"
                title="View Details & Price History"
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </Link>

              {/* Visit Link Button */}
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:bg-violet-500 hover:text-white transition-colors shadow-sm"
                title="Buy on Website"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={16} strokeWidth={2} />
              </a>

              {/* Move to Collection Button */}
              {userCollections.length > 0 && (
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMenuOpen(!isMenuOpen)
                    }}
                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:bg-violet-500 hover:text-white transition-colors shadow-sm"
                    title="Move to Collection"
                  >
                    <MoreHorizontal size={16} strokeWidth={2} />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div 
                      className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 p-1 z-30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 px-2 py-1.5 uppercase tracking-wider">
                        Move to...
                      </div>
                      
                      {/* Option to remove from collection */}
                      <button
                        onClick={() => handleMoveToCollection(null)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                      >
                        <FolderInput size={14} />
                        <span>Uncategorized</span>
                        {!itemCollectionId && (
                          <Check size={14} className="ml-auto text-blue-500" />
                        )}
                      </button>

                      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                      {/* List user collections */}
                      {userCollections.map(col => (
                        <button
                          key={col.id}
                          onClick={() => handleMoveToCollection(col.id)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                        >
                          <span className="truncate">{col.name}</span>
                          {itemCollectionId === col.id && (
                            <Check size={14} className="ml-auto text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Edit Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartEdit()
                }}
                className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:bg-violet-500 hover:text-white transition-colors shadow-sm"
                title="Edit Title"
              >
                <Edit2 size={16} strokeWidth={2} />
              </button>

              {/* Delete Button */}
              {onDelete && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete()
                  }}
                  disabled={isDeleting}
                  className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm disabled:opacity-50"
                  title="Remove Item"
                >
                  {isDeleting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                  ) : (
                    <Trash2 size={16} strokeWidth={2} />
                  )}
                </button>
              )}
            </div>
          ) : (
            // Guest view - Reserve button
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
        <div className="p-5">
          {isEditing && isOwner ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCancelEdit}
                autoFocus
                className="w-full px-3 py-2 text-sm font-medium text-zinc-900 bg-white border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                disabled={isSaving}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-xs font-medium rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 
                className="font-medium text-zinc-900 text-sm leading-snug line-clamp-2 cursor-text"
                onDoubleClick={isOwner ? handleStartEdit : undefined}
                title={isOwner ? 'Double-click to edit' : undefined}
              >
                {title}
              </h3>
              
              {price && (
                <div className="mt-3 flex items-center">
                  <span className="inline-block bg-violet-50 text-violet-600 text-xs font-bold px-2.5 py-1 rounded-full">
                    {price}
                  </span>
                </div>
              )}

              {/* Footer with History and Buy buttons */}
              <div className="mt-4 flex items-end justify-between pt-4 border-t border-zinc-100">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Current Price</span>
                  <span className="text-lg font-bold text-gray-900">
                    {price || 'N/A'}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  {/* Internal Link to Detail Page */}
                  <Link
                    href={`/dashboard/item/${item.id}`}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-900 transition hover:bg-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    History
                  </Link>

                  {/* External Link to Store */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700"
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
    </motion.div>
  )
}
