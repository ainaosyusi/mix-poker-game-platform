// ========================================
// Mix Poker - PlayerSeat Component
// プレイヤー席コンポーネント
// ========================================

import React, { memo } from 'react';
import type { Player } from '../../types/table';

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

        {/* ステータス */}
        <div className={`player-status ${player.status.toLowerCase()}`}>
          {player.status === 'ALL_IN' && <span className="status-badge all-in">ALL IN</span>}
          {player.status === 'FOLDED' && <span className="status-badge folded">FOLD</span>}
          {player.status === 'SIT_OUT' && <span className="status-badge sit-out">離席中</span>}
        </div>
      </div>

      {/* アクティブインジケーター */}
      {isActive && (
        <div className="active-indicator">
          <div className="active-glow" />
        </div>
      )}
    </div>
  );
});

// プレイヤーベット表示コンポーネント
interface PlayerBetProps {
  amount: number;
  style: React.CSSProperties;
}

export const PlayerBet = memo(function PlayerBet({ amount, style }: PlayerBetProps) {
  if (amount <= 0) return null;

  return (
    <div className="player-bet" style={style}>
      <div className="bet-chips">
        {/* 簡略化したチップ表示 */}
        <div className="chip-stack-visual">
          <div className="chip" />
        </div>
        <span className="bet-amount-text">{amount.toLocaleString()}</span>
      </div>
    </div>
  );
});

export default PlayerSeat;
