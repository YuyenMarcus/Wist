'use client'

import { AnimatePresence } from 'framer-motion'
import ItemCard from './ItemCard'
import { SupabaseProduct } from '@/lib/supabase/products'

interface WishlistGridProps {
  items: SupabaseProduct[]
  isOwner?: boolean
  onDelete?: (id: string) => void
  onReserve?: (id: string) => void
}

export default function WishlistGrid({ items, isOwner = true, onDelete, onReserve }: WishlistGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-20 opacity-50">
        <p className="text-zinc-500">Your collection is empty.</p>
        <p className="text-sm text-zinc-400 mt-2">Add items to get started</p>
      </div>
    )
  }

  return (
    // Tailwind Columns for Masonry Layout
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 px-4 pb-24 mx-auto max-w-7xl">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ItemCard 
            key={item.id}
            item={item}
            isOwner={isOwner}
            onDelete={onDelete}
            onReserve={onReserve}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

