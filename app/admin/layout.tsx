import AdminLayoutClient from '@/components/admin/AdminLayoutClient'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
