/**
 * Structured data extraction using Cheerio
 * Extracts from JSON-LD, Microdata, and meta tags
 */
import * as cheerio from 'cheerio';

export interface StructuredData {
  title: string | null;
  price: string | number | null;
  currency: string | null;
  image: string | null;
  description: string | null;
}

/**
 * Extract structured data from JSON-LD (schema.org)
 * This works even if the page rendering is blocked
 */
export function extractStructuredData(html: string): StructuredData | null {
  const $ = cheerio.load(html);
  
  // Try JSON-LD first
  const jsonLdScript = $('script[type="application/ld+json"]').first().html();
  
  if (jsonLdScript) {
    try {
      const data = JSON.parse(jsonLdScript);
      const items = Array.isArray(data) ? data : [data];
      
      // Find Product or Offer type
      const product = items.find((d: any) => 
        d['@type'] === 'Product' || 
        d['@type'] === 'Offer' ||
        (d['@type'] && Array.isArray(d['@type']) && d['@type'].includes('Product'))
      );
      
      if (product) {
        // Extract price - try offers.price first, then price
        let price: string | number | null = null;
        let currency: string | null = null;
        
        if (product.offers) {
          // Handle single offer or array of offers
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          price = offer?.price || null;
          currency = offer?.priceCurrency || null;
        } else if (product.price) {
          price = product.price;
        }
        
        // Extract image - handle array or single string
        let image: string | null = null;
        if (product.image) {
          if (Array.isArray(product.image)) {
            image = product.image[0] || null;
          } else if (typeof product.image === 'string') {
            image = product.image;
          } else if (product.image.url) {
            image = product.image.url;
          }
        }
        
        return {
          title: product.name || null,
          price,
          currency,
          image,
          description: product.description || null,
        };
      }
    } catch (e) {
      // JSON parse failed, continue to meta tags
    }
  }
  
  return null;
}

/**
 * Extract metadata from Open Graph and standard meta tags
 * Universal fallback that works on almost all sites
 */
export function extractMetaData(html: string): StructuredData {
  const $ = cheerio.load(html);
  
  // Title: og:title → title tag
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="title"]').attr('content') ||
    $('title').text() ||
    null;
  
  // Image: og:image → first img
  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="image"]').attr('content') ||
    $('img').first().attr('src') ||
    null;
  
  // Description: og:description → meta description
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    null;
  
  // Price: Try to find in JSON-LD or regex
  let price: string | number | null = null;
  
  // Try JSON-LD first
  const jsonLdScript = $('script[type="application/ld+json"]').first().html();
  if (jsonLdScript) {
    try {
      const data = JSON.parse(jsonLdScript);
      const items = Array.isArray(data) ? data : [data];
      const product = items.find((d: any) => 
        d['@type'] === 'Product' || d['@type'] === 'Offer'
      );
      
      if (product) {
        price = product.offers?.price || product.price || null;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Regex fallback for price
  if (!price) {
    const bodyText = $('body').text() || '';
    const priceMatch = bodyText.match(/\$[0-9,.]+/);
    if (priceMatch) {
      price = priceMatch[0];
    }
  }
  
  return {
    title: title?.trim() || null,
    price,
    currency: null, // Meta tags don't usually have currency
    image: image?.trim() || null,
    description: description?.trim() || null,
  };
}

/**
 * Combined extraction: tries structured data first, falls back to meta tags
 */
export function extractAll(html: string): StructuredData {
  // Try structured data first (more reliable for e-commerce)
  const structured = extractStructuredData(html);
  
  if (structured && structured.title && structured.title !== 'Unknown Item') {
    return structured;
  }
  
  // Fall back to meta tags
  return extractMetaData(html);
}

