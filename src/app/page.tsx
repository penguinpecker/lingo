'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { COLORS } from '@/constants/theme';

export default function Splash() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setProgress(p => Math.min(p + 2, 100)), 30);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => {
      if (authenticated) {
        const onboarded = typeof window !== 'undefined' && localStorage.getItem('lingo_hasOnboarded');
        router.replace(onboarded ? '/home' : '/onboarding');
      } else {
        router.replace('/auth');
      }
    }, 1800);
    return () => clearTimeout(timeout);
  }, [ready, authenticated, router]);

  return (
    <div style={{
      minHeight: '100dvh', background: COLORS.black,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Logo badge */}
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: COLORS.orange, border: `2px solid ${COLORS.white}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `4px 4px 0 ${COLORS.orange}40`,
      }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: COLORS.black }}>L</span>
      </div>

      <div style={{
        marginTop: 16, fontWeight: 900, fontSize: 20, color: COLORS.white,
        textTransform: 'uppercase', letterSpacing: 3,
      }}>
        Lingo
      </div>

      {/* Loading bar */}
      <div style={{
        width: 120, height: 3, background: '#333', borderRadius: 2,
        marginTop: 32, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: COLORS.orange, borderRadius: 2,
          width: `${progress}%`, transition: 'width 0.1s',
        }} />
      </div>

      <div style={{
        marginTop: 16, fontSize: 10, color: '#555',
        textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Powered by LI.FI
      </div>
    </div>
  );
}
