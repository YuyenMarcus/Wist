'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { PackageOpen, Chrome } from 'lucide-react'
import Link from 'next/link'
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
        className="col-span-full py-20 text-center bg-white border-2 border-dashed border-zinc-200 rounded-3xl mx-4 md:mx-0"
      >
        <div className="mx-auto h-16 w-16 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center mb-6">
          <Chrome size={32} />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">Your wishlist is looking empty</h3>
        <p className="text-zinc-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
          The easiest way to add items is with our browser button. 
          Go to Amazon or Target and save items in one click.
        </p>
        <Link 
          href="/extension" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-sm"
        >
          <Chrome size={18} />
          Install Browser Button
        </Link>
      </motion.div>
    )
  }

  return (
    // CSS Columns for Masonry Layout
    // columns-1 on mobile, 2 on tablet, 3 on desktop, 4 on large screens
    <div 
      className="w-full px-2 sm:px-4 md:px-0 mx-auto max-w-7xl pb-32 
                 columns-2 sm:columns-2 lg:columns-3 xl:columns-4 
                 gap-3 sm:gap-6 space-y-3 sm:space-y-6"
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
