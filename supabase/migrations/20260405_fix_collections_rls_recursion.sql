-- Break RLS recursion between `collections` and `collection_collaborators`:
-- collections policy scanned collaborators → collaborators policy subqueried collections → loop.
-- SECURITY DEFINER helpers read tables as the function owner (bypass RLS inside the function).

CREATE OR REPLACE FUNCTION public.user_owns_collection(_collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = _collection_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_collection_collaborator(_collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_collaborators cc
    WHERE cc.collection_id = _collection_id AND cc.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_collection_collaborator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_collection_collaborator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_collection(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_collection_collaborator(uuid) TO service_role;

-- collection_collaborators: stop subquerying collections from RLS
DROP POLICY IF EXISTS "Users can view collaborators for their collections" ON collection_collaborators;
CREATE POLICY "Users can view collaborators for their collections"
  ON collection_collaborators FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_owns_collection(collection_id)
  );

-- collection_invites: same pattern as 20260402 (owner check only)
DROP POLICY IF EXISTS "Owners can manage invites" ON collection_invites;
CREATE POLICY "Owners can manage invites"
  ON collection_invites FOR ALL TO authenticated
  USING (public.user_owns_collection(collection_id))
  WITH CHECK (public.user_owns_collection(collection_id));

-- collections: collaborator read without scanning collaborators under RLS
DROP POLICY IF EXISTS "Collaborators can view shared collections" ON collections;
CREATE POLICY "Collaborators can view shared collections"
  ON collections FOR SELECT TO authenticated
  USING (public.user_is_collection_collaborator(id));

-- items: same for collaborator item read
DROP POLICY IF EXISTS "Collaborators can view items in shared collections" ON items;
CREATE POLICY "Collaborators can view items in shared collections"
  ON items FOR SELECT TO authenticated
  USING (
    collection_id IS NOT NULL
    AND public.user_is_collection_collaborator(collection_id)
  );
