// ========================================
// Mix Poker - ActionPanel Component
// アクションパネルコンポーネント
// ========================================

import React, { memo, useState, useCallback } from 'react';
import type { ActionType, ActionPanelProps } from '../../types/table';

export const ActionPanel = memo(function ActionPanel({
  validActions,
  currentBet,
  minRaise,
  maxBet,
  yourBet,
  pot,
  onAction,
}: ActionPanelProps) {
  const [betAmount, setBetAmount] = useState(minRaise);
  const callAmount = currentBet - yourBet;

  // クイックベットボタンの値を計算
  const quickBets = [
    { label: '1/3', value: Math.floor(pot * 0.33) },
    { label: '1/2', value: Math.floor(pot * 0.5) },
    { label: '3/4', value: Math.floor(pot * 0.75) },
    { label: 'POT', value: pot },
  ];

  const handleBetChange = useCallback((value: number) => {
    const clampedValue = Math.max(minRaise, Math.min(maxBet, value));
    setBetAmount(clampedValue);
  }, [minRaise, maxBet]);

  const handleBetAction = useCallback(() => {
    const actionType: ActionType = validActions.includes('BET') ? 'BET' : 'RAISE';
    onAction(actionType, betAmount);
  }, [validActions, betAmount, onAction]);

  const canBetOrRaise = validActions.includes('BET') || validActions.includes('RAISE');

  return (
    <div className="action-panel">
      <div className="action-header">
        <span className="action-title">あなたの番です</span>
        <span className="pot-info-mini">POT: {pot.toLocaleString()}</span>
      </div>

      {/* 基本アクションボタン */}
      <div className="action-buttons-row">
        {validActions.includes('FOLD') && (
          <button
            className="action-btn fold"
            onClick={() => onAction('FOLD')}
          >
            FOLD
          </button>
        )}

        {validActions.includes('CHECK') && (
          <button
            className="action-btn check"
            onClick={() => onAction('CHECK')}
          >
            CHECK
          </button>
        )}

        {validActions.includes('CALL') && (
          <button
            className="action-btn call"
            onClick={() => onAction('CALL')}
          >
            CALL {callAmount.toLocaleString()}
          </button>
        )}

        {validActions.includes('ALL_IN') && (
          <button
            className="action-btn all-in"
            onClick={() => onAction('ALL_IN')}
          >
            ALL IN
          </button>
        )}
      </div>

      {/* ベット/レイズコントロール */}
      {canBetOrRaise && (
        <div className="bet-controls">
          <div className="bet-controls-divider" />

          {/* クイックベットボタン */}
          <div className="quick-bet-row">
            {quickBets.map((qb) => (
              <button
                key={qb.label}
                className="quick-bet-btn"
                onClick={() => handleBetChange(qb.value)}
                disabled={qb.value < minRaise}
              >
                {qb.label}
              </button>
            ))}
          </div>

          {/* スライダー */}
          <div className="bet-slider-container">
            <span className="slider-min">{minRaise.toLocaleString()}</span>
            <input
              type="range"
              className="bet-slider"
              min={minRaise}
              max={maxBet}
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
            />
            <span className="slider-max">{maxBet.toLocaleString()}</span>
          </div>

          {/* ベット額入力と実行ボタン */}
          <div className="bet-submit-row">
            <input
              type="number"
              className="bet-input"
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
              min={minRaise}
              max={maxBet}
            />
            <button
              className="action-btn bet"
              onClick={handleBetAction}
            >
              {validActions.includes('BET') ? 'BET' : 'RAISE TO'} {betAmount.toLocaleString()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ActionPanel;
