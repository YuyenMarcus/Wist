-- Supabase schema for wishlist_items table
-- Run this in your Supabase SQL editor

-- Create wishlist_items table
CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text,
  description text,
  price numeric,
  price_raw text,
  currency text,
  image text,
  domain text,
  url text NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index on user_id for fast queries
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_at ON wishlist_items(created_at DESC);

-- Optional: Create index on domain for analytics
CREATE INDEX IF NOT EXISTS idx_wishlist_items_domain ON wishlist_items(domain);

-- Enable Row Level Security (RLS)
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own items
CREATE POLICY "Users can view own wishlist items"
  ON wishlist_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own items
CREATE POLICY "Users can insert own wishlist items"
  ON wishlist_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own items
CREATE POLICY "Users can update own wishlist items"
  ON wishlist_items
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own items
CREATE POLICY "Users can delete own wishlist items"
  ON wishlist_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Create a cache table for scraped products
CREATE TABLE IF NOT EXISTS product_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Index on URL for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_cache_url ON product_cache(url);

-- Index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_product_cache_expires_at ON product_cache(expires_at);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM product_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean cache (requires pg_cron extension)
-- SELECT cron.schedule('clean-cache', '0 * * * *', 'SELECT clean_expired_cache()');

-- Error analytics table for tracking failed scrapes
CREATE TABLE IF NOT EXISTS scrape_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  domain text,
  reason text,
  error_type text NOT NULL CHECK (error_type IN ('timeout', 'blocked', 'parse_error', 'network_error', 'unknown')),
  failed_at timestamptz DEFAULT now()
);

-- Index on domain for analytics queries
CREATE INDEX IF NOT EXISTS idx_scrape_errors_domain ON scrape_errors(domain);

-- Index on error_type for filtering
CREATE INDEX IF NOT EXISTS idx_scrape_errors_error_type ON scrape_errors(error_type);

-- Index on failed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_scrape_errors_failed_at ON scrape_errors(failed_at DESC);

-- Function to get blocked domains summary
CREATE OR REPLACE FUNCTION get_blocked_domains_summary(days_back integer DEFAULT 7)
RETURNS TABLE (
  domain text,
  error_count bigint,
  last_error_at timestamptz,
  error_types text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.domain,
    COUNT(*)::bigint as error_count,
    MAX(se.failed_at) as last_error_at,
    ARRAY_AGG(DISTINCT se.error_type) as error_types
  FROM scrape_errors se
  WHERE se.failed_at >= NOW() - (days_back || ' days')::interval
  GROUP BY se.domain
  ORDER BY error_count DESC;
END;
$$ LANGUAGE plpgsql;