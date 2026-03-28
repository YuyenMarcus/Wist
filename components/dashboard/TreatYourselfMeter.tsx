'use client'

import { useMemo } from 'react'
import { Gift } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

const GOAL = 300

/** Dollar thresholds; suggested treats (copy + i18n). */
const MILESTONES = [
  { amount: 100, itemKey: 'Treat item headphones' },
  { amount: 200, itemKey: 'Treat item shoes' },
  { amount: 300, itemKey: 'Treat item lamp' },
] as const

interface TreatYourselfMeterProps {
  /** Total $ saved from tracked price drops (sum of drops across items). */
  savedAmount: number
}

export default function TreatYourselfMeter({ savedAmount }: TreatYourselfMeterProps) {
  const { t } = useTranslation()
  const raw = Math.max(0, savedAmount)
  const barPct = GOAL > 0 ? Math.min(100, (raw / GOAL) * 100) : 0

  const { unlockTitle, unlockSub } = useMemo(() => {
    if (raw >= GOAL) {
      return { unlockTitle: t('Treat goal title'), unlockSub: t('Treat goal sub') }
    }
    const next = MILESTONES.find((m) => raw < m.amount)
    if (!next) {
      return { unlockTitle: t('Treat goal title'), unlockSub: t('Treat goal sub') }
    }
    const remaining = Math.max(0, Math.ceil(next.amount - raw))
    const itemName = t(next.itemKey)
    return {
      unlockTitle: t('Treat next unlock title').replace('{item}', itemName),
      unlockSub: t('Treat save more sub').replace('{amount}', `$${remaining}`),
    }
  }, [raw, t])

  const m1Unlocked = raw >= MILESTONES[0].amount
  const m2Unlocked = raw >= MILESTONES[1].amount

  return (
    <div className="w-full rounded-xl border border-beige-200 bg-white p-4 shadow-sm dark:border-dpurple-700 dark:bg-dpurple-900 sm:p-5">
      <div className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{t('Treat yourself meter')}</div>
      <p className="mb-3 text-[13px] text-zinc-500 dark:text-zinc-400">{t('Treat yourself meter sub')}</p>

      <div className="mb-2 text-[28px] font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
        ${Math.round(raw)}
        <span className="ml-1.5 text-sm font-normal text-zinc-500 dark:text-zinc-400">{t('saved')}</span>
      </div>

      <div className="relative mb-2 h-3.5 overflow-visible rounded-full bg-zinc-200/80 dark:bg-dpurple-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7F77DD] to-[#D4537E] transition-[width] duration-500 ease-out"
          style={{ width: `${barPct}%` }}
        />
        <div
          className="pointer-events-none absolute top-0 z-[2] h-full w-0.5 bg-white"
          style={{ left: '33.333%' }}
        />
        <div
          className="pointer-events-none absolute top-0 z-[2] h-full w-0.5 bg-white"
          style={{ left: '66.666%' }}
        />
        {m1Unlocked && (
          <span
            className="pointer-events-none absolute -top-[22px] z-[3] -translate-x-1/2 text-[11px] font-medium text-[#7F77DD]"
            style={{ left: '33.333%' }}
          >
            ✓
          </span>
        )}
        {m2Unlocked && (
          <span
            className="pointer-events-none absolute -top-[22px] z-[3] -translate-x-1/2 text-[11px] font-medium text-[#7F77DD]"
            style={{ left: '66.666%' }}
          >
            ✓
          </span>
        )}
      </div>

      <div className="mb-4 flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
        <span>$0</span>
        <span>$100</span>
        <span>$200</span>
        <span>${GOAL}</span>
      </div>

      <div className="flex items-center gap-3 rounded-[10px] bg-violet-50 px-3.5 py-3 dark:bg-violet-950/40">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
          <Gift className="h-[18px] w-[18px] text-[#7F77DD]" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug text-[#3C3489] dark:text-violet-200">{unlockTitle}</p>
          <p className="mt-0.5 text-xs text-[#7F77DD] dark:text-violet-400">{unlockSub}</p>
        </div>
      </div>
    </div>
  )
}
