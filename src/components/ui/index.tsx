import { ReactNode } from 'react';
import { COLORS, PROTOCOL_NAMES } from '@/constants/theme';

// ─── VAULT BADGE (letter in colored square) ──────────────────
export function VaultBadge({ letter, color, size = 24 }: { letter: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.38, color: COLORS.black,
      letterSpacing: -0.5, border: `1.5px solid ${COLORS.black}`, flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

// ─── BADGE (small pill label) ────────────────────────────────
export function Badge({ children, bg, color: cl }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color: cl, fontSize: 9, fontWeight: 800,
      padding: '3px 8px', borderRadius: 4, letterSpacing: 1,
      textTransform: 'uppercase', border: `1.5px solid ${COLORS.black}`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ─── PROGRESS RING ───────────────────────────────────────────
export function ProgressRing({ progress, size = 48, sw = 4, color = COLORS.orange }: { progress: number; size?: number; sw?: number; color?: string }) {
  const r = (size - sw) / 2;
  const ci = r * 2 * Math.PI;
  const off = ci - (Math.min(100, Math.max(0, progress)) / 100) * ci;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.gray} strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  );
}

// ─── SPARKLINE ───────────────────────────────────────────────
export function Sparkline({ data, color = COLORS.success, w = 100, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── MINI BAR CHART ──────────────────────────────────────────
export function MiniBarChart({ data, labels, colors, w = 280, h = 60 }: { data: number[]; labels: string[]; colors: string[]; w?: number; h?: number }) {
  const max = Math.max(...data);
  const bw = Math.min(28, (w - 20) / data.length - 4);
  return (
    <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 10);
        const x = 10 + i * ((w - 20) / data.length);
        return (
          <g key={i}>
            <rect x={x} y={h - bh} width={bw} height={bh} rx={3} fill={colors?.[i] || COLORS.orange} />
            <text x={x + bw / 2} y={h + 14} textAnchor="middle" fontSize="8" fontWeight="700" fill="#888" fontFamily="inherit">
              {labels?.[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── ALLOCATION DONUT ────────────────────────────────────────
export function AllocationDonut({ segments, size = 56 }: { segments: { weight: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.weight, 0);
  const r = size * 0.4;
  const ci = r * 2 * Math.PI;
  let cum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.lightGray} strokeWidth={size * 0.14} />
      {segments.map((seg, i) => {
        const len = (seg.weight / total) * ci;
        const rot = (cum / total) * 360;
        cum += seg.weight;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color}
            strokeWidth={size * 0.14} strokeDasharray={`${len} ${ci - len}`} strokeDashoffset={0}
            style={{ transform: `rotate(${rot}deg)`, transformOrigin: 'center', transition: 'all 0.5s' }} />
        );
      })}
    </svg>
  );
}

// ─── STRATEGY BAR ────────────────────────────────────────────
export function StrategyBar({ allocations }: { allocations: { weight: number; color: string }[] }) {
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
      {allocations.map((a, i) => (
        <div key={i} style={{
          height: '100%', background: a.color, flex: a.weight,
          borderRadius: i === 0 ? '3px 0 0 3px' : i === allocations.length - 1 ? '0 3px 3px 0' : '0',
        }} />
      ))}
    </div>
  );
}

// ─── SECTION LABEL ───────────────────────────────────────────
export function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase',
      letterSpacing: 1.2, marginBottom: 10, marginTop: 20,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {icon}
      {children}
    </div>
  );
}

// ─── CARD ────────────────────────────────────────────────────
export function Card({ children, variant = 'default', onClick, style: s }: {
  children: ReactNode;
  variant?: 'default' | 'dark' | 'outlined';
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const bg = variant === 'dark' ? COLORS.black : variant === 'outlined' ? 'transparent' : COLORS.white;
  const border = variant === 'outlined' ? `2px dashed ${COLORS.black}` : `2px solid ${COLORS.black}`;
  return (
    <div onClick={onClick} style={{
      background: bg, border, borderRadius: 16, padding: 16,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', ...s,
    }}>
      {children}
    </div>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', disabled, style: s }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const bg = disabled ? COLORS.gray : variant === 'primary' ? COLORS.orange : variant === 'secondary' ? COLORS.black : COLORS.white;
  const color = disabled ? '#888' : variant === 'secondary' ? COLORS.white : COLORS.black;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, color, border: `2px solid ${COLORS.black}`, borderRadius: 100,
      padding: '12px 20px', fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : `2px 2px 0 ${COLORS.black}`,
      textTransform: 'uppercase', letterSpacing: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      width: '100%', ...s,
    }}>
      {children}
    </button>
  );
}

// ─── PROTOCOL NAME (normie-friendly) ─────────────────────────
export function protocolDisplayName(protocol: string): string {
  return PROTOCOL_NAMES[protocol] || protocol.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
