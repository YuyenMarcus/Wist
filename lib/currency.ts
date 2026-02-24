export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'CAD' | 'AUD'
  | 'KRW' | 'INR' | 'BRL' | 'MXN' | 'SGD' | 'HKD' | 'TWD'
  | 'THB' | 'PHP' | 'IDR' | 'MYR' | 'VND' | 'NZD' | 'CHF'
  | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK' | 'HUF' | 'RUB'
  | 'TRY' | 'ZAR' | 'AED' | 'SAR'
  | 'GTQ' | 'CRC' | 'COP' | 'PEN' | 'CLP' | 'ARS' | 'HNL' | 'NIO' | 'DOP';

export const CURRENCY_INFO: Record<string, { symbol: string; name: string; decimals: number }> = {
  USD: { symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { symbol: '£', name: 'British Pound', decimals: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar', decimals: 2 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  KRW: { symbol: '₩', name: 'South Korean Won', decimals: 0 },
  INR: { symbol: '₹', name: 'Indian Rupee', decimals: 2 },
  BRL: { symbol: 'R$', name: 'Brazilian Real', decimals: 2 },
  MXN: { symbol: 'MX$', name: 'Mexican Peso', decimals: 2 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', decimals: 2 },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2 },
  TWD: { symbol: 'NT$', name: 'Taiwan Dollar', decimals: 0 },
  THB: { symbol: '฿', name: 'Thai Baht', decimals: 2 },
  PHP: { symbol: '₱', name: 'Philippine Peso', decimals: 2 },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', decimals: 0 },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', decimals: 2 },
  VND: { symbol: '₫', name: 'Vietnamese Dong', decimals: 0 },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', decimals: 2 },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', decimals: 2 },
  SEK: { symbol: 'kr', name: 'Swedish Krona', decimals: 2 },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', decimals: 2 },
  DKK: { symbol: 'kr', name: 'Danish Krone', decimals: 2 },
  PLN: { symbol: 'zł', name: 'Polish Zloty', decimals: 2 },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', decimals: 2 },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', decimals: 0 },
  RUB: { symbol: '₽', name: 'Russian Ruble', decimals: 2 },
  TRY: { symbol: '₺', name: 'Turkish Lira', decimals: 2 },
  ZAR: { symbol: 'R', name: 'South African Rand', decimals: 2 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', decimals: 2 },
  SAR: { symbol: '﷼', name: 'Saudi Riyal', decimals: 2 },
  GTQ: { symbol: 'Q', name: 'Guatemalan Quetzal', decimals: 2 },
  CRC: { symbol: '₡', name: 'Costa Rican Colón', decimals: 0 },
  COP: { symbol: 'COL$', name: 'Colombian Peso', decimals: 0 },
  PEN: { symbol: 'S/', name: 'Peruvian Sol', decimals: 2 },
  CLP: { symbol: 'CL$', name: 'Chilean Peso', decimals: 0 },
  ARS: { symbol: 'AR$', name: 'Argentine Peso', decimals: 2 },
  HNL: { symbol: 'L', name: 'Honduran Lempira', decimals: 2 },
  NIO: { symbol: 'C$', name: 'Nicaraguan Córdoba', decimals: 2 },
  DOP: { symbol: 'RD$', name: 'Dominican Peso', decimals: 2 },
};

// Hardcoded fallback rates (USD-based) — updated periodically.
// Used when the API is unreachable. Good enough for approximate display.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CNY: 7.24,
  CAD: 1.36,
  AUD: 1.53,
  KRW: 1320,
  INR: 83.1,
  BRL: 4.97,
  MXN: 17.15,
  SGD: 1.34,
  HKD: 7.82,
  TWD: 31.5,
  THB: 35.6,
  PHP: 56.2,
  IDR: 15600,
  MYR: 4.72,
  VND: 24500,
  NZD: 1.64,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.7,
  DKK: 6.88,
  PLN: 4.02,
  CZK: 23.1,
  HUF: 362,
  RUB: 91.5,
  TRY: 30.2,
  ZAR: 18.6,
  AED: 3.67,
  SAR: 3.75,
  GTQ: 7.75,
  CRC: 510,
  COP: 3950,
  PEN: 3.72,
  CLP: 935,
  ARS: 870,
  HNL: 24.7,
  NIO: 36.7,
  DOP: 58.5,
};

let cachedRates: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    // Uses the free frankfurter.app API (no key needed, based on ECB data)
    const res = await fetch('https://api.frankfurter.app/latest?from=USD', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();

    const rates: Record<string, number> = { USD: 1 };
    for (const [code, rate] of Object.entries(data.rates)) {
      rates[code] = rate as number;
    }
    cachedRates = rates;
    cacheTimestamp = now;
    return rates;
  } catch (err) {
    console.warn('[Currency] Failed to fetch live rates, using fallback:', (err as Error).message);
    return FALLBACK_RATES;
  }
}

export async function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ converted: number; rate: number }> {
  if (fromCurrency === toCurrency || !amount) {
    return { converted: amount, rate: 1 };
  }

  const rates = await fetchRates();
  const fromRate = rates[fromCurrency] || FALLBACK_RATES[fromCurrency];
  const toRate = rates[toCurrency] || FALLBACK_RATES[toCurrency];

  if (!fromRate || !toRate) {
    return { converted: amount, rate: 1 };
  }

  // Convert: amount in fromCurrency -> USD -> toCurrency
  const usdAmount = amount / fromRate;
  const converted = usdAmount * toRate;
  const rate = toRate / fromRate;

  const info = CURRENCY_INFO[toCurrency];
  const decimals = info?.decimals ?? 2;
  const rounded = parseFloat(converted.toFixed(decimals));

  return { converted: rounded, rate: parseFloat(rate.toFixed(6)) };
}

export function formatPrice(amount: number, currencyCode: string): string {
  const info = CURRENCY_INFO[currencyCode];
  if (!info) return `$${amount.toFixed(2)}`;

  const formatted = amount.toFixed(info.decimals);

  // For currencies with large numbers, add commas
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const withCommas = parts.join('.');

  return `${info.symbol}${withCommas}`;
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_INFO).sort();
