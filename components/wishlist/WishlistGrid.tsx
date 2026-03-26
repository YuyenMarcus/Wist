'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Chrome, Upload, Sparkles, ArrowRight } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { CHROME_WEB_STORE_URL } from '@/lib/constants/chrome-web-store'
import ItemCard from './ItemCard'
import { SupabaseProduct } from '@/lib/supabase/products'
import { useTranslation } from '@/lib/i18n/context'

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
  onPinItem?: (id: string) => void
  pinnedItemId?: string | null
  userCollections?: Collection[]
  adultFilterEnabled?: boolean
  tier?: string | null
  amazonTag?: string | null
  onImport?: () => void
}

function getColCount(w: number) {
  if (w < 640) return 2
  if (w < 1024) return 2
  if (w < 1280) return 3
  return 4
}

function useColumnCount() {
  const [colCount, setColCount] = useState(() => {
    if (typeof window === 'undefined') return 4
    return getColCount(window.innerWidth)
  })

  useEffect(() => {
    const onResize = () => setColCount(getColCount(window.innerWidth))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return colCount
}

export default function WishlistGrid({ items, isOwner = true, onDelete, onReserve, onUpdate, onHide, onPinItem, pinnedItemId, userCollections = [], adultFilterEnabled = false, tier, amazonTag, onImport }: WishlistGridProps) {
  const { t } = useTranslation()
  const colCount = useColumnCount()

  const isEmpty = !items || items.length === 0

  const columns = useMemo(() => {
    if (!items || items.length === 0) return []
    const cols: SupabaseProduct[][] = Array.from({ length: colCount }, () => [])
    items.forEach((item, i) => {
      cols[i % colCount].push(item)
    })
    return cols
  }, [items, colCount])

  return (
    <div className="w-full px-2 sm:px-4 md:px-0 mx-auto max-w-7xl pb-32">
      {isEmpty && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-16 sm:py-24 text-center bg-beige-100 dark:bg-dpurple-900 border-2 border-dashed border-beige-200 dark:border-dpurple-700 rounded-3xl mb-6"
        >
          <div className="max-w-md mx-auto px-4">
            <div className="mx-auto h-20 w-20 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Sparkles size={36} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('Welcome to your Wishlist')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
              {t('Start tracking prices and never miss a deal. Here\'s how to get started:')}
            </p>

            <div className="space-y-4 text-left mb-8">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">1</div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('Install the browser extension')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('Save items from any store with one click')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">2</div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('Browse your favorite stores')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('Amazon, Target, Nike, and thousands more')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">3</div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('Get notified when prices drop')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('We\'ll track every item and alert you automatically')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                <Chrome size={18} />
                {t('Install Extension')}
              </a>
              {onImport && (
                <button
                  onClick={onImport}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                >
                  <Upload size={12} />
                  {t('Import from spreadsheet')}
                  <ArrowRight size={10} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {!isEmpty && (
        <div className="flex gap-3 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 space-y-3 sm:space-y-6">
                {col.map((item, rowIdx) => (
                  <span key={item.id}>
                    <ItemCard
                      item={item}
                      index={colIdx + rowIdx * colCount}
                      isOwner={isOwner}
                      onDelete={onDelete}
                      onReserve={onReserve}
                      onUpdate={onUpdate}
                      onHide={onHide}
                      onPinItem={onPinItem}
                      pinnedItemId={pinnedItemId}
                      userCollections={userCollections}
                      adultFilterEnabled={adultFilterEnabled}
                      tier={tier}
                      amazonTag={amazonTag}
                    />
                  </span>
                ))}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
