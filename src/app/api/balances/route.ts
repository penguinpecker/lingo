import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

const CHAINS = [
  { chain: base, name: 'Base', rpc: 'https://mainnet.base.org', tokens: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, decimals: 6 },
  ]},
  { chain: arbitrum, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', tokens: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`, decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as `0x${string}`, decimals: 6 },
  ]},
  { chain: mainnet, name: 'Ethereum', rpc: 'https://eth.llamarpc.com', tokens: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`, decimals: 6 },
  ]},
  { chain: optimism, name: 'Optimism', rpc: 'https://mainnet.optimism.io', tokens: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as `0x${string}`, decimals: 6 },
  ]},
  { chain: polygon, name: 'Polygon', rpc: 'https://polygon.llamarpc.com', tokens: [
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`, decimals: 6 },
  ]},
  { chain: bsc, name: 'BNB Chain', rpc: 'https://bsc-dataseed.binance.org', tokens: [
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as `0x${string}`, decimals: 18 },
  ]},
  { chain: avalanche, name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc', tokens: [
    { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' as `0x${string}`, decimals: 6 },
  ]},
  { chain: gnosis, name: 'Gnosis', rpc: 'https://rpc.gnosischain.com', tokens: [
    { symbol: 'USDC', address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83' as `0x${string}`, decimals: 6 },
  ]},
  { chain: linea, name: 'Linea', rpc: 'https://rpc.linea.build', tokens: [
    { symbol: 'USDC', address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' as `0x${string}`, decimals: 6 },
  ]},
  { chain: scroll, name: 'Scroll', rpc: 'https://rpc.scroll.io', tokens: [
    { symbol: 'USDC', address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4' as `0x${string}`, decimals: 6 },
  ]},
];

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))]);

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

  const promises = CHAINS.map(async ({ chain, name, rpc, tokens }) => {
    const client = createPublicClient({ chain, transport: http(rpc, { timeout: 5000 }) });
    const chainBalances: Record<string, number> = {};

    await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          const result = await withTimeout(
            client.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [walletAddr] }),
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

    // Native ETH/gas token
    try {
      const bal = await withTimeout(client.getBalance({ address: walletAddr }), 5000);
      if (bal != null) {
        const eth = parseFloat(formatUnits(bal, 18));
        if (eth > 0.0001) ethBalances[name] = Math.round(eth * 1e6) / 1e6;
      }
    } catch { /* skip */ }

    if (Object.keys(chainBalances).length > 0) {
      balances[name] = chainBalances;
    }
  });

  await Promise.allSettled(promises);

  return NextResponse.json({
    wallet, balances, ethBalances,
    total: Math.round(total * 100) / 100,
    timestamp: new Date().toISOString(),
  });
}
