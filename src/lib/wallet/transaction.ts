import { createPublicClient, createWalletClient, custom, http, parseAbi, type WalletClient } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc } from 'viem/chains';

const CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  56: bsc,
};

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

// Stablecoin addresses per chain for cross-chain source detection
const STABLECOINS: Record<number, { symbol: string; address: string; decimals: number }[]> = {
  8453:  [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }],
  42161: [{ symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }],
  1:     [{ symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 }],
  10:    [{ symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 }],
  137:   [{ symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 }],
  56:    [{ symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 }],
};

const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com',
  56: 'https://bscscan.com',
};

const GAS_COSTS: Record<number, number> = { 1: 5, 8453: 0.1, 42161: 0.15, 10: 0.12, 137: 0.05, 56: 0.1 };

export async function getWalletClient(privyWallet: any, chainId: number): Promise<WalletClient> {
  const provider = await privyWallet.getEthereumProvider();
  const chain = CHAIN_MAP[chainId] || base;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      console.warn('Chain not added:', chainId);
    }
  }

  return createWalletClient({ chain, transport: custom(provider) });
}

export async function sendTransaction(
  privyWallet: any,
  tx: { to: string; data: string; value: string; chainId: number; gasLimit?: string }
): Promise<string> {
  const client = await getWalletClient(privyWallet, tx.chainId);
  const account = privyWallet.address as `0x${string}`;

  const hash = await client.sendTransaction({
    account,
    chain: CHAIN_MAP[tx.chainId] || base,
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value || '0'),
    gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
  });

  return hash;
}

// ─── Check & send ERC20 approval if needed ────────────────────
async function ensureApproval(params: {
  privyWallet: any;
  tokenAddress: string;
  spenderAddress: string;
  amount: bigint;
  chainId: number;
  walletAddress: string;
}): Promise<string | null> {
  const { privyWallet, tokenAddress, spenderAddress, amount, chainId, walletAddress } = params;
  const chain = CHAIN_MAP[chainId] || base;
  const publicClient = createPublicClient({ chain, transport: http() });

  const allowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [walletAddress as `0x${string}`, spenderAddress as `0x${string}`],
  });

  if (allowance >= amount) return null;

  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const client = await getWalletClient(privyWallet, chainId);

  const hash = await client.writeContract({
    account: walletAddress as `0x${string}`,
    chain,
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress as `0x${string}`, MAX_UINT256],
  });

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return hash;
}

// ─── Detect best source chain for user's stablecoins ──────────
export async function detectSourceChain(
  walletAddress: string,
  requiredAmount: number,
): Promise<{ chainId: number; tokenAddress: string; tokenDecimals: number; balance: number } | null> {
  type ChainBalance = { chainId: number; tokenAddress: string; tokenDecimals: number; balance: number; gas: number };
  const results: ChainBalance[] = [];

  await Promise.allSettled(
    Object.entries(STABLECOINS).map(async ([chainIdStr, tokens]) => {
      const chainId = parseInt(chainIdStr);
      const chain = CHAIN_MAP[chainId];
      if (!chain) return;
      const client = createPublicClient({ chain, transport: http() });

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

// ─── Execute deposit: detect chain → approve → quote → sign ───
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

  // Step 1: Detect which chain has the user's funds
  const source = await detectSourceChain(walletAddress, amount);
  const fromChainId = source?.chainId ?? vaultChainId;
  const fromTokenAddress = source?.tokenAddress ?? tokenAddress;
  const fromTokenDecimals = source?.tokenDecimals ?? tokenDecimals;
  const bridged = fromChainId !== vaultChainId;

  const rawAmount = Math.floor(amount * (10 ** fromTokenDecimals)).toString();

  // Step 2: Get quote from Composer (cross-chain if needed)
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

  // Step 3: Approve ERC20 spend if needed
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

  // Step 4: Sign and send
  const hash = await sendTransaction(privyWallet, {
    to: txReq.to,
    data: txReq.data,
    value: txReq.value || '0',
    chainId: txReq.chainId || fromChainId,
    gasLimit: txReq.gasLimit,
  });

  const explorer = `${EXPLORERS[fromChainId] || 'https://basescan.org'}/tx/${hash}`;
  return { hash, explorer, ...(approvalHash ? { approvalHash } : {}), bridged };
}

// ─── Execute withdraw: quote redeem → approve → sign ──────────
export async function executeWithdraw(params: {
  privyWallet: any;
  vaultAddress: string;
  vaultChainId: number;
  underlyingTokenAddress: string;
  shareDecimals: number;
  amountShares: string; // raw share amount as string (from portfolio)
  walletAddress: string;
}): Promise<{ hash: string; explorer: string }> {
  const { privyWallet, vaultAddress, vaultChainId, underlyingTokenAddress, shareDecimals, amountShares, walletAddress } = params;

  // For withdrawal: fromToken = vault share token, toToken = underlying (USDC)
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

  // Approve vault shares spend if needed
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

  const hash = await sendTransaction(privyWallet, {
    to: txReq.to,
    data: txReq.data,
    value: txReq.value || '0',
    chainId: txReq.chainId || vaultChainId,
    gasLimit: txReq.gasLimit,
  });

  const explorer = `${EXPLORERS[vaultChainId] || 'https://basescan.org'}/tx/${hash}`;
  return { hash, explorer };
}
