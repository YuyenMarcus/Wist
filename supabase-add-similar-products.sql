CREATE TABLE IF NOT EXISTS similar_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  similar_url text NOT NULL,
  similar_title text,
  similar_price numeric(10,2),
  similar_image text,
  retailer text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_similar_products_item_id ON similar_products(item_id);
