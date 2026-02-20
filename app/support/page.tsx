'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSection {
  title: string
  icon: string
  items: FAQItem[]
}

const faqSections: FAQSection[] = [
  {
    title: 'Getting Started',
    icon: '🚀',
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
        answer: 'Yes! Wist is completely free. You can save unlimited items, create collections, track prices, and share your wishlist at no cost.',
      },
      {
        question: 'How do I share my wishlist?',
        answer: 'Click the "Share List" button on your dashboard. This copies your unique profile link that you can send to anyone. They\'ll be able to see your public items without needing an account.',
      },
    ],
  },
  {
    title: 'Browser Extension',
    icon: '🧩',
    items: [
      {
        question: 'What does the Wist extension do?',
        answer: 'The Wist browser extension lets you save items to your wishlist with one click while browsing any shopping site. It automatically detects the product name, price, and image — no copy-pasting needed.',
      },
      {
        question: 'How do I install the extension?',
        answer: 'Download the extension from your dashboard (or the Chrome Web Store when available). In Chrome, go to chrome://extensions, enable "Developer mode", click "Load unpacked", and select the downloaded extension folder.',
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
    icon: '📦',
    items: [
      {
        question: 'How do I add items to my wishlist?',
        answer: 'There are two ways: (1) Use the browser extension while on any product page — click the Wist icon and hit "Save to Wist". (2) Paste a product link directly into the input field on your dashboard.',
      },
      {
        question: 'Why does pasting a link take a few seconds?',
        answer: 'When you paste a link, the extension opens the page in the background to extract the product details (title, price, image). Some sites like Target or Etsy use heavy JavaScript that takes a moment to load. The progress bar shows the current status.',
      },
      {
        question: 'The price or image didn\'t load correctly for an item.',
        answer: 'Some websites use strong bot protection that can block automated data extraction. Try saving the item using the extension while you\'re actually on the product page — this method is more reliable since you\'ve already loaded the page in your browser.',
      },
      {
        question: 'Can I edit an item after saving it?',
        answer: 'Yes! Click on any item in your dashboard to view its details. From there you can update the title, notes, and other information.',
      },
    ],
  },
  {
    title: 'Price Tracking',
    icon: '📈',
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
        answer: 'Yes! When a price drop is detected, Wist logs a notification. Make sure the notification bell on your dashboard is enabled to stay informed about price changes.',
      },
      {
        question: 'Where can I see the price history chart?',
        answer: 'Click the "History" button on any item card. This takes you to the item\'s detail page where you\'ll see a chart showing the price over time, starting from the day you added the item.',
      },
    ],
  },
  {
    title: 'Collections & Organization',
    icon: '📁',
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
    icon: '👤',
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
        answer: 'Please contact us at support@nuvio.cloud to request account deletion. We\'ll remove all your data within 48 hours.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: '🔧',
    items: [
      {
        question: 'The page is loading slowly or looks broken.',
        answer: 'Try refreshing the page with Ctrl+Shift+R (or Cmd+Shift+R on Mac) to clear the cache. If the issue persists, try a different browser or check your internet connection.',
      },
      {
        question: 'I saved an item but it\'s not showing on my dashboard.',
        answer: 'Refresh the dashboard page. If you\'re using the extension, make sure you saw the green "Saved!" confirmation. Also check that you\'re logged into the same account on both the website and the extension.',
      },
      {
        question: 'My shared profile link doesn\'t show all my items.',
        answer: 'Only items marked as "public" appear on your shared profile. Items set to private are only visible to you when logged in. Check your item visibility settings.',
      },
      {
        question: 'I need more help.',
        answer: 'Reach out to us at support@nuvio.cloud and we\'ll get back to you as soon as possible. Please include details about the issue, what device and browser you\'re using, and any error messages you see.',
      },
    ],
  },
]

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-medium text-zinc-900 pr-4 group-hover:text-violet-600 transition-colors">
          {item.question}
        </span>
        <ChevronDown
          size={16}
          className={`text-zinc-400 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-violet-500' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-96 pb-4' : 'max-h-0'
        }`}
      >
        <p className="text-sm text-zinc-600 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <Link
            href="/"
            className="inline-block text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4 hover:bg-violet-100 transition-colors"
          >
            ← Back to Wist
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight">
            Help & Support
          </h1>
          <p className="mt-3 text-zinc-500 text-sm sm:text-base max-w-md mx-auto">
            Everything you need to know about using Wist, the extension, price tracking, and more.
          </p>
        </div>
      </div>

      {/* FAQ Sections */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-6">
          {faqSections.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
                <h2 className="text-base sm:text-lg font-semibold text-zinc-900 flex items-center gap-2.5">
                  <span className="text-lg">{section.icon}</span>
                  {section.title}
                </h2>
              </div>
              <div className="px-5 sm:px-6 pb-2">
                {section.items.map((item) => (
                  <FAQAccordion key={item.question} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-10 text-center">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-8 sm:p-10">
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 mb-2">
              Still need help?
            </h2>
            <p className="text-sm text-zinc-500 mb-5 max-w-sm mx-auto">
              Can't find what you're looking for? Our team is here to help.
            </p>
            <a
              href="mailto:support@nuvio.cloud"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-full hover:bg-violet-700 transition-colors shadow-sm"
            >
              Contact Support
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pb-24 text-center text-xs text-zinc-400">
          <Link href="/" className="hover:text-violet-500 transition-colors">
            wishlist.nuvio.cloud
          </Link>
          {' · '}
          <Link href="/dashboard" className="hover:text-violet-500 transition-colors">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
