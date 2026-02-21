-- Auto-activate queued items setting (default: true = auto-activate on desktop)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_activate_queued boolean DEFAULT true;
