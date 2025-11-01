/**
 * Static scraper using metascraper for non-dynamic sites
 */
import fetch from 'node-fetch';
import metascraper from 'metascraper';
import msImage from 'metascraper-image';
import msTitle from 'metascraper-title';
import msDesc from 'metascraper-description';
import msUrl from 'metascraper-url';

const METASCRAPER = metascraper([
  msImage(),
  msTitle(),
  msDesc(),
  msUrl(),
]);

export interface ScrapeResult {
  title: string | null;
  description: string | null;
  image: string | null;
  priceRaw: string | null;
  url: string;
  html?: string;
}

export async function staticScrape(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const html = await res.text();
  const metadata = await METASCRAPER({ html, url });

  // Extract price from JSON-LD (more reliable than metascraper-price)
  let priceRaw: string | null = null;
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
          const processItem = (item: any) => {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
              const price = item.price || item.offers?.price || item.aggregateOffer?.lowPrice;
              if (price !== undefined && price !== null) {
                priceRaw = typeof price === 'number' ? price.toString() : String(price);
              }
            }
          };
      
      if (Array.isArray(jsonLd)) {
        jsonLd.forEach(processItem);
      } else {
        processItem(jsonLd);
      }
    }
  } catch (e) {
    // JSON-LD parsing failed, continue without price
  }

  return {
    title: metadata.title || null,
    description: metadata.description || null,
    image: metadata.image || null,
    priceRaw,
    url,
    html,
  };
}
