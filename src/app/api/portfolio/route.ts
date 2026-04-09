import { NextRequest, NextResponse } from 'next/server';
import { fetchPortfolio } from '@/lib/lifi/earn-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  try {
    const data = await fetchPortfolio(wallet);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Portfolio API error:', error);
    return NextResponse.json({ positions: [] });
  }
}
