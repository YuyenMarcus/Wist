import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardCollectionRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  position?: number | null;
  created_at?: string | null;
  is_shared?: boolean;
};

/**
 * Owned collections + collections the user collaborates on (for sidebar, layout, dashboard).
 */
export async function fetchDashboardCollections(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardCollectionRow[]> {
  const { data: own, error: ownErr } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (ownErr) {
    console.error('[fetchDashboardCollections] owned:', ownErr);
  }

  const { data: collabRows, error: collabErr } = await supabase
    .from('collection_collaborators')
    .select('collection_id')
    .eq('user_id', userId);

  if (collabErr) {
    console.error('[fetchDashboardCollections] collaborators:', collabErr);
  }

  const sharedIds = [...new Set((collabRows || []).map((r) => r.collection_id).filter(Boolean))];

  let shared: DashboardCollectionRow[] = [];
  if (sharedIds.length > 0) {
    const { data: sharedCols, error: sharedErr } = await supabase
      .from('collections')
      .select('*')
      .in('id', sharedIds);

    if (sharedErr) {
      console.error('[fetchDashboardCollections] shared:', sharedErr);
    } else {
      shared = (sharedCols || []).map((c) => ({ ...c, is_shared: true }));
    }
  }

  const byId = new Map<string, DashboardCollectionRow>();
  for (const c of own || []) {
    byId.set(c.id, { ...c, is_shared: false });
  }
  for (const c of shared) {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    if (a.position != null && b.position != null) {
      return (a.position as number) - (b.position as number);
    }
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    const dateA = new Date((a.created_at as string) || 0).getTime();
    const dateB = new Date((b.created_at as string) || 0).getTime();
    return dateA - dateB;
  });

  return merged;
}
