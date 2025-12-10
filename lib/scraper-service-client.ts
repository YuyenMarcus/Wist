/**
 * Client for communicating with the Python Flask scraper microservice
 * Supports both sync and async (job queue) modes
 */

const SCRAPER_SERVICE_URL = process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL || 'http://localhost:5000';

export interface ScrapeJobResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url: string;
  message?: string;
  result?: any;
  error?: string;
  created_at?: string;
  completed_at?: string;
}

export interface ScrapeSyncResponse {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Create an async scraping job
 * Returns job_id immediately, client should poll for status
 */
export async function createScrapeJob(url: string): Promise<ScrapeJobResponse> {
  const response = await fetch(`${SCRAPER_SERVICE_URL}/api/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create scrape job');
  }

  return response.json();
}

/**
 * Poll for job status
 */
export async function getJobStatus(jobId: string): Promise<ScrapeJobResponse> {
  const response = await fetch(`${SCRAPER_SERVICE_URL}/api/job/${jobId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Job not found');
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get job status');
  }

  return response.json();
}

/**
 * Poll for job completion with automatic retry
 */
export async function pollJobUntilComplete(
  jobId: string,
  options: {
    interval?: number; // Polling interval in ms (default: 1000)
    maxAttempts?: number; // Max polling attempts (default: 60)
    onProgress?: (status: ScrapeJobResponse) => void;
  } = {}
): Promise<any> {
  const { interval = 1000, maxAttempts = 60, onProgress } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getJobStatus(jobId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed') {
      return status.result;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Scraping job failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Job polling timeout');
}

/**
 * Synchronous scraping (for fast methods only)
 * Use this for structured data extraction, not full Scrapy
 */
export async function scrapeSync(url: string): Promise<ScrapeSyncResponse> {
  const response = await fetch(`${SCRAPER_SERVICE_URL}/api/scrape/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Scraping failed');
  }

  return data;
}

/**
 * Check if scraper service is available
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SCRAPER_SERVICE_URL}/health`, {
      method: 'GET',
      // Short timeout for health check
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}


