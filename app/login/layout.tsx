import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Wist to access your smart wishlist, track prices, and manage your saved products from any online store.',
  openGraph: {
    title: 'Sign In | Wist',
    description: 'Sign in to access your smart wishlist and price tracker.',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
