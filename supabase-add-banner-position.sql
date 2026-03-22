-- Focal point for profile cover (CSS object-position as percentages).
-- 50,50 = center. X: 0 left → 100 right. Y: 0 top → 100 bottom.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS banner_position_x integer NOT NULL DEFAULT 50;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS banner_position_y integer NOT NULL DEFAULT 50;

COMMENT ON COLUMN profiles.banner_position_x IS '0–100: horizontal object-position % for banner (50 = center).';
COMMENT ON COLUMN profiles.banner_position_y IS '0–100: vertical object-position % for banner (50 = center).';
