'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { COLORS, PROTOCOL_NAMES } from '@/constants/theme';
import { SectionLabel, VaultBadge, Badge, AllocationDonut, StrategyBar, Button, Card } from '@/components/ui';
import WithdrawSheet from '@/components/sheets/WithdrawSheet';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getTrackedVaults, type TrackedVault } from '@/lib/wallet/deposit-tracker';

interface Position {
  name: string; chain: string; token: string;
  current: number; color: string; letter: string;
  protocolName: string; chainId: number;
  vaultAddress: string; underlyingTokenAddress: string;
  shareDecimals: number; shareBalanceRaw: string;
  status: 'live' | 'pending';
}

const TIER_COLORS = [COLORS.success, COLORS.warning, COLORS.error, COLORS.info, COLORS.lavender, COLORS.orange];
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
  137: 'Polygon', 56: 'BNB Chain', 43114: 'Avalanche', 100: 'Gnosis',
  59144: 'Linea', 534352: 'Scroll',
};

// Convert tracked vaults to display positions — this is INSTANT, no API needed
function trackedToPositions(vaults: TrackedVault[]): Position[] {
  return vaults.map((v, i) => ({
    name: PROTOCOL_NAMES[v.protocol] || v.protocol || 'Vault',
    chain: CHAIN_NAMES[v.chainId] || v.network || 'Unknown',
    token: v.token || 'USDC',
    current: v.depositAmount || 0,
    color: TIER_COLORS[i % TIER_COLORS.length],
    letter: (v.protocol || 'V').charAt(0).toUpperCase(),
    protocolName: v.protocol || '',
    chainId: v.chainId,
    vaultAddress: v.vaultAddress,
    underlyingTokenAddress: v.tokenAddress || '',
    shareDecimals: v.shareDecimals || 18,
    shareBalanceRaw: '0',
    status: 'pending' as const,
  }));
}

export default function PortfolioPage() {
  const walletAddress = useStore(s => s.walletAddress);
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawIdx, setWithdrawIdx] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // STEP 1: Show tracked deposits IMMEDIATELY on mount
  useEffect(() => {
    const tracked = getTrackedVaults();
    if (tracked.length > 0) {
      setPositions(trackedToPositions(tracked));
    }
  }, [refreshKey]);

  // STEP 2: Try to enhance with live on-chain data in background
  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);

    const tracked = getTrackedVaults();

    fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, trackedVaults: tracked }),
    })
      .then(r => r.json())
      .then(d => {
        const livePositions: Position[] = (d.positions || [])
          .filter((p: any) => parseFloat(p.balanceUsd || '0') > 0.001)
          .map((p: any, i: number) => {
            const name = p.protocolName || p.asset?.name || 'Vault';
            return {
              name,
              chain: p.chainName || CHAIN_NAMES[p.chainId] || 'Unknown',
              token: p.asset?.symbol || '?',
              current: parseFloat(p.balanceUsd || '0'),
              color: TIER_COLORS[i % TIER_COLORS.length],
              letter: name.charAt(0).toUpperCase(),
              protocolName: p.protocolName || '',
              chainId: p.chainId || 0,
              vaultAddress: p.vaultAddress || p.asset?.address || '',
              underlyingTokenAddress: p.underlyingTokenAddress || '',
              shareDecimals: p.asset?.decimals || 18,
              shareBalanceRaw: p.balanceNative || '0',
              status: (p.status || 'live') as 'live' | 'pending',
            };
          });

        if (livePositions.length > 0) {
          // Merge: live data replaces tracked data for matching vaults, keep tracked for unmatched
          const liveKeys = new Set(livePositions.map(p => `${p.vaultAddress.toLowerCase()}-${p.chainId}`));
          const unmatchedTracked = trackedToPositions(tracked).filter(
            p => !liveKeys.has(`${p.vaultAddress.toLowerCase()}-${p.chainId}`)
          );
          setPositions([...livePositions, ...unmatchedTracked]);
        }
        // If live returns empty, keep the tracked positions (already set in step 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress, refreshKey]);

  const totalCur = positions.reduce((s, p) => s + p.current, 0);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1.5 }}>Portfolio</div>
        <button onClick={() => setRefreshKey(k => k + 1)} style={{
          background: 'none', border: `1.5px solid ${COLORS.gray}`, borderRadius: 8,
          padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {loading && positions.length === 0 ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div className="skeleton" style={{ flex: 1, height: 60, borderRadius: 12 }} />
            <div className="skeleton" style={{ flex: 1, height: 60, borderRadius: 12 }} />
          </div>
          <div className="skeleton" style={{ height: 80, borderRadius: 14, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />
        </>
      ) : positions.length === 0 ? (
        <Card variant="outlined" style={{ textAlign: 'center', padding: 40 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
            <rect x="6" y="6" width="14" height="14" rx="3" stroke={COLORS.gray} strokeWidth="2.5" />
            <rect x="28" y="6" width="14" height="14" rx="3" stroke={COLORS.gray} strokeWidth="2.5" />
            <rect x="6" y="28" width="14" height="14" rx="3" stroke={COLORS.gray} strokeWidth="2.5" />
            <rect x="28" y="28" width="14" height="14" rx="3" stroke={COLORS.orange} strokeWidth="2.5" strokeDasharray="4 3" />
            <path d="M33 35H37M35 33V37" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ fontWeight: 900, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            No positions yet
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
            Deposit into a strategy to start earning. Your positions will appear here automatically.
          </div>
          <Button onClick={() => router.push('/earn')} style={{ maxWidth: 160, margin: '0 auto' }}>
            Start earning
          </Button>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, background: COLORS.lightGray, borderRadius: 12, padding: 12, border: `2px solid ${COLORS.black}` }}>
              <div style={{ fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Positions</div>
              <div style={{ fontSize: 17, fontWeight: 900, marginTop: 4 }}>{positions.length}</div>
            </div>
            <div style={{ flex: 1, background: COLORS.lightGray, borderRadius: 12, padding: 12, border: `2px solid ${COLORS.black}` }}>
              <div style={{ fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Total value</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: COLORS.success, marginTop: 4 }}>${totalCur.toFixed(2)}</div>
            </div>
          </div>

          {/* Allocation */}
          {positions.length > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, background: COLORS.white,
              border: `2px solid ${COLORS.black}`, borderRadius: 14, padding: 14,
              marginBottom: 16, boxShadow: '2px 2px 0 #080808',
            }}>
              <AllocationDonut segments={positions.map(p => ({ weight: p.current, color: p.color }))} size={56} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Allocation</div>
                <StrategyBar allocations={positions.map(p => ({ weight: p.current, color: p.color }))} />
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {positions.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: p.color }} />
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: '#888' }}>{totalCur > 0 ? Math.round(p.current / totalCur * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Position cards */}
          <SectionLabel>Active Positions</SectionLabel>
          {positions.map((p, i) => (
            <div key={i} style={{
              background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 14,
              padding: 16, marginBottom: 10, boxShadow: '2px 2px 0 #080808',
              opacity: p.status === 'pending' ? 0.85 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <VaultBadge letter={p.letter} color={p.color} size={28} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{p.token} &middot; {p.chain}</div>
                  </div>
                </div>
                <Badge
                  bg={p.status === 'pending' ? COLORS.warning + '20' : COLORS.success + '20'}
                  color={p.status === 'pending' ? COLORS.warning : COLORS.success}
                >
                  {p.status === 'pending' ? 'Bridging...' : 'Live'}
                </Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Value</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>${p.current.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Chain</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{p.chain}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => router.push('/earn')} style={{
                  flex: 1, background: COLORS.orange, color: COLORS.black,
                  border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '8px 0',
                  fontWeight: 800, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                  boxShadow: '1.5px 1.5px 0 #080808', textTransform: 'uppercase', letterSpacing: 0.8,
                }}>Add more</button>
                <button
                  onClick={() => { if (p.status === 'live') { setWithdrawIdx(i); setShowWithdraw(true); }}}
                  style={{
                    flex: 1, background: COLORS.white,
                    color: p.status === 'pending' ? '#ccc' : COLORS.black,
                    border: `2px solid ${p.status === 'pending' ? COLORS.gray : COLORS.black}`,
                    borderRadius: 100, padding: '8px 0',
                    fontWeight: 800, fontSize: 11, fontFamily: 'inherit',
                    cursor: p.status === 'pending' ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: 0.8,
                  }}
                >Withdraw</button>
              </div>
            </div>
          ))}
        </>
      )}

      {positions.length > 0 && (
        <WithdrawSheet
          open={showWithdraw}
          onClose={() => { setShowWithdraw(false); setWithdrawIdx(undefined); setRefreshKey(k => k + 1); }}
          positions={positions.filter(p => p.status === 'live').map(p => ({
            name: p.name, chain: p.chain, chainId: p.chainId, token: p.token,
            vaultAddress: p.vaultAddress, underlyingTokenAddress: p.underlyingTokenAddress,
            shareDecimals: p.shareDecimals, shareBalanceRaw: p.shareBalanceRaw,
            current: p.current, earned: 0, apy: 0,
            color: p.color, letter: p.letter,
          }))}
          preselected={withdrawIdx}
        />
      )}
    </div>
  );
}
