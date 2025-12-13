'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SupabaseProduct } from '@/lib/supabase/products'

export interface WishlistItem {
  id: string
  title: string
  price?: string | null
  imageUrl?: string | null
  url: string
}

interface ItemCardProps {
  item: SupabaseProduct
  isOwner?: boolean
  onDelete?: (id: string) => void
  onReserve?: (id: string) => void
}

export default function ItemCard({ item, isOwner = true, onDelete, onReserve }: ItemCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}>
              {/* Visit Link Button */}
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2.5 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:bg-violet-500 hover:text-white transition-colors shadow-sm"
                title="Visit Website"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={16} strokeWidth={2} />
              </a>

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
          <h3 className="font-medium text-zinc-900 text-sm leading-snug line-clamp-2">
            {title}
          </h3>
          
          {price && (
            <div className="mt-3 flex items-center">
              <span className="inline-block bg-violet-50 text-violet-600 text-xs font-bold px-2.5 py-1 rounded-full">
                {price}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
