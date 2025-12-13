'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { SupabaseProduct } from '@/lib/supabase/products'

interface ItemCardProps {
  item: SupabaseProduct
  isOwner?: boolean
  onDelete?: (id: string) => void
  onReserve?: (id: string) => void
}

export default function ItemCard({ item, isOwner = true, onDelete, onReserve }: ItemCardProps) {
  const title = item.title || 'Untitled Item'
  const imageUrl = item.image || ''
  const price = item.price ? `$${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}` : null
  const isReserved = !!item.reserved_by

  // Priority from meta
  const priority = (item as any).meta?.priority || 'medium'
  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative break-inside-avoid mb-6"
    >
      {/* Card Container */}
      <div className={`relative overflow-hidden rounded-2xl bg-white border border-zinc-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-violet-200 ${
        isReserved && !isOwner ? 'opacity-60' : ''
      }`}>
        
        {/* Image Display */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-300 bg-gradient-to-br from-violet-50 to-pink-50">
              <span className="text-2xl font-medium text-zinc-400">
                {title.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* Priority Dot */}
          <div className="absolute top-3 right-3 z-10">
            <div className={`w-2 h-2 rounded-full ${priorityColors[priority as keyof typeof priorityColors]}`} />
          </div>

          {/* Reserved Badge */}
          {isReserved && !isOwner && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
              <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg">
                <span className="text-xs font-medium text-zinc-900">Claimed</span>
              </div>
            </div>
          )}
          
          {/* Hover Overlay Actions */}
          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center gap-3 z-30">
            {isOwner ? (
              <>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-zinc-900 hover:bg-violet-500 hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                </a>
                {onDelete && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            ) : (
              <>
                {!isReserved && onReserve && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onReserve(item.id)
                    }}
                    className="px-4 py-2 bg-violet-500 text-white rounded-full text-sm font-medium hover:bg-violet-600 transition-colors"
                  >
                    Reserve
                  </button>
                )}
                {isReserved && (
                  <div className="px-4 py-2 bg-white/90 backdrop-blur-sm text-zinc-500 rounded-full text-sm font-medium">
                    Reserved
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-zinc-900 line-clamp-2 text-sm leading-relaxed mb-2">
            {title}
          </h3>
          {price && (
            <p className="text-xs font-semibold text-violet-500 bg-violet-50 inline-block px-2 py-1 rounded-full">
              {price}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

