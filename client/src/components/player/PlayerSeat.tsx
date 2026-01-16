// ========================================
// Mix Poker - PlayerSeat Component
// プレイヤー席コンポーネント
// ========================================

import React, { memo } from 'react';
import type { Player } from '../../types/table';
import { Card } from '../cards/Card';

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isYou: boolean;
  isSelected?: boolean;
  style: React.CSSProperties;
  onSeatClick?: () => void;
}

export const PlayerSeat = memo(function PlayerSeat({
  player,
  seatIndex,
  isActive,
  isDealer,
  isSB,
  isBB,
  isYou,
  isSelected = false,
  style,
  onSeatClick,
}: PlayerSeatProps) {
  const isFolded = player?.status === 'FOLDED';
  const isAllIn = player?.status === 'ALL_IN';

  // 空席
  if (!player) {
    return (
      <div
        className={`player-seat empty ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={onSeatClick}
      >
        <div className="empty-seat-content">
          {isSelected ? (
            <span className="selected-indicator">選択中</span>
          ) : (
            <span className="seat-number">空席 {seatIndex + 1}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`player-seat ${isActive ? 'active' : ''} ${isYou ? 'is-you' : ''} ${isFolded ? 'folded' : ''} ${isAllIn ? 'all-in' : ''}`}
      style={style}
    >
      {/* ディーラーボタン */}
      {isDealer && <div className="dealer-btn">D</div>}

      {/* SB/BBマーカー */}
      {isSB && <div className="position-marker sb-marker">SB</div>}
      {isBB && <div className="position-marker bb-marker">BB</div>}

      {/* プレイヤー情報 */}
      <div className="player-info">
        {/* アバター */}
        <div className={`player-avatar ${isFolded ? 'dimmed' : ''}`}>
          {isYou ? '👤' : '🎭'}
        </div>

        {/* 詳細情報 */}
        <div className="player-details">
          {/* 名前 */}
          <div className={`player-name ${isYou ? 'is-you' : ''}`}>
            {player.name}
            {isYou && <span className="you-indicator">(you)</span>}
          </div>

          {/* スタック */}
          <div className="player-stack">
            <span className="chip-icon">💰</span>
            <span className="stack-amount">{player.stack.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Stud Up Cards（他プレイヤーの公開カード） */}
      {player.studUpCards && player.studUpCards.length > 0 && (
        <div className="stud-up-cards">
          {player.studUpCards.map((card, i) => (
            <Card key={i} card={card} size="small" />
          ))}
        </div>
      )}

      {/* ステータス（フォールド/オールイン時のみ） */}
      {(player.status === 'ALL_IN' || player.status === 'FOLDED' || player.status === 'SIT_OUT') && (
        <div className={`player-status ${player.status.toLowerCase()}`}>
          {player.status === 'ALL_IN' && <span className="status-badge all-in">ALL IN</span>}
          {player.status === 'FOLDED' && <span className="status-badge folded">FOLD</span>}
          {player.status === 'SIT_OUT' && <span className="status-badge sit-out">離席中</span>}
        </div>
      )}

      {/* アクティブインジケーター */}
      {isActive && (
        <div className="active-indicator">
          <div className="active-glow" />
        </div>
      )}
    </div>
  );
});

// チップの色と枚数を金額から計算
function getChipVisuals(amount: number): { colors: string[]; count: number } {
  // チップ色: 黒(1), 緑(5), 青(10), 赤(25), 紫(100), 黄(500), 白(1000)
  const chipColors = {
    1: '#1a1a1a',     // 黒
    5: '#22c55e',     // 緑
    10: '#3b82f6',    // 青
    25: '#ef4444',    // 赤
    100: '#a855f7',   // 紫
    500: '#eab308',   // 黄/ゴールド
    1000: '#f8fafc',  // 白
  };

  const denominations = [1000, 500, 100, 25, 10, 5, 1];
  const colors: string[] = [];
  let remaining = amount;

  for (const denom of denominations) {
    while (remaining >= denom && colors.length < 5) {
      colors.push(chipColors[denom as keyof typeof chipColors]);
      remaining -= denom;
    }
    if (colors.length >= 5) break;
  }

  // 最低1枚は表示
  if (colors.length === 0) {
    colors.push(chipColors[1]);
  }

  return { colors, count: colors.length };
}

// プレイヤーベット表示コンポーネント
interface PlayerBetProps {
  amount: number;
  style: React.CSSProperties;
}

export const PlayerBet = memo(function PlayerBet({ amount, style }: PlayerBetProps) {
  if (amount <= 0) return null;

  const { colors } = getChipVisuals(amount);

  return (
    <div className="player-bet" style={style}>
      <div className="bet-chips">
        <div className="chip-stack-visual">
          {colors.map((color, i) => (
            <div
              key={i}
              className="chip"
              style={{
                backgroundColor: color,
                transform: `translateY(${-i * 3}px)`,
                zIndex: colors.length - i,
                border: color === '#f8fafc' ? '2px solid #94a3b8' : '2px solid rgba(0,0,0,0.3)',
              }}
            />
          ))}
        </div>
        <span className="bet-amount-text">{amount.toLocaleString()}</span>
      </div>
    </div>
  );
});

export default PlayerSeat;
