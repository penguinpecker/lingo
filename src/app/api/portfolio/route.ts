import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';
import { fetchPortfolio } from '@/lib/lifi/earn-api';

const CHAIN_MAP: Record<number, any> = {
  1: mainnet, 8453: base, 42161: arbitrum, 10: optimism,
  137: polygon, 56: bsc, 43114: avalanche, 100: gnosis,
  59144: linea, 534352: scroll,
};

const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com', 8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc', 10: 'https://mainnet.optimism.io',
  137: 'https://polygon.llamarpc.com', 56: 'https://bsc-dataseed.binance.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc', 100: 'https://rpc.gnosischain.com',
  59144: 'https://rpc.linea.build', 534352: 'https://rpc.scroll.io',
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
  137: 'Polygon', 56: 'BNB Chain', 43114: 'Avalanche', 100: 'Gnosis',
  59144: 'Linea', 534352: 'Scroll',
};

const UNDERLYING_USDC: Record<number, string> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  100: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  534352: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

interface TrackedVault {
  vaultAddress: string;
  chainId: number;
  network: string;
  protocol: string;
  token: string;
  tokenAddress: string;
  tokenDecimals: number;
  shareDecimals: number;
  depositedAt: number;
  depositAmount: number;
  txHash: string;
}

// Check on-chain balance for a specific vault share token
async function checkVaultBalance(wallet: string, vault: TrackedVault): Promise<any | null> {
  const chain = CHAIN_MAP[vault.chainId];
  if (!chain) return null;
  const rpc = RPC_URLS[vault.chainId];

  try {
    const client = createPublicClient({ chain, transport: http(rpc, { timeout: 6000 }) });

    const balance = await client.readContract({
      address: vault.vaultAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });

    if (balance === BigInt(0)) return null;

    // Try to get share token info
    let symbol = vault.token + ' vault';
    let decimals = vault.shareDecimals || 18;
    try {
      symbol = await client.readContract({ address: vault.vaultAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' });
      decimals = await client.readContract({ address: vault.vaultAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' });
    } catch { /* use defaults */ }

    const balanceFormatted = parseFloat(formatUnits(balance, decimals));
    // Rough USD estimate — for stablecoin vaults, 1 share ≈ $1
    const balanceUsd = vault.token === 'USDC' || vault.token === 'USDT' || vault.token === 'DAI'
      ? balanceFormatted.toString()
      : (balanceFormatted * vault.depositAmount / Math.max(1, vault.depositAmount)).toString();

    return {
      chainId: vault.chainId,
      protocolName: vault.protocol,
      asset: {
        address: vault.vaultAddress,
        name: symbol,
        symbol: symbol,
        decimals: decimals,
      },
      balanceUsd: balanceUsd,
      balanceNative: balance.toString(),
      vaultAddress: vault.vaultAddress,
      underlyingTokenAddress: vault.tokenAddress || UNDERLYING_USDC[vault.chainId] || '',
      source: 'onchain', // Flag to distinguish from LI.FI data
    };
  } catch {
    return null;
  }
}

// GET: LI.FI portfolio only
// POST: LI.FI portfolio + on-chain checks for tracked vaults
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  try {
    const data = await fetchPortfolio(wallet);
    const enriched = (data.positions || []).map((p: any) => ({
      ...p,
      vaultAddress: p.asset?.address || '',
      underlyingTokenAddress: UNDERLYING_USDC[p.chainId] || '',
      source: 'lifi',
    }));
    return NextResponse.json({ positions: enriched });
  } catch (error) {
    console.error('Portfolio API error:', error);
    return NextResponse.json({ positions: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, trackedVaults } = body as { wallet: string; trackedVaults: TrackedVault[] };

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Fetch LI.FI portfolio
    let lifiPositions: any[] = [];
    try {
      const data = await fetchPortfolio(wallet);
      lifiPositions = (data.positions || []).map((p: any) => ({
        ...p,
        vaultAddress: p.asset?.address || '',
        underlyingTokenAddress: UNDERLYING_USDC[p.chainId] || '',
        source: 'lifi',
      }));
    } catch { /* proceed with on-chain only */ }

    // Check on-chain for tracked vaults
    let onchainPositions: any[] = [];
    if (trackedVaults && trackedVaults.length > 0) {
      const results = await Promise.allSettled(
        trackedVaults.map(v => checkVaultBalance(wallet, v))
      );
      onchainPositions = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value != null)
        .map(r => r.value);
    }

    // Merge: LI.FI positions take priority, add on-chain ones that aren't in LI.FI
    const lifiAddresses = new Set(lifiPositions.map((p: any) => `${p.vaultAddress}-${p.chainId}`.toLowerCase()));
    const merged = [
      ...lifiPositions,
      ...onchainPositions.filter(p => !lifiAddresses.has(`${p.vaultAddress}-${p.chainId}`.toLowerCase())),
    ];

    return NextResponse.json({ positions: merged });
  } catch (error) {
    console.error('Portfolio POST error:', error);
    return NextResponse.json({ positions: [] });
  }
}
