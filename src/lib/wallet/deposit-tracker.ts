// Track deposits locally so portfolio can check on-chain immediately
// LI.FI's portfolio indexer can take minutes/hours — this is the fast fallback

export interface TrackedVault {
  vaultAddress: string;
  chainId: number;
  network: string;
  protocol: string;
  token: string;
  tokenAddress: string;  // underlying (USDC)
  tokenDecimals: number;
  shareDecimals: number;
  depositedAt: number;
  depositAmount: number;
  txHash: string;
}

const STORAGE_KEY = 'lingo_tracked_vaults';

export function getTrackedVaults(): TrackedVault[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function trackDeposit(vault: TrackedVault) {
  const existing = getTrackedVaults();
  // Deduplicate by vault address + chain
  const filtered = existing.filter(v => !(v.vaultAddress === vault.vaultAddress && v.chainId === vault.chainId));
  filtered.push(vault);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function removeTrackedVault(vaultAddress: string, chainId: number) {
  const existing = getTrackedVaults();
  const filtered = existing.filter(v => !(v.vaultAddress === vaultAddress && v.chainId === chainId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearTrackedVaults() {
  localStorage.removeItem(STORAGE_KEY);
}
