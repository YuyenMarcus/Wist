/**
 * Simplified product fetching API
 * Primary method: Structured data extraction (JSON-LD + meta tags)
 * No Playwright unless absolutely necessary
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper: Clean price
function cleanPrice(raw: string | number | null): number | null {
  if (!raw) return null;
  const str = String(raw);
  const num = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(num);
  return isNaN(parsed) ? null : parseFloat(parsed.toFixed(2));
}

// Helper: Clean title
function cleanTitle(title: string | null): string {
  if (!title) return 'Unknown Product';
  return title.trim().replace(/\s+/g, ' ');
}

// Helper: Extract domain
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, save = false, user_id } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing URL' });
    }

    // Fetch HTML (simple HTTP request - no bot detection)
    const html = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }).then((r) => r.text());

    const $ = cheerio.load(html);

    // ---- 1️⃣ Try to extract structured data (JSON-LD) ----
    let jsonLdBlocks = $('script[type="application/ld+json"]')
      .map((_, el) => $(el).html())
      .get();

    let productData: any = null;

    // Find Product type in JSON-LD
    for (const block of jsonLdBlocks) {
      try {
        const data = JSON.parse(block);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
            productData = item;
            break;
          }
        }

        if (productData) break;
      } catch {
        // Ignore parse errors
      }
    }

    // ---- 2️⃣ Extract metadata (with structured data priority) ----
    const title =
      productData?.name ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      'Unknown Product';

    const priceRaw =
      productData?.offers?.price ||
      productData?.price ||
      $('meta[property="product:price:amount"]').attr('content') ||
      null;

    const currency =
      productData?.offers?.priceCurrency ||
      productData?.priceCurrency ||
      $('meta[property="product:price:currency"]').attr('content') ||
      'USD';

    const image =
      (productData?.image && (Array.isArray(productData.image) ? productData.image[0] : productData.image)) ||
      $('meta[property="og:image"]').attr('content') ||
      $('img').first().attr('src') ||
      null;

    const description =
      productData?.description ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const source = extractDomain(url);

    // ---- 3️⃣ Normalize and clean ----
    const cleanPriceValue = cleanPrice(priceRaw);
    const cleanTitleValue = cleanTitle(title);

    // Clean image URL
    let cleanImage = image;
    if (image && !image.startsWith('http')) {
      try {
        cleanImage = new URL(image, url).href;
      } catch {
        cleanImage = null;
      }
    }

    const normalized = {
      title: cleanTitleValue,
      price: cleanPriceValue,
      priceRaw: priceRaw ? String(priceRaw) : null,
      currency,
      image: cleanImage,
      description: description.trim() || null,
      domain: source,
      url,
      blocked: false,
    };

    // ---- 4️⃣ Save to Supabase if requested ----
    if (save && user_id) {
      const supabase = getSupabase();

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('wishlist_items')
            .insert([
              {
                user_id,
                title: normalized.title,
                description: normalized.description,
                price: normalized.price,
                price_raw: normalized.priceRaw,
                currency: normalized.currency,
                image: normalized.image,
                domain: normalized.domain,
                url: normalized.url,
                meta: {
                  scraped_at: new Date().toISOString(),
                  method: 'structured_data',
                },
              },
            ])
            .select()
            .single();

          if (error) {
            console.error('Supabase insert error:', error);
          } else {
            return res.status(200).json({
              ok: true,
              data: normalized,
              saved: true,
              item: data,
            });
          }
        } catch (supabaseErr: any) {
          console.error('Supabase save failed:', supabaseErr);
          // Continue to return data even if save fails
        }
      }
    }

    // Return normalized data
    return res.status(200).json({
      ok: true,
      data: normalized,
      saved: false,
    });
  } catch (err: any) {
    console.error('fetch-product error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unable to fetch product',
      detail: err.message || String(err),
    });
  }
}

