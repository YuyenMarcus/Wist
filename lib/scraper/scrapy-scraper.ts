/**
 * Scrapy-based scraper wrapper for Node.js
 * Calls Python scrapy scraper as a subprocess
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { ScrapeResult } from './static-scraper';

const execAsync = promisify(exec);

const PYTHON_SCRIPT_PATH = join(process.cwd(), 'scraper', 'scrapy_scraper.py');

export interface ScrapyScrapeOptions {
  url: string;
  timeout?: number;
}

/**
 * Scrape product data using Scrapy (Python)
 * This is particularly effective for Amazon and other sites with bot detection
 */
export async function scrapyScrape(
  options: ScrapyScrapeOptions
): Promise<ScrapeResult> {
  const { url, timeout = 30000 } = options;

  try {
    // Call Python script (try python3 first, fallback to python for Windows)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout, stderr } = await execAsync(
      `${pythonCmd} "${PYTHON_SCRIPT_PATH}" "${url}"`,
      {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    if (stderr && !stderr.includes('WARNING')) {
      console.warn('Scrapy stderr:', stderr);
    }

    // Parse JSON output
    const result = JSON.parse(stdout.trim());

    if (result.error) {
      throw new Error(result.error);
    }

    // Normalize to ScrapeResult format
    const normalized: ScrapeResult = {
      title: result.title || null,
      priceRaw: result.priceRaw || null,
      image: result.image || null,
      description: result.description || null,
      url: url,
      html: null, // Scrapy doesn't return HTML by default
    };

    return normalized;
  } catch (error: any) {
    // Handle timeout
    if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
      throw new Error('Scrapy scrape timeout');
    }

    // Handle Python not found
    if (error.code === 'ENOENT' || error.message.includes('python3')) {
      throw new Error('Python 3 not found. Please install Python 3.');
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      console.error('Scrapy output:', error.message);
      throw new Error('Failed to parse Scrapy output');
    }

    throw error;
  }
}

/**
 * Check if Python and Scrapy are available
 */
export async function checkScrapyAvailable(): Promise<boolean> {
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    await execAsync(`${pythonCmd} --version`);
    await execAsync(`${pythonCmd} -c "import scrapy; print(scrapy.__version__)"`);
    return true;
  } catch {
    return false;
  }
}

