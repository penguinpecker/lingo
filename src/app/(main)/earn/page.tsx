'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { COLORS, RISK_TIERS, PROTOCOL_NAMES, CHAINS } from '@/constants/theme';
import { Badge, VaultBadge, SectionLabel, Button, StrategyBar } from '@/components/ui';
import DepositSheet from '@/components/sheets/DepositSheet';
import type { Strategy, ScoredVault } from '@/lib/lifi/types';

function ShieldIcon({ s = 16, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 3L5 7V13C5 19.07 8.84 24.64 14 26C19.16 24.64 23 19.07 23 13V7L14 3Z" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M10 14L13 17L18 11" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ScaleIcon({ s = 16, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 4V24" stroke={c} strokeWidth="2" strokeLinecap="round" /><path d="M6 8L14 6L22 8" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 16C3 16 4 12 6 12C8 12 9 16 9 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M19 16C19 16 20 12 22 12C24 12 25 16 25 16" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M3 16H9M19 16H25" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function RocketIcon({ s = 16, c = COLORS.black }: { s?: number; c?: string }) {
  return <svg width={s} height={s} viewBox="0 0 28 28" fill="none"><path d="M14 4C14 4 8 10 8 18L14 24L20 18C20 10 14 4 14 4Z" stroke={c} strokeWidth="2" strokeLinejoin="round" /><circle cx="14" cy="13" r="2.5" stroke={c} strokeWidth="1.8" /><path d="M8 18L4 20L6 16" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /><path d="M20 18L24 20L22 16" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
const RISK_ICONS = [ShieldIcon, ScaleIcon, RocketIcon];

function riskLabel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: 'Low Risk', color: COLORS.success };
  if (score >= 0.45) return { label: 'Moderate', color: COLORS.warning };
  return { label: 'Higher Risk', color: COLORS.error };
}

export default function EarnPage() {
  const [strategies, setStrategies] = useState<Record<number, Strategy | null>>({ 0: null, 1: null, 2: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedVault, setExpandedVault] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositStrategy, setDepositStrategy] = useState<Strategy | null>(null);

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/vaults?deposit=1000');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setStrategies({ 0: data.strategies.safe || null, 1: data.strategies.mix || null, 2: data.strategies.bold || null });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  const handleDeposit = (strat: Strategy) => {
    setDepositStrategy(strat);
    setShowDeposit(true);
  };

  // Collect all unique vaults across all strategies for display
  const allVaults: { vault: ScoredVault; tier: number; weight: number; stratName: string }[] = [];
  [0, 1, 2].forEach(tier => {
    const strat = strategies[tier];
    if (!strat) return;
    strat.allocations.forEach(a => {
      // Deduplicate by address
      if (!allVaults.find(v => v.vault.address === a.vault.address)) {
        allVaults.push({ vault: a.vault, tier, weight: a.weight, stratName: strat.name });
      }
    });
  });

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1.5 }}>Earn</div>
        {loading && <div style={{ width: 16, height: 16, border: `2px solid ${COLORS.gray}`, borderTopColor: COLORS.orange, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
        {!loading && !error && <Badge bg={COLORS.success + '20'} color={COLORS.success}>LIVE</Badge>}
        {!loading && error && <Badge bg={COLORS.error + '20'} color={COLORS.error}>OFFLINE</Badge>}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Live yields from LI.FI across 21 chains. Pick a strategy, we handle the rest.
      </div>

      {/* Strategy cards — vertical stack */}
      {loading ? (
        <>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 12 }} />
          ))}
        </>
      ) : error ? (
        <div style={{ background: COLORS.white, border: `2px dashed ${COLORS.black}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Could not reach vault data</div>
          <Button onClick={fetchLive} style={{ maxWidth: 160, margin: '0 auto' }}>Retry</Button>
        </div>
      ) : (
        <>
          {[0, 1, 2].map(tierIdx => {
            const strat = strategies[tierIdx];
            if (!strat) return null;
            const tier = RISK_TIERS[tierIdx];
            const RIcon = RISK_ICONS[tierIdx];
            const isExpanded = expandedVault === `strategy-${tierIdx}`;

            return (
              <div key={tierIdx} style={{
                background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 14,
                marginBottom: 12, boxShadow: '2px 2px 0 #080808', overflow: 'hidden',
              }}>
                {/* Strategy header — tappable */}
                <div
                  onClick={() => setExpandedVault(isExpanded ? null : `strategy-${tierIdx}`)}
                  style={{ padding: 16, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: tier.color + '20',
                        border: `2px solid ${tier.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <RIcon s={18} c={tier.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 15 }}>{strat.name}</div>
                        <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>
                          {strat.allocations.length} vaults &middot; {strat.chainCount} chains &middot; {strat.protocolCount} protocols
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: tier.color, lineHeight: 1 }}>{strat.netApy}%</div>
                      <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>APY</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <Badge bg={tier.color + '15'} color={tier.color}>{tier.label}</Badge>
                    <Badge bg={COLORS.lightGray} color="#666">Gas: {strat.gasEntry < 1 ? '<$1' : `$${strat.gasEntry}`}</Badge>
                    <Badge bg={COLORS.lightGray} color="#666">
                      {strat.tokens.join(' + ')}
                    </Badge>
                  </div>

                  {/* Chevron */}
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path d="M6 9L12 15L18 9" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Expanded vault composition */}
                {isExpanded && (
                  <div style={{ borderTop: `1.5px solid ${COLORS.lightGray}`, padding: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                      Vault composition
                    </div>

                    <StrategyBar allocations={strat.allocations.map(a => ({ weight: a.weight, color: tier.color }))} />

                    {strat.allocations.map((a, i) => {
                      const v = a.vault;
                      const risk = riskLabel(v.riskScore);
                      const chainName = CHAINS[v.chainId]?.name || v.network;
                      return (
                        <div key={i} style={{
                          background: COLORS.lightGray, borderRadius: 12, padding: 14, marginTop: 10,
                          border: `1.5px solid ${COLORS.gray}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <VaultBadge letter={v.protocol.charAt(0).toUpperCase()} color={tier.color} size={28} />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13 }}>{v.protocol}</div>
                                <div style={{ fontSize: 10, color: '#888' }}>{v.token} &middot; {chainName}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: tier.color }}>{v.apyTotal.toFixed(1)}%</div>
                              <div style={{ fontSize: 9, color: '#888' }}>APY</div>
                            </div>
                          </div>

                          {/* Vault stats */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                            <Badge bg={risk.color + '15'} color={risk.color}>{risk.label}</Badge>
                            <Badge bg={COLORS.lightGray} color="#666">TVL ${(v.tvl / 1e6).toFixed(1)}M</Badge>
                            <Badge bg={COLORS.lightGray} color="#666">{Math.round(a.weight * 100)}% allocation</Badge>
                            {v.apyBase > 0 && <Badge bg={COLORS.lightGray} color="#666">Base: {v.apyBase.toFixed(1)}%</Badge>}
                            {v.apyReward > 0 && <Badge bg={COLORS.warning + '20'} color={COLORS.warning}>Rewards: {v.apyReward.toFixed(1)}%</Badge>}
                          </div>

                          {/* Yield breakdown bar */}
                          <div style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888', marginBottom: 3 }}>
                              <span>Yield source</span>
                              <span>{v.apyBase > 0 && v.apyReward > 0 ? 'Base + Rewards' : v.apyBase > 0 ? 'Organic only' : 'Reward-heavy'}</span>
                            </div>
                            <div style={{ height: 6, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                              {v.apyBase > 0 && (
                                <div style={{ width: `${(v.apyBase / v.apyTotal) * 100}%`, background: COLORS.success, height: '100%' }} />
                              )}
                              {v.apyReward > 0 && (
                                <div style={{ width: `${(v.apyReward / v.apyTotal) * 100}%`, background: COLORS.warning, height: '100%' }} />
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 9, color: '#888' }}>
                              {v.apyBase > 0 && <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: COLORS.success, marginRight: 3, verticalAlign: 'middle' }} />Base {v.apyBase.toFixed(1)}%</span>}
                              {v.apyReward > 0 && <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: COLORS.warning, marginRight: 3, verticalAlign: 'middle' }} />Rewards {v.apyReward.toFixed(1)}%</span>}
                            </div>
                          </div>

                          {/* APY stability */}
                          {v.apy1d != null && v.apy7d != null && v.apy30d != null && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>APY history</div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {[
                                  { l: '24h', v: v.apy1d },
                                  { l: '7d', v: v.apy7d },
                                  { l: '30d', v: v.apy30d },
                                  { l: 'Now', v: v.apyTotal },
                                ].map((p, j) => (
                                  <div key={j} style={{
                                    flex: 1, background: COLORS.white, borderRadius: 8, padding: '6px 4px',
                                    textAlign: 'center', border: `1px solid ${COLORS.gray}`,
                                  }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: p.v > v.apyTotal * 0.9 ? COLORS.success : COLORS.warning }}>{p.v.toFixed(1)}%</div>
                                    <div style={{ fontSize: 8, color: '#aaa', fontWeight: 700, textTransform: 'uppercase' }}>{p.l}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Deposit CTA */}
                    <Button onClick={() => handleDeposit(strat)} style={{ marginTop: 14 }}>
                      Deposit into {strat.name}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom summary */}
          <div style={{
            background: COLORS.black, borderRadius: 14, padding: 16, marginTop: 4,
            border: `2px solid ${COLORS.black}`,
          }}>
            <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
              Strategy comparison
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => {
                const s = strategies[i];
                const t = RISK_TIERS[i];
                return (
                  <div key={i} style={{
                    flex: 1, borderRadius: 10, padding: 10, textAlign: 'center',
                    background: s ? t.color + '15' : '#1a1a1a',
                    border: `1.5px solid ${s ? t.color + '40' : '#333'}`,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s ? t.color : '#555' }}>{s?.netApy || 0}%</div>
                    <div style={{ fontSize: 8, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{s?.allocations.length || 0} vaults</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <DepositSheet open={showDeposit} onClose={() => setShowDeposit(false)} strategy={depositStrategy} />
    </div>
  );
}
