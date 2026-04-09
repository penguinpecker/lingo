'use client';
export const dynamic = 'force-dynamic';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { COLORS } from '@/constants/theme';

export default function AuthPage() {
  const { login, ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      const onboarded = localStorage.getItem('lingo_hasOnboarded');
      router.replace(onboarded ? '/home' : '/onboarding');
    }
  }, [ready, authenticated, router]);

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.lightGray, display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        background: COLORS.orange, padding: '48px 24px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: COLORS.black,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 18, color: COLORS.orange, boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
          }}>L</div>
          <span style={{ fontWeight: 900, fontSize: 18, color: COLORS.black, textTransform: 'uppercase', letterSpacing: 2 }}>
            Lingo
          </span>
        </div>

        <div style={{ fontWeight: 900, fontSize: 28, color: COLORS.black, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.1 }}>
          The smartest<br />savings in<br />DeFi
        </div>
        <div style={{ fontSize: 14, color: COLORS.black, opacity: 0.7, marginTop: 10, lineHeight: 1.5 }}>
          Chat in your language. We find the best rates.<br />Earn up to 18% APY on your dollars.
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {[{ v: '672+', l: 'Vaults' }, { v: '21', l: 'Chains' }, { v: '18%', l: 'Top APY' }].map((s, i) => (
            <div key={i} style={{
              background: COLORS.white, border: `1.5px solid ${COLORS.black}`,
              borderRadius: 100, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600,
            }}>
              <span style={{ fontWeight: 900, color: COLORS.success }}>{s.v}</span>{s.l}
            </div>
          ))}
        </div>
      </div>

      {/* Auth buttons */}
      <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={() => login()}
          style={{
            width: '100%', background: COLORS.orange, color: COLORS.black,
            border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '16px 0',
            fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '3px 3px 0 #080808', textTransform: 'uppercase', letterSpacing: 1,
          }}
        >
          Get started with email
        </button>

        <button
          onClick={() => login()}
          style={{
            width: '100%', background: COLORS.white, color: COLORS.black,
            border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '14px 0',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <button
          onClick={() => login()}
          style={{
            width: '100%', background: COLORS.black, color: COLORS.white,
            border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '14px 0',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><path d="M11.182 5.04C10.618 4.396 9.78 4 9 4c-1.665 0-3 1.466-3 3.27 0 .175.015.347.044.515C4.275 7.67 2.53 6.61 1.345 5.06c-.19.33-.3.713-.3 1.122 0 1.134.568 2.135 1.432 2.72-.528-.017-1.024-.163-1.458-.406v.041c0 1.585 1.112 2.907 2.588 3.207-.27.074-.555.114-.85.114-.208 0-.41-.02-.608-.06.41 1.296 1.603 2.24 3.015 2.266A5.96 5.96 0 011 15.276 8.401 8.401 0 005.552 16.5c5.463 0 8.448-4.58 8.448-8.553 0-.13-.003-.26-.009-.388A6.077 6.077 0 0015.5 5.94a5.874 5.874 0 01-1.716.476 3.018 3.018 0 001.314-1.672 5.972 5.972 0 01-1.896.733A2.982 2.982 0 0011.182 5.04z"/></svg>
          Continue with Apple
        </button>

        <div style={{ flex: 1 }} />

        <p style={{ fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing you agree to our{' '}
          <span style={{ textDecoration: 'underline' }}>Terms</span> &{' '}
          <span style={{ textDecoration: 'underline' }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
