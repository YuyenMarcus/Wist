const DYNAMIC_HOSTS = ['amazon.', 'bestbuy.', 'target.', 'walmart.', 'ebay.'];

export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function looksDynamic(domain: string | null): boolean {
  if (!domain) return false;
  return DYNAMIC_HOSTS.some(d => domain.includes(d));
}

export function parseCurrencyFromRaw(raw?: string | null): string | null {
  if (!raw) return null;
  const iso = raw.match(/(USD|GBP|EUR|CAD|AUD|JPY|CNY)/i);
  return iso ? iso[0].toUpperCase() : null;
}

export function cleanPrice(raw?: string | null): number | null {
  if (!raw) return null;
  const s = raw.replace(/[^\d.,\-]/g, '').trim();
  if (!s) return null;

  const comma = s.indexOf(',');
  const dot = s.indexOf('.');

  try {
    if (comma > -1 && dot > -1) {
      // Whichever appears last is decimal
      return parseFloat(s.replace(/,/g, ''));
    } else if (comma > -1 && dot === -1) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    } else {
      return parseFloat(s.replace(/,/g, ''));
    }
  } catch {
    return null;
  }
}

export function detectBlock(htmlSample: string | null): boolean {
  if (!htmlSample) return false;
  const s = htmlSample.toLowerCase();
  const markers = [
    'robot',
    'captcha',
    'automated access',
    'unusual traffic',
    'verify you are human',
    'to discuss automated access',
    'access denied',
    'request blocked',
  ];
  return markers.some(m => s.includes(m));
}
