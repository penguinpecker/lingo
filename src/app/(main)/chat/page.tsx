'use client';
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback } from 'react';
import { COLORS, LANGUAGES, RISK_TIERS } from '@/constants/theme';
import { VaultBadge, Badge, Button } from '@/components/ui';
import DepositSheet from '@/components/sheets/DepositSheet';
import { useStore } from '@/lib/store';
import type { Strategy, StrategyAllocation } from '@/lib/lifi/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  strategies?: Strategy[] | null;
}

const SUGGESTED: Record<string, string[]> = {
  en: ['Save 500 dollars safely', 'Show my earnings', "What's the best rate right now?", 'Withdraw everything'],
  hi: ['500 \u0921\u0949\u0932\u0930 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0930\u0916\u094B', '\u092E\u0947\u0930\u0940 \u0915\u092E\u093E\u0908 \u0926\u093F\u0916\u093E\u0913', '\u0938\u092C\u0938\u0947 \u0905\u091A\u094D\u091B\u0940 \u0926\u0930 \u0915\u094D\u092F\u093E \u0939\u0948?', '\u0938\u092C \u0928\u093F\u0915\u093E\u0932\u094B'],
  es: ['Guardar 500 d\u00F3lares seguro', 'Mostrar ganancias', '\u00BFMejor tasa ahora?', 'Retirar todo'],
  pt: ['Guardar 500 d\u00F3lares com seguran\u00E7a', 'Mostrar ganhos', 'Melhor taxa agora?', 'Retirar tudo'],
  id: ['Simpan 500 dolar dengan aman', 'Tampilkan penghasilan', 'Rate terbaik sekarang?', 'Tarik semua'],
  zh: ['\u5B89\u5168\u50A8\u84C4500\u7F8E\u5143', '\u67E5\u770B\u6536\u76CA', '\u6700\u4F73\u5229\u7387\u662F\u591A\u5C11\uFF1F', '\u5168\u90E8\u63D0\u53D6'],
};

export default function ChatPage() {
  const language = useStore(s => s.language);
  const setLanguage = useStore(s => s.setLanguage);
  const walletAddress = useStore(s => s.walletAddress);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [depositStrat, setDepositStrat] = useState<Strategy | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const lang = language || 'en';
  const suggested = SUGGESTED[lang] || SUGGESTED.en;

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          language: lang,
          walletAddress,
        }),
      });

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Sorry, I had trouble connecting. Please try again.',
        strategies: data.strategies,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: lang === 'hi' ? '\u0915\u0941\u091B \u0917\u0921\u093C\u092C\u0921\u093C \u0939\u094B \u0917\u0908\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964' : 'Something went wrong. Please try again.',
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, lang, walletAddress]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 48px - 64px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `2px solid ${COLORS.black}`, background: COLORS.white }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: COLORS.lavender, border: `1.5px solid ${COLORS.black}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2.5" stroke="#FFF" strokeWidth="1.5" /><path d="M2 11C2 8.79 3.79 7 6 7C8.21 7 10 8.79 10 11" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Lingo AI</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowLang(!showLang)} style={{ background: COLORS.lightGray, border: `1.5px solid ${COLORS.black}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}>
            {LANGUAGES.find(l => l.code === lang)?.native || 'EN'}
          </button>
          {showLang && (
            <div style={{ position: 'absolute', right: 0, top: 32, background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 10, boxShadow: '3px 3px 0 #080808', zIndex: 10, overflow: 'hidden', minWidth: 120 }}>
              {LANGUAGES.map(l => (
                <div key={l.code} onClick={() => { setLanguage(l.code); setShowLang(false); }}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: lang === l.code ? 800 : 500, background: lang === l.code ? COLORS.orange + '30' : 'transparent', borderBottom: `1px solid ${COLORS.gray}` }}>
                  <span style={{ fontWeight: 800, marginRight: 6 }}>{l.native}</span>{l.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: COLORS.lavender, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808', marginBottom: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: COLORS.white }}>L</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Talk to Lingo</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
              Tell me what you want in any language.<br />I&apos;ll find the best way to grow your money.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {suggested.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{ padding: '8px 14px', borderRadius: 100, border: `1.5px solid ${COLORS.black}`, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: COLORS.white, boxShadow: '1.5px 1.5px 0 #080808' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: m.role === 'user' ? COLORS.black : COLORS.white, color: m.role === 'user' ? COLORS.white : COLORS.black, border: m.role === 'user' ? 'none' : `2px solid ${COLORS.black}`, boxShadow: m.role === 'user' ? 'none' : '2px 2px 0 #080808', fontSize: 13, lineHeight: 1.5 }}>
                {m.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <VaultBadge letter="L" color={COLORS.orange} size={18} />
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#888' }}>Lingo</span>
                  </div>
                )}
                {m.content}
              </div>
            </div>

            {/* Strategy cards from AI */}
            {m.strategies && Array.isArray(m.strategies) && m.strategies.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {m.strategies.map((s: any, si: number) => {
                  const riskIdx = si;
                  const t = RISK_TIERS[riskIdx] || RISK_TIERS[0];
                  return (
                    <div key={si} style={{ background: COLORS.white, border: `2px solid ${COLORS.black}`, borderRadius: 14, padding: 14, boxShadow: '2px 2px 0 #080808', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <VaultBadge letter={s.name?.charAt(0) || 'S'} color={t.color} size={26} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13 }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>{s.vaults?.length || 0} vaults &middot; {s.protocolCount || 0} protocols</div>
                          </div>
                        </div>
                        <Badge bg={t.color + '25'} color={t.color}>{t.label}</Badge>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Net rate</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{s.netApy}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Monthly</div>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>${s.monthlyEarn}</div>
                        </div>
                      </div>
                      {s.vaults && (
                        <div style={{ fontSize: 10, color: '#666', marginBottom: 10, lineHeight: 1.5 }}>
                          {s.vaults.map((v: any) => `${v.weight}% ${v.name}`).join(' + ')}
                        </div>
                      )}
                      <Button onClick={() => { /* TODO: map to full Strategy type */ }} style={{ fontSize: 12, padding: '10px 0' }}>
                        Pick this one
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '12px 18px', borderRadius: 14, background: COLORS.white, border: `2px solid ${COLORS.black}`, boxShadow: '2px 2px 0 #080808', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (<div key={i} className="dot-bounce" style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.lavender }} />))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: `2px solid ${COLORS.black}`, background: COLORS.white }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim() && !isTyping) sendMessage(input.trim()); }}
          placeholder={lang === 'hi' ? '\u0905\u092A\u0928\u093E \u0938\u0902\u0926\u0947\u0936 \u091F\u093E\u0907\u092A \u0915\u0930\u0947\u0902...' : lang === 'es' ? 'Escribe tu mensaje...' : 'Type your message...'}
          style={{ flex: 1, padding: '10px 14px', border: `2px solid ${COLORS.black}`, borderRadius: 12, fontSize: 13, fontFamily: 'inherit' }} />
        <button onClick={() => { if (input.trim() && !isTyping) sendMessage(input.trim()); }}
          disabled={!input.trim() || isTyping}
          style={{ width: 42, height: 42, background: input.trim() && !isTyping ? COLORS.orange : COLORS.gray, border: `2px solid ${COLORS.black}`, borderRadius: 12, cursor: 'pointer', boxShadow: input.trim() ? '2px 2px 0 #080808' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L13 6M19 12L13 18" stroke={COLORS.black} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-90 12 12)" /></svg>
        </button>
      </div>

      <DepositSheet open={showDeposit} onClose={() => setShowDeposit(false)} strategy={depositStrat} />
    </div>
  );
}
