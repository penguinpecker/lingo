import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';

// Known stablecoins to EXCLUDE from vault positions (these go in the balance card)
const STABLECOIN_ADDRESSES = new Set([
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base USDC
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', // Base USDbC
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Arb USDC
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // Arb USDT
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // ETH USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // ETH USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f', // ETH DAI
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // OP USDC
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // OP USDT
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Polygon USDC
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // Polygon USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BSC USDC
  '0x55d398326f99059ff775485246999027b3197955', // BSC USDT
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // Avax USDC
  '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', // Gnosis USDC
  '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', // Linea USDC
  '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', // Scroll USDC
]);

// Primary USDC per chain for withdrawal destination
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

// Blockscout explorer APIs per chain
const BLOCKSCOUT_APIS: { chainId: number; name: string; url: string }[] = [
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

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

interface Position {
  chainId: number;
  chainName: string;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: string;
  balanceNative: string;
  vaultAddress: string;
  underlyingTokenAddress: string;
  exchangeRate: string | null;
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))]);

// Scan a single chain via Blockscout REST API
async function scanChainBlockscout(
  wallet: string,
  chain: { chainId: number; name: string; url: string }
): Promise<Position[]> {
  try {
    const res = await fetch(
      `${chain.url}/api/v2/addresses/${wallet}/tokens?type=ERC-20`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const positions: Position[] = [];
    for (const item of data.items || []) {
      const token = item.token || {};
      const address = (token.address || '').toLowerCase();
      const balance = item.value || '0';

      // Skip zero balances and known stablecoins
      if (balance === '0') continue;
      if (STABLECOIN_ADDRESSES.has(address)) continue;

      const decimals = parseInt(token.decimals || '18');
      const balNum = parseFloat(formatUnits(BigInt(balance), decimals));
      if (balNum < 0.0001) continue;

      // Estimate USD value
      const exchangeRate = token.exchange_rate;
      const usdValue = exchangeRate
        ? (balNum * parseFloat(exchangeRate)).toFixed(2)
        : balNum.toFixed(2); // Assume ~$1 per share for vault tokens

      positions.push({
        chainId: chain.chainId,
        chainName: chain.name,
        protocolName: token.name || token.symbol || 'Unknown',
        asset: {
          address: token.address || address,
          name: token.name || 'Unknown',
          symbol: token.symbol || '?',
          decimals,
        },
        balanceUsd: usdValue,
        balanceNative: balance,
        vaultAddress: token.address || address,
        underlyingTokenAddress: UNDERLYING_USDC[chain.chainId] || '',
        exchangeRate: exchangeRate || null,
      });
    }
    return positions;
  } catch {
    return [];
  }
}

// Fallback: check specific token balance via RPC
async function checkTokenRPC(
  wallet: string,
  chainId: number,
  tokenAddress: string,
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
): Promise<Position | null> {
  const chain = CHAIN_MAP[chainId];
  const rpc = RPC_URLS[chainId];
  if (!chain || !rpc) return null;

  try {
    const client = createPublicClient({ chain, transport: http(rpc, { timeout: 6000 }) });
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });
    if (balance === BigInt(0)) return null;

    const balNum = parseFloat(formatUnits(balance, tokenDecimals));
    if (balNum < 0.0001) return null;

    const chainNames: Record<number, string> = {
      1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
      137: 'Polygon', 56: 'BNB Chain', 43114: 'Avalanche', 100: 'Gnosis',
    };

    return {
      chainId,
      chainName: chainNames[chainId] || `Chain ${chainId}`,
      protocolName: tokenName,
      asset: { address: tokenAddress, name: tokenName, symbol: tokenSymbol, decimals: tokenDecimals },
      balanceUsd: balNum.toFixed(2),
      balanceNative: balance.toString(),
      vaultAddress: tokenAddress,
      underlyingTokenAddress: UNDERLYING_USDC[chainId] || '',
      exchangeRate: null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  // Scan ALL chains via Blockscout for ALL tokens
  const chainResults = await Promise.allSettled(
    BLOCKSCOUT_APIS.map(chain => withTimeout(scanChainBlockscout(wallet, chain), 10000))
  );

  let positions: Position[] = [];
  for (const result of chainResults) {
    if (result.status === 'fulfilled' && result.value) {
      positions.push(...result.value);
    }
  }

  // Fallback: if Blockscout missed known positions, check via RPC
  // This catches tokens on chains where Blockscout might be slow
  const knownVaultTokens = [
    { chainId: 8453, address: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61', name: 'Gauntlet USDC Prime', symbol: 'gtUSDCp', decimals: 18 },
    { chainId: 137, address: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620', name: 'Aave v3 USDT', symbol: 'AUSDT', decimals: 6 },
  ];

  const existingAddresses = new Set(positions.map(p => p.vaultAddress.toLowerCase()));

  const rpcFallbacks = await Promise.allSettled(
    knownVaultTokens
      .filter(t => !existingAddresses.has(t.address.toLowerCase()))
      .map(t => withTimeout(checkTokenRPC(wallet, t.chainId, t.address, t.name, t.symbol, t.decimals), 8000))
  );

  for (const result of rpcFallbacks) {
    if (result.status === 'fulfilled' && result.value) {
      positions.push(result.value);
    }
  }

  // Also check any tracked vaults from localStorage (sent via POST body or query)
  const tracked = searchParams.get('tracked');
  if (tracked) {
    try {
      const trackedVaults = JSON.parse(decodeURIComponent(tracked));
      const trackedResults = await Promise.allSettled(
        trackedVaults
          .filter((t: any) => !existingAddresses.has(t.vaultAddress?.toLowerCase()))
          .map((t: any) => withTimeout(
            checkTokenRPC(wallet, t.chainId, t.vaultAddress, t.protocol || 'Vault', t.token || '?', t.shareDecimals || 18),
            8000
          ))
      );
      for (const result of trackedResults) {
        if (result.status === 'fulfilled' && result.value) {
          positions.push(result.value);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Deduplicate by address+chain
  const seen = new Set<string>();
  positions = positions.filter(p => {
    const key = `${p.vaultAddress.toLowerCase()}-${p.chainId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ positions });
}

// POST: same as GET but accepts tracked vaults in body
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, trackedVaults } = body;

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet' }, { status: 400 });
    }

    // Build URL with tracked vaults as query param and call GET handler
    const url = new URL(request.url);
    url.searchParams.set('wallet', wallet);
    if (trackedVaults?.length > 0) {
      url.searchParams.set('tracked', JSON.stringify(trackedVaults));
    }

    const fakeRequest = new NextRequest(url, { method: 'GET' });
    return GET(fakeRequest);
  } catch (error) {
    return NextResponse.json({ positions: [] });
  }
}
