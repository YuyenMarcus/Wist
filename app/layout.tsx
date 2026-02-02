import type { Metadata } from 'next'
import '@/styles/globals.css'
import ThemeProvider from '@/components/layout/ThemeProvider'
import FloatingNav from '@/components/layout/FloatingNav'
import ClientProvider from '@/components/ClientProvider'

export const metadata: Metadata = {
  title: 'Wist - Product Wishlist Manager',
  description: 'Track and manage your product wishlist',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: '/favicon-128x128.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet" />
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

