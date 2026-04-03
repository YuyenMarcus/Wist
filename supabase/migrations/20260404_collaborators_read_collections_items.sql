-- Let collaborators read collections they joined and items in those collections (dashboard + collection page).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections' AND policyname = 'Collaborators can view shared collections'
  ) THEN
    CREATE POLICY "Collaborators can view shared collections"
      ON collections FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM collection_collaborators cc
          WHERE cc.collection_id = collections.id AND cc.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'items' AND policyname = 'Collaborators can view items in shared collections'
  ) THEN
    CREATE POLICY "Collaborators can view items in shared collections"
      ON items FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM collection_collaborators cc
          WHERE cc.collection_id = items.collection_id AND cc.user_id = auth.uid()
        )
      );
  END IF;
END $$;
