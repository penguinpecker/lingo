'use client';

import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { COLORS } from '@/constants/theme';
import { VaultBadge, Badge, Button } from '@/components/ui';
import BottomSheet from './BottomSheet';
import { executeWithdraw } from '@/lib/wallet/transaction';

interface Position {
  name: string;
  chain: string;
  chainId: number;
  token: string;
  vaultAddress: string;
  underlyingTokenAddress: string;
  shareDecimals: number;
  shareBalanceRaw: string; // raw balance in smallest units
  current: number;
  earned: number;
  apy: number;
  color: string;
  letter: string;
}

type Step = 'select' | 'amount' | 'confirm' | 'approving' | 'processing' | 'success' | 'error';

export default function WithdrawSheet({
  open,
  onClose,
  positions,
  preselected,
}: {
  open: boolean;
  onClose: () => void;
  positions: Position[];
  preselected?: number;
}) {
  const { wallets } = useWallets();
  const [step, setStep] = useState<Step>(preselected != null ? 'amount' : 'select');
  const [selected, setSelected] = useState<number>(preselected ?? 0);
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState<{ hash: string; explorer: string } | null>(null);

  const pos = positions[selected];
  const numAmount = parseFloat(amount) || 0;
  const isMax = pos && Math.abs(numAmount - pos.current) < 0.01;
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

  const handleClose = () => {
    setStep(preselected != null ? 'amount' : 'select');
    setAmount('');
    setErrorMsg('');
    setTxHash(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!pos || !embeddedWallet) return;

    setStep('approving');

    try {
      // Calculate share amount proportional to withdrawal
      // If withdrawing max, use full share balance; otherwise scale proportionally
      let shareAmount: string;
      if (isMax) {
        shareAmount = pos.shareBalanceRaw;
      } else {
        const fraction = numAmount / pos.current;
        const rawShares = BigInt(pos.shareBalanceRaw);
        shareAmount = ((rawShares * BigInt(Math.floor(fraction * 10000))) / BigInt(10000)).toString();
      }

      setStep('processing');

      const result = await executeWithdraw({
        privyWallet: embeddedWallet,
        vaultAddress: pos.vaultAddress,
        vaultChainId: pos.chainId,
        underlyingTokenAddress: pos.underlyingTokenAddress,
        shareDecimals: pos.shareDecimals,
        amountShares: shareAmount,
        walletAddress: embeddedWallet.address,
      });

      setTxHash(result);
      setStep('success');
    } catch (e) {
      setErrorMsg((e as Error).message || 'Withdrawal failed');
      setStep('error');
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 'select' ? 'Withdraw' : undefined}>
      {/* Select position */}
      {step === 'select' && (
        <>
          <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Select position
          </div>
          {positions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#888', fontSize: 13 }}>
              No active positions to withdraw from.
            </div>
          )}
          {positions.map((p, i) => (
            <div key={i} onClick={() => { setSelected(i); setStep('amount'); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 14,
              background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12,
              marginBottom: 8, cursor: 'pointer', boxShadow: '2px 2px 0 #080808',
            }}>
              <VaultBadge letter={p.letter} color={p.color} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{p.chain} &middot; {p.token}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>${p.current.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: COLORS.success }}>+${p.earned.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Amount */}
      {step === 'amount' && pos && (
        <>
          <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Withdraw
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12,
            background: COLORS.lightGray, borderRadius: 12, marginBottom: 16,
          }}>
            <VaultBadge letter={pos.letter} color={pos.color} size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{pos.name}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{pos.chain}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>${pos.current.toFixed(2)}</div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12,
            padding: '12px 16px',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900 }}>$</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" autoFocus style={{
                flex: 1, fontSize: 28, fontWeight: 900, border: 'none', background: 'transparent',
                fontFamily: 'inherit',
              }} />
          </div>

          <button onClick={() => setAmount(pos.current.toFixed(2))} style={{
            padding: '8px 16px', borderRadius: 100, border: `1.5px solid ${COLORS.black}`,
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            background: COLORS.orange, marginBottom: 20,
          }}>
            Max: ${pos.current.toFixed(2)}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('select')} style={{
              flex: 1, padding: '14px 0', borderRadius: 100, border: `2px solid ${COLORS.black}`,
              background: COLORS.white, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            }}>Back</button>
            <Button onClick={() => setStep('confirm')} disabled={numAmount <= 0 || numAmount > pos.current} style={{ flex: 2 }}>
              Next
            </Button>
          </div>
        </>
      )}

      {/* Confirm */}
      {step === 'confirm' && pos && (
        <>
          <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
            Confirm withdrawal
          </div>
          <div style={{
            background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 12, padding: 16, marginBottom: 20,
          }}>
            {[
              ['From', pos.name],
              ['Amount', `$${numAmount.toFixed(2)}`],
              ['Receive', `${pos.token} on ${pos.chain}`],
              ['Gas', '<$1'],
            ].map(([k, v], i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: i < 3 ? `1px solid ${COLORS.lightGray}` : 'none',
              }}>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{v}</span>
              </div>
            ))}
          </div>

          {!embeddedWallet && (
            <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
              Wallet not connected. Please reconnect.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('amount')} style={{
              flex: 1, padding: '14px 0', borderRadius: 100, border: `2px solid ${COLORS.black}`,
              background: COLORS.white, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            }}>Back</button>
            <Button onClick={handleConfirm} disabled={!embeddedWallet} style={{ flex: 2 }}>Confirm &amp; sign</Button>
          </div>
        </>
      )}

      {/* Approving */}
      {step === 'approving' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 800, fontSize: 14 }}>Approving token spend...</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Confirm in your wallet</div>
        </div>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 800, fontSize: 14 }}>Processing withdrawal...</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Signing transaction</div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && pos && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="pop-in" style={{
            width: 56, height: 56, borderRadius: 16, background: COLORS.success,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808',
          }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <path d="M6 13L10 17L18 8" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Withdrawn</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            ${numAmount.toFixed(2)} {pos.token} sent to your wallet
          </div>

          {txHash && (
            <a href={txHash.explorer} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#3B82F6', marginTop: 8, textDecoration: 'none' }}>
              View on explorer: {txHash.hash.slice(0, 10)}...{txHash.hash.slice(-6)}
              <svg width={10} height={10} viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H5M9 3V7" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          )}

          <div style={{ marginTop: 20 }}>
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}

      {/* Error */}
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
