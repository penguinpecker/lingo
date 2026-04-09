import { PROTOCOL_TRUST, CHAINS, STABLECOINS } from '@/constants/theme';
import type { Vault, ScoredVault, Strategy, StrategyAllocation } from './types';

// ─── STEP 1: Convert raw vault to scoreable format ──────────
export function normalizeVault(v: Vault): ScoredVault | null {
  if (!v.isTransactional || !v.isRedeemable) return null;
  const apy = v.analytics.apy;
  if (apy.total == null) return null;

  const tvl = parseFloat(v.analytics.tvl.usd || '0');
  if (tvl < 100_000) return null;

  const tokens = v.underlyingTokens.map(t => t.symbol);
  const hasStable = tokens.some(t => (STABLECOINS as readonly string[]).includes(t));
  if (!hasStable) return null;

  const chainInfo = CHAINS[v.chainId];

  return {
    address: v.address,
    network: v.network,
    chainId: v.chainId,
    name: v.name,
    protocol: v.protocol.name,
    protocolUrl: v.protocol.url,
    token: tokens[0] || '?',
    tokenAddress: v.underlyingTokens[0]?.address || '',
    tokenDecimals: v.underlyingTokens[0]?.decimals || 6,
    tags: v.tags,
    apyTotal: apy.total || 0,
    apyBase: apy.base || 0,
    apyReward: apy.reward || 0,
    apy1d: v.analytics.apy1d,
    apy7d: v.analytics.apy7d,
    apy30d: v.analytics.apy30d,
    tvl,
    isTransactional: v.isTransactional,
    isRedeemable: v.isRedeemable,
    depositPacks: v.depositPacks,
    redeemPacks: v.redeemPacks,

    // Will be computed by scoreVault
    riskScore: 0,
    stability: 0,
    confidence: 0,
    gasCost: chainInfo?.gas ?? 0.30,
    gasDragPct: 0,
    netApy: 0,
    adjConfidence: 0,
  };
}

// ─── STEP 2: Score a single vault (7-signal composite) ──────
export function scoreVault(v: ScoredVault, depositAmount: number): ScoredVault {
  // Signal 1: Protocol trust (25%)
  const protoScore = PROTOCOL_TRUST[v.protocol] ?? 1;

  // Signal 2: TVL depth (25%)
  const tvlScore = v.tvl > 50_000_000 ? 3 : v.tvl > 5_000_000 ? 2 : 1;

  // Signal 3: Yield source composition (15%)
  const base = v.apyBase || 0;
  const reward = v.apyReward || 0;
  const yieldScore = reward === 0 ? 3 : base > reward ? 2 : 1;

  // Signal 4: APY volatility (15%)
  let volScore = 2;
  let stability = 0.5;
  if (v.apy1d != null && v.apy30d != null && v.apy30d > 0) {
    const deviation = Math.abs(v.apy1d - v.apy30d) / v.apy30d;
    volScore = deviation < 0.10 ? 3 : deviation < 0.40 ? 2 : 1;
    stability = Math.max(0.1, 1 - deviation);
  }

  // Signal 5: Asset complexity (10%)
  const tags = v.tags;
  const assetScore = tags.includes('stablecoin') ? 3 :
    tags.includes('single') ? 2 :
    tags.includes('il-risk') || tags.includes('multi') ? 1 : 2;

  // Signal 6: Chain security tier (5%)
  const chainScore = CHAINS[v.chainId]?.tier ?? 1;

  // Signal 7: Exit liquidity (5%)
  const exitScore = v.redeemPacks.some(p => p.stepsType === 'instant') ? 3 :
    v.redeemPacks.length > 0 ? 2 : 1;

  // Composite (normalized 0-1)
  const composite = (
    protoScore * 0.25 +
    tvlScore * 0.25 +
    yieldScore * 0.15 +
    volScore * 0.15 +
    assetScore * 0.10 +
    chainScore * 0.05 +
    exitScore * 0.05
  ) / 3.0;

  // Gas-aware net APY
  const annualGas = v.gasCost * 4; // 4 txs/year
  const gasDragPct = (annualGas / depositAmount) * 100;
  const netApy = v.apyTotal - gasDragPct;

  // Confidence for weighting
  const confidence = Math.log10(Math.max(v.tvl, 1)) * stability;
  const adjConfidence = confidence * Math.max(0.1, netApy / Math.max(v.apyTotal, 0.01));

  return {
    ...v,
    riskScore: Math.round(composite * 10000) / 10000,
    stability: Math.round(stability * 10000) / 10000,
    confidence: Math.round(confidence * 100) / 100,
    gasDragPct: Math.round(gasDragPct * 10000) / 10000,
    netApy: Math.round(netApy * 100) / 100,
    adjConfidence: Math.round(adjConfidence * 100) / 100,
  };
}

// ─── STEP 3: Pool into risk tiers ───────────────────────────
export function bucketVaults(vaults: ScoredVault[]): {
  safe: ScoredVault[];
  mix: ScoredVault[];
  bold: ScoredVault[];
} {
  return {
    safe: vaults.filter(v => v.riskScore >= 0.75).sort((a, b) => b.adjConfidence - a.adjConfidence),
    mix: vaults.filter(v => v.riskScore >= 0.45 && v.riskScore < 0.75).sort((a, b) => (b.netApy * b.adjConfidence) - (a.netApy * a.adjConfidence)),
    bold: vaults.filter(v => v.riskScore < 0.45).sort((a, b) => b.netApy - a.netApy),
  };
}

// ─── STEP 4: Portfolio optimization (Sharpe-like) ───────────
function estimateVolatility(v: ScoredVault): number {
  const points = [v.apy1d, v.apy7d, v.apy30d, v.apyTotal].filter((x): x is number => x != null);
  if (points.length < 2) return v.apyTotal * 0.3; // assume 30% vol if no data
  const mean = points.reduce((s, x) => s + x, 0) / points.length;
  const variance = points.reduce((s, x) => s + (x - mean) ** 2, 0) / points.length;
  return Math.max(0.1, Math.sqrt(variance));
}

function estimateCorrelation(a: ScoredVault, b: ScoredVault): number {
  let corr = 0.2; // base: different chain + protocol
  if (a.protocol === b.protocol) corr = 0.9;
  else if (a.chainId === b.chainId) corr = 0.5;
  if (a.token === b.token) corr = Math.min(1, corr + 0.1);
  return corr;
}

function portfolioSharpe(
  vaults: ScoredVault[],
  weights: number[]
): number {
  // Portfolio return
  const portReturn = vaults.reduce((s, v, i) => s + v.netApy * weights[i], 0);

  // Portfolio variance (using covariance matrix)
  let portVariance = 0;
  for (let i = 0; i < vaults.length; i++) {
    for (let j = 0; j < vaults.length; j++) {
      const vi = estimateVolatility(vaults[i]);
      const vj = estimateVolatility(vaults[j]);
      const corr = i === j ? 1 : estimateCorrelation(vaults[i], vaults[j]);
      portVariance += weights[i] * weights[j] * vi * vj * corr;
    }
  }
  const portRisk = Math.max(0.01, Math.sqrt(portVariance));
  return portReturn / portRisk;
}

function isValidCombo(vaults: ScoredVault[]): boolean {
  // Max 1 per protocol
  const protocols = new Set(vaults.map(v => v.protocol));
  if (protocols.size < vaults.length) return false;

  // Max 2 per chain
  const chainCounts: Record<number, number> = {};
  for (const v of vaults) {
    chainCounts[v.chainId] = (chainCounts[v.chainId] || 0) + 1;
    if (chainCounts[v.chainId] > 2) return false;
  }

  return true;
}

function inverseVolWeights(vaults: ScoredVault[]): number[] {
  const invVols = vaults.map(v => 1 / Math.max(0.1, estimateVolatility(v)));
  const total = invVols.reduce((s, x) => s + x, 0);
  let weights = invVols.map(x => x / total);

  // Clamp: 10% min, 60% max
  weights = weights.map(w => Math.max(0.10, Math.min(0.60, w)));
  const clampTotal = weights.reduce((s, x) => s + x, 0);
  return weights.map(w => Math.round((w / clampTotal) * 10000) / 10000);
}

// Generate all combinations of size k from array
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── STEP 5: Build optimal strategy ─────────────────────────
export function buildStrategy(
  pool: ScoredVault[],
  tier: 0 | 1 | 2,
  tierName: string,
  deposit: number,
  maxVaults: number = 3,
): Strategy | null {
  // Filter out negative net APY vaults
  const viable = pool.filter(v => v.netApy > 0).slice(0, 15); // cap candidates for performance
  if (viable.length === 0) return null;

  // Try all valid combos of 2, 3, (and 4 for mix tier)
  const sizes = tier === 1 ? [2, 3, 4] : [2, 3];
  let bestSharpe = -Infinity;
  let bestCombo: ScoredVault[] | null = null;
  let bestWeights: number[] = [];

  for (const size of sizes) {
    if (viable.length < size) continue;
    const combos = combinations(viable, size);

    for (const combo of combos) {
      if (!isValidCombo(combo)) continue;

      const weights = inverseVolWeights(combo);
      const sharpe = portfolioSharpe(combo, weights);

      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestCombo = combo;
        bestWeights = weights;
      }
    }
  }

  // Fallback: if no valid combo found, take top 2 ignoring constraints
  if (!bestCombo) {
    bestCombo = viable.slice(0, Math.min(2, viable.length));
    bestWeights = bestCombo.map(() => 1 / bestCombo!.length);
  }

  // Build allocations
  const allocations: StrategyAllocation[] = bestCombo.map((v, i) => ({
    vault: v,
    weight: bestWeights[i],
    dollarAmount: Math.round(deposit * bestWeights[i] * 100) / 100,
  }));

  const grossApy = allocations.reduce((s, a) => s + a.vault.apyTotal * a.weight, 0);
  const netApy = allocations.reduce((s, a) => s + a.vault.netApy * a.weight, 0);
  const gasEntry = allocations.reduce((s, a) => s + a.vault.gasCost, 0);
  const gasAnnual = gasEntry * 4;

  return {
    tier,
    name: tierName,
    allocations,
    grossApy: Math.round(grossApy * 100) / 100,
    netApy: Math.round(netApy * 100) / 100,
    gasEntry: Math.round(gasEntry * 100) / 100,
    gasAnnual: Math.round(gasAnnual * 100) / 100,
    monthlyEarn: Math.round((deposit * netApy / 100 / 12) * 100) / 100,
    yearlyEarn: Math.round((deposit * netApy / 100) * 100) / 100,
    protocolCount: new Set(allocations.map(a => a.vault.protocol)).size,
    chainCount: new Set(allocations.map(a => a.vault.chainId)).size,
    tokens: [...new Set(allocations.map(a => a.vault.token))],
  };
}

// ─── MAIN ENTRY POINT ────────────────────────────────────────
// Call this with raw API vaults + deposit amount → get 3 strategies
export function computeStrategies(
  rawVaults: Vault[],
  depositAmount: number,
): { safe: Strategy | null; mix: Strategy | null; bold: Strategy | null } {
  // Normalize and filter
  const normalized = rawVaults
    .map(normalizeVault)
    .filter((v): v is ScoredVault => v !== null);

  // Score all vaults (gas-aware)
  const scored = normalized.map(v => scoreVault(v, depositAmount));

  // Bucket into tiers
  const pools = bucketVaults(scored);

  // Build optimal portfolio for each tier
  return {
    safe: buildStrategy(pools.safe, 0, 'Savings Account', depositAmount, 3),
    mix: buildStrategy(pools.mix, 1, 'Growth Fund', depositAmount, 4),
    bold: buildStrategy(pools.bold, 2, 'High-Yield Fund', depositAmount, 3),
  };
}
