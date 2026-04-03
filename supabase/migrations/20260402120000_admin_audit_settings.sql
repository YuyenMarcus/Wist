-- Admin audit trail (append-only). Service role / server APIs only.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address text
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log (action);

COMMENT ON TABLE admin_audit_log IS 'Sensitive admin actions; read via /api/admin/audit';

-- Key-value console settings (JSON payloads).
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default role matrix (UI + future permission checks; app still uses profiles.is_admin today)
INSERT INTO admin_settings (key, value)
VALUES (
  'role_matrix',
  '{
    "roles": ["admin", "editor", "viewer", "member"],
    "matrix": {
      "admin": { "overview": true, "users": true, "banned": true, "settings": true, "roles": true, "audit": true },
      "editor": { "overview": true, "users": true, "banned": false, "settings": false, "roles": false, "audit": false },
      "viewer": { "overview": true, "users": false, "banned": false, "settings": false, "roles": false, "audit": true },
      "member": { "overview": false, "users": false, "banned": false, "settings": false, "roles": false, "audit": false }
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value)
VALUES (
  'site_prefs',
  '{
    "siteName": "Wist",
    "timezone": "America/New_York",
    "language": "en",
    "sessionTimeoutDays": "7",
    "enforce2FA": false,
    "minPasswordLength": 8,
    "webhookUrl": "",
    "apiKeyHint": "",
    "logoUrl": "",
    "primaryColor": "#7c3aed",
    "emailTemplateNote": ""
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
