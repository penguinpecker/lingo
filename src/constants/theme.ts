// ─── LINGO DESIGN SYSTEM ────────────────────────────────
// Derived from yo-goals Metio-Mobile design language
// Orange primary, Lavender AI accent, Brutalist shadows, 900-weight uppercase headers
// Mobile-first: all measurements assume 390px viewport

export const COLORS = {
  orange: '#F26F21',
  orangeLight: '#FF8C42',
  orangeDark: '#D85A10',
  lavender: '#938EF2',
  lavenderLight: '#B5B1F7',
  lavenderDark: '#7570D1',
  black: '#080808',
  darkGray: '#1A1A1A',
  gray: '#D9D9D9',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  success: '#22C55E',
  successLight: '#E8F5E9',
  warning: '#F59E0B',
  warningLight: '#FFF8E1',
  error: '#EF4444',
  errorLight: '#FFEBEE',
  info: '#3B82F6',
} as const;

export const SHADOWS = {
  hard: (offset = 3) => `${offset}px ${offset}px 0px ${COLORS.black}`,
  none: 'none',
} as const;

export const RISK_TIERS = [
  { id: 0, key: 'safe', label: 'SAFE', name: 'Savings Account', color: COLORS.success, description: 'Stablecoin vaults only. Top TVL protocols. No reward farming. Your principal stays put.' },
  { id: 1, key: 'mix', label: 'MIX', name: 'Growth Fund', color: COLORS.warning, description: 'Mix of stable and growth vaults. Moderate risk. Best balance of safety and returns.' },
  { id: 2, key: 'bold', label: 'BOLD', name: 'High-Yield Fund', color: COLORS.error, description: 'Highest APY targets. Smaller vaults. Reward-heavy. For the adventurous saver.' },
] as const;

export type RiskTier = 0 | 1 | 2;

// Protocol display names (normie-friendly)
export const PROTOCOL_NAMES: Record<string, string> = {
  'morpho-v1': 'Secured Lending',
  'morpho-v2': 'Secured Lending',
  'aave-v3': 'Bank-Grade Lending',
  'fluid': 'Smart Lending',
  'spark': 'Savings Protocol',
  'maple': 'Institutional Lending',
  'euler-v2': 'Optimized Lending',
  'ethena-usde': 'Dollar Yield',
  'pendle': 'Fixed Rate',
  'kelp': 'Restaking Yield',
  'etherfi': 'Staking Yield',
  'hypurrfi': 'Hyper Lending',
  'neverland': 'New Frontier',
  'yo': 'Yield Boost',
  'upshift': 'Boosted Vault',
  'avon': 'Frontier Lending',
  'kinetiq': 'Liquid Staking',
  'hyperlend': 'Hyper Lending',
  'usdai': 'AI Dollar',
  'tokemak': 'Auto Dollar',
  'concrete': 'Concrete Yield',
};

// Chain display names + gas estimates (USD per tx)
export const CHAINS: Record<number, { name: string; gas: number; tier: number }> = {
  1: { name: 'Ethereum', gas: 5.0, tier: 3 },
  8453: { name: 'Base', gas: 0.10, tier: 2 },
  42161: { name: 'Arbitrum', gas: 0.15, tier: 2 },
  10: { name: 'Optimism', gas: 0.12, tier: 2 },
  137: { name: 'Polygon', gas: 0.05, tier: 2 },
  100: { name: 'Gnosis', gas: 0.02, tier: 2 },
  59144: { name: 'Linea', gas: 0.15, tier: 2 },
  534352: { name: 'Scroll', gas: 0.15, tier: 2 },
  43114: { name: 'Avalanche', gas: 0.20, tier: 2 },
  56: { name: 'BNB Chain', gas: 0.10, tier: 2 },
};

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'EN' },
  { code: 'hi', name: 'Hindi', native: 'HI' },
  { code: 'es', name: 'Spanish', native: 'ES' },
  { code: 'pt', name: 'Portuguese', native: 'PT' },
  { code: 'id', name: 'Indonesian', native: 'ID' },
  { code: 'zh', name: 'Chinese', native: 'ZH' },
] as const;

export const STABLECOINS = ['USDC', 'USDT', 'DAI', 'sUSDe', 'USDe', 'FRAX', 'LUSD', 'crvUSD', 'GHO', 'PYUSD'] as const;

// Protocol trust tiers for risk scoring
export const PROTOCOL_TRUST: Record<string, number> = {
  'aave-v3': 3, 'morpho-v1': 3, 'morpho-v2': 3, 'spark': 3, 'maple': 3, 'fluid': 3,
  'euler-v2': 2, 'pendle': 2, 'ethena-usde': 2, 'etherfi': 2, 'kelp': 2, 'kinetiq': 2,
};
