/**
 * Validate a user-supplied URL is safe to fetch (SSRF prevention).
 * Rejects private IPs, localhost, non-HTTP(S) schemes, and known internal hostnames.
 */
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only http/https allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { safe: false, reason: 'Localhost/internal not allowed' };
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && b >= 18 && b <= 19)
    ) {
      return { safe: false, reason: 'Private/reserved IP not allowed' };
    }
  }

  if (parsed.port && !['80', '443', ''].includes(parsed.port)) {
    return { safe: false, reason: 'Non-standard port not allowed' };
  }

  return { safe: true };
}
