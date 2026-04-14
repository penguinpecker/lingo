import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';

const CHAIN_MAP: Record<number, any> = {
  1: mainnet, 8453: base, 42161: arbitrum, 10: optimism,
  137: polygon, 56: bsc, 43114: avalanche, 100: gnosis,
  59144: linea, 534352: scroll,
};

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

const STABLECOINS: Record<number, { symbol: string; address: string; decimals: number }[]> = {
  8453:   [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }],
  42161:  [{ symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }],
  1:      [{ symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 }],
  10:     [{ symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 }],
  137:    [{ symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 }],
  56:     [{ symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 }],
  43114:  [{ symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 }],
  100:    [{ symbol: 'USDC', address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', decimals: 6 }],
  59144:  [{ symbol: 'USDC', address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', decimals: 6 }],
  534352: [{ symbol: 'USDC', address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', decimals: 6 }],
};

const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io', 8453: 'https://basescan.org',
  42161: 'https://arbiscan.io', 10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com', 56: 'https://bscscan.com',
  43114: 'https://snowtrace.io', 100: 'https://gnosisscan.io',
  59144: 'https://lineascan.build', 534352: 'https://scrollscan.com',
};

const GAS_COSTS: Record<number, number> = {
  1: 5.0, 8453: 0.10, 42161: 0.15, 10: 0.12, 137: 0.05,
  56: 0.10, 43114: 0.20, 100: 0.02, 59144: 0.15, 534352: 0.15,
};

const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com', 8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc', 10: 'https://mainnet.optimism.io',
  137: 'https://polygon.llamarpc.com', 56: 'https://bsc-dataseed.binance.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc', 100: 'https://rpc.gnosischain.com',
  59144: 'https://rpc.linea.build', 534352: 'https://rpc.scroll.io',
};

function getPublicClient(chainId: number) {
  const chain = CHAIN_MAP[chainId] || base;
  const rpc = RPC_URLS[chainId];
  return createPublicClient({ chain, transport: http(rpc, { timeout: 10000 }) });
}

// ─── Switch chain + send tx through Privy provider directly ───
// Bypasses viem's chain validation which breaks with Privy embedded wallets
async function privySendTx(
  privyWallet: any,
  chainId: number,
  tx: { to: string; data: string; value?: string }
): Promise<string> {
  // Switch chain via Privy
  try {
    await privyWallet.switchChain(chainId);
  } catch {
    // Try provider-level fallback
    try {
      const p = await privyWallet.getEthereumProvider();
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch { /* proceed */ }
  }

  // Small delay to let chain switch propagate
  await new Promise(r => setTimeout(r, 300));

  const provider = await privyWallet.getEthereumProvider();

  // Send through provider directly — no viem chain validation
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: privyWallet.address,
      to: tx.to,
      data: tx.data,
      value: tx.value || '0x0',
    }],
  });

  return hash;
}

// ─── ERC20 approval ───────────────────────────────────────────
async function ensureApproval(params: {
  privyWallet: any;
  tokenAddress: string;
  spenderAddress: string;
  amount: bigint;
  chainId: number;
  walletAddress: string;
}): Promise<string | null> {
  const { privyWallet, tokenAddress, spenderAddress, amount, chainId, walletAddress } = params;
  const publicClient = getPublicClient(chainId);

  const allowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [walletAddress as `0x${string}`, spenderAddress as `0x${string}`],
  });

  if (allowance >= amount) return null;

  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

  // Encode approve calldata manually
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress as `0x${string}`, MAX_UINT256],
  });

  // Send through Privy provider directly
  const hash = await privySendTx(privyWallet, chainId, {
    to: tokenAddress,
    data,
  });

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}`, confirmations: 1 });

  return hash;
}

// ─── Detect best source chain ─────────────────────────────────
export async function detectSourceChain(
  walletAddress: string,
  requiredAmount: number,
): Promise<{ chainId: number; tokenAddress: string; tokenDecimals: number; balance: number } | null> {
  type ChainBalance = { chainId: number; tokenAddress: string; tokenDecimals: number; balance: number; gas: number };
  const results: ChainBalance[] = [];

  await Promise.allSettled(
    Object.entries(STABLECOINS).map(async ([chainIdStr, tokens]) => {
      const chainId = parseInt(chainIdStr);
      const client = getPublicClient(chainId);

      for (const token of tokens) {
        try {
          const raw = await client.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          });
          const balance = Number(raw) / (10 ** token.decimals);
          if (balance >= requiredAmount) {
            results.push({ chainId, tokenAddress: token.address, tokenDecimals: token.decimals, balance, gas: GAS_COSTS[chainId] ?? 0.3 });
          }
        } catch { /* skip */ }
      }
    })
  );

  if (results.length === 0) return null;
  results.sort((a, b) => a.gas - b.gas);
  return results[0];
}

// ─── Execute deposit ──────────────────────────────────────────
export async function executeDeposit(params: {
  privyWallet: any;
  vaultAddress: string;
  vaultChainId: number;
  tokenAddress: string;
  tokenDecimals: number;
  amount: number;
  walletAddress: string;
}): Promise<{ hash: string; explorer: string; approvalHash?: string; bridged?: boolean }> {
  const { privyWallet, vaultAddress, vaultChainId, tokenAddress, tokenDecimals, amount, walletAddress } = params;

  const source = await detectSourceChain(walletAddress, amount);
  const fromChainId = source?.chainId ?? vaultChainId;
  const fromTokenAddress = source?.tokenAddress ?? tokenAddress;
  const fromTokenDecimals = source?.tokenDecimals ?? tokenDecimals;
  const bridged = fromChainId !== vaultChainId;

  const rawAmount = Math.floor(amount * (10 ** fromTokenDecimals)).toString();

  // Get Composer quote
  const quoteRes = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromChain: fromChainId,
      toChain: vaultChainId,
      fromToken: fromTokenAddress,
      toToken: vaultAddress,
      fromAmount: rawAmount,
      fromAddress: walletAddress,
      toAddress: walletAddress,
    }),
  });

  if (!quoteRes.ok) {
    const errText = await quoteRes.text();
    throw new Error(`Quote failed: ${errText}`);
  }

  const quote = await quoteRes.json();
  const txReq = quote.transactionRequest;
  const approvalAddress = quote.estimate?.approvalAddress;

  if (!txReq) throw new Error('No transaction in quote response');

  // Approve if needed
  let approvalHash: string | null = null;
  if (approvalAddress) {
    approvalHash = await ensureApproval({
      privyWallet,
      tokenAddress: fromTokenAddress,
      spenderAddress: approvalAddress,
      amount: BigInt(rawAmount),
      chainId: fromChainId,
      walletAddress,
    });
  }

  // Send deposit tx through Privy provider
  const hash = await privySendTx(privyWallet, txReq.chainId || fromChainId, {
    to: txReq.to,
    data: txReq.data,
    value: txReq.value || '0x0',
  });

  const explorer = `${EXPLORERS[fromChainId] || 'https://basescan.org'}/tx/${hash}`;
  return { hash, explorer, ...(approvalHash ? { approvalHash } : {}), bridged };
}

// ─── Execute withdraw ─────────────────────────────────────────
export async function executeWithdraw(params: {
  privyWallet: any;
  vaultAddress: string;
  vaultChainId: number;
  underlyingTokenAddress: string;
  shareDecimals: number;
  amountShares: string;
  walletAddress: string;
}): Promise<{ hash: string; explorer: string }> {
  const { privyWallet, vaultAddress, vaultChainId, underlyingTokenAddress, shareDecimals, amountShares, walletAddress } = params;

  const quoteRes = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromChain: vaultChainId,
      toChain: vaultChainId,
      fromToken: vaultAddress,
      toToken: underlyingTokenAddress,
      fromAmount: amountShares,
      fromAddress: walletAddress,
      toAddress: walletAddress,
    }),
  });

  if (!quoteRes.ok) {
    const errText = await quoteRes.text();
    throw new Error(`Withdraw quote failed: ${errText}`);
  }

  const quote = await quoteRes.json();
  const txReq = quote.transactionRequest;
  const approvalAddress = quote.estimate?.approvalAddress;

  if (!txReq) throw new Error('No transaction in withdraw quote response');

  if (approvalAddress) {
    await ensureApproval({
      privyWallet,
      tokenAddress: vaultAddress,
      spenderAddress: approvalAddress,
      amount: BigInt(amountShares),
      chainId: vaultChainId,
      walletAddress,
    });
  }

  const hash = await privySendTx(privyWallet, txReq.chainId || vaultChainId, {
    to: txReq.to,
    data: txReq.data,
    value: txReq.value || '0x0',
  });

  const explorer = `${EXPLORERS[vaultChainId] || 'https://basescan.org'}/tx/${hash}`;
  return { hash, explorer };
}
