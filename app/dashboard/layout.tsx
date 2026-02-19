import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
import { redirect } from 'next/navigation';

// 🛑 FORCE DYNAMIC: This fixes the "Disappearing List" bug
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Collection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
  icon?: string | null;
  color?: string | null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Don't redirect here - let the client-side dashboard page handle auth
  // This prevents redirect loops when cookies aren't set yet after sign-in
  
  // Fetch collections to pass to the sidebar (only if user exists)
  let collections: Collection[] = [];
  if (user) {
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      // Sort by position if it exists, otherwise keep created_at order
      if (data) {
        const sorted = data.sort((a: any, b: any) => {
          if (a.position !== null && b.position !== null) {
            return a.position - b.position;
          }
          if (a.position !== null) return -1;
          if (b.position !== null) return 1;
          return 0;
        });
        collections = (sorted as Collection[]) || [];
      } else {
        collections = [];
      }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar - Includes mobile header and slide-out menu */}
      <Sidebar initialCollections={collections} />
      
      {/* Main Content Area - Add top padding on mobile for fixed header */}
      <main className="flex-1 w-full pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
