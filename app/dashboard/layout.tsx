import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';

// 🛑 FORCE DYNAMIC: This fixes the "Disappearing List" bug
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Collection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware handles redirects, but we still need user for queries
  // Fetch collections to pass to the sidebar (only if user exists)
  let collections: Collection[] = [];
  if (user) {
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    collections = (data as Collection[]) || [];
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      {/* Sidebar - Hidden on mobile, handled by a separate component later if needed */}
      <Sidebar initialCollections={collections || []} />
      
      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}

