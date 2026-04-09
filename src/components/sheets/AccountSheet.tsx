'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { COLORS, LANGUAGES } from '@/constants/theme';
import { Button, Badge } from '@/components/ui';
import { useStore } from '@/lib/store';
import BottomSheet from './BottomSheet';
import FundWalletSheet from './FundWalletSheet';

export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const language = useStore(s => s.language);
  const setLanguage = useStore(s => s.setLanguage);
  const [showFund, setShowFund] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const wallet = wallets.find(w => w.walletClientType === 'privy');
  const address = wallet?.address || '';
  const email = user?.email?.address || user?.google?.email || '';

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Account">
        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: COLORS.lavender,
            border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 18, color: COLORS.white,
          }}>
            {(email || address).charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            {email && <div style={{ fontWeight: 800, fontSize: 14 }}>{email}</div>}
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Connected via Privy</div>
          </div>
        </div>

        {/* Wallet address */}
        <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Wallet</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: 12,
          background: COLORS.lightGray, borderRadius: 12, border: `2px solid ${COLORS.black}`, marginBottom: 16,
        }}>
          <div style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: COLORS.black }}>
            {address || 'No wallet found'}
          </div>
          {address && (
            <button onClick={copyAddress} style={{
              padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${COLORS.black}`,
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              background: copied ? COLORS.success : COLORS.white, color: copied ? COLORS.white : COLORS.black,
              transition: 'all 0.2s',
            }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>

        {/* Fund wallet */}
        <Button onClick={() => { onClose(); setTimeout(() => setShowFund(true), 300); }} style={{ marginBottom: 12 }}>
          Fund wallet
        </Button>

        {/* Language */}
        <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 }}>Language</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLanguage(l.code)} style={{
              padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${COLORS.black}`,
              fontSize: 12, fontWeight: language === l.code ? 800 : 500, fontFamily: 'inherit', cursor: 'pointer',
              background: language === l.code ? COLORS.orange : COLORS.white,
            }}>
              {l.native} {l.name}
            </button>
          ))}
        </div>

        {/* Links */}
        <div style={{ borderTop: `1px solid ${COLORS.gray}`, paddingTop: 16, marginTop: 8 }}>
          {[
            { label: 'Powered by LI.FI', url: 'https://li.fi' },
            { label: 'Earn API docs', url: 'https://docs.li.fi/earn/overview' },
            { label: 'Privy dashboard', url: 'https://dashboard.privy.io' },
          ].map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', fontSize: 13, color: COLORS.black, textDecoration: 'none',
                borderBottom: i < 2 ? `1px solid ${COLORS.lightGray}` : 'none',
              }}>
              {link.label}
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H5M9 3V7" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          ))}
        </div>

        {/* Logout */}
        <button onClick={() => setShowLogout(true)} style={{
          width: '100%', padding: '14px 0', borderRadius: 100, border: `2px solid ${COLORS.error}`,
          background: 'transparent', color: COLORS.error, fontWeight: 800, fontSize: 13,
          fontFamily: 'inherit', cursor: 'pointer', marginTop: 20,
          textTransform: 'uppercase', letterSpacing: 1,
        }}>
          Log out
        </button>

        {/* Logout confirm */}
        {showLogout && (
          <div style={{
            background: COLORS.errorLight, border: `2px solid ${COLORS.error}`, borderRadius: 14,
            padding: 20, marginTop: 16, textAlign: 'center',
          }}>
            <div style={{ fontWeight: 900, fontSize: 14, textTransform: 'uppercase', marginBottom: 8 }}>Log out?</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
              Your wallet is safely stored by Privy. You can log back in anytime with the same email.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowLogout(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 100, border: `2px solid ${COLORS.black}`,
                background: COLORS.white, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => { logout(); onClose(); }} style={{
                flex: 1, padding: '12px 0', borderRadius: 100, border: `2px solid ${COLORS.error}`,
                background: COLORS.error, color: COLORS.white, fontWeight: 800, fontSize: 13,
                fontFamily: 'inherit', cursor: 'pointer', boxShadow: '2px 2px 0 #080808',
              }}>Log out</button>
            </div>
          </div>
        )}
      </BottomSheet>

      <FundWalletSheet open={showFund} onClose={() => setShowFund(false)} address={address} />
    </>
  );
}
