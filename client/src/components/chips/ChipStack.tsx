// ========================================
// Mix Poker - ChipStack Component
// 3Dチップスタック表現
// ========================================

import { memo } from 'react';

// チップの色定義
const CHIP_COLORS: Record<number, { bg: string; border: string; accent: string; text: string }> = {
  1: { bg: '#ffffff', border: '#cbd5e1', accent: '#1e293b', text: '#1e293b' },
  5: { bg: '#dc2626', border: '#991b1b', accent: '#ffffff', text: '#7f1d1d' },
  25: { bg: '#16a34a', border: '#14532d', accent: '#fbbf24', text: '#14532d' },
  100: { bg: '#1f2937', border: '#000000', accent: '#e5e7eb', text: '#000000' },
  500: { bg: '#7c3aed', border: '#4c1d95', accent: '#f9a8d4', text: '#4c1d95' },
  1000: { bg: '#eab308', border: '#a16207', accent: '#000000', text: '#eab308' },
};

// 金額をチップの配列に変換
const getChipsFromAmount = (amount: number): number[] => {
  const denominations = [1000, 500, 100, 25, 5, 1];
  let remaining = amount;
  const chips: number[] = [];

  for (const val of denominations) {
    const count = Math.floor(remaining / val);
    for (let i = 0; i < Math.min(count, 6); i++) {
      chips.push(val);
    }
    remaining -= count * val;
    if (chips.length > 8) break;
  }

  return chips.reverse();
};

// 単体チップ
interface PokerChipProps {
  value: number;
  index: number;
}

const PokerChip = memo(function PokerChip({ value, index }: PokerChipProps) {
  const colors = CHIP_COLORS[value] || CHIP_COLORS[1];
  const offsetY = -index * 3;

  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${offsetY}px)`,
        zIndex: index,
      }}
    >
      {/* 影 */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)',
          filter: 'blur(1px)',
        }}
      />

      {/* 側面 */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: colors.border,
        }}
      />

      {/* 表面 */}
      <div
        style={{
          position: 'relative',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: colors.bg,
          border: `2px dashed ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)',
        }}
      >
        {/* インレイ */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: colors.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          <span
            style={{
              fontSize: 5,
              fontWeight: 'bold',
              color: colors.text,
              lineHeight: 1,
            }}
          >
            {value >= 1000 ? '1k' : value}
          </span>
        </div>

        {/* ハイライト */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
});

// チップスタック
interface ChipStackProps {
  amount: number;
  className?: string;
  showLabel?: boolean;
  animate?: 'bet' | 'win' | null;
}

export const ChipStack = memo(function ChipStack({
  amount,
  showLabel = true,
  animate = null,
}: ChipStackProps) {
  if (amount === 0) return null;
  const chips = getChipsFromAmount(amount);

  // アニメーションスタイル
  const getAnimationStyle = (): React.CSSProperties => {
    if (animate === 'bet') {
      return {
        animation: 'chipBetIn 0.35s ease-out',
      };
    }
    if (animate === 'win') {
      return {
        animation: 'winnerGlow 1.5s ease-in-out infinite',
      };
    }
    return {};
  };

  return (
    <div
      style={{
        position: 'relative',
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        ...getAnimationStyle(),
      }}
    >
      {chips.map((val, idx) => (
        <PokerChip key={idx} value={val} index={idx} />
      ))}
      {/* 金額ラベル */}
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: -16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 10,
            color: '#ffffff',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
            zIndex: 50,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          ${amount.toLocaleString()}
        </div>
      )}
      {/* アニメーション用のインラインstyle */}
      <style>{`
        @keyframes chipBetIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(-20px);
          }
          60% {
            opacity: 1;
            transform: scale(1.15) translateY(3px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

export default ChipStack;
