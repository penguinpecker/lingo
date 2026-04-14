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

// ONLY scan Base + Arbitrum for source funds — no more dead RPC failures
const STABLECOINS: Record<number, { symbol: string; address: string; decimals: number }[]> = {
  8453:   [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }],
  42161:  [{ symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }],
};

const EXPLORERS: Record<number, string> = {
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  1: 'https://etherscan.io', 10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com', 56: 'https://bscscan.com',
};

const GAS_COSTS: Record<number, number> = {
  8453: 0.10, 42161: 0.15,
};

const RPC_URLS: Record<number, string> = {
  8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc',
};

function getPublicClient(chainId: number) {
  const chain = CHAIN_MAP[chainId] || base;
  const rpc = RPC_URLS[chainId];
  return createPublicClient({ chain, transport: http(rpc || undefined, { timeout: 8000 }) });
}

// ─── Switch chain + send tx through Privy provider directly ───
// Bypasses viem's chain validation which breaks with Privy embedded wallets
async function privySendTx(
  privyWallet: any,
  chainId: number,
  tx: { to: string; data: string; value?: string; gasLimit?: string }
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

  // Build tx params
  const txParams: Record<string, string> = {
    from: privyWallet.address,
    to: tx.to,
    data: tx.data,
    value: tx.value || '0x0',
  };

  // Gas limit from Composer quote or estimate
  if (tx.gasLimit) {
    txParams.gas = tx.gasLimit.startsWith('0x') ? tx.gasLimit : `0x${parseInt(tx.gasLimit).toString(16)}`;
  } else {
    try {
      const est = await provider.request({
        method: 'eth_estimateGas',
        params: [{ from: txParams.from, to: txParams.to, data: txParams.data, value: txParams.value }],
      });
      const n = parseInt(est, 16);
      txParams.gas = `0x${Math.ceil(n * 1.3).toString(16)}`;
    } catch {
      txParams.gas = '0x50000';
    }
  }

  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams],
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

// ─── Detect best source chain — prefers vault's chain to avoid bridging ───
export async function detectSourceChain(
  walletAddress: string,
  requiredAmount: number,
  preferChainId?: number,
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

  // ALWAYS prefer the vault's chain if user has enough there — avoids cross-chain failures
  if (preferChainId) {
    const sameChain = results.find(r => r.chainId === preferChainId);
    if (sameChain) return sameChain;
  }

  // Otherwise pick cheapest gas
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

  const source = await detectSourceChain(walletAddress, amount, vaultChainId);
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
    gasLimit: txReq.gasLimit || txReq.gas || undefined,
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
    gasLimit: txReq.gasLimit || txReq.gas || undefined,
  });

  const explorer = `${EXPLORERS[vaultChainId] || 'https://basescan.org'}/tx/${hash}`;
  return { hash, explorer };
}
