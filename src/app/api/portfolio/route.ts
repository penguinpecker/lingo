import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';

const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDbC', 'BUSD', 'FRAX', 'LUSD', 'TUSD', 'USDP', 'sUSD', 'GUSD', 'USDD', 'cUSD', 'DOLA']);

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

const BLOCKSCOUT_APIS = [
  { chainId: 8453, name: 'Base', url: 'https://base.blockscout.com' },
  { chainId: 42161, name: 'Arbitrum', url: 'https://arbitrum.blockscout.com' },
  { chainId: 1, name: 'Ethereum', url: 'https://eth.blockscout.com' },
  { chainId: 10, name: 'Optimism', url: 'https://optimism.blockscout.com' },
  { chainId: 137, name: 'Polygon', url: 'https://polygon.blockscout.com' },
  { chainId: 100, name: 'Gnosis', url: 'https://gnosis.blockscout.com' },
  { chainId: 59144, name: 'Linea', url: 'https://linea.blockscout.com' },
  { chainId: 534352, name: 'Scroll', url: 'https://scroll.blockscout.com' },
];

const CHAIN_MAP: Record<number, any> = {
  1: mainnet, 8453: base, 42161: arbitrum, 10: optimism,
  137: polygon, 56: bsc, 43114: avalanche, 100: gnosis,
  59144: linea, 534352: scroll,
};
const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com', 8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc', 10: 'https://mainnet.optimism.io',
  137: 'https://polygon-rpc.com', 56: 'https://bsc-dataseed.binance.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc', 100: 'https://rpc.gnosischain.com',
  59144: 'https://rpc.linea.build', 534352: 'https://rpc.scroll.io',
};
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
  137: 'Polygon', 56: 'BNB Chain', 43114: 'Avalanche', 100: 'Gnosis',
  59144: 'Linea', 534352: 'Scroll',
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

interface Position {
  chainId: number;
  chainName: string;
  protocolName: string;
  asset: { address: string; name: string; symbol: string; decimals: number };
  balanceUsd: string;
  balanceNative: string;
  vaultAddress: string;
  underlyingTokenAddress: string;
  status: 'live' | 'pending';
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))]);

// Scan one chain via Blockscout — returns only vault tokens (not stablecoins)
async function scanChain(wallet: string, chain: typeof BLOCKSCOUT_APIS[0]): Promise<Position[]> {
  try {
    const res = await fetch(
      `${chain.url}/api/v2/addresses/${wallet}/tokens?type=ERC-20`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const positions: Position[] = [];
    for (const item of data.items || []) {
      const t = item.token || {};
      const bal = item.value || '0';
      if (bal === '0') continue;
      const sym = t.symbol || '';
      if (STABLECOIN_SYMBOLS.has(sym)) continue;
      const dec = parseInt(t.decimals || '18');
      const balNum = parseFloat(formatUnits(BigInt(bal), dec));
      if (balNum < 0.0001) continue;
      const rate = t.exchange_rate ? parseFloat(t.exchange_rate) : 1;
      positions.push({
        chainId: chain.chainId, chainName: chain.name,
        protocolName: t.name || sym || 'Vault',
        asset: { address: t.address || '', name: t.name || '', symbol: sym, decimals: dec },
        balanceUsd: (balNum * rate).toFixed(2),
        balanceNative: bal,
        vaultAddress: t.address || '',
        underlyingTokenAddress: UNDERLYING_USDC[chain.chainId] || '',
        status: 'live',
      });
    }
    return positions;
  } catch { return []; }
}

// Check a single vault token via RPC
async function checkVaultRPC(wallet: string, chainId: number, vaultAddr: string, name: string, symbol: string, decimals: number, depositUsd: number): Promise<Position | null> {
  const chain = CHAIN_MAP[chainId]; const rpc = RPC_URLS[chainId];
  if (!chain || !rpc) return null;
  try {
    const client = createPublicClient({ chain, transport: http(rpc, { timeout: 6000 }) });
    const bal = await client.readContract({
      address: vaultAddr as `0x${string}`, abi: ERC20_ABI,
      functionName: 'balanceOf', args: [wallet as `0x${string}`],
    });
    if (bal === BigInt(0)) return null;
    const balNum = parseFloat(formatUnits(bal, decimals));
    return {
      chainId, chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      protocolName: name, asset: { address: vaultAddr, name, symbol, decimals },
      balanceUsd: (balNum > 0 ? Math.max(balNum, depositUsd) : depositUsd).toFixed(2), // approximate
      balanceNative: bal.toString(),
      vaultAddress: vaultAddr,
      underlyingTokenAddress: UNDERLYING_USDC[chainId] || '',
      status: 'live',
    };
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });
  }

  // Scan all chains in parallel
  const results = await Promise.allSettled(
    BLOCKSCOUT_APIS.map(c => withTimeout(scanChain(wallet, c), 10000))
  );
  const positions: Position[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) positions.push(...r.value);
  }

  // RPC fallback for known vault tokens when Blockscout misses them
  const knownVaults = [
    { chainId: 8453, addr: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61', name: 'Gauntlet USDC Prime', sym: 'gtUSDCp', dec: 18 },
    { chainId: 137, addr: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620', name: 'Aave v3 USDT', sym: 'AUSDT', dec: 6 },
  ];
  const foundAddrs = new Set(positions.map(p => `${p.vaultAddress.toLowerCase()}-${p.chainId}`));
  const rpcResults = await Promise.allSettled(
    knownVaults
      .filter(v => !foundAddrs.has(`${v.addr.toLowerCase()}-${v.chainId}`))
      .map(v => withTimeout(checkVaultRPC(wallet, v.chainId, v.addr, v.name, v.sym, v.dec, 0), 8000))
  );
  for (const r of rpcResults) {
    if (r.status === 'fulfilled' && r.value) positions.push(r.value);
  }

  // Dedupe
  const seen = new Set<string>();
  const deduped = positions.filter(p => {
    const k = `${p.vaultAddress.toLowerCase()}-${p.chainId}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return NextResponse.json({ positions: deduped });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, trackedVaults } = body;
    if (!wallet) return NextResponse.json({ error: 'Missing wallet' }, { status: 400 });

    // 1. Scan all chains via Blockscout
    const chainResults = await Promise.allSettled(
      BLOCKSCOUT_APIS.map(c => withTimeout(scanChain(wallet, c), 10000))
    );
    const livePositions: Position[] = [];
    for (const r of chainResults) {
      if (r.status === 'fulfilled' && r.value) livePositions.push(...r.value);
    }

    // 2. For tracked vaults, try RPC check if not found in Blockscout
    const liveAddrs = new Set(livePositions.map(p => `${p.vaultAddress.toLowerCase()}-${p.chainId}`));

    if (trackedVaults?.length > 0) {
      const rpcResults = await Promise.allSettled(
        trackedVaults
          .filter((t: any) => t.vaultAddress && !liveAddrs.has(`${t.vaultAddress.toLowerCase()}-${t.chainId}`))
          .map((t: any) => withTimeout(
            checkVaultRPC(wallet, t.chainId, t.vaultAddress, t.protocol || 'Vault', t.token || '?', t.shareDecimals || 18, t.depositAmount || 0),
            8000
          ))
      );
      for (const r of rpcResults) {
        if (r.status === 'fulfilled' && r.value) {
          livePositions.push(r.value);
          liveAddrs.add(`${r.value.vaultAddress.toLowerCase()}-${r.value.chainId}`);
        }
      }

      // 3. For tracked vaults STILL not found on-chain, show as pending (mock)
      // This handles cross-chain bridges that haven't landed yet
      for (const t of trackedVaults as any[]) {
        if (!t.vaultAddress) continue;
        const key = `${t.vaultAddress.toLowerCase()}-${t.chainId}`;
        if (liveAddrs.has(key)) continue;

        livePositions.push({
          chainId: t.chainId,
          chainName: CHAIN_NAMES[t.chainId] || `Chain ${t.chainId}`,
          protocolName: t.protocol || 'Vault',
          asset: { address: t.vaultAddress, name: t.protocol || 'Vault', symbol: t.token || '?', decimals: t.shareDecimals || 18 },
          balanceUsd: (t.depositAmount || 0).toFixed(2),
          balanceNative: '0',
          vaultAddress: t.vaultAddress,
          underlyingTokenAddress: t.tokenAddress || UNDERLYING_USDC[t.chainId] || '',
          status: 'pending',
        });
        liveAddrs.add(key);
      }
    }

    // Dedupe
    const seen = new Set<string>();
    const deduped = livePositions.filter(p => {
      const k = `${p.vaultAddress.toLowerCase()}-${p.chainId}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    return NextResponse.json({ positions: deduped });
  } catch {
    return NextResponse.json({ positions: [] });
  }
}
