'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COLORS } from '@/constants/theme';
import { useStore } from '@/lib/store';

const STEPS = [
  {
    title: 'TALK, DON\'T TAP',
    text: 'Tell Lingo what you want in your language. "I want to save 500 dollars safely" — that\'s all it takes.',
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="10" width="48" height="32" rx="8" stroke={COLORS.lavender} strokeWidth="3" />
        <path d="M20 50L30 42H8" stroke={COLORS.lavender} strokeWidth="3" strokeLinejoin="round" />
        <path d="M22 26H42" stroke={COLORS.orange} strokeWidth="3" strokeLinecap="round" />
        <path d="M22 32H36" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: 'WE PICK THE BEST',
    text: 'Lingo scans 672+ vaults across 21 chains. Compares rates, checks safety, picks the winner. You don\'t need to know what USDC or Morpho means.',
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="6" y="18" width="24" height="30" rx="4" stroke={COLORS.gray} strokeWidth="2" />
        <rect x="20" y="12" width="24" height="30" rx="4" stroke={COLORS.warning} strokeWidth="2" />
        <rect x="34" y="6" width="24" height="30" rx="4" stroke={COLORS.success} strokeWidth="3" />
        <path d="M40 18L44 22L52 14" stroke={COLORS.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'ONE TAP TO EARN',
    text: 'Confirm once. Your money starts earning instantly. Track earnings anytime, withdraw whenever you want.',
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="28" r="18" stroke={COLORS.orange} strokeWidth="3" />
        <path d="M32 20V28L38 32" stroke={COLORS.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 46L32 54L40 46" stroke={COLORS.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 44V54" stroke={COLORS.success} strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const setOnboarded = useStore(s => s.setOnboarded);

  const finish = () => {
    setOnboarded();
    router.replace('/home');
  };

  return (
    <div style={{
      minHeight: '100dvh', background: COLORS.lightGray,
      display: 'flex', flexDirection: 'column', padding: 24,
    }}>
      {/* Skip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={finish} style={{
          fontSize: 12, color: '#888', textDecoration: 'underline', cursor: 'pointer',
          background: 'none', border: 'none', fontFamily: 'inherit',
        }}>Skip</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{
          width: 100, height: 100, borderRadius: 24, background: COLORS.white,
          border: `2px solid ${COLORS.black}`, boxShadow: '3px 3px 0 #080808',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32,
        }}>
          {STEPS[step].icon}
        </div>
        <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          {STEPS[step].title}
        </div>
        <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 300 }}>
          {STEPS[step].text}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 8, borderRadius: 4,
            background: i === step ? COLORS.orange : COLORS.gray,
            border: `1.5px solid ${COLORS.black}`,
            transition: 'all 0.2s',
          }} />
        ))}
      </div>

      {/* Button */}
      <button onClick={() => step < 2 ? setStep(step + 1) : finish()} style={{
        width: '100%', background: COLORS.orange, color: COLORS.black,
        border: `2px solid ${COLORS.black}`, borderRadius: 100, padding: '16px 0',
        fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
        boxShadow: '3px 3px 0 #080808', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        {step < 2 ? 'Next' : 'Get started'}
      </button>
    </div>
  );
}
