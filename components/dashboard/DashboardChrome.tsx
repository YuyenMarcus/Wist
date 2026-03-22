'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';

export interface DashboardCollection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
  icon?: string | null;
  color?: string | null;
}

/** Routes that use a full-width layout without the dashboard sidebar. */
const FULL_WIDTH_PATHS = new Set<string>(['/dashboard/subscription']);

export default function DashboardChrome({
  children,
  initialCollections,
  tier,
}: {
  children: React.ReactNode;
  initialCollections: DashboardCollection[];
  tier?: string | null;
}) {
  const pathname = usePathname() || '';
  const hideSidebar = FULL_WIDTH_PATHS.has(pathname);

  if (hideSidebar) {
    return (
      <div className="min-h-screen bg-beige-50 dark:bg-dpurple-950 transition-colors">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-beige-50 dark:bg-dpurple-950 transition-colors">
      <Sidebar initialCollections={initialCollections} tier={tier} />
      <main className="flex-1 w-full pt-14 md:pt-0">{children}</main>
    </div>
  );
}
