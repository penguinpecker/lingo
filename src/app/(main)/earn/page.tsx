'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { COLORS, RISK_TIERS, PROTOCOL_NAMES } from '@/constants/theme';
import { Badge, VaultBadge, MiniBarChart, SectionLabel, Button, StrategyBar } from '@/components/ui';
import DepositSheet from '@/components/sheets/DepositSheet';
import type { Strategy } from '@/lib/lifi/types';


function ShieldIcon({ s = 22, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 3L5 7V13C5 19.07 8.84 24.64 14 26C19.16 24.64 23 19.07 23 13V7L14 3Z" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M10 14L13 17L18 11" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ScaleIcon({ s = 22, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 4V24" stroke={c} strokeWidth="2" strokeLinecap="round" /><path d="M6 8L14 6L22 8" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 16C3 16 4 12 6 12C8 12 9 16 9 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M19 16C19 16 20 12 22 12C24 12 25 16 25 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M3 16H9M19 16H25" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function RocketIcon({ s = 22, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 4C14 4 8 10 8 18L14 24L20 18C20 10 14 4 14 4Z" stroke={c} strokeWidth="2" strokeLinejoin="round" /><circle cx="14" cy="13" r="2.5" stroke={c} strokeWidth="1.8" /><path d="M8 18L4 20L6 16" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /><path d="M20 18L24 20L22 16" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
const RISK_ICONS = [ShieldIcon, ScaleIcon, RocketIcon];

export default function EarnPage() {
  const [risk, setRisk] = useState(0);
  const [deposit, setDeposit] = useState(1000);
  const [showDeposit, setShowDeposit] = useState(false);
  const [strategies, setStrategies] = useState<Record<number, Strategy | null>>({ 0: null, 1: null, 2: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLive = useCallback(async (amt: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/vaults?deposit=${amt}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const s = data.strategies;
      setStrategies({
        0: s.safe || null,
        1: s.mix || null,
        2: s.bold || null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLive(deposit); }, [deposit, fetchLive]);

  const strat = strategies[risk];
  const tier = RISK_TIERS[risk];
  const allApys = [strategies[0]?.netApy || 0, strategies[1]?.netApy || 0, strategies[2]?.netApy || 0];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Start earning
        </div>
        {loading && <div style={{ width: 16, height: 16, border: `2px solid ${COLORS.gray}`, borderTopColor: COLORS.orange, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
        {!loading && !error && strat && <Badge bg={COLORS.success + '20'} color={COLORS.success}>LIVE</Badge>}
        {!loading && error && <Badge bg={COLORS.error + '20'} color={COLORS.error}>OFFLINE</Badge>}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Pick your saving style. We compute the best portfolio.
      </div>

      {/* Deposit amount */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 24, fontWeight: 900 }}>$</span>
        <input type="number" value={deposit} onChange={e => setDeposit(Math.max(0, Number(e.target.value)))}
          style={{ flex: 1, fontSize: 24, fontWeight: 900, border: 'none', background: 'transparent', fontFamily: 'inherit', width: '100%' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {[100, 500, 1000].map(v => (
            <button key={v} onClick={() => setDeposit(v)} style={{
              padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${COLORS.black}`,
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              background: deposit === v ? COLORS.orange : COLORS.lightGray,
            }}>${v}</button>
          ))}
        </div>
      </div>

      {/* Risk tier selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {RISK_TIERS.map((t, i) => {
          const RIcon = RISK_ICONS[i];
          return (
            <button key={t.key} onClick={() => setRisk(i)} style={{
              flex: 1, padding: '10px 8px', border: `2px solid ${COLORS.black}`, borderRadius: 12,
              fontWeight: 800, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center',
              background: risk === i ? COLORS.black : COLORS.white,
              color: risk === i ? COLORS.white : COLORS.black,
              boxShadow: risk === i ? `2px 2px 0 ${t.color}` : 'none', transition: 'all 0.15s',
            }}>
              <div style={{ marginBottom: 4 }}><RIcon s={20} c={risk === i ? COLORS.white : COLORS.black} /></div>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Risk description */}
      <div style={{ background: COLORS.lightGray, borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: '#666', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>{(() => { const I = RISK_ICONS[risk]; return <I s={14} />; })()}</div>
        {tier.description}
      </div>

      {/* Strategy composition */}
      {loading ? (
        <>
          <div className="skeleton" style={{ height: 20, width: 180, marginTop: 20, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 180, borderRadius: 14, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />
        </>
      ) : !strat ? (
        <div style={{
          background: COLORS.white, border: `2px dashed ${COLORS.black}`, borderRadius: 14,
          padding: 32, textAlign: 'center', marginTop: 20,
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
            {error ? 'Could not reach vault data' : 'No vaults available for this tier'}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            {error ? 'Check your connection and try again.' : 'Try a different risk level or deposit amount.'}
          </div>
          {error && (
            <Button onClick={() => fetchLive(deposit)} style={{ maxWidth: 160, margin: '0 auto' }}>
              Retry
            </Button>
          )}
        </div>
      ) : (
        <>
          <SectionLabel>{strat.name} — {strat.allocations.length} vaults</SectionLabel>

      <div style={{ background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '2px 2px 0 #080808' }}>
        <StrategyBar allocations={strat.allocations.map(a => ({ weight: a.weight, color: tier.color }))} />
        {strat.allocations.map((a, i) => {
          const v = a.vault;
          const normieName = PROTOCOL_NAMES[v.protocol] || v.protocol;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <VaultBadge letter={normieName.charAt(0)} color={tier.color} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{normieName}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: tier.color }}>{v.apyTotal.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Badge bg={COLORS.lightGray} color="#666">{v.token}</Badge>
                    <Badge bg={COLORS.lightGray} color="#666">{v.network}</Badge>
                  </div>
                  <span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>{Math.round(a.weight * 100)}% &middot; ${Math.round(deposit * a.weight)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ height: 3, flex: 1, background: COLORS.lightGray, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: tier.color, opacity: 0.4, borderRadius: 2, width: `${Math.min(100, v.tvl / 3000000)}%` }} />
                  </div>
                  <span style={{ fontSize: 9, color: '#aaa' }}>${(v.tvl / 1e6).toFixed(0)}M</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projection card */}
      <div style={{ background: COLORS.black, borderRadius: 14, padding: 16, border: `2px solid ${COLORS.black}`, boxShadow: '3px 3px 0 ' + tier.color }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Your ${deposit.toLocaleString()} earns</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.orange, lineHeight: 1, marginTop: 2 }}>${(deposit * strat.netApy / 100 / 12).toFixed(2)}/mo</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Net rate</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.success }}>{strat.netApy}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 10 }}>
          {[
            { l: 'Yearly', v: `$${(deposit * strat.netApy / 100).toFixed(0)}` },
            { l: 'Entry gas', v: strat.gasEntry < 1 ? '<$1' : `$${strat.gasEntry}` },
            { l: 'Protocols', v: strat.protocolCount.toString() },
            { l: 'Chains', v: strat.chainCount.toString() },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{s.l}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.white, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 6 }}>APY comparison</div>
          <MiniBarChart data={allApys} labels={['SAFE', 'MIX', 'BOLD']} colors={[COLORS.success, COLORS.warning, COLORS.error]} w={260} h={40} />
        </div>
      </div>

      <Button onClick={() => setShowDeposit(true)} style={{ marginTop: 16 }}>
        Deposit ${deposit.toLocaleString()} into {strat.name}
      </Button>

      <DepositSheet open={showDeposit} onClose={() => setShowDeposit(false)} strategy={strat} />
        </>
      )}
    </div>
  );
}
