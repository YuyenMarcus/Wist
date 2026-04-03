'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import ImportModal from '@/components/dashboard/ImportModal'

type ImportModalContextValue = {
  openImport: () => void
}

const ImportModalContext = createContext<ImportModalContextValue | null>(null)

export function useDashboardImportModal(): ImportModalContextValue {
  const ctx = useContext(ImportModalContext)
  if (!ctx) {
    throw new Error('useDashboardImportModal must be used within ImportModalProvider')
  }
  return ctx
}

/**
 * Single import modal for the whole dashboard shell (avoids 3× portals + 3× hooks).
 */
export function ImportModalProvider({
  children,
  clientTier,
}: {
  children: ReactNode
  /** From server layout; avoids free cap when DB tier lags behind Stripe */
  clientTier?: string | null
}) {
  const [open, setOpen] = useState(false)

  const onClose = useCallback(() => setOpen(false), [])

  const onComplete = useCallback(() => {
    setOpen(false)
    window.location.reload()
  }, [])

  const value = useMemo(() => ({ openImport: () => setOpen(true) }), [])

  return (
    <ImportModalContext.Provider value={value}>
      {children}
      <ImportModal
        isOpen={open}
        onClose={onClose}
        onComplete={onComplete}
        clientTier={clientTier ?? undefined}
      />
    </ImportModalContext.Provider>
  )
}
