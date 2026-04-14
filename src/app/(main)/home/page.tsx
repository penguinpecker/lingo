'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { COLORS, PROTOCOL_NAMES, RISK_TIERS } from '@/constants/theme';
import { SectionLabel, Card, Button, Badge } from '@/components/ui';
import WithdrawSheet from '@/components/sheets/WithdrawSheet';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getTrackedVaults, type TrackedVault } from '@/lib/wallet/deposit-tracker';
import type { Strategy } from '@/lib/lifi/types';

interface Balance { chain: string; symbol: string; amount: number }
interface Position {
  name: string; chain: string; token: string; deposited: number;
  current: number; color: string; letter: string;
  protocolName: string; chainId: number;
  vaultAddress: string; underlyingTokenAddress: string;
  shareDecimals: number; shareBalanceRaw: string;
  status: string;
}

const TIER_COLORS = [COLORS.success, COLORS.warning, COLORS.error, COLORS.info, COLORS.lavender];
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
  137: 'Polygon', 56: 'BNB Chain', 43114: 'Avalanche', 100: 'Gnosis',
};

function trackedToPositions(vaults: TrackedVault[]): Position[] {
  return vaults.map((v, i) => ({
    name: PROTOCOL_NAMES[v.protocol] || v.protocol || 'Vault',
    chain: CHAIN_NAMES[v.chainId] || v.network || 'Unknown',
    token: v.token || 'USDC', deposited: v.depositAmount || 0,
    current: v.depositAmount || 0, color: TIER_COLORS[i % TIER_COLORS.length],
    letter: (v.protocol || 'V').charAt(0).toUpperCase(),
    protocolName: v.protocol || '', chainId: v.chainId,
    vaultAddress: v.vaultAddress, underlyingTokenAddress: v.tokenAddress || '',
    shareDecimals: v.shareDecimals || 18, shareBalanceRaw: '0', status: 'pending',
  }));
}

export default function HomePage() {
  const router = useRouter();
  const walletAddress = useStore(s => s.walletAddress);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [strategies, setStrategies] = useState<{ safe: Strategy | null; mix: Strategy | null; bold: Strategy | null }>({ safe: null, mix: null, bold: null });
  const [vaultCount, setVaultCount] = useState(0);

  // Show tracked deposits immediately
  useEffect(() => {
    const tracked = getTrackedVaults();
    if (tracked.length > 0) setPositions(trackedToPositions(tracked));
  }, []);

  // Fetch balances
  useEffect(() => {
    if (!walletAddress) { setLoadingBal(false); return; }
    fetch(`/api/balances?wallet=${walletAddress}`)
      .then(r => r.json())
      .then(d => {
        const entries: Balance[] = [];
        for (const [chain, tokens] of Object.entries(d.balances || {})) {
          for (const [symbol, amount] of Object.entries(tokens as Record<string, number>)) {
            entries.push({ chain, symbol, amount });
          }
        }
        setBalances(entries);
        setTotalBalance(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoadingBal(false));
  }, [walletAddress]);

  // Fetch positions in background
  useEffect(() => {
    if (!walletAddress) return;
    const tracked = getTrackedVaults();
    fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, trackedVaults: tracked }),
    })
      .then(r => r.json())
      .then(d => {
        const live = (d.positions || []).filter((p: any) => parseFloat(p.balanceUsd || '0') > 0.001).map((p: any, i: number) => ({
          name: p.protocolName || p.asset?.name || 'Vault',
          chain: p.chainName || 'Unknown', token: p.asset?.symbol || '?',
          deposited: parseFloat(p.balanceUsd || '0'), current: parseFloat(p.balanceUsd || '0'),
          color: TIER_COLORS[i % TIER_COLORS.length], letter: (p.protocolName || 'V').charAt(0).toUpperCase(),
          protocolName: p.protocolName || '', chainId: p.chainId || 0,
          vaultAddress: p.vaultAddress || '', underlyingTokenAddress: p.underlyingTokenAddress || '',
          shareDecimals: p.asset?.decimals || 18, shareBalanceRaw: p.balanceNative || '0',
          status: p.status || 'live',
        }));
        if (live.length > 0) {
          const liveKeys = new Set(live.map((p: Position) => `${p.vaultAddress.toLowerCase()}-${p.chainId}`));
          const unmatched = trackedToPositions(tracked).filter(p => !liveKeys.has(`${p.vaultAddress.toLowerCase()}-${p.chainId}`));
          setPositions([...live, ...unmatched]);
        }
      }).catch(() => {});
  }, [walletAddress]);

  // Fetch strategy stats for the hero
  useEffect(() => {
    fetch('/api/vaults?deposit=1000')
      .then(r => r.json())
      .then(d => {
        setStrategies(d.strategies || { safe: null, mix: null, bold: null });
        setVaultCount(d.vaultCount || 0);
      }).catch(() => {});
  }, []);

  const totalPositionValue = positions.reduce((s, p) => s + p.current, 0);
  const displayTotal = totalBalance + totalPositionValue;
  const topApy = Math.max(strategies.safe?.netApy || 0, strategies.mix?.netApy || 0, strategies.bold?.netApy || 0);

  return (
    <div style={{ padding: 0 }}>
      {/* HERO SECTION */}
      <div style={{
        background: COLORS.black, padding: '24px 16px 20px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: COLORS.orange, opacity: 0.08 }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 120, height: 120, borderRadius: '50%', background: COLORS.lavender, opacity: 0.06 }} />

        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 1.5, lineHeight: 1.15 }}>
          The Smartest<br />Savings in<br /><span style={{ color: COLORS.orange }}>DeFi</span>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 8, lineHeight: 1.5 }}>
          Chat in your language. AI builds your strategy.<br />
          Earn up to {topApy > 0 ? `${topApy}%` : '...'} APY across {vaultCount || '600+'}  vaults.
        </div>

        {/* Stats badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {strategies.safe && (
            <div style={{ padding: '6px 12px', borderRadius: 100, border: `1.5px solid ${COLORS.success}40`, background: COLORS.success + '15' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.success }}>{strategies.safe.netApy}%</span>
              <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>Safe APY</span>
            </div>
          )}
          {vaultCount > 0 && (
            <div style={{ padding: '6px 12px', borderRadius: 100, border: `1.5px solid ${COLORS.orange}40`, background: COLORS.orange + '15' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.orange }}>{vaultCount}+</span>
              <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>Vaults</span>
            </div>
          )}
          <div style={{ padding: '6px 12px', borderRadius: 100, border: `1.5px solid ${COLORS.lavender}40`, background: COLORS.lavender + '15' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.lavender }}>6</span>
            <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>Languages</span>
          </div>
        </div>

        {/* Balance card */}
        <div style={{
          background: '#1a1a1a', borderRadius: 14, padding: 16, marginTop: 16,
          border: `1.5px solid #333`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 8, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Your balance</div>
              {loadingBal ? (
                <div className="skeleton" style={{ width: 120, height: 28, marginTop: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.white, lineHeight: 1, marginTop: 4 }}>${displayTotal.toFixed(2)}</div>
              )}
            </div>
            {totalPositionValue > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Earning</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.success, marginTop: 4 }}>${totalPositionValue.toFixed(2)}</div>
              </div>
            )}
          </div>
          {balances.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {balances.map((b, i) => (
                <div key={i}>
                  <span style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', fontWeight: 700 }}>{b.symbol} ({b.chain})</span>
                  <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.white }}>{b.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4 }}>
          <Button onClick={() => router.push('/earn')} style={{ flex: 1, padding: '12px 0', fontSize: 12 }}>Deposit &amp; Earn</Button>
          <Button onClick={() => router.push('/chat')} variant="outline" style={{ flex: 1, padding: '12px 0', fontSize: 12 }}>Chat with AI</Button>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>How it works</SectionLabel>
          {[
            { num: '1', title: 'Chat in your language', desc: 'Say "save 500 dollars safely" in Hindi, English, or 4 other languages.' },
            { num: '2', title: 'AI builds your strategy', desc: '7-signal scoring across 600+ vaults. Sharpe-ratio portfolio optimization.' },
            { num: '3', title: 'Deposit & earn', desc: 'One tap deposits. Auto-bridges across chains for cheapest gas.' },
            { num: '4', title: 'Withdraw anytime', desc: 'Your keys, your money. Instant redeem from any vault.' },
          ].map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: COLORS.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 13, color: COLORS.black, flexShrink: 0,
                border: `1.5px solid ${COLORS.black}`,
              }}>{step.num}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{step.title}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* STRATEGY OVERVIEW */}
        {(strategies.safe || strategies.mix || strategies.bold) && (
          <div style={{ marginTop: 16 }}>
            <SectionLabel>Live strategies</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { s: strategies.safe, t: RISK_TIERS[0] },
                { s: strategies.mix, t: RISK_TIERS[1] },
                { s: strategies.bold, t: RISK_TIERS[2] },
              ].map(({ s, t }, i) => s && (
                <div key={i} onClick={() => router.push('/earn')} style={{
                  flex: 1, borderRadius: 12, padding: 12, textAlign: 'center', cursor: 'pointer',
                  background: COLORS.white, border: `2px solid ${COLORS.black}`, boxShadow: `2px 2px 0 ${t.color}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{s.netApy}%</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{s.allocations.length} vaults</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE POSITIONS */}
        {positions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <SectionLabel>Active positions</SectionLabel>
            {positions.map((p, i) => (
              <div key={i} style={{
                background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12,
                padding: 14, marginBottom: 8, boxShadow: '2px 2px 0 #080808',
                opacity: p.status === 'pending' ? 0.85 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 14, color: COLORS.black, border: `1.5px solid ${COLORS.black}`,
                    }}>{p.letter}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{p.token} &middot; {p.chain}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>${p.current.toFixed(2)}</div>
                    {p.status === 'pending' && <div style={{ fontSize: 9, color: COLORS.warning, fontWeight: 700 }}>Bridging...</div>}
                    {p.status === 'live' && <div style={{ fontSize: 9, color: COLORS.success, fontWeight: 700 }}>Live</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WHY LINGO */}
        <div style={{ marginTop: 20, marginBottom: 24 }}>
          <SectionLabel>Why Lingo</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { icon: '🔑', title: 'Your Keys', desc: 'Non-custodial. Embedded wallet via Privy.' },
              { icon: '🤖', title: 'AI Optimized', desc: 'Multi-vault strategies for your risk profile.' },
              { icon: '⛽', title: 'Gas Aware', desc: 'Auto-picks cheapest chain. Avoids mainnet.' },
              { icon: '🌍', title: '6 Languages', desc: 'Chat in Hindi, Spanish, Portuguese & more.' },
            ].map((item, i) => (
              <div key={i} style={{
                background: COLORS.lightGray, borderRadius: 12, padding: 14,
                border: `1.5px solid ${COLORS.gray}`,
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#888', lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {positions.length > 0 && (
        <WithdrawSheet
          open={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          positions={positions.filter(p => p.status === 'live').map(p => ({
            name: p.name, chain: p.chain, chainId: p.chainId, token: p.token,
            vaultAddress: p.vaultAddress, underlyingTokenAddress: p.underlyingTokenAddress,
            shareDecimals: p.shareDecimals, shareBalanceRaw: p.shareBalanceRaw,
            current: p.current, earned: 0, apy: 0, color: p.color, letter: p.letter,
          }))}
        />
      )}
    </div>
  );
}
