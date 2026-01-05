'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { PackageOpen } from 'lucide-react'
import ItemCard from './ItemCard'
import { SupabaseProduct } from '@/lib/supabase/products'

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface WishlistGridProps {
  items: SupabaseProduct[]
  isOwner?: boolean
  onDelete?: (id: string) => void
  onReserve?: (id: string) => void
  onUpdate?: (id: string, updatedItem: SupabaseProduct) => void
  userCollections?: Collection[]
}

export default function WishlistGrid({ items, isOwner = true, onDelete, onReserve, onUpdate, userCollections = [] }: WishlistGridProps) {
  
  // Empty State
  if (!items || items.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 px-4 text-center"
      >
        <div className="bg-violet-50 p-4 rounded-full mb-4">
          <PackageOpen size={32} className="text-violet-400" />
        </div>
        <h3 className="text-lg font-medium text-zinc-900 mb-2">Your collection is empty</h3>
        <p className="text-zinc-500 text-sm max-w-md leading-relaxed">
          Paste a URL above to start curating your wishlist. Items you add will appear here in a beautiful grid.
        </p>
      </motion.div>
    )
  }

  return (
    // CSS Columns for Masonry Layout
    // columns-1 on mobile, 2 on tablet, 3 on desktop, 4 on large screens
    <div 
      className="w-full px-4 md:px-0 mx-auto max-w-7xl pb-32 
                 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 
                 gap-6 space-y-6"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ItemCard 
            key={item.id}
            item={item}
            isOwner={isOwner}
            onDelete={onDelete}
            onReserve={onReserve}
            onUpdate={onUpdate}
            userCollections={userCollections}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
