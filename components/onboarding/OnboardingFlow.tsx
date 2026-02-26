'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  TrendingDown,
  FolderOpen,
  BarChart3,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/context'

interface OnboardingFlowProps {
  userId: string
  onComplete: () => void
}

type Phase = 'age' | 'tutorial'

const MOCK_ITEM = {
  title: 'Sony WH-1000XM5 Wireless Headphones',
  price: 278.0,
  previousPrice: 349.99,
  image: 'https://m.media-amazon.com/images/I/61+btxzpfDL._AC_SL1500_.jpg',
  domain: 'amazon.com',
}

const MOCK_CHART_POINTS = [
  { day: 'Mon', price: 349.99 },
  { day: 'Tue', price: 345.0 },
  { day: 'Wed', price: 339.0 },
  { day: 'Thu', price: 320.0 },
  { day: 'Fri', price: 299.99 },
  { day: 'Sat', price: 289.0 },
  { day: 'Sun', price: 278.0 },
]

function MiniChart() {
  const prices = MOCK_CHART_POINTS.map((p) => p.price)
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  const range = max - min || 1
  const h = 80
  const w = 200
  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * w
      const y = h - ((p - min) / range) * (h - 10) - 5
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#chartGrad)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MockItemCard() {
  const drop = (
    ((MOCK_ITEM.price - MOCK_ITEM.previousPrice) / MOCK_ITEM.previousPrice) *
    100
  ).toFixed(0)

  return (
    <div className="w-48 sm:w-56 bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm mx-auto">
      <div className="relative aspect-[2/3] bg-zinc-100 overflow-hidden">
        <img
          src={MOCK_ITEM.image}
          alt={MOCK_ITEM.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-0.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <TrendingDown className="w-2.5 h-2.5" />
            {drop}%
          </span>
        </div>
        <div className="absolute bottom-2 left-2">
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full pl-1 pr-1.5 py-0.5 shadow-sm">
            <img
              src={`https://www.google.com/s2/favicons?domain=${MOCK_ITEM.domain}&sz=32`}
              alt=""
              className="w-3 h-3 rounded-sm"
            />
            <span className="text-[8px] font-medium text-zinc-600">amazon</span>
          </div>
        </div>
      </div>
      <div className="p-2.5">
        <h3 className="font-medium text-zinc-900 text-xs line-clamp-2">{MOCK_ITEM.title}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-bold text-zinc-900">${MOCK_ITEM.price.toFixed(2)}</span>
          <span className="text-[10px] text-zinc-400 line-through">
            ${MOCK_ITEM.previousPrice.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 inline-flex items-center justify-center gap-0.5 text-[10px] text-zinc-600 bg-zinc-100 px-2 py-1.5 rounded-md">
            <BarChart3 className="w-2.5 h-2.5" />
            History
          </div>
          <div className="flex-1 inline-flex items-center justify-center gap-0.5 text-[10px] font-medium text-white bg-violet-600 px-2 py-1.5 rounded-md">
            <ExternalLink className="w-2.5 h-2.5" />
            Buy
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('age')
  const [age, setAge] = useState('')
  const [ageError, setAgeError] = useState('')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const TUTORIAL_STEPS = [
    {
      key: 'welcome',
      title: t('Welcome to Wist'),
      subtitle: t('Your smart wishlist that tracks prices for you.'),
      content: (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-violet-600" />
          </div>
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
            {t("Save items from any store, track price drops automatically, and organize everything into collections. Let's show you the basics.")}
          </p>
        </div>
      ),
    },
    {
      key: 'dashboard',
      title: t('Your Dashboard'),
      subtitle: t('Every item you save shows up as a card.'),
      content: (
        <div className="flex flex-col items-center gap-4">
          <MockItemCard />
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
            {t('Use the ')}
            <strong className="text-violet-600">{t('Browser extension')}</strong>
            {t(' to save items in one click, or paste a product URL directly. Each card shows the price, store, and any recent changes.')}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      title: t('Price Tracking'),
      subtitle: t("We check prices daily so you don't have to."),
      content: (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-xs bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-900">{t('Price History')}</span>
              <span className="text-[10px] text-green-600 font-semibold">-20%</span>
            </div>
            <MiniChart />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>Mon</span>
              <span>Sun</span>
            </div>
          </div>
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
            {t('Click ')}
            <strong>{t('History')}</strong>
            {t(" on any card to see the full price graph. You'll get notified when prices drop significantly.")}
          </p>
        </div>
      ),
    },
    {
      key: 'collections',
      title: t('Collections'),
      subtitle: t('Organize your items however you like.'),
      content: (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-xs space-y-2">
            {[
              { name: 'Tech', count: 12, color: 'bg-blue-100 text-blue-600' },
              { name: 'Fashion', count: 8, color: 'bg-pink-100 text-pink-600' },
              { name: 'Home', count: 5, color: 'bg-amber-100 text-amber-600' },
            ].map((col) => (
              <div
                key={col.name}
                className="flex items-center gap-3 bg-white rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div className={`w-8 h-8 rounded-lg ${col.color} flex items-center justify-center`}>
                  <FolderOpen className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-zinc-900 flex-1">{col.name}</span>
                <span className="text-xs text-zinc-400">{col.count} {t('items')}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
            {t('Switch to ')}
            <strong>{t('Categories')}</strong>
            {t(' view to see your collections. Drag items between collections or let Wist auto-organize them for you.')}
          </p>
        </div>
      ),
    },
  ]

  useEffect(() => {
    supabase
      .from('profiles')
      .select('age')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.age != null) {
          setPhase('tutorial')
        }
      })
  }, [userId])

  const handleAgeSubmit = async () => {
    const parsed = parseInt(age, 10)
    if (isNaN(parsed) || parsed < 5 || parsed > 120) {
      setAgeError(t('Please enter a valid age between 5 and 120.'))
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ age: parsed, adult_content_filter: true })
        .eq('id', userId)
        .select()

      if (error) {
        console.error('Failed to save age:', error)
        setAgeError(t('Could not save. Please try again.'))
        setSaving(false)
        return
      }

      setPhase('tutorial')
    } catch (e: any) {
      console.error('Age submit error:', e)
      setAgeError(t('Something went wrong. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId)
        .select()

      if (error) {
        console.error('Failed to mark onboarding complete:', error)
      }

      onComplete()
    } catch (e: any) {
      console.error('Finish onboarding error:', e)
      onComplete()
    }
  }

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {phase === 'age' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-1">{t('Before we start')}</h2>
          <p className="text-sm text-zinc-500 mb-6">
            {t('How old are you? This helps us personalize your experience.')}
          </p>

          <input
            type="number"
            value={age}
            onChange={(e) => {
              setAge(e.target.value)
              setAgeError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAgeSubmit()}
            placeholder={t('Your age')}
            min={5}
            max={120}
            className="w-full px-4 py-3 text-center text-lg font-semibold border border-zinc-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 placeholder:text-zinc-300"
            autoFocus
          />

          {ageError && (
            <p className="text-xs text-red-500 mt-2">{ageError}</p>
          )}

          <button
            onClick={handleAgeSubmit}
            disabled={saving || !age}
            className="mt-5 w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {t('Continue')}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Progress bar */}
          <div className="h-1 bg-zinc-100">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6 sm:p-8">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-1.5 mb-5">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                    i === step ? 'bg-violet-500' : i < step ? 'bg-violet-200' : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>

            {/* Title — transitions instantly */}
            <h2 className="text-xl font-bold text-zinc-900 text-center mb-1">
              {TUTORIAL_STEPS[step].title}
            </h2>
            <p className="text-sm text-zinc-400 text-center mb-6">
              {TUTORIAL_STEPS[step].subtitle}
            </p>

            {/* Content — quick fade via key swap */}
            <div key={step} className="min-h-[240px] flex items-center justify-center animate-[fadeIn_150ms_ease-out]">
              {TUTORIAL_STEPS[step].content}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
              {step > 0 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('Back')}
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={handleNext}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : step < TUTORIAL_STEPS.length - 1 ? (
                  <>
                    {t('Next')}
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    {t('Get Started')}
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
