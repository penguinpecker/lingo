'use client';

import { usePathname, useRouter } from 'next/navigation';
import { COLORS } from '@/constants/theme';

const tabs = [
  {
    id: '/home', label: 'Home',
    icon: (c: string) => <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M4 12L12 4L20 12" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10V20H11V16H13V20H17V10" stroke={c} strokeWidth="2.2" strokeLinejoin="round"/></svg>,
  },
  {
    id: '/chat', label: 'Chat',
    icon: (c: string) => <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="3" stroke={c} strokeWidth="2"/><path d="M8 21L12 17H3" stroke={c} strokeWidth="2" strokeLinejoin="round"/><circle cx="8" cy="11" r="1" fill={c}/><circle cx="12" cy="11" r="1" fill={c}/><circle cx="16" cy="11" r="1" fill={c}/></svg>,
  },
  {
    id: '/earn', label: 'Earn',
    icon: (c: string) => <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M12 3V21M12 3L7 8M12 3L17 8" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 14H19" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/><path d="M3 18H21" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/></svg>,
  },
  {
    id: '/portfolio', label: 'Portfolio',
    icon: (c: string) => <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/></svg>,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = tabs.find(t => pathname.startsWith(t.id))?.id || '/home';

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, background: COLORS.white,
      borderTop: `2px solid ${COLORS.black}`, padding: '6px 16px calc(10px + env(safe-area-inset-bottom))',
      display: 'flex', justifyContent: 'space-around', zIndex: 50,
    }}>
      {tabs.map(t => {
        const a = activeTab === t.id;
        return (
          <div
            key={t.id}
            onClick={() => router.push(t.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, cursor: 'pointer', padding: '4px 12px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: a ? COLORS.orange : 'transparent',
              border: a ? `1.5px solid ${COLORS.black}` : '1.5px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: a ? `2px 2px 0 ${COLORS.black}` : 'none',
            }}>
              {t.icon(a ? COLORS.black : '#888')}
            </div>
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.5, color: a ? COLORS.orange : '#888',
            }}>
              {t.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
