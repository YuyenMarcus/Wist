/**
 * Utility functions for product scraping and normalization
 */

export const DYNAMIC_DOMAINS = ['amazon.', 'bestbuy.', 'target.', 'etsy.com', 'taobao.', 'tmall.', 'kakobuy.', 'superbuy.', 'wegobuy.', 'pandabuy.'];

export function isDynamic(domain: string): boolean {
  return DYNAMIC_DOMAINS.some(d => domain.includes(d));
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

export function cleanPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;

  // Remove currency letters, handle 1.234,56 and 1,234.56
  const normalized = raw.replace(/[^\d.,]/g, '').trim();
  if (!normalized) return null;

  if (normalized.indexOf(',') > -1 && normalized.indexOf('.') > -1) {
    // Determine which is decimal based on last separator
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      return parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
    } else {
      return parseFloat(normalized.replace(/,/g, ''));
    }
  } else if (normalized.indexOf(',') > -1) {
    return parseFloat(normalized.replace(',', '.'));
  } else {
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }
}

/** Extension / scrape payloads: comma may be the decimal separator (e.g. 85,00). */
export function priceFromScrapeValue(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const n = cleanPrice(String(raw).trim());
  return n != null && n > 0 && Number.isFinite(n) ? n : undefined;
}

export function detectBlock(html: string): boolean {
  const htmlSample = html.slice(0, 2000).toLowerCase();
  return (
    htmlSample.includes('robot') ||
    htmlSample.includes('captcha') ||
    htmlSample.includes('automated access') ||
    htmlSample.includes('access denied') ||
    htmlSample.includes('unusual traffic')
  );
}

export interface NormalizedProduct {
  title: string;
  price: number | null;
  priceRaw: string | null;
  currency: string | null;
  image: string | null;
  domain: string;
  url: string;
  description: string | null;
  outOfStock?: boolean;
}
