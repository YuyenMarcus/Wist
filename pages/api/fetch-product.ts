// pages/api/fetch-product.ts

import type { NextApiRequest, NextApiResponse } from 'next';

import fetch from 'node-fetch';

import metascraper from 'metascraper';

import msImage from 'metascraper-image';

import msTitle from 'metascraper-title';

import msDesc from 'metascraper-description';

import msUrl from 'metascraper-url';

import { chromium } from 'playwright-extra';

// Note: playwright-extra-plugin-stealth is currently a placeholder package.
// For production, consider using puppeteer-extra-plugin-stealth with puppeteer,
// or implement manual stealth techniques (user agent rotation, headers, etc.)
// For now, we'll use playwright-extra without the stealth plugin.
// import StealthPlugin from 'playwright-extra-plugin-stealth';
// chromium.use(StealthPlugin());

import { createClient } from '@supabase/supabase-js';



// CONFIG: expand this list if you know other dynamic hosts

const DYNAMIC_HOSTS = ['amazon.', 'bestbuy.', 'target.', 'walmart.', 'ebay.'];



const METASCRAPER = metascraper([msImage(), msTitle(), msDesc(), msUrl()]);



type Normalized = {

  title: string | null;

  price: number | null;

  priceRaw?: string | null;

  currency?: string | null;

  image?: string | null;

  description?: string | null;

  domain: string | null;

  url: string;

  blocked?: boolean;

  rawHtmlSample?: string | null;

};



// Helper funcs

function extractDomain(url: string): string | null {

  try { return new URL(url).hostname.replace(/^www\./, ''); }

  catch { return null; }

}



function looksDynamic(domain: string | null) {

  if (!domain) return false;

  return DYNAMIC_HOSTS.some(d => domain.includes(d));

}



function parseCurrencyFromRaw(raw?: string | null) {

  if (!raw) return null;

  // common ISO detection like USD, GBP

  const iso = raw.match(/(USD|GBP|EUR|CAD|AUD|JPY|CNY)/i);

  return iso ? iso[0].toUpperCase() : null;

}



function cleanPrice(raw?: string | null): number | null {

  if (!raw) return null;

  const s = raw.replace(/[^\d.,\-]/g, '').trim();

  if (!s) return null;

  // handle formats 1,234.56 or 1.234,56

  const comma = s.indexOf(',');

  const dot = s.indexOf('.');

  try {

    if (comma > -1 && dot > -1) {

      // whichever appears last is decimal

      return parseFloat(s.replace(/[,]/g, '').replace(/^\s+|\s+$/g, ''));

    } else if (comma > -1 && dot === -1) {

      return parseFloat(s.replace(/\./g, '').replace(',', '.'));

    } else {

      return parseFloat(s.replace(/,/g, ''));

    }

  } catch {

    return null;

  }

}



// block detection heuristics

function detectBlock(htmlSample: string | null) {

  if (!htmlSample) return false;

  const s = htmlSample.toLowerCase();

  const markers = [

    'robot', 'captcha', 'automated access', 'unusual traffic', 'verify you are human',

    'to discuss automated access', 'access denied', 'request blocked'

  ];

  return markers.some(m => s.includes(m));

}



// static metadata scraping (fast)

async function staticScrape(url: string) {

  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});

  const html = await resp.text();

  const meta = await METASCRAPER({ html, url });

  // Extract price from JSON-LD since metascraper-price doesn't exist
  let price: string | null = null;
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const obj of arr) {
        if (obj && (obj['@type'] === 'Product' || obj['@type'] === 'Offer')) {
          price = obj.price || obj.offers?.price || obj.aggregateOffer?.lowPrice || null;
          if (price && typeof price !== 'string') price = String(price);
          if (price) break;
        }
      }
    }
  } catch (e) {
    // Ignore JSON-LD parse errors
  }

  return { meta: { ...meta, price }, html };

}



// Playwright renderer (stealth + light humanization)

async function playwrightScrape(url: string) {

  const browser = await chromium.launch({

    headless: true,

    args: ['--no-sandbox', '--disable-setuid-sandbox']

  });

  const page = await browser.newPage({

    userAgent:

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',

    viewport: { width: 1280, height: 800 }

  });



  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });



  try {

    // go -> small human-like waits -> evaluate

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // small randomized delay to mimic human

    await page.waitForTimeout(700 + Math.floor(Math.random() * 800));

    // light interaction

    try {

      await page.mouse.move(200 + Math.random() * 200, 200 + Math.random() * 200);

      await page.mouse.wheel(0, 100);

    } catch (e) { /* ignore interactive errors */ }



    // wait for network idle

    await page.waitForLoadState('networkidle');



    const html = await page.content();



    // try to extract JSON-LD product

    let title: string | null = null;

    let image: string | null = null;

    let priceRaw: string | null = null;

    let description: string | null = null;



    try {

      const jsonld = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent).join('\n'));

      if (jsonld) {

        try {

          const parsed = JSON.parse(jsonld);

          const arr = Array.isArray(parsed) ? parsed : [parsed];

          for (const obj of arr) {

            if (!obj) continue;

            if (obj['@type'] === 'Product' || (obj['@type'] && obj['name'])) {

              title = title || (obj.name && String(obj.name));

              if (obj.image) image = image || (Array.isArray(obj.image) ? obj.image[0] : obj.image);

              if (obj.offers && obj.offers.price) priceRaw = priceRaw || String(obj.offers.price);

              description = description || obj.description || description;

              break;

            }

          }

        } catch (e) {

          // ignore JSON parse issues

        }

      }

    } catch (e) {}



    // store selectors for common stores (fallback)

    try { if (!title) title = await page.$eval('#productTitle', el => el.textContent?.trim() || null); } catch {}

    try { if (!priceRaw) priceRaw = await page.$eval('.a-price .a-offscreen', el => el.textContent?.trim() || null); } catch {}

    try { if (!image) image = await page.$eval('#landingImage', el => el.getAttribute('src') || el.getAttribute('data-old-hires') || null); } catch {}

    try { if (!title) title = await page.title(); } catch {}



    await browser.close();

    return { title, image, priceRaw, description, html };

  } catch (err) {

    try { await browser.close(); } catch (e) {}

    throw err;

  }

}



// Optional Supabase save helper (if env set)

function getSupabase() {

  const url = process.env.SUPABASE_URL || null;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || null; // service role for server-side writes

  if (!url || !key) return null;

  return createClient(url, key);

}



export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });



  const { url, save = false, user_id } = req.body || {};

  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url in request body' });



  const domain = extractDomain(url);



  // Basic rate-limit hint: implement proper throttle in your service (not implemented here)

  try {

    let result: { title?: string | null, image?: string | null, priceRaw?: string | null, description?: string | null, html?: string | null } | null = null;



    if (looksDynamic(domain)) {

      // Attempt Playwright first

      try {

        result = await playwrightScrape(url);

      } catch (err) {

        // fallback to static if playwright fails

        console.error('Playwright scrape failed:', (err as any)?.message || err);

        try {

          const s = await staticScrape(url);

          result = {

            title: s.meta.title || null,

            image: s.meta.image || null,

            priceRaw: s.meta.price || null,

            description: s.meta.description || null,

            html: s.html

          };

        } catch (e) {

          console.error('Static fallback failed after playwright error:', (e as any)?.message || e);

          return res.status(500).json({ error: 'Both dynamic renderer and static scrape failed' });

        }

      }

    } else {

      // static path

      const s = await staticScrape(url);

      result = {

        title: s.meta.title || null,

        image: s.meta.image || null,

        priceRaw: s.meta.price || null,

        description: s.meta.description || null,

        html: s.html

      };

    }



    const htmlSample = (result.html || '').slice(0, 2000);

    const blocked = detectBlock(htmlSample);



    if (blocked) {

      return res.status(403).json({ error: 'Site blocking automated access; try again via manual add or from a different IP.' });

    }



    const price = result.priceRaw ? cleanPrice(result.priceRaw) : null;

    const currency = result.priceRaw ? parseCurrencyFromRaw(result.priceRaw) : parseCurrencyFromRaw(result.description || null);



    const normalized: Normalized = {

      title: (result.title && typeof result.title === 'string') ? result.title.trim() : null,

      price,

      priceRaw: result.priceRaw || null,

      currency,

      image: result.image || null,

      description: result.description || null,

      domain,

      url,

      blocked: false,

      rawHtmlSample: htmlSample || null

    };



    // Optionally save to Supabase if requested and SUPABASE env provided

    if (save && user_id) {

      const sb = getSupabase();

      if (!sb) {

        console.warn('Supabase keys are missing; cannot save.');

      } else {

        try {

          await sb.from('wishlist_items').insert([{

            user_id,

            title: normalized.title,

            description: normalized.description,

            price: normalized.price,

            price_raw: normalized.priceRaw,

            currency: normalized.currency,

            image: normalized.image,

            domain: normalized.domain,

            url: normalized.url,

            meta: { scraped_at: new Date().toISOString() }

          }]);

        } catch (e) {

          console.error('Supabase insert failed:', e);

          // don't fail the request — return data to client

        }

      }

    }



    return res.status(200).json({ ok: true, data: normalized });

  } catch (err: any) {

    console.error('fetch-product error', err);

    return res.status(500).json({ error: 'Unable to fetch product', detail: (err as any)?.message || String(err) });

  }

}