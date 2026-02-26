'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Chrome, Upload } from 'lucide-react'
import Link from 'next/link'
import ItemCard from './ItemCard'
import AdItemCard from './AdItemCard'
import { SupabaseProduct } from '@/lib/supabase/products'
import { useTranslation } from '@/lib/i18n/context'

const AD_INTERVAL = 5

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
  onHide?: (id: string) => void
  userCollections?: Collection[]
  adultFilterEnabled?: boolean
  tier?: string | null
  onImport?: () => void
}

export default function WishlistGrid({ items, isOwner = true, onDelete, onReserve, onUpdate, onHide, userCollections = [], adultFilterEnabled = false, tier, onImport }: WishlistGridProps) {
  const { t } = useTranslation()
  const showAds = !tier || tier === 'free'

  const isEmpty = !items || items.length === 0

  // Build interleaved list of items and ads
  type GridEntry =
    | { type: 'item'; item: SupabaseProduct; index: number }
    | { type: 'ad'; slotIndex: number; index: number }

  const entries: GridEntry[] = []
  let adSlotCount = 0

  // Always lead with one ad for free tier (even with 0 items)
  if (showAds) {
    entries.push({ type: 'ad', slotIndex: adSlotCount, index: entries.length })
    adSlotCount++
  }

  if (!isEmpty) {
    items.forEach((item, i) => {
      entries.push({ type: 'item', item, index: entries.length })

      if (showAds && (i + 1) % AD_INTERVAL === 0) {
        entries.push({ type: 'ad', slotIndex: adSlotCount, index: entries.length })
        adSlotCount++
      }
    })
  }

  return (
    <div className="w-full px-2 sm:px-4 md:px-0 mx-auto max-w-7xl pb-32">
      {isEmpty && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-20 text-center bg-beige-100 dark:bg-dpurple-900 border-2 border-dashed border-beige-200 dark:border-dpurple-700 rounded-3xl mb-6"
        >
          <div className="mx-auto h-16 w-16 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-full flex items-center justify-center mb-6">
            <Chrome size={32} />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t('Your wishlist is looking empty')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-8 text-sm leading-relaxed">
            {t('The easiest way to add items is with our browser button. Go to Amazon or Target and save items in one click.')}
          </p>
          <Link 
            href="/extension" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            <Chrome size={18} />
            {t('Install Browser Button')}
          </Link>
          {onImport && (
            <button
              onClick={onImport}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            >
              <Upload size={12} />
              {t('or import from a spreadsheet or Amazon')}
            </button>
          )}
        </motion.div>
      )}

      {entries.length > 0 && (
        <div className="columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-6 space-y-3 sm:space-y-6">
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => {
              if (entry.type === 'ad') {
                return (
                  <span key={`ad-${entry.slotIndex}`}>
                    <AdItemCard index={entry.index} slotIndex={entry.slotIndex} />
                  </span>
                )
              }

              return (
                <span key={entry.item.id}>
                  <ItemCard 
                    item={entry.item}
                    index={entry.index}
                    isOwner={isOwner}
                    onDelete={onDelete}
                    onReserve={onReserve}
                    onUpdate={onUpdate}
                    onHide={onHide}
                    userCollections={userCollections}
                    adultFilterEnabled={adultFilterEnabled}
                    tier={tier}
                  />
                </span>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
