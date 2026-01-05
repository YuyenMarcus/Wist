import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
// import { redirect } from 'next/navigation'; <--- COMMENTED OUT

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

  // 🛑 DISABLE THE REDIRECT. Just log it.
  if (!user) {
    console.log("Layout: User is missing on server side.");
    // redirect('/login'); <--- COMMENTED OUT
  }

  // Allow the page to render even if user is null (for debugging)
  const { data: collections } = await supabase
    .from('collections')
    .select('*')
    //.eq('user_id', user.id) <--- This will fail if user is null, so handle it:
    .eq('user_id', user?.id || '00000000-0000-0000-0000-000000000000') // Dummy ID to prevent crash
    .order('created_at', { ascending: true });

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

