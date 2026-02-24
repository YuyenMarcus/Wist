import { NextRequest, NextResponse } from 'next/server';
import { convertPrice, SUPPORTED_CURRENCIES, CURRENCY_INFO } from '@/lib/currency';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amount = parseFloat(searchParams.get('amount') || '0');
  const from = (searchParams.get('from') || 'USD').toUpperCase();
  const to = (searchParams.get('to') || 'USD').toUpperCase();

  if (!amount) {
    return NextResponse.json({
      currencies: SUPPORTED_CURRENCIES,
      info: CURRENCY_INFO,
    });
  }

  try {
    const { converted, rate } = await convertPrice(amount, from, to);
    return NextResponse.json({
      original: amount,
      from,
      to,
      converted,
      rate,
    });
  } catch {
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
