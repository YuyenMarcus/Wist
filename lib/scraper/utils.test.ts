/**
 * Unit tests for scraper utilities
 * Run with: npm test -- lib/scraper/utils.test.ts
 */
import { cleanPrice, extractDomain, isDynamic, detectBlock } from './utils';

describe('cleanPrice', () => {
  test('handles USD format', () => {
    expect(cleanPrice('$29.99')).toBe(29.99);
    expect(cleanPrice('USD 29.99')).toBe(29.99);
  });

  test('handles comma as decimal', () => {
    expect(cleanPrice('29,99')).toBe(29.99);
    expect(cleanPrice('1.234,56')).toBe(1234.56);
  });

  test('handles period as decimal', () => {
    expect(cleanPrice('29.99')).toBe(29.99);
    expect(cleanPrice('1,234.56')).toBe(1234.56);
  });

  test('returns null for invalid input', () => {
    expect(cleanPrice('')).toBe(null);
    expect(cleanPrice(null)).toBe(null);
    expect(cleanPrice('abc')).toBe(null);
  });
});

describe('extractDomain', () => {
  test('extracts domain from URL', () => {
    expect(extractDomain('https://www.amazon.com/product')).toBe('amazon.com');
    expect(extractDomain('https://amazon.com/product')).toBe('amazon.com');
  });

  test('handles invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe('');
    expect(extractDomain('')).toBe('');
  });
});

describe('isDynamic', () => {
  test('identifies dynamic sites', () => {
    expect(isDynamic('amazon.com')).toBe(true);
    expect(isDynamic('bestbuy.com')).toBe(true);
    expect(isDynamic('target.com')).toBe(true);
  });

  test('identifies static sites', () => {
    expect(isDynamic('example.com')).toBe(false);
    expect(isDynamic('shopify.com')).toBe(false);
  });
});

describe('detectBlock', () => {
  test('detects robot blocks', () => {
    expect(detectBlock('sorry, we detected unusual traffic from your robot')).toBe(true);
    expect(detectBlock('captcha')).toBe(true);
    expect(detectBlock('automated access is not allowed')).toBe(true);
  });

  test('does not flag normal content', () => {
    expect(detectBlock('normal product page content')).toBe(false);
    expect(detectBlock('shop now')).toBe(false);
  });
});
