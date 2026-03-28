import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Set new password',
  description: 'Choose a new password for your Wist account.',
  openGraph: {
    title: 'Set new password | Wist',
    description: 'Choose a new password for your Wist account.',
  },
}

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
