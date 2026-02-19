import type { Metadata } from 'next'
import '@/styles/globals.css'
import ThemeProvider from '@/components/layout/ThemeProvider'
import FloatingNav from '@/components/layout/FloatingNav'
import ClientProvider from '@/components/ClientProvider'

const siteUrl = 'https://wishlist.nuvio.cloud'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Wist — Smart Wishlist & Price Tracker for Any Online Store',
    template: '%s | Wist',
  },
  description:
    'Wist is a free smart wishlist and price tracker. Save products from Amazon, Target, Walmart, Etsy and any online store, track price drops automatically, and get notified when prices fall. The smarter way to shop online.',
  keywords: [
    'wishlist',
    'smart wishlist',
    'price tracker',
    'price drop alerts',
    'product wishlist',
    'online shopping wishlist',
    'wishlist app',
    'wishlist manager',
    'price tracking',
    'amazon price tracker',
    'universal wishlist',
    'gift registry',
    'save for later',
    'shopping list',
    'price history',
    'deal finder',
    'wist',
    'wishlist chrome extension',
  ],
  authors: [{ name: 'Wist', url: siteUrl }],
  creator: 'Wist',
  publisher: 'Nuvio Digital',
  applicationName: 'Wist',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: '/favicon-128x128.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Wist',
    title: 'Wist — Smart Wishlist & Price Tracker for Any Online Store',
    description:
      'Save products from any online store, track price drops automatically, and share your wishlist with friends. Free Chrome extension included.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Wist — Smart Wishlist & Price Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wist — Smart Wishlist & Price Tracker',
    description:
      'Save products from any store, track prices, get drop alerts. The smarter way to manage your wishlist.',
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'shopping',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Wist',
    url: siteUrl,
    description:
      'A free smart wishlist and price tracker. Save products from any online store, track price drops, and get notified when prices fall.',
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'Web, Chrome Extension',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Universal wishlist for any online store',
      'Automatic price tracking and history',
      'Price drop notifications',
      'Chrome extension for one-click saving',
      'Shareable wishlists',
      'Smart auto-categorization',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Nuvio Digital',
    },
  }

  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet" />
        <link rel="author" href={`${siteUrl}/llms.txt`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-white font-sans tracking-tight">
        <ThemeProvider>
          <ClientProvider>
            {children}
            <FloatingNav />
          </ClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

