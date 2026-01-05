import type { Metadata } from 'next'
import '@/styles/globals.css'
import ThemeProvider from '@/components/layout/ThemeProvider'
import FloatingNav from '@/components/layout/FloatingNav'
import ClientProvider from '@/components/ClientProvider'

export const metadata: Metadata = {
  title: 'Wist - Product Wishlist Manager',
  description: 'Track and manage your product wishlist',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body className="bg-zinc-50 font-sans tracking-tight">
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

