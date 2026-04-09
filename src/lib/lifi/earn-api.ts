import type { Vault, VaultsResponse, PortfolioResponse } from './types';

const EARN_BASE = 'https://earn.li.fi';
const COMPOSER_BASE = 'https://li.quest';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// Simple in-memory cache
const cache: Record<string, { data: unknown; ts: number }> = {};

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

// ─── Earn Data API (no auth) ─────────────────────────────────

export async function fetchAllVaults(): Promise<Vault[]> {
  const cached = getCached<Vault[]>('allVaults');
  if (cached) return cached;

  const allVaults: Vault[] = [];
  let cursor: string | null = null;
  let page = 0;
  const MAX_PAGES = 10; // safety limit

  do {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${EARN_BASE}/v1/earn/vaults?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // Next.js cache: 5 min
    });

    if (!res.ok) throw new Error(`Earn API error: ${res.status}`);
    const data: VaultsResponse = await res.json();

    allVaults.push(...data.data);
    cursor = data.nextCursor;
    page++;
  } while (cursor && page < MAX_PAGES);

  setCache('allVaults', allVaults);
  return allVaults;
}

export async function fetchVaultDetail(network: string, address: string): Promise<Vault> {
  const key = `vault:${network}:${address}`;
  const cached = getCached<Vault>(key);
  if (cached) return cached;

  const res = await fetch(`${EARN_BASE}/v1/earn/vaults/${network}/${address}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Vault detail error: ${res.status}`);
  const data = await res.json();
  setCache(key, data);
  return data;
}

export async function fetchPortfolio(walletAddress: string): Promise<PortfolioResponse> {
  const res = await fetch(`${EARN_BASE}/v1/earn/portfolio/${walletAddress}/positions`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Portfolio error: ${res.status}`);
  return res.json();
}

export async function fetchChains(): Promise<unknown> {
  const res = await fetch(`${EARN_BASE}/v1/earn/chains`);
  if (!res.ok) throw new Error(`Chains error: ${res.status}`);
  return res.json();
}

export async function fetchProtocols(): Promise<unknown> {
  const res = await fetch(`${EARN_BASE}/v1/earn/protocols`);
  if (!res.ok) throw new Error(`Protocols error: ${res.status}`);
  return res.json();
}

// ─── Composer API (requires API key, server-side only) ───────

export async function fetchQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}, apiKey: string) {
  const qs = new URLSearchParams({
    fromChain: params.fromChain.toString(),
    toChain: params.toChain.toString(),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
  });

  const res = await fetch(`${COMPOSER_BASE}/v1/quote?${qs}`, {
    headers: {
      'Accept': 'application/json',
      'x-lifi-api-key': apiKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Composer quote error ${res.status}: ${errText}`);
  }

  return res.json();
}
