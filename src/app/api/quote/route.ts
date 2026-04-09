import { NextRequest, NextResponse } from 'next/server';
import { fetchQuote } from '@/lib/lifi/earn-api';

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIFI_COMPOSER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Composer API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, toAddress } = body;

    if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const quote = await fetchQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress: toAddress || fromAddress,
    }, apiKey);

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { error: 'Quote failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}
