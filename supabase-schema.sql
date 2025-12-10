-- Create a table to store tracked products
-- Run this in Supabase Dashboard -> SQL Editor

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  url text not null unique,        -- The product URL (must be unique)
  title text,                      -- Product Title
  price text,                      -- Current Price (e.g. "19.99")
  price_raw text,                  -- Raw price string (e.g. "$19.99")
  image text,                      -- Image URL
  description text,                -- Product description
  domain text,                     -- Domain (e.g. "amazon.com")
  currency text default 'USD',
  
  last_scraped timestamp with time zone default timezone('utc'::text, now()),
  
  -- Metadata for tracking
  meta jsonb default '{}'::jsonb
);

-- Create index on URL for fast lookups
create index if not exists products_url_idx on products(url);

-- Create index on last_scraped for cache expiration queries
create index if not exists products_last_scraped_idx on products(last_scraped);

-- Turn on Row Level Security (Safety first)
alter table products enable row level security;

-- Allow anyone to READ products (Public)
create policy "Public Read" on products
for select using (true);

-- Allow authenticated users to INSERT (via service role key in API)
-- Service role key bypasses RLS, so this is for future user auth
create policy "Public Insert" on products
for insert with check (true);

-- Allow service role to UPDATE (for price updates)
create policy "Public Update" on products
for update using (true);

