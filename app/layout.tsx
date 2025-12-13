import type { Metadata } from 'next'
import '@/styles/globals.css'
import ThemeProvider from '@/components/layout/ThemeProvider'

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

