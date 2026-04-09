'use client';

import { useState } from 'react';
import { COLORS } from '@/constants/theme';
import { Badge, Button } from '@/components/ui';
import BottomSheet from './BottomSheet';

// Simple QR code as SVG (generates a visual representation)
function QRPlaceholder({ data, size = 160 }: { data: string; size?: number }) {
  // Generate deterministic pattern from address
  const cells = 21;
  const cellSize = size / cells;
  const hash = Array.from(data).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);

  const grid: boolean[][] = [];
  for (let y = 0; y < cells; y++) {
    grid[y] = [];
    for (let x = 0; x < cells; x++) {
      // Always fill finder patterns (corners)
      const isFinderTL = x < 7 && y < 7;
      const isFinderTR = x >= cells - 7 && y < 7;
      const isFinderBL = x < 7 && y >= cells - 7;

      if (isFinderTL || isFinderTR || isFinderBL) {
        const lx = isFinderTR ? x - (cells - 7) : x;
        const ly = isFinderBL ? y - (cells - 7) : y;
        const isBorder = lx === 0 || lx === 6 || ly === 0 || ly === 6;
        const isInner = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
        grid[y][x] = isBorder || isInner;
      } else {
        // Pseudo-random fill based on address hash
        const seed = (hash + x * 31 + y * 37 + x * y * 13) & 0xFFFF;
        grid[y][x] = (seed % 3) === 0;
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx="8" />
      {grid.map((row, y) =>
        row.map((filled, x) =>
          filled ? <rect key={`${x}-${y}`} x={x * cellSize + 1} y={y * cellSize + 1} width={cellSize - 1} height={cellSize - 1} fill={COLORS.black} /> : null
        )
      )}
    </svg>
  );
}

const SUPPORTED_CHAINS = [
  { name: 'Base', color: '#0052FF' },
  { name: 'Arbitrum', color: '#28A0F0' },
  { name: 'Ethereum', color: '#627EEA' },
  { name: 'Optimism', color: '#FF0420' },
  { name: 'Polygon', color: '#8247E5' },
];

export default function FundWalletSheet({ open, onClose, address }: { open: boolean; onClose: () => void; address: string }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Fund your wallet">
      <div style={{ textAlign: 'center' }}>
        {/* QR Code */}
        <div style={{
          display: 'inline-block', padding: 12, background: COLORS.white,
          border: `2px solid ${COLORS.black}`, borderRadius: 16, boxShadow: '3px 3px 0 #080808',
          marginBottom: 16,
        }}>
          {address ? <QRPlaceholder data={address} size={160} /> : (
            <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No wallet</div>
          )}
        </div>

        {/* Address */}
        <div style={{
          background: COLORS.lightGray, borderRadius: 12, padding: '12px 14px',
          marginBottom: 12, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all',
          border: `2px solid ${COLORS.black}`, textAlign: 'left',
        }}>
          {address || 'Connect wallet first'}
        </div>

        <Button onClick={copyAddress} style={{ marginBottom: 20 }}>
          {copied ? 'Copied' : 'Copy address'}
        </Button>

        {/* Instructions */}
        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            How to fund
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 12 }}>
            Send USDC, USDT, or DAI to this address on any supported chain. Lingo will detect your balance automatically.
          </div>

          {/* Supported chains */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUPPORTED_CHAINS.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                borderRadius: 8, border: `1.5px solid ${COLORS.black}`, background: COLORS.white,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: c.color }} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div style={{
          background: COLORS.orange + '10', border: `1.5px solid ${COLORS.orange}`,
          borderRadius: 12, padding: 14, textAlign: 'left',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.orangeDark, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            Tip
          </div>
          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>
            Sending on Base or Arbitrum costs less than $0.01 in gas. Ethereum mainnet costs $2-5. For small amounts, use L2s.
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
