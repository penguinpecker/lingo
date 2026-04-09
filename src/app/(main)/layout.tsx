'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { COLORS } from '@/constants/theme';
import BottomNav from '@/components/BottomNav';
import AccountSheet from '@/components/sheets/AccountSheet';
import { useStore } from '@/lib/store';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const setAuth = useStore(s => s.setAuth);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace('/auth');
    if (ready && authenticated) {
      const wallet = user?.wallet?.address || null;
      setAuth(true, wallet);
    }
  }, [ready, authenticated, user, router, setAuth]);

  if (!ready) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.lightGray }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.lightGray, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: COLORS.orange, padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `2px solid ${COLORS.black}`,
        paddingTop: 'calc(10px + env(safe-area-inset-top))',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: COLORS.black,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 14, color: COLORS.orange,
            boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
          }}>L</div>
          <span style={{ fontWeight: 900, fontSize: 16, color: COLORS.black, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Lingo
          </span>
        </div>
        <div
          onClick={() => setShowAccount(true)}
          style={{
            width: 28, height: 28, borderRadius: 8, background: COLORS.white,
            border: `1.5px solid ${COLORS.black}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '1.5px 1.5px 0 #080808', position: 'relative', cursor: 'pointer',
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="18" height="14" rx="2" stroke={COLORS.black} strokeWidth="2" />
            <path d="M3 10H21" stroke={COLORS.black} strokeWidth="1.5" />
            <circle cx="17" cy="15" r="1.5" fill={COLORS.black} />
          </svg>
          <div style={{
            position: 'absolute', top: -2, right: -2, width: 8, height: 8,
            borderRadius: 4, background: authenticated ? COLORS.success : COLORS.error,
            border: `1.5px solid ${COLORS.white}`,
          }} />
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: 80, overflow: 'auto' }}>
        {children}
      </main>

      <BottomNav />
      <AccountSheet open={showAccount} onClose={() => setShowAccount(false)} />
    </div>
  );
}
