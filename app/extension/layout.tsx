import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chrome Extension — Save Products in One Click',
  description: 'Install the free Wist Chrome extension to save products from any online store in one click. Works on Amazon, Target, Walmart, Etsy, and thousands more.',
  openGraph: {
    title: 'Wist Chrome Extension — Save Products in One Click',
    description: 'Install the free Wist Chrome extension to save products from any store in one click and track prices automatically.',
  },
}

export default function ExtensionLayout({ children }: { children: React.ReactNode }) {
  return children
}
