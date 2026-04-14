'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { COLORS, RISK_TIERS, PROTOCOL_NAMES, CHAINS } from '@/constants/theme';
import { VaultBadge, Badge, Button, StrategyBar } from '@/components/ui';
import BottomSheet from './BottomSheet';
import { executeDeposit, detectSourceChain } from '@/lib/wallet/transaction';
import type { Strategy } from '@/lib/lifi/types';

type Step = 'amount' | 'confirm' | 'detecting' | 'approving' | 'processing' | 'success' | 'error';

export default function DepositSheet({
  open,
  onClose,
  strategy,
}: {
  open: boolean;
  onClose: () => void;
  strategy: Strategy | null;
}) {
  const { wallets } = useWallets();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHashes, setTxHashes] = useState<{ hash: string; explorer: string; bridged?: boolean }[]>([]);
  const [currentVaultIdx, setCurrentVaultIdx] = useState(0);
  const [sourceChain, setSourceChain] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const tier = strategy ? RISK_TIERS[strategy.tier] : RISK_TIERS[0];
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

  const handleClose = () => {
    setStep('amount');
    setAmount('');
    setErrorMsg('');
    setTxHashes([]);
    setCurrentVaultIdx(0);
    setSourceChain(null);
    onClose();
  };

  const handleNext = async () => {
    if (!embeddedWallet) return;
    // Detect source chain before showing confirm
    setStep('detecting');
    try {
      const source = await detectSourceChain(embeddedWallet.address, numAmount);
      if (source) {
        const chainName = CHAINS[source.chainId]?.name || `Chain ${source.chainId}`;
        setSourceChain(chainName);
      } else {
        setSourceChain(null);
      }
      setStep('confirm');
    } catch {
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    if (!strategy || !embeddedWallet) return;
    setStep('approving');
    setTxHashes([]);

    try {
      const results: { hash: string; explorer: string; bridged?: boolean }[] = [];

      for (let i = 0; i < strategy.allocations.length; i++) {
        setCurrentVaultIdx(i);
        const alloc = strategy.allocations[i];
        const depositAmount = numAmount * alloc.weight;

        setStep('approving');

        const result = await executeDeposit({
          privyWallet: embeddedWallet,
          vaultAddress: alloc.vault.address,
          vaultChainId: alloc.vault.chainId,
          tokenAddress: alloc.vault.tokenAddress,
          tokenDecimals: alloc.vault.tokenDecimals,
          amount: depositAmount,
          walletAddress: embeddedWallet.address,
        });

        setStep('processing');
        results.push(result);
        setTxHashes([...results]);
      }

      setStep('success');
    } catch (e) {
      setErrorMsg((e as Error).message || 'Transaction failed');
      setStep('error');
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 'amount' ? 'Deposit' : undefined}>
      {/* STEP: Amount */}
      {step === 'amount' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            background: COLORS.lightGray, border: `2px solid ${COLORS.black}`, borderRadius: 12, padding: '12px 16px',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900 }}>$</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus
              style={{ flex: 1, fontSize: 28, fontWeight: 900, border: 'none', background: 'transparent', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[50, 100, 500, 1000].map(v => (
              <button key={v} onClick={() => setAmount(v.toString())} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${COLORS.black}`,
                fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                background: numAmount === v ? COLORS.orange : COLORS.white,
              }}>${v}</button>
            ))}
          </div>

          {strategy && (
            <div style={{ background: COLORS.lightGray, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Strategy: {strategy.name}
              </div>
              <StrategyBar allocations={strategy.allocations.map(a => ({ weight: a.weight, color: tier.color }))} />
              <div style={{ marginTop: 8 }}>
                {strategy.allocations.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
                    <span style={{ fontWeight: 700 }}>{PROTOCOL_NAMES[a.vault.protocol] || a.vault.protocol}</span>
                    <span style={{ color: '#888' }}>{Math.round(a.weight * 100)}% &middot; {a.vault.token} &middot; {a.vault.network}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {numAmount > 0 && strategy && (
            <div style={{
              background: COLORS.black, borderRadius: 12, padding: 14, marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>Monthly earnings</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.orange }}>${(numAmount * strategy.netApy / 100 / 12).toFixed(2)}/mo</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.success }}>{strategy.netApy}%</div>
            </div>
          )}

          <Button onClick={handleNext} disabled={numAmount <= 0}>Next</Button>
        </>
      )}

      {/* STEP: Detecting source chain */}
      {step === 'detecting' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 800, fontSize: 14 }}>Scanning your balances...</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Finding the cheapest route</div>
        </div>
      )}

      {/* STEP: Confirm */}
      {step === 'confirm' && strategy && (
        <>
          <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Confirm deposit</div>

          {/* Cross-chain info banner */}
          {sourceChain && (
            <div style={{
              background: '#EEF2FF', border: `1.5px solid ${COLORS.lavender}`, borderRadius: 12,
              padding: '10px 14px', marginBottom: 16, fontSize: 11, color: COLORS.lavenderDark, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M4 12H20M20 12L14 6M20 12L14 18" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Funds detected on {sourceChain}. Lingo will auto-bridge to the cheapest vault chain.
            </div>
          )}

          <div style={{ background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {[
              ['Amount', `$${numAmount.toLocaleString()}`],
              ['Strategy', strategy.name],
              ['Net rate', `${strategy.netApy}% yearly`],
              ['Monthly', `$${(numAmount * strategy.netApy / 100 / 12).toFixed(2)}`],
              ['Gas', strategy.gasEntry < 1 ? '<$1' : `~$${strategy.gasEntry.toFixed(2)}`],
              ['Transactions', `${strategy.allocations.length} (one per vault)`],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 5 ? `1px solid ${COLORS.lightGray}` : 'none' }}>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Allocation</div>
          {strategy.allocations.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < strategy.allocations.length - 1 ? `1px solid ${COLORS.lightGray}` : 'none' }}>
              <VaultBadge letter={(PROTOCOL_NAMES[a.vault.protocol] || 'V').charAt(0)} color={tier.color} size={24} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{PROTOCOL_NAMES[a.vault.protocol] || a.vault.protocol}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{a.vault.network} &middot; {a.vault.token}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>${(numAmount * a.weight).toFixed(0)}</div>
                <div style={{ fontSize: 10, color: tier.color, fontWeight: 700 }}>{a.vault.netApy}%</div>
              </div>
            </div>
          ))}

          {!embeddedWallet && (
            <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: 12, padding: '10px 14px', marginTop: 16, fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
              Wallet not connected. Please reconnect.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep('amount')} style={{ flex: 1, padding: '14px 0', borderRadius: 100, border: `2px solid ${COLORS.black}`, background: COLORS.white, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Back</button>
            <Button onClick={handleConfirm} disabled={!embeddedWallet} style={{ flex: 2 }}>Confirm &amp; sign</Button>
          </div>
        </>
      )}

      {/* STEP: Approving */}
      {step === 'approving' && strategy && (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
            Approving &amp; depositing into vault {currentVaultIdx + 1}/{strategy.allocations.length}...
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Confirm each transaction in your wallet</div>
          {strategy.allocations.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', marginTop: i === 0 ? 16 : 0,
              opacity: i < currentVaultIdx ? 0.5 : i === currentVaultIdx ? 1 : 0.3,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: i < currentVaultIdx ? COLORS.success : i === currentVaultIdx ? COLORS.orange : COLORS.lightGray,
                border: `1.5px solid ${COLORS.black}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i < currentVaultIdx ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 6L5 8L9 4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : i === currentVaultIdx ? (
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.black }} />
                ) : null}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{PROTOCOL_NAMES[a.vault.protocol] || a.vault.protocol}</span>
              <span style={{ fontSize: 10, color: '#888' }}>${(numAmount * a.weight).toFixed(0)}</span>
            </div>
          ))}
          {txHashes.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 10, color: '#888' }}>
              {txHashes.length}/{strategy.allocations.length} confirmed
            </div>
          )}
        </div>
      )}

      {/* STEP: Processing */}
      {step === 'processing' && strategy && (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
            Depositing into {strategy.allocations.length} vaults...
          </div>
          {strategy.allocations.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
              opacity: i < currentVaultIdx ? 0.5 : i === currentVaultIdx ? 1 : 0.3,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: i < currentVaultIdx ? COLORS.success : i === currentVaultIdx ? COLORS.orange : COLORS.lightGray,
                border: `1.5px solid ${COLORS.black}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i < currentVaultIdx ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 6L5 8L9 4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : i === currentVaultIdx ? (
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.black }} />
                ) : null}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{PROTOCOL_NAMES[a.vault.protocol] || a.vault.protocol}</span>
              <span style={{ fontSize: 10, color: '#888' }}>${(numAmount * a.weight).toFixed(0)}</span>
            </div>
          ))}
          {txHashes.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 10, color: '#888' }}>
              {txHashes.length}/{strategy.allocations.length} confirmed
            </div>
          )}
        </div>
      )}

      {/* STEP: Success */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="pop-in" style={{
            width: 56, height: 56, borderRadius: 16, background: COLORS.success,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808',
          }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M6 13L10 17L18 8" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Deposited</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>${numAmount.toLocaleString()} into {strategy?.name}</div>
          <div style={{ fontSize: 12, color: COLORS.success, fontWeight: 700, marginBottom: 16 }}>Earning {strategy?.netApy}% yearly</div>

          {txHashes.some(t => t.bridged) && (
            <div style={{ fontSize: 10, color: COLORS.lavender, fontWeight: 700, marginBottom: 8 }}>
              Cross-chain bridge executed automatically
            </div>
          )}

          {txHashes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {txHashes.map((tx, i) => (
                <a key={i} href={tx.explorer} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: '#3B82F6', marginBottom: 4, textDecoration: 'none' }}>
                  Tx {i + 1}: {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                  {tx.bridged && <Badge bg={COLORS.lavender + '30'} color={COLORS.lavender}>bridged</Badge>}
                  <svg width={10} height={10} viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H5M9 3V7" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              ))}
            </div>
          )}

          <Button onClick={handleClose}>Done</Button>
        </div>
      )}

      {/* STEP: Error */}
      {step === 'error' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: COLORS.error,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808',
          }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#FFF" strokeWidth="3" strokeLinecap="round" /></svg>
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', marginBottom: 8 }}>Failed</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 20, padding: '0 20px', lineHeight: 1.5 }}>{errorMsg || 'Something went wrong'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleClose} style={{ flex: 1, padding: '14px 0', borderRadius: 100, border: `2px solid ${COLORS.black}`, background: COLORS.white, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
            <Button onClick={() => { setErrorMsg(''); setStep('confirm'); }} style={{ flex: 1 }}>Try again</Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
