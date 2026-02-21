'use client'

import { useState } from 'react'
import {
  ChevronDown,
  Sparkles,
  Chrome,
  Package,
  TrendingUp,
  FolderOpen,
  UserCircle,
  Wrench,
  Mail,
  ArrowLeft,
} from 'lucide-react'
import PageTransition from '@/components/ui/PageTransition'
import Link from 'next/link'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSection {
  title: string
  icon: React.ReactNode
  items: FAQItem[]
}

const faqSections: FAQSection[] = [
  {
    title: 'Getting Started',
    icon: <Sparkles size={18} />,
    items: [
      {
        question: 'What is Wist?',
        answer: 'Wist is a universal wishlist and price tracker. Save items from any online store, organize them into collections, track price changes over time, and share your wishlist with friends and family.',
      },
      {
        question: 'How do I create an account?',
        answer: 'You can sign up with your email address or use Google Sign-In for instant access. Visit the sign-up page, enter your details, and you\'re ready to start saving items.',
      },
      {
        question: 'Is Wist free to use?',
        answer: 'Yes. Wist is completely free. You can save unlimited items, create collections, track prices, and share your wishlist at no cost.',
      },
      {
        question: 'How do I share my wishlist?',
        answer: 'Click the "Share List" button on your dashboard. This copies your unique profile link that you can send to anyone. They\'ll be able to see your public items without needing an account.',
      },
    ],
  },
  {
    title: 'Browser Extension',
    icon: <Chrome size={18} />,
    items: [
      {
        question: 'What does the Wist extension do?',
        answer: 'The Wist browser extension lets you save items to your wishlist with one click while browsing any shopping site. It automatically detects the product name, price, and image — no copy-pasting needed.',
      },
      {
        question: 'How do I install the extension?',
        answer: 'Download the extension from your dashboard or the Chrome Web Store. In Chrome, go to chrome://extensions, enable "Developer mode", click "Load unpacked", and select the downloaded extension folder.',
      },
      {
        question: 'The extension says "Please log in" even though I\'m logged in.',
        answer: 'This usually happens when your session needs to sync. Visit wishlist.nuvio.cloud and make sure you\'re logged in on the website first. Then try using the extension again — it automatically syncs your session when you visit the site.',
      },
      {
        question: 'Which browsers are supported?',
        answer: 'The extension currently works with Google Chrome and other Chromium-based browsers like Brave, Edge, and Opera. Firefox and Safari support is planned for the future.',
      },
      {
        question: 'Which shopping sites does the extension support?',
        answer: 'The extension works on virtually any shopping website including Amazon, Target, Walmart, Best Buy, Etsy, and thousands more. If a site has a product page with a price, the extension can save it.',
      },
    ],
  },
  {
    title: 'Adding Items',
    icon: <Package size={18} />,
    items: [
      {
        question: 'How do I add items to my wishlist?',
        answer: 'There are two ways: use the browser extension while on any product page and click "Save to Wist", or paste a product link directly into the input field on your dashboard.',
      },
      {
        question: 'Why does pasting a link take a few seconds?',
        answer: 'When you paste a link, the extension opens the page in the background to extract product details. Some sites like Target or Etsy use heavy JavaScript that takes a moment to load. The progress bar shows the current status.',
      },
      {
        question: 'The price or image didn\'t load correctly for an item.',
        answer: 'Some websites use strong bot protection that can block automated data extraction. Try saving the item using the extension while you\'re actually on the product page — this method is more reliable since you\'ve already loaded the page.',
      },
      {
        question: 'Can I edit an item after saving it?',
        answer: 'Yes. Click on any item in your dashboard to view its details. From there you can update the title, notes, and other information.',
      },
    ],
  },
  {
    title: 'Price Tracking',
    icon: <TrendingUp size={18} />,
    items: [
      {
        question: 'How does price tracking work?',
        answer: 'Wist automatically checks the prices of your saved items on a regular schedule. When a price changes, it\'s logged to your price history chart so you can see trends over time.',
      },
      {
        question: 'How often are prices checked?',
        answer: 'Prices are checked automatically every 24 hours. You can view the price history chart on any item\'s detail page to see how the price has changed since you added it.',
      },
      {
        question: 'Will I get notified when a price drops?',
        answer: 'Yes. When a price drop is detected, Wist logs a notification. Make sure the notification bell on your dashboard is enabled to stay informed about price changes.',
      },
      {
        question: 'Where can I see the price history chart?',
        answer: 'Click the "History" button on any item card. This takes you to the item\'s detail page where you\'ll see a chart showing the price over time, starting from the day you added the item.',
      },
    ],
  },
  {
    title: 'Collections & Organization',
    icon: <FolderOpen size={18} />,
    items: [
      {
        question: 'What are collections?',
        answer: 'Collections are folders for organizing your items. You can create collections like "Gift Ideas", "Tech Wishlist", or "Home Decor" to keep your wishlist tidy.',
      },
      {
        question: 'How do I create a collection?',
        answer: 'From your dashboard, switch to the "Categories" view. You can create new collections and drag items into them to organize your wishlist.',
      },
      {
        question: 'Can I make some items private?',
        answer: 'Yes. When saving an item, you can set it to private so it won\'t appear on your shared profile. Only you can see private items when logged in.',
      },
    ],
  },
  {
    title: 'Account & Profile',
    icon: <UserCircle size={18} />,
    items: [
      {
        question: 'How do I customize my profile?',
        answer: 'Go to Account Settings from the sidebar menu. You can update your display name, username, bio, and profile picture. Your username determines your shareable profile URL.',
      },
      {
        question: 'How do I sign in with Google?',
        answer: 'On the login page, click "Sign in with Google" or use the Google One Tap popup that appears. If you originally signed up with email, you can link your Google account from Account Settings.',
      },
      {
        question: 'I\'m having trouble signing in with Google.',
        answer: 'Make sure you\'re allowing popups from wishlist.nuvio.cloud. If the Google popup appears and disappears without signing you in, try clearing your browser cookies for the site and signing in again.',
      },
      {
        question: 'How do I delete my account?',
        answer: 'Contact us at support@nuvio.cloud to request account deletion. We\'ll remove all your data within 48 hours.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: <Wrench size={18} />,
    items: [
      {
        question: 'The page is loading slowly or looks broken.',
        answer: 'Try refreshing the page with Ctrl+Shift+R (or Cmd+Shift+R on Mac) to clear the cache. If the issue persists, try a different browser or check your internet connection.',
      },
      {
        question: 'I saved an item but it\'s not showing on my dashboard.',
        answer: 'Refresh the dashboard page. If you\'re using the extension, make sure you saw the green confirmation. Also check that you\'re logged into the same account on both the website and the extension.',
      },
      {
        question: 'My shared profile link doesn\'t show all my items.',
        answer: 'Only items marked as "public" appear on your shared profile. Items set to private are only visible to you when logged in. Check your item visibility settings.',
      },
      {
        question: 'I need more help.',
        answer: 'Reach out to us at support@nuvio.cloud and we\'ll get back to you as soon as possible. Include details about the issue, what device and browser you\'re using, and any error messages you see.',
      },
    ],
  },
]

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-zinc-100/80 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 sm:py-5 text-left group"
      >
        <span className="text-[13px] sm:text-sm font-medium text-zinc-800 pr-4 group-hover:text-violet-600 transition-colors">
          {item.question}
        </span>
        <ChevronDown
          size={15}
          className={`text-zinc-300 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-violet-500' : 'group-hover:text-zinc-400'
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          open ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-[13px] sm:text-sm text-zinc-500 leading-relaxed">
          {item.answer}
        </p>
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <PageTransition className="min-h-screen bg-white">
      {/* Hero header with radial gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient pointer-events-none" />
        <div className="absolute inset-0 bg-grid pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 px-3.5 py-1.5 rounded-full mb-6 hover:bg-violet-100 hover:border-violet-200 transition-all"
          >
            <ArrowLeft size={12} />
            Back to Wist
          </Link>
          <h1
            className="hero-headline text-center"
            style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', marginBottom: '16px' }}
          >
            Help & <span className="headline-accent">Support</span>
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
            Everything you need to know about using Wist, the extension, price tracking, and more.
          </p>
        </div>
      </div>

      {/* FAQ Sections */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        <div className="space-y-5">
          {faqSections.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-xl border border-zinc-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-1">
                <h2 className="text-sm sm:text-base font-semibold text-zinc-900 flex items-center gap-2.5 tracking-tight">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-500">
                    {section.icon}
                  </span>
                  {section.title}
                </h2>
              </div>
              <div className="px-5 sm:px-7 pb-1">
                {section.items.map((item) => (
                  <FAQAccordion key={item.question} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 p-8 sm:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-purple-50 pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-600 mb-4">
                <Mail size={22} />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 mb-2 tracking-tight">
                Still need help?
              </h2>
              <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto leading-relaxed">
                Can't find what you're looking for? We're happy to help.
              </p>
              <a
                href="mailto:support@nuvio.cloud"
                className="btn btn-primary inline-flex items-center gap-2 !px-6 !py-3 !text-sm !rounded-xl"
                style={{ display: 'inline-flex' }}
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-10 pb-24 flex items-center justify-center gap-3 text-xs text-zinc-400">
          <Link href="/" className="hover:text-violet-500 transition-colors">
            Home
          </Link>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-300" />
          <Link href="/dashboard" className="hover:text-violet-500 transition-colors">
            Dashboard
          </Link>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-300" />
          <a href="mailto:support@nuvio.cloud" className="hover:text-violet-500 transition-colors">
            support@nuvio.cloud
          </a>
        </div>
      </div>
    </PageTransition>
  )
}
