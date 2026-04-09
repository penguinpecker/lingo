'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { COLORS } from '@/constants/theme';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed', top: 'calc(env(safe-area-inset-top) + 56px)',
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 440, padding: '0 16px',
        zIndex: 200, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {toasts.map(t => {
          const bg = t.type === 'error' ? COLORS.error : t.type === 'success' ? COLORS.success : COLORS.black;
          return (
            <div key={t.id} style={{
              background: bg, color: COLORS.white, padding: '12px 16px',
              borderRadius: 12, border: `2px solid ${COLORS.black}`,
              boxShadow: '3px 3px 0 #080808', fontSize: 13, fontWeight: 700,
              pointerEvents: 'auto', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t.type === 'error' && (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" /></svg>
              )}
              {t.type === 'success' && (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M6 13L10 17L18 8" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
              <span style={{ flex: 1 }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
