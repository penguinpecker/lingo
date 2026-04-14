import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

const TOKENS: Record<number, { symbol: string; address: `0x${string}`; decimals: number }[]> = {
  [base.id]: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  ],
  [arbitrum.id]: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  ],
  [mainnet.id]: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  ],
  [optimism.id]: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  ],
  [polygon.id]: [
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  ],
  [bsc.id]: [
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  ],
};

// Explicit reliable RPCs with short timeouts
const CHAINS = [
  { chain: base, name: 'Base', rpc: 'https://mainnet.base.org' },
  { chain: arbitrum, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  { chain: mainnet, name: 'Ethereum', rpc: 'https://eth.llamarpc.com' },
  { chain: optimism, name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
  { chain: polygon, name: 'Polygon', rpc: 'https://polygon.llamarpc.com' },
  { chain: bsc, name: 'BNB Chain', rpc: 'https://bsc-dataseed.binance.org' },
];

// Native ETH balance (for gas display)
async function getEthBalance(client: any, wallet: `0x${string}`, chainName: string): Promise<{ chain: string; amount: number } | null> {
  try {
    const bal = await client.getBalance({ address: wallet });
    const eth = parseFloat(formatUnits(bal, 18));
    if (eth > 0.0001) return { chain: chainName, amount: Math.round(eth * 1e6) / 1e6 };
  } catch { /* skip */ }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const walletAddr = wallet as `0x${string}`;
  const balances: Record<string, Record<string, number>> = {};
  const ethBalances: Record<string, number> = {};
  let total = 0;

  // 5s timeout per chain — don't let one slow RPC stall everything
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))]);

  const promises = CHAINS.map(async ({ chain, name, rpc }) => {
    const client = createPublicClient({
      chain,
      transport: http(rpc, { timeout: 5000 }),
    });
    const tokens = TOKENS[chain.id] || [];
    const chainBalances: Record<string, number> = {};

    // Check stablecoins
    await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          const result = await withTimeout(
            client.readContract({
              address: token.address,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [walletAddr],
            }),
            5000
          );
          if (result == null) return;
          const value = parseFloat(formatUnits(result, token.decimals));
          if (value > 0.01) {
            chainBalances[token.symbol] = Math.round(value * 100) / 100;
            total += value;
          }
        } catch { /* skip */ }
      })
    );

    // Check native ETH (for gas info)
    const ethBal = await withTimeout(getEthBalance(client, walletAddr, name), 5000);
    if (ethBal) ethBalances[name] = ethBal.amount;

    if (Object.keys(chainBalances).length > 0) {
      balances[name] = chainBalances;
    }
  });

  await Promise.allSettled(promises);

  return NextResponse.json({
    wallet,
    balances,
    ethBalances,
    total: Math.round(total * 100) / 100,
    timestamp: new Date().toISOString(),
  });
}
