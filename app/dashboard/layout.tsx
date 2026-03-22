import { createClient } from '@/lib/supabase/server';
import DashboardChrome from '@/components/dashboard/DashboardChrome';

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
  
  let collections: Collection[] = [];
  let userTier: string | null = null;
  if (user) {
      const [collectionsResult, profileResult] = await Promise.all([
        supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single(),
      ]);
      
      if (collectionsResult.data) {
        const sorted = collectionsResult.data.sort((a: any, b: any) => {
          if (a.position !== null && b.position !== null) {
            return a.position - b.position;
          }
          if (a.position !== null) return -1;
          if (b.position !== null) return 1;
          return 0;
        });
        collections = (sorted as Collection[]) || [];
      }

      userTier = profileResult.data?.subscription_tier || null;
  }

  return (
    <DashboardChrome initialCollections={collections} tier={userTier}>
      {children}
    </DashboardChrome>
  );
}
