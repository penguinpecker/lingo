import { createWalletClient, custom, type WalletClient } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon } from 'viem/chains';

const CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

export async function getWalletClient(privyWallet: any, chainId: number): Promise<WalletClient> {
  const provider = await privyWallet.getEthereumProvider();
  const chain = CHAIN_MAP[chainId] || base;

  // Switch to target chain
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Chain not added — for known chains Privy handles this
      console.warn('Chain not added:', chainId);
    }
  }

  return createWalletClient({
    chain,
    transport: custom(provider),
  });
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

// Build and execute a full deposit: get quote from Composer, then sign via Privy
export async function executeDeposit(params: {
  privyWallet: any;
  vaultAddress: string;
  vaultChainId: number;
  tokenAddress: string;
  tokenDecimals: number;
  amount: number; // in USD (human readable)
  walletAddress: string;
}): Promise<{ hash: string; explorer: string }> {
  const { privyWallet, vaultAddress, vaultChainId, tokenAddress, tokenDecimals, amount, walletAddress } = params;

  // Convert to smallest unit
  const rawAmount = Math.floor(amount * (10 ** tokenDecimals)).toString();

  // Get quote from our proxy (which adds the API key server-side)
  const quoteRes = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromChain: vaultChainId,
      toChain: vaultChainId,
      fromToken: tokenAddress,
      toToken: vaultAddress, // vault address IS the toToken for deposits
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

  if (!txReq) {
    throw new Error('No transaction in quote response');
  }

  // Sign and send via Privy embedded wallet
  const hash = await sendTransaction(privyWallet, {
    to: txReq.to,
    data: txReq.data,
    value: txReq.value || '0',
    chainId: txReq.chainId || vaultChainId,
    gasLimit: txReq.gasLimit,
  });

  // Build explorer URL
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
  };
  const explorer = `${explorers[vaultChainId] || 'https://basescan.org'}/tx/${hash}`;

  return { hash, explorer };
}
