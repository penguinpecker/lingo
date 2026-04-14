import { NextRequest, NextResponse } from 'next/server';
import { fetchPortfolio } from '@/lib/lifi/earn-api';

// Map chainId → primary USDC address for withdrawal destination
const UNDERLYING_USDC: Record<number, string> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',     // BSC
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  try {
    const data = await fetchPortfolio(wallet);

    // Enrich positions with vault metadata needed for withdrawal
    const enriched = (data.positions || []).map((p: any) => ({
      ...p,
      vaultAddress: p.asset?.address || '',
      underlyingTokenAddress: UNDERLYING_USDC[p.chainId] || '',
    }));

    return NextResponse.json({ positions: enriched });
  } catch (error) {
    console.error('Portfolio API error:', error);
    return NextResponse.json({ positions: [] });
  }
}
