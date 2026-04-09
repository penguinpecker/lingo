import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

// USDC + USDT addresses per chain
const TOKENS: Record<number, { symbol: string; address: `0x${string}`; decimals: number }[]> = {
  [base.id]: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
  ],
  [arbitrum.id]: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  ],
  [mainnet.id]: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  ],
  [optimism.id]: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
  ],
  [polygon.id]: [
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  ],
};

const CHAINS = [
  { chain: base, name: 'Base' },
  { chain: arbitrum, name: 'Arbitrum' },
  { chain: mainnet, name: 'Ethereum' },
  { chain: optimism, name: 'Optimism' },
  { chain: polygon, name: 'Polygon' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const walletAddr = wallet as `0x${string}`;
  const balances: Record<string, Record<string, number>> = {};
  let total = 0;

  const promises = CHAINS.map(async ({ chain, name }) => {
    const client = createPublicClient({ chain, transport: http() });
    const tokens = TOKENS[chain.id] || [];
    const chainBalances: Record<string, number> = {};

    await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          const raw = await client.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddr],
          });
          const value = parseFloat(formatUnits(raw, token.decimals));
          if (value > 0.01) {
            chainBalances[token.symbol] = Math.round(value * 100) / 100;
            total += value;
          }
        } catch {
          // Skip failed reads silently
        }
      })
    );

    if (Object.keys(chainBalances).length > 0) {
      balances[name] = chainBalances;
    }
  });

  await Promise.allSettled(promises);

  return NextResponse.json({
    wallet,
    balances,
    total: Math.round(total * 100) / 100,
    timestamp: new Date().toISOString(),
  });
}
