'use client'

import { APP_STORE_URL } from '@/lib/constants/app-store'
import { Smartphone, Bell, TrendingDown, Share2 } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: TrendingDown, text: 'Real-time price tracking' },
  { icon: Bell, text: 'Instant drop notifications' },
  { icon: Share2, text: 'Share wishlists with friends' },
  { icon: Smartphone, text: 'Add items from any browser' },
]

export default function AppStoreSection() {
  return (
    <section
      className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50/60 to-white pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #8b5cf6 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-7xl mx-auto rounded-3xl border-2 border-violet-200/60 bg-white/50 backdrop-blur-sm p-12 sm:p-16 lg:p-24 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        {/* Phone mockup */}
        <div className="relative flex-shrink-0 w-[220px] sm:w-[260px]">
          <div className="relative rounded-[2.5rem] border-[14px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-zinc-900/20 overflow-hidden aspect-[9/19.5]">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-purple-50 flex flex-col items-center justify-center px-5">
              <img
                src="/logo.png"
                alt="Wist"
                className="w-14 h-14 mb-4 rounded-2xl shadow-md"
              />
              <span
                className="text-xl font-bold text-zinc-900 tracking-tight mb-1"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Wist
              </span>
              <span className="text-[11px] text-zinc-500 text-center leading-snug">
                Your wishlist,<br />always with you.
              </span>

              <div className="mt-6 w-full space-y-2.5">
                {[
                  { name: 'Sony WH-1000XM5', price: '$278', pct: '-20%' },
                  { name: 'Apple Watch Ultra', price: '$699', pct: '-13%' },
                  { name: 'Fujifilm X-T5', price: '$1,699', pct: '' },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2.5 rounded-xl bg-white/80 border border-zinc-100 px-3 py-2 shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-zinc-800 truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-900">
                          {item.price}
                        </span>
                        {item.pct && (
                          <span className="text-[9px] font-bold text-emerald-600">
                            {item.pct}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[22px] bg-zinc-900 rounded-b-2xl" />
          </div>
        </div>

        {/* Copy */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/60 mb-5">
            <Smartphone className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs font-semibold text-zinc-700 tracking-wide">
              NOW ON iOS
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Your wishlist,<br className="hidden sm:block" /> in your pocket
          </h2>

          <p className="mt-5 text-base sm:text-lg text-zinc-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Track prices, get instant drop alerts, and manage your wishlist on
            the go. Everything syncs with your web dashboard.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-zinc-700 leading-snug">
                  {text}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 lg:justify-start justify-center">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-7 py-3.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium opacity-80">
                  Download on the
                </span>
                <span className="text-[15px] font-bold -mt-0.5">
                  App Store
                </span>
              </div>
            </a>
            <span className="text-xs text-zinc-400">
              Free · Requires iOS 17+
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
