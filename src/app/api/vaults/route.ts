import { NextRequest, NextResponse } from 'next/server';
import { fetchAllVaults } from '@/lib/lifi/earn-api';
import { computeStrategies } from '@/lib/lifi/engine';

// Only Base + Arbitrum vaults — no random chain routing
const ALLOWED_CHAINS = new Set([8453, 42161]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deposit = parseFloat(searchParams.get('deposit') || '1000');

  try {
    const allVaults = await fetchAllVaults();

    // Filter to Base + Arbitrum ONLY
    const vaults = allVaults.filter(v => ALLOWED_CHAINS.has(v.chainId));

    const strategies = computeStrategies(vaults, deposit);

    return NextResponse.json({
      strategies,
      vaultCount: allVaults.length, // show total for bragging rights
      filteredCount: vaults.length,
      chains: ['Base', 'Arbitrum'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Vaults API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults', message: (error as Error).message },
      { status: 500 }
    );
  }
}
