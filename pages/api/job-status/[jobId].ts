/**
 * Get job status endpoint
 * Proxies requests to Python microservice
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobStatus } from '@/lib/scraper-service-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Missing job ID' });
  }

  try {
    const status = await getJobStatus(jobId);
    
    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('Job status error:', error);
    
    if (error.message === 'Job not found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to get job status',
    });
  }
}


