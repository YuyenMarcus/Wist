-- ============================================================
-- Collaborative Collections & Gift Registry
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. New columns on collections
ALTER TABLE collections ADD COLUMN IF NOT EXISTS registry_mode boolean DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS background_image_url text;

-- 2. Collection collaborators
CREATE TABLE IF NOT EXISTS collection_collaborators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_collection ON collection_collaborators(collection_id);
CREATE INDEX IF NOT EXISTS idx_collab_user ON collection_collaborators(user_id);

-- 3. Collection invites
CREATE TABLE IF NOT EXISTS collection_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_uses int,
  use_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_code ON collection_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invite_collection ON collection_invites(collection_id);

-- 4. Item reservations (for gift registry)
CREATE TABLE IF NOT EXISTS item_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE UNIQUE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  reserver_name text,
  reserver_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_collection ON item_reservations(collection_id);
CREATE INDEX IF NOT EXISTS idx_reservation_item ON item_reservations(item_id);

-- 5. RLS
ALTER TABLE collection_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_reservations ENABLE ROW LEVEL SECURITY;

-- Collaborators: users can see collaborators for collections they own or are members of
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_collaborators' AND policyname = 'Users can view collaborators for their collections') THEN
    CREATE POLICY "Users can view collaborators for their collections"
      ON collection_collaborators FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR collection_id IN (SELECT id FROM collections WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Invites: owners can manage invites
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_invites' AND policyname = 'Owners can manage invites') THEN
    CREATE POLICY "Owners can manage invites"
      ON collection_invites FOR ALL TO authenticated
      USING (
        collection_id IN (SELECT id FROM collections WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Reservations: public read for active registry collections
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_reservations' AND policyname = 'Public can view reservations') THEN
    CREATE POLICY "Public can view reservations"
      ON item_reservations FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;
