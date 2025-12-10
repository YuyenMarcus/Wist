// pages/api/fetch-product.ts
// Updated to use Python Flask microservice instead of Node.js scraper

import type { NextApiRequest, NextApiResponse } from 'next';

const SCRAPER_SERVICE_URL = process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL || 'http://localhost:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set JSON header immediately to prevent HTML error pages
  res.setHeader('Content-Type', 'application/json');

  // Wrap entire handler in try/catch to prevent HTML error pages
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing URL in request body' });
    }

    try {
      // Call Python Flask microservice sync endpoint
      console.log(`[fetch-product] Calling Flask service: ${SCRAPER_SERVICE_URL}/api/scrape/sync`);
      
      const response = await fetch(`${SCRAPER_SERVICE_URL}/api/scrape/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Flask service returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Scraping failed');
      }

      const result = data.result || {};
      
      // Map Flask response to frontend format
      // Ensure priceRaw has $ symbol
      let priceRaw = result.priceRaw;
      if (!priceRaw && result.price) {
        priceRaw = `$${parseFloat(String(result.price)).toFixed(2)}`;
      } else if (priceRaw && !priceRaw.startsWith('$')) {
        // If priceRaw exists but doesn't start with $, add it
        priceRaw = priceRaw.replace(/^\$?/, '$');
      }
      
      return res.status(200).json({
        success: true,
        title: result.title || 'Unknown Item',
        price: result.price || null,
        priceRaw: priceRaw || null,
        image: result.image || '',
        description: result.description || null,
        domain: result.domain || new URL(url).hostname.replace('www.', ''),
        url: result.url || url,
      });
    } catch (error: any) {
      console.error('[fetch-product] Scrape error:', error);
      
      // Check if Flask service is reachable
      if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
        return res.status(503).json({
          success: false,
          error: 'Scraper service unavailable. Is it running on port 5000?',
          hint: 'Start the Python service: cd scraper-service && python app.py',
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch product',
      });
    }
  } catch (outerErr: any) {
    // This catches ANY error
    console.error('[fetch-product] Fatal error:', outerErr);
    
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching product',
      detail: outerErr?.message || String(outerErr),
    });
  }
}
