-- Collaborative collections: opt-in public join + stable invite code on collection
ALTER TABLE collections ADD COLUMN IF NOT EXISTS collaborative_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS collaboration_invite_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_collaboration_invite_code
  ON collections (collaboration_invite_code)
  WHERE collaboration_invite_code IS NOT NULL;
