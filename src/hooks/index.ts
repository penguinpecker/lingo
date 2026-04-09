'use client';

import { useState, useCallback } from 'react';
import type { Strategy } from '@/lib/lifi/types';

// ─── useStrategies: fetch computed strategies from our API ───
export function useStrategies() {
  const [strategies, setStrategies] = useState<{
    safe: Strategy | null;
    mix: Strategy | null;
    bold: Strategy | null;
  }>({ safe: null, mix: null, bold: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async (deposit: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vaults?deposit=${deposit}`);
      if (!res.ok) throw new Error('Failed to fetch strategies');
      const data = await res.json();
      setStrategies(data.strategies);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { strategies, loading, error, fetchStrategies };
}

// ─── useBalances: multi-chain balance check ──────────────────
export function useBalances() {
  const [balances, setBalances] = useState<Record<string, Record<string, number>>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async (wallet: string) => {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/balances?wallet=${wallet}`);
      if (!res.ok) throw new Error('Failed to fetch balances');
      const data = await res.json();
      setBalances(data.balances);
      setTotal(data.total);
    } catch {
      // Silently fail, show 0 balances
    } finally {
      setLoading(false);
    }
  }, []);

  return { balances, total, loading, fetchBalances };
}

// ─── useDeposit: deposit flow state machine ──────────────────
export function useDeposit() {
  const [status, setStatus] = useState<'idle' | 'quoting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    strategy: Strategy,
    amount: number,
    walletAddress: string,
    // In production: pass the Privy wallet signer here
  ) => {
    setStatus('quoting');
    setError(null);
    setTxHashes([]);

    try {
      // Build quotes for each vault in the strategy
      const quotes = await Promise.all(
        strategy.allocations.map(async (alloc) => {
          const vaultAmount = Math.floor(amount * alloc.weight * (10 ** alloc.vault.tokenDecimals));
          const res = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromChain: alloc.vault.chainId,
              toChain: alloc.vault.chainId,
              fromToken: alloc.vault.tokenAddress,
              toToken: alloc.vault.address, // vault address IS the toToken
              fromAmount: vaultAmount.toString(),
              fromAddress: walletAddress,
              toAddress: walletAddress,
            }),
          });
          if (!res.ok) throw new Error(`Quote failed for ${alloc.vault.name}`);
          return res.json();
        })
      );

      setStatus('signing');

      // In production: iterate quotes, sign each tx via Privy embedded wallet
      // For now, simulate
      for (const _quote of quotes) {
        await new Promise(r => setTimeout(r, 800));
        setTxHashes(prev => [...prev, '0x' + Math.random().toString(16).slice(2, 66)]);
      }

      setStatus('confirming');
      await new Promise(r => setTimeout(r, 1000));

      setStatus('success');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHashes([]);
    setError(null);
  }, []);

  return { status, txHashes, error, execute, reset };
}

// ─── useChat: chat with AI agent ─────────────────────────────
export function useChat() {
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (
    messages: { role: string; content: string }[],
    language: string,
    walletAddress?: string,
  ) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language, walletAddress }),
      });
      if (!res.ok) throw new Error('Chat failed');
      return await res.json();
    } catch (e) {
      return { message: 'Sorry, I had trouble connecting. Please try again.', strategies: null };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, sendMessage };
}
