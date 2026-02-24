'use client'

import { useState, useEffect, useCallback } from 'react'
import { CURRENCY_INFO } from '@/lib/currency'

interface ConvertedPrice {
  original: number
  converted: number
  originalCurrency: string
  targetCurrency: string
  displayString: string
  originalDisplayString: string
}

let rateCache: Record<string, number> | null = null
let rateCacheTime = 0
const RATE_CACHE_TTL = 30 * 60 * 1000; // 30 min client-side

async function fetchRate(from: string, to: string): Promise<number> {
  if (from === to) return 1

  const now = Date.now()
  if (rateCache && now - rateCacheTime < RATE_CACHE_TTL) {
    const fromRate = rateCache[from] || 1
    const toRate = rateCache[to] || 1
    return toRate / fromRate
  }

  try {
    const res = await fetch(`/api/currency?amount=1&from=${from}&to=${to}`)
    if (res.ok) {
      const data = await res.json()
      return data.rate || 1
    }
  } catch {}
  return 1
}

export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const info = CURRENCY_INFO[currencyCode]
  if (!info) return `$${amount.toFixed(2)}`
  
  const decimals = info.decimals
  const formatted = amount.toFixed(decimals)
  const parts = formatted.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${info.symbol}${parts.join('.')}`
}

export function useCurrency(preferredCurrency: string = 'USD') {
  const [rates, setRates] = useState<Record<string, number>>({})

  useEffect(() => {
    let mounted = true

    async function loadRates() {
      try {
        const res = await fetch('/api/currency?amount=1&from=USD&to=USD')
        if (res.ok && mounted) {
          // Rates are cached server-side, this just warms the cache
        }
      } catch {}
    }

    loadRates()
    return () => { mounted = false }
  }, [preferredCurrency])

  const convertPrice = useCallback(async (
    amount: number,
    fromCurrency: string
  ): Promise<ConvertedPrice> => {
    const from = fromCurrency || 'USD'
    const to = preferredCurrency || 'USD'

    const originalInfo = CURRENCY_INFO[from] || CURRENCY_INFO['USD']
    const targetInfo = CURRENCY_INFO[to] || CURRENCY_INFO['USD']

    const originalDisplay = formatCurrencyAmount(amount, from)

    if (from === to || !amount) {
      return {
        original: amount,
        converted: amount,
        originalCurrency: from,
        targetCurrency: to,
        displayString: originalDisplay,
        originalDisplayString: originalDisplay,
      }
    }

    const rate = await fetchRate(from, to)
    const converted = parseFloat((amount * rate).toFixed(targetInfo.decimals))
    const convertedDisplay = formatCurrencyAmount(converted, to)

    return {
      original: amount,
      converted,
      originalCurrency: from,
      targetCurrency: to,
      displayString: convertedDisplay,
      originalDisplayString: originalDisplay,
    }
  }, [preferredCurrency])

  return { convertPrice, formatPrice: formatCurrencyAmount }
}
