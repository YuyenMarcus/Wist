'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Trash2, MoreHorizontal, Check, FolderInput } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProductItem {
  id: string;
  title: string | null;
  price: number | null;
  image: string | null;
  url: string;
  collection_id?: string | null;
  current_price?: number | null;
  image_url?: string | null;
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
        // Item might be in products table - check and create items entry
        console.log('🔍 Item not in items table, checking products table...');
        const { data: productCheck } = await supabase
          .from('products')
          .select('id, user_id, title, url, price, image')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (productCheck) {
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
            console.error('❌ Error creating item entry:', createError);
            alert('Failed to move item: ' + createError.message);
            setIsMoving(false);
            return;
          }

          updateResult = { data: [newItem], error: null };
        } else {
          console.error('⚠️ Item not found in either items or products table');
          alert('Failed to move item: Item not found');
          setIsMoving(false);
          return;
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-violet-500 hover:shadow-lg transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50 dark:from-zinc-800 dark:to-zinc-900">
            <span className="text-2xl font-medium text-zinc-400">
              {title.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Loading Overlay */}
        {isMoving && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Moving...</span>
            </div>
          </div>
        )}

        {/* Menu Button - Top Right Corner */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" ref={menuRef}>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 p-1 z-20">
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
                  {!item.collection_id && (
                    <Check size={14} className="ml-auto text-violet-500" />
                  )}
                </button>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                {/* List user collections */}
                {userCollections.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                    No collections yet
                  </div>
                ) : (
                  userCollections.map(col => (
                    <button
                      key={col.id}
                      onClick={() => handleMoveToCollection(col.id)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                    >
                      <span className="truncate">{col.name}</span>
                      {item.collection_id === col.id && (
                        <Check size={14} className="ml-auto text-violet-500" />
                      )}
                    </button>
                  ))
                )}

                {/* Delete Option */}
                {onDelete && (
                  <>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                    <button
                      onClick={handleDelete}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
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
        <h3 className="font-medium text-zinc-900 dark:text-white text-sm mb-2 line-clamp-2">
          {title}
        </h3>
        {price && price > 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
            {formatPrice(price)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

