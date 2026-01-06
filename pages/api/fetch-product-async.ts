/**
 * Async scraping endpoint using Python microservice
 * Returns job_id immediately, client polls for status
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createScrapeJob } from '@/lib/scraper-service-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing URL in request body' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    try {
      // Create async job in Python microservice
      const job = await createScrapeJob(url);
      
      return res.status(202).json({
        success: true,
        job_id: job.job_id,
        status: job.status,
        message: 'Job created, poll /api/job-status/<job_id> for results',
      });
    } catch (error: any) {
      console.error('Scrape job creation error:', error);
      
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to create scrape job',
        hint: 'Is the scraper microservice running? Check NEXT_PUBLIC_SCRAPER_SERVICE_URL',
      });
    }
  } catch (outerErr: any) {
    console.error('fetch-product-async fatal error:', outerErr);
    
    return res.status(500).json({
      success: false,
      error: 'Server error while creating scrape job',
      detail: outerErr?.message || String(outerErr),
    });
  }
}









