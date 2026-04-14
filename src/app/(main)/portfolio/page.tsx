'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { COLORS, PROTOCOL_NAMES } from '@/constants/theme';
import { SectionLabel, VaultBadge, Badge, AllocationDonut, StrategyBar, Button, Card } from '@/components/ui';
import WithdrawSheet from '@/components/sheets/WithdrawSheet';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getTrackedVaults } from '@/lib/wallet/deposit-tracker';

interface Position {
  name: string; chain: string; token: string;
  current: number; color: string; letter: string;
  protocolName: string; chainId: number;
  vaultAddress: string; underlyingTokenAddress: string;
  shareDecimals: number; shareBalanceRaw: string;
  status: string;
}

const TIER_COLORS = [COLORS.success, COLORS.warning, COLORS.error, COLORS.info, COLORS.lavender, COLORS.orange];

export default function PortfolioPage() {
  const walletAddress = useStore(s => s.walletAddress);
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawIdx, setWithdrawIdx] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!walletAddress) { setLoading(false); return; }
    setLoading(true);

    const trackedVaults = getTrackedVaults();

    // POST with tracked vaults for comprehensive scanning
    fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, trackedVaults }),
    })
      .then(r => r.json())
      .then(d => {
        const pos: Position[] = (d.positions || []).map((p: any, i: number) => {
          const name = p.protocolName || p.asset?.name || 'Vault';
          return {
            name,
            chain: p.chainName || 'Unknown',
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
          status: p.status || 'live',
          };
        }).filter((p: Position) => p.current > 0.001);
        setPositions(pos);
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

      {loading ? (
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

          {/* Allocation donut */}
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
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{p.token}</span>
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
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <VaultBadge letter={p.letter} color={p.color} size={28} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{p.token} &middot; {p.chain}</div>
                  </div>
                </div>
                <Badge bg={p.status === 'pending' ? COLORS.warning + '20' : COLORS.lavender + '20'} color={p.status === 'pending' ? COLORS.warning : COLORS.lavender}>
                  {p.status === 'pending' ? 'Bridging...' : p.chain}
                </Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Value</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>${p.current.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Vault</div>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>{p.vaultAddress.slice(0, 6)}...{p.vaultAddress.slice(-4)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => router.push('/earn')} style={{
                  flex: 1, background: COLORS.orange, color: COLORS.black,
                  border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '8px 0',
                  fontWeight: 800, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                  boxShadow: '1.5px 1.5px 0 #080808', textTransform: 'uppercase', letterSpacing: 0.8,
                }}>Add more</button>
                <button onClick={() => { setWithdrawIdx(i); setShowWithdraw(true); }} disabled={p.status === 'pending'} style={{
                  flex: 1, background: COLORS.white, color: p.status === 'pending' ? '#ccc' : COLORS.black,
                  border: `2px solid ${p.status === 'pending' ? COLORS.gray : COLORS.black}`, borderRadius: 100, padding: '8px 0',
                  fontWeight: 800, fontSize: 11, fontFamily: 'inherit', cursor: p.status === 'pending' ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>Withdraw</button>
              </div>
            </div>
          ))}
        </>
      )}

      {positions.length > 0 && (
        <WithdrawSheet
          open={showWithdraw}
          onClose={() => { setShowWithdraw(false); setWithdrawIdx(undefined); setRefreshKey(k => k + 1); }}
          positions={positions.map(p => ({
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
