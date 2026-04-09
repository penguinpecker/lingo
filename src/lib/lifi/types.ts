// Types matching the actual LI.FI Earn API response schema
// Source: https://earn.li.fi/v1/earn/vaults

export interface VaultAPY {
  base: number | null;
  reward: number | null;
  total: number | null;
}

export interface VaultTVL {
  usd: string; // string, not number — parse it
}

export interface VaultAnalytics {
  apy: VaultAPY;
  apy1d: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvl: VaultTVL;
  updatedAt: string;
}

export interface VaultToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface VaultProtocol {
  name: string;
  url: string;
}

export interface VaultPack {
  name: string;
  stepsType: 'instant' | 'delayed';
}

export interface Vault {
  address: string;
  network: string;
  chainId: number;
  slug: string;
  name: string;
  description: string;
  protocol: VaultProtocol;
  underlyingTokens: VaultToken[];
  lpTokens: VaultToken[];
  tags: string[];
  analytics: VaultAnalytics;
  isTransactional: boolean;
  isRedeemable: boolean;
  depositPacks: VaultPack[];
  redeemPacks: VaultPack[];
}

export interface VaultsResponse {
  data: Vault[];
  nextCursor: string | null;
  total: number;
}

export interface Position {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: string;
  balanceNative: string;
}

export interface PortfolioResponse {
  positions: Position[];
}

// Composer quote response
export interface ComposerQuote {
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    gasCosts: { amountUSD: string }[];
  };
}

// ─── Scored vault (our internal type) ────────────────────────
export interface ScoredVault {
  // Original vault fields
  address: string;
  network: string;
  chainId: number;
  name: string;
  protocol: string;
  protocolUrl: string;
  token: string;
  tokenAddress: string;
  tokenDecimals: number;
  tags: string[];
  apyTotal: number;
  apyBase: number;
  apyReward: number;
  apy1d: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvl: number;
  isTransactional: boolean;
  isRedeemable: boolean;
  depositPacks: VaultPack[];
  redeemPacks: VaultPack[];

  // Computed scores
  riskScore: number;       // 0-1 composite
  stability: number;       // 0-1 APY stability
  confidence: number;      // log10(tvl) * stability
  gasCost: number;         // USD per tx on this chain
  gasDragPct: number;      // annual gas as % of deposit
  netApy: number;          // APY after gas drag
  adjConfidence: number;   // gas-adjusted confidence for weighting
}

// ─── Strategy (composed portfolio) ───────────────────────────
export interface StrategyAllocation {
  vault: ScoredVault;
  weight: number;          // 0-1, sums to 1
  dollarAmount: number;
}

export interface Strategy {
  tier: 0 | 1 | 2;
  name: string;            // "Savings Account", "Growth Fund", "High-Yield Fund"
  allocations: StrategyAllocation[];
  grossApy: number;
  netApy: number;
  gasEntry: number;        // total gas to enter all vaults
  gasAnnual: number;       // gas for 4 rebalances/year
  monthlyEarn: number;
  yearlyEarn: number;
  protocolCount: number;
  chainCount: number;
  tokens: string[];
}
