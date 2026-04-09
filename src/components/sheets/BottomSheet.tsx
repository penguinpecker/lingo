'use client';

import { ReactNode, useEffect } from 'react';
import { COLORS } from '@/constants/theme';

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  fullScreen = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: fullScreen ? 'stretch' : 'flex-end', justifyContent: 'center',
    }}>
      <div
        onClick={onClose}
        className="sheet-backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        className="sheet-content"
        style={{
          background: COLORS.white,
          borderRadius: fullScreen ? 0 : '24px 24px 0 0',
          padding: 24,
          paddingBottom: fullScreen ? 24 : 'calc(24px + env(safe-area-inset-bottom))',
          width: '100%', maxWidth: 480,
          position: 'relative', zIndex: 1,
          maxHeight: fullScreen ? '100%' : '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          width: 40, height: 4, background: COLORS.gray, borderRadius: 2,
          margin: '0 auto 20px',
        }} />
        {title && (
          <div style={{
            fontWeight: 900, fontSize: 18, color: COLORS.black,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20,
          }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
