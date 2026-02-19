import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Your Free Account',
  description: 'Join Wist for free — the smart wishlist and price tracker. Save products from Amazon, Target, Walmart, Etsy and any store. Get price drop alerts automatically.',
  openGraph: {
    title: 'Create Your Free Wist Account',
    description: 'Join Wist — the smart wishlist and price tracker. Save products from any store and get price drop alerts.',
  },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
