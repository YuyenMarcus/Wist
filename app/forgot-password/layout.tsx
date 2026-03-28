import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset your Wist account password via email.',
  openGraph: {
    title: 'Forgot password | Wist',
    description: 'Reset your Wist account password.',
  },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
