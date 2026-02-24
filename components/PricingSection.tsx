'use client'

import Link from 'next/link'
import { TIERS, type SubscriptionTier } from '@/lib/constants/subscription-tiers'
import { Check, ArrowRight, Sparkles } from 'lucide-react'

const PLANS: {
  key: SubscriptionTier
  tagline: string
  highlight?: boolean
  ctaLabel: string
  accent: string
  checkColor: string
  featureOverrides: string[]
}[] = [
  {
    key: 'free',
    tagline: 'Everything you need to start tracking prices.',
    ctaLabel: 'Get Started Free',
    accent: 'text-zinc-900',
    checkColor: 'text-zinc-400',
    featureOverrides: [
      'Up to 20 tracked items',
      'Weekly price checks',
      'Browser extension',
      'Price history graph',
      'Share your wishlist',
    ],
  },
  {
    key: 'pro',
    tagline: 'For serious deal hunters who hate missing drops.',
    ctaLabel: 'Start Free Trial',
    accent: 'text-blue-600',
    checkColor: 'text-blue-500',
    featureOverrides: [
      'Up to 45 tracked items',
      'Weekly price checks',
      'Back-in-stock alerts',
      'Ad-free experience',
      'Similar product comparison',
    ],
  },
  {
    key: 'pro_plus',
    tagline: 'The full toolkit. Unlimited tracking, daily checks, and gifting.',
    highlight: true,
    ctaLabel: 'Start Free Trial',
    accent: 'text-violet-600',
    checkColor: 'text-violet-500',
    featureOverrides: [
      'Unlimited items',
      'Daily price checks',
      'Receipt & warranty tracking',
      '2-year pricing history',
      'Gifting service',
      'Amazon & spreadsheet sync',
      'Pro badge on profile',
    ],
  },
  {
    key: 'creator',
    tagline: 'Built for influencers and content creators.',
    ctaLabel: 'Start Free Trial',
    accent: 'text-amber-600',
    checkColor: 'text-amber-500',
    featureOverrides: [
      'Everything in Wist Pro',
      'Instant price notifications',
      'Boosted audience reach',
      'Community analytics',
      'Profile customization',
      'Creator badge on profile',
    ],
  },
]

export default function PricingSection() {
  return (
    <section className="relative py-28 sm:py-32 px-4 sm:px-6 overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-violet-50/30 to-white pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #8b5cf6 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100/80 border border-violet-200/60 mb-5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-700 tracking-wide">PRICING</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-zinc-900 tracking-tight leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Pick the plan that<br className="hidden sm:block" /> fits your lifestyle
          </h2>
          <p className="mt-5 text-base sm:text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed">
            Start free, upgrade anytime. Every plan includes a 14-day trial on paid features.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4">
          {PLANS.map((plan) => {
            const tier = TIERS[plan.key]
            const isPopular = plan.highlight

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
                  isPopular
                    ? 'bg-zinc-900 text-white shadow-2xl shadow-violet-500/10 ring-1 ring-violet-500/20 lg:scale-[1.03] lg:-my-2'
                    : 'bg-white border border-zinc-200/80 hover:border-zinc-300 hover:shadow-lg'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[11px] font-bold tracking-wide rounded-full shadow-lg shadow-violet-500/30">
                      <Sparkles className="w-3 h-3" /> MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <div className="mb-5 pt-1">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${isPopular ? 'text-violet-400' : plan.accent}`}>
                    {tier.displayName}
                  </h3>
                  <p className={`mt-1 text-[13px] leading-snug ${isPopular ? 'text-zinc-400' : 'text-zinc-400'}`}>
                    {plan.tagline}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {tier.price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-extrabold tracking-tight ${isPopular ? 'text-white' : 'text-zinc-900'}`}>$0</span>
                      <span className={`text-sm font-medium ${isPopular ? 'text-zinc-500' : 'text-zinc-400'}`}>/mo</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-extrabold tracking-tight ${isPopular ? 'text-white' : 'text-zinc-900'}`}>${tier.price}</span>
                      <span className={`text-sm font-medium ${isPopular ? 'text-zinc-500' : 'text-zinc-400'}`}>/mo</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Link
                  href="/signup"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                    isPopular
                      ? 'bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm'
                      : plan.key === 'free'
                        ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {plan.ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Features */}
                <div className={`mt-6 pt-6 border-t ${isPopular ? 'border-zinc-800' : 'border-zinc-100'} flex-1`}>
                  <ul className="space-y-3">
                    {plan.featureOverrides.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className={`w-4.5 h-4.5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isPopular ? 'bg-violet-500/20' : 'bg-zinc-100'
                        }`}>
                          <Check className={`w-3 h-3 ${isPopular ? 'text-violet-400' : plan.checkColor}`} />
                        </div>
                        <span className={`text-[13px] leading-snug ${isPopular ? 'text-zinc-300' : 'text-zinc-600'}`}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* Enterprise bar */}
        <div className="mt-14 rounded-2xl bg-zinc-900 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-white mb-1">Need something bigger?</h3>
            <p className="text-sm text-zinc-400 max-w-lg">
              Wist Enterprise includes API access, team wishlists, bulk gifting, custom branding, and a dedicated account manager.
            </p>
          </div>
          <Link
            href="mailto:julien@nitron.digital?subject=Wist Enterprise"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 text-sm font-bold rounded-xl hover:bg-zinc-100 transition-colors"
          >
            Talk to Sales <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Reassurance */}
        <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-zinc-400">
          <span>No credit card required</span>
          <span className="hidden sm:inline">·</span>
          <span>14-day money-back guarantee</span>
          <span className="hidden sm:inline">·</span>
          <span>Cancel anytime</span>
        </div>
      </div>
    </section>
  )
}
