import { NextRequest, NextResponse } from 'next/server';
import { fetchAllVaults } from '@/lib/lifi/earn-api';
import { computeStrategies } from '@/lib/lifi/engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deposit = parseFloat(searchParams.get('deposit') || '1000');

  try {
    const vaults = await fetchAllVaults();

    const strategies = computeStrategies(vaults, deposit);

    return NextResponse.json({
      strategies,
      vaultCount: vaults.length,
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
