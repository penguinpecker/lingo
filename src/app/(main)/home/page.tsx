'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { COLORS, PROTOCOL_NAMES } from '@/constants/theme';
import { SectionLabel, ProgressRing, Sparkline, Card, Button } from '@/components/ui';
import WithdrawSheet from '@/components/sheets/WithdrawSheet';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getTrackedVaults, type TrackedVault } from '@/lib/wallet/deposit-tracker';

interface Balance { chain: string; symbol: string; amount: number }
interface Position {
  name: string; chain: string; token: string; deposited: number;
  current: number; apy: number; color: string; letter: string;
  protocolName: string; chainId: number;
  vaultAddress: string; underlyingTokenAddress: string;
  shareDecimals: number; shareBalanceRaw: string;
  status: string;
}

function DepositIcon({ size = 14, color = COLORS.orange }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M10 3V14M10 14L6 10M10 14L14 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17H16" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
}
function YieldIcon({ size = 14, color = COLORS.success }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M10 17V6M10 6L6 10M10 6L14 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 3H16" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
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
    token: v.token || 'USDC',
    deposited: v.depositAmount || 0,
    current: v.depositAmount || 0,
    apy: 0,
    color: TIER_COLORS[i % TIER_COLORS.length],
    letter: (v.protocol || 'V').charAt(0).toUpperCase(),
    protocolName: v.protocol || '',
    chainId: v.chainId,
    vaultAddress: v.vaultAddress,
    underlyingTokenAddress: v.tokenAddress || '',
    shareDecimals: v.shareDecimals || 18,
    shareBalanceRaw: '0',
    status: 'pending',
  }));
}

export default function HomePage() {
  const router = useRouter();
  const walletAddress = useStore(s => s.walletAddress);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [loadingPos, setLoadingPos] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Show tracked deposits immediately
  useEffect(() => {
    const tracked = getTrackedVaults();
    if (tracked.length > 0) setPositions(trackedToPositions(tracked));
  }, []);

  // Fetch live balances
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

  // Fetch live positions in background
  useEffect(() => {
    if (!walletAddress) { setLoadingPos(false); return; }
    const tracked = getTrackedVaults();

    fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, trackedVaults: tracked }),
    })
      .then(r => r.json())
      .then(d => {
        const live = (d.positions || [])
          .filter((p: any) => parseFloat(p.balanceUsd || '0') > 0.001)
          .map((p: any, i: number) => ({
            name: p.protocolName || p.asset?.name || 'Vault',
            chain: p.chainName || 'Unknown',
            token: p.asset?.symbol || '?',
            deposited: parseFloat(p.balanceUsd || '0'),
            current: parseFloat(p.balanceUsd || '0'),
            apy: 0,
            color: TIER_COLORS[i % TIER_COLORS.length],
            letter: (p.protocolName || 'V').charAt(0).toUpperCase(),
            protocolName: p.protocolName || '',
            chainId: p.chainId || 0,
            vaultAddress: p.vaultAddress || '',
            underlyingTokenAddress: p.underlyingTokenAddress || '',
            shareDecimals: p.asset?.decimals || 18,
            shareBalanceRaw: p.balanceNative || '0',
            status: p.status || 'live',
          }));

        if (live.length > 0) {
          const liveKeys = new Set(live.map((p: Position) => `${p.vaultAddress.toLowerCase()}-${p.chainId}`));
          const unmatched = trackedToPositions(tracked).filter(
            p => !liveKeys.has(`${p.vaultAddress.toLowerCase()}-${p.chainId}`)
          );
          setPositions([...live, ...unmatched]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPos(false));
  }, [walletAddress]);

  const totalPositionValue = positions.reduce((s, p) => s + p.current, 0);
  const displayTotal = totalBalance + totalPositionValue;

  return (
    <div style={{ padding: 16 }}>
      {/* Balance card */}
      <div style={{
        background: COLORS.black, borderRadius: 16, padding: 20, marginBottom: 16,
        border: `2px solid ${COLORS.black}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(242,111,33,0.06)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Total balance</div>
            {loadingBal ? (
              <div className="skeleton" style={{ width: 140, height: 34, marginTop: 4 }} />
            ) : (
              <div style={{ fontSize: 34, fontWeight: 900, color: COLORS.white, lineHeight: 1, marginTop: 4 }}>
                ${displayTotal.toFixed(2)}
              </div>
            )}
          </div>
          {totalPositionValue > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Earning</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.success, marginTop: 4 }}>${totalPositionValue.toFixed(2)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {loadingBal ? (
            <>
              <div className="skeleton" style={{ width: 60, height: 28 }} />
              <div className="skeleton" style={{ width: 60, height: 28 }} />
            </>
          ) : balances.length > 0 ? (
            balances.map((b, i) => (
              <div key={i}>
                <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                  {b.symbol} <span style={{ color: '#444' }}>({b.chain})</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.white }}>{b.amount.toFixed(2)}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 11, color: '#555' }}>No stablecoins found. Fund your wallet to start earning.</div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <Button onClick={() => router.push('/earn')} style={{ flex: 1, padding: '10px 0', fontSize: 11 }}>
          <DepositIcon size={12} color={COLORS.black} /> Deposit
        </Button>
        <Button onClick={() => positions.length > 0 ? setShowWithdraw(true) : router.push('/earn')} variant="outline" style={{ flex: 1, padding: '10px 0', fontSize: 11 }}>
          <YieldIcon size={12} /> Withdraw
        </Button>
        <Button onClick={() => router.push('/chat')} variant="secondary" style={{ flex: 1, padding: '10px 0', fontSize: 11, color: COLORS.lavenderLight }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="3" stroke={COLORS.lavenderLight} strokeWidth="2" /><path d="M8 21L12 17H3" stroke={COLORS.lavenderLight} strokeWidth="2" strokeLinejoin="round" /></svg>
          Chat
        </Button>
      </div>

      {/* Positions */}
      <SectionLabel icon={<svg width={12} height={12} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#888" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#888" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#888" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#888" strokeWidth="2" /></svg>}>
        Active positions
      </SectionLabel>

      {positions.length === 0 && !loadingPos ? (
        <Card variant="outlined" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>No active positions</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            {totalBalance > 0
              ? "You have funds ready. Let's put them to work earning yield."
              : "Fund your wallet with USDC or USDT on any supported chain to start earning."}
          </div>
          <Button onClick={() => router.push('/earn')} style={{ maxWidth: 200, margin: '0 auto' }}>
            {totalBalance > 0 ? 'Start earning' : 'How to fund'}
          </Button>
        </Card>
      ) : (
        positions.map((p, i) => (
          <div key={i} style={{
            background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12,
            padding: 14, marginBottom: 8, boxShadow: '2px 2px 0 #080808', cursor: 'pointer',
            opacity: p.status === 'pending' ? 0.85 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 14, color: COLORS.black,
                  border: `1.5px solid ${COLORS.black}`,
                }}>{p.letter}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{p.token} &middot; {p.chain}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>${p.current.toFixed(2)}</div>
                {p.status === 'pending' && <div style={{ fontSize: 9, color: COLORS.warning, fontWeight: 700 }}>Bridging...</div>}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Withdraw sheet */}
      {positions.length > 0 && (
        <WithdrawSheet
          open={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          positions={positions.filter(p => p.status === 'live').map(p => ({
            name: p.name, chain: p.chain, chainId: p.chainId, token: p.token,
            vaultAddress: p.vaultAddress, underlyingTokenAddress: p.underlyingTokenAddress,
            shareDecimals: p.shareDecimals, shareBalanceRaw: p.shareBalanceRaw,
            current: p.current, earned: 0, apy: 0,
            color: p.color, letter: p.letter,
          }))}
        />
      )}
    </div>
  );
}
