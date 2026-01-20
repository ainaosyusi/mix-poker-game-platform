// ========================================
// Mix Poker - PotDisplay Component
// ポット表示コンポーネント（インラインスタイル版）
// ========================================

import { memo } from 'react';
import { ChipStack } from '../chips/ChipStack';

interface SidePot {
  amount: number;
  eligible?: string[];
}

interface PotDisplayProps {
  mainPot: number;
  sidePots: SidePot[];
  style?: React.CSSProperties;
}

export const PotDisplay = memo(function PotDisplay({
  mainPot,
  sidePots,
  style
}: PotDisplayProps) {
  const totalPot = mainPot + sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  const hasSidePots = sidePots.length > 0 && sidePots.some(sp => sp.amount > 0);

  if (totalPot === 0) return null;

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {/* チップスタック */}
      <div style={{ marginBottom: 4 }}>
        <ChipStack amount={totalPot} showLabel={false} />
      </div>

      {/* メインポット */}
      <div
        style={{
          background: 'rgba(15, 46, 58, 0.9)',
          padding: '4px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: '#9ca3af',
            fontSize: 10,
            fontWeight: 500,
          }}
        >
          Main Pot
        </span>
        <span
          style={{
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          ${mainPot.toLocaleString()}
        </span>
      </div>

      {/* サイドポット */}
      {hasSidePots && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {sidePots.map((sp, i) => (
            sp.amount > 0 && (
              <div
                key={`sidepot-${i}`}
                style={{
                  background: 'rgba(146, 64, 14, 0.8)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(202, 138, 4, 0.3)',
                  fontSize: 9,
                }}
              >
                <span style={{ color: '#fcd34d' }}>Side {i + 1}: </span>
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>${sp.amount.toLocaleString()}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
});

export default PotDisplay;
