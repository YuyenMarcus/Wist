'use client'

import Link from 'next/link'
import { TIERS, TIER_ORDER, type SubscriptionTier } from '@/lib/constants/subscription-tiers'
import { Check, Star, Crown, Gem, Building2, ArrowRight, Sparkles } from 'lucide-react'

const TIER_ICONS: Record<SubscriptionTier, typeof Star> = {
  free: Star,
  pro: Sparkles,
  pro_plus: Gem,
  creator: Crown,
  enterprise: Building2,
}

const CARD_STYLES: Record<SubscriptionTier, { border: string; badge: string; bg: string; cta: string; icon: string }> = {
  free: {
    border: 'border-zinc-200',
    badge: '',
    bg: 'bg-white',
    cta: 'bg-zinc-900 hover:bg-zinc-800 text-white',
    icon: 'text-zinc-500',
  },
  pro: {
    border: 'border-blue-200',
    badge: '',
    bg: 'bg-white',
    cta: 'bg-blue-600 hover:bg-blue-700 text-white',
    icon: 'text-blue-500',
  },
  pro_plus: {
    border: 'border-violet-300 ring-2 ring-violet-200',
    badge: 'Most Popular',
    bg: 'bg-white',
    cta: 'bg-violet-600 hover:bg-violet-700 text-white',
    icon: 'text-violet-500',
  },
  creator: {
    border: 'border-amber-200',
    badge: '',
    bg: 'bg-white',
    cta: 'bg-amber-600 hover:bg-amber-700 text-white',
    icon: 'text-amber-500',
  },
  enterprise: {
    border: 'border-emerald-200',
    badge: '',
    bg: 'bg-white',
    cta: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    icon: 'text-emerald-500',
  },
}

const VISIBLE_TIERS: SubscriptionTier[] = ['free', 'pro', 'pro_plus', 'creator']

export default function PricingSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 bg-zinc-50 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-violet-600 tracking-wide uppercase mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight">
            Simple plans for every shopper
          </h2>
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">
            Start free. Upgrade when you need more power. No credit card required.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VISIBLE_TIERS.map((tierKey) => {
            const tier = TIERS[tierKey]
            const style = CARD_STYLES[tierKey]
            const Icon = TIER_ICONS[tierKey]
            const isPopular = tierKey === 'pro_plus'

            return (
              <div
                key={tierKey}
                className={`relative flex flex-col rounded-2xl border ${style.border} ${style.bg} p-6 transition-all hover:shadow-lg hover:-translate-y-1 duration-200`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full shadow-md">
                      <Sparkles className="w-3 h-3" /> {style.badge}
                    </span>
                  </div>
                )}

                {/* Icon & name */}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tierKey === 'free' ? 'bg-zinc-100' :
                    tierKey === 'pro' ? 'bg-blue-50' :
                    tierKey === 'pro_plus' ? 'bg-violet-50' :
                    tierKey === 'creator' ? 'bg-amber-50' : 'bg-emerald-50'
                  }`}>
                    <Icon className={`w-4.5 h-4.5 ${style.icon}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">{tier.displayName}</h3>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {tier.price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-zinc-900">$0</span>
                      <span className="text-sm text-zinc-400">/mo</span>
                    </div>
                  ) : tier.price === null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-zinc-900">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-zinc-900">${tier.price}</span>
                      <span className="text-sm text-zinc-400">/mo</span>
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {tierKey === 'free' && 'Free forever'}
                    {tierKey === 'pro' && 'For deal hunters'}
                    {tierKey === 'pro_plus' && 'Best value for power users'}
                    {tierKey === 'creator' && 'For influencers & creators'}
                    {tierKey === 'enterprise' && 'For teams & organizations'}
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href="/signup"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${style.cta}`}
                >
                  {tierKey === 'free' ? 'Get Started' : 'Start Free Trial'}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Divider */}
                <div className="mt-6 mb-5 border-t border-zinc-100" />

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {tierKey === 'pro' && (
                    <li className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Everything in Free, plus:</li>
                  )}
                  {tierKey === 'pro_plus' && (
                    <li className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Everything in Wist+, plus:</li>
                  )}
                  {tierKey === 'creator' && (
                    <li className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Everything in Wist Pro, plus:</li>
                  )}
                  {tier.features.filter(f => !f.startsWith('Everything in')).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        tierKey === 'free' ? 'text-zinc-400' :
                        tierKey === 'pro' ? 'text-blue-500' :
                        tierKey === 'pro_plus' ? 'text-violet-500' :
                        tierKey === 'creator' ? 'text-amber-500' : 'text-emerald-500'
                      }`} />
                      <span className="text-sm text-zinc-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Enterprise callout */}
        <div className="mt-12 relative rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-zinc-900">{TIERS.enterprise.displayName}</h3>
            </div>
            <p className="text-sm text-zinc-500 max-w-lg">
              API access, team wishlists, bulk gifting, custom branding, and dedicated support. 
              Built for organizations that need scale.
            </p>
          </div>
          <Link
            href="mailto:julien@nitron.digital?subject=Wist Enterprise"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Contact Sales <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Bottom reassurance */}
        <p className="mt-8 text-center text-xs text-zinc-400">
          All plans include a 14-day money-back guarantee. Cancel anytime. No questions asked.
        </p>
      </div>
    </section>
  )
}
