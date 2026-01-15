// ========================================
// Mix Poker - PotDisplay Component
// ポット表示コンポーネント
// ========================================

import React, { memo } from 'react';

interface SidePot {
  amount: number;
  eligible?: string[];
}

interface PotDisplayProps {
  mainPot: number;
  sidePots: SidePot[];
  style: React.CSSProperties;
}

export const PotDisplay = memo(function PotDisplay({
  mainPot,
  sidePots,
  style
}: PotDisplayProps) {
  const totalPot = mainPot + sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  const hasSidePots = sidePots.length > 0 && sidePots.some(sp => sp.amount > 0);

  return (
    <div className="pot-display" style={style}>
      {/* チップスタック表示 */}
      <div className="pot-chips">
        <div className="chip-pile">
          <div className="chip chip-green" />
          <div className="chip chip-blue" style={{ marginTop: '-6px' }} />
          <div className="chip chip-red" style={{ marginTop: '-6px' }} />
        </div>
      </div>

      {/* ポット額 */}
      <div className="pot-info">
        <div className="pot-label">POT</div>
        <div className="pot-amount">{totalPot.toLocaleString()}</div>

        {/* サイドポット表示 */}
        {hasSidePots && (
          <div className="side-pots">
            {sidePots.map((sp, i) => (
              sp.amount > 0 && (
                <div key={`sidepot-${i}`} className="side-pot">
                  <span className="side-pot-label">Side {i + 1}:</span>
                  <span className="side-pot-amount">{sp.amount.toLocaleString()}</span>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default PotDisplay;
