// ========================================
// Mix Poker - ActionPanel Component
// アクションパネルコンポーネント
// ベッティング構造対応: NL / PL / FL
// ========================================

import React, { memo, useState, useCallback, useEffect } from 'react';
import type { ActionType, ActionPanelProps } from '../../types/table';

interface ExtendedActionPanelProps extends ActionPanelProps {
  isYourTurn?: boolean;
}

export const ActionPanel = memo(function ActionPanel({
  validActions,
  currentBet,
  minRaise,
  maxBet,
  yourBet,
  pot,
  onAction,
  isYourTurn = true,
  betStructure = 'no-limit',
  isCapped = false,
  raisesRemaining,
  fixedBetSize,
}: ExtendedActionPanelProps) {
  const [betAmount, setBetAmount] = useState(minRaise);
  const callAmount = currentBet - yourBet;

  // BET（誰もベットしていない）かRAISE（既にベットがある）かを判定
  const isFacingBet = currentBet > 0;

  // Fixed-Limit判定
  const isFixedLimit = betStructure === 'fixed';
  const isPotLimit = betStructure === 'pot-limit';

  // minRaiseが変わったらbetAmountを更新
  useEffect(() => {
    if (minRaise > 0) {
      setBetAmount(minRaise);
    }
  }, [minRaise]);

  // Fixed-Limitの場合、betAmountをfixedBetSizeに固定
  useEffect(() => {
    if (isFixedLimit && fixedBetSize) {
      setBetAmount(currentBet + fixedBetSize);
    }
  }, [isFixedLimit, fixedBetSize, currentBet]);

  // クイックベットボタンの値を計算
  // Fixed-Limit: 表示しない（固定額のみ）
  // Pot-Limit: POTボタンと割合
  // No-Limit: RAISE時は倍率、BET時はPOT比率
  const quickBets = isFixedLimit
    ? [] // Fixed-Limitはクイックベットなし
    : isPotLimit
      ? [
          { label: '1/3 POT', value: Math.floor((pot + callAmount) * 0.33) + currentBet },
          { label: '1/2 POT', value: Math.floor((pot + callAmount) * 0.5) + currentBet },
          { label: '2/3 POT', value: Math.floor((pot + callAmount) * 0.67) + currentBet },
          { label: 'POT', value: maxBet }, // POT-Limitの最大
        ]
      : isFacingBet
        ? [
            { label: '2x', value: currentBet * 2 },
            { label: '2.5x', value: Math.floor(currentBet * 2.5) },
            { label: '3x', value: currentBet * 3 },
            { label: '4x', value: currentBet * 4 },
          ]
        : [
            { label: '1/3', value: Math.floor(pot * 0.33) },
            { label: '1/2', value: Math.floor(pot * 0.5) },
            { label: '3/4', value: Math.floor(pot * 0.75) },
            { label: 'POT', value: pot },
          ];

  const handleBetChange = useCallback((value: number) => {
    // NaNや負の値をチェック
    if (isNaN(value) || value < 0) {
      setBetAmount(minRaise || 0);
      return;
    }
    const clampedValue = Math.max(minRaise || 0, Math.min(maxBet || 0, value));
    setBetAmount(clampedValue);
  }, [minRaise, maxBet]);

  const handleBetAction = useCallback(() => {
    const actionType: ActionType = validActions.includes('BET') ? 'BET' : 'RAISE';
    // betAmountは「ベットTO（トータル額）」なので、追加分を計算してサーバーに送信
    const additionalAmount = betAmount - yourBet;
    // スタックを超えないようにバリデーション
    const playerStack = maxBet - yourBet; // maxBet = stack + yourBet
    if (additionalAmount > playerStack) {
      alert(`スタック不足: 最大 ${playerStack} までベットできます`);
      return;
    }
    onAction(actionType, additionalAmount);
  }, [validActions, betAmount, yourBet, maxBet, onAction]);

  // Fixed-Limitのベットアクション
  const handleFixedBetAction = useCallback(() => {
    const actionType: ActionType = validActions.includes('BET') ? 'BET' : 'RAISE';
    // Fixed-Limit: ベットTOの額からyourBetを引いた追加額を送信
    // BET: fixedBetSize (0からのベット)
    // RAISE: currentBet + fixedBetSize - yourBet (コール額 + レイズ増分)
    const totalBetTo = currentBet + (fixedBetSize || 0);
    const additionalAmount = totalBetTo - yourBet;
    onAction(actionType, additionalAmount);
  }, [validActions, fixedBetSize, currentBet, yourBet, onAction]);

  const canBetOrRaise = validActions.includes('BET') || validActions.includes('RAISE');

  // ベッティング構造の表示名
  const betStructureLabel = {
    'no-limit': 'NL',
    'pot-limit': 'PL',
    'fixed': 'FL',
  }[betStructure];

  return (
    <div className={`action-panel ${!isYourTurn ? 'waiting' : ''}`}>
      <div className="action-header">
        <span className="action-title">
          {isYourTurn ? 'あなたの番です' : '相手の番です...'}
        </span>
        <div className="action-header-right">
          <span className="bet-structure-badge">{betStructureLabel}</span>
          <span className="pot-info-mini">POT: {pot.toLocaleString()}</span>
        </div>
      </div>

      {/* キャップ表示 (Fixed-Limit) */}
      {isFixedLimit && isCapped && (
        <div className="capped-indicator">CAPPED</div>
      )}

      {/* レイズ残り回数表示 (Fixed-Limit) */}
      {isFixedLimit && !isCapped && raisesRemaining !== undefined && raisesRemaining < 4 && (
        <div className="raises-remaining">
          残りレイズ: {raisesRemaining}回
        </div>
      )}

      {/* 基本アクションボタン */}
      <div className="action-buttons-row">
        <button
          className="action-btn fold"
          onClick={() => onAction('FOLD')}
          disabled={!isYourTurn || !validActions.includes('FOLD')}
        >
          FOLD
        </button>

        <button
          className="action-btn check"
          onClick={() => onAction('CHECK')}
          disabled={!isYourTurn || !validActions.includes('CHECK')}
        >
          CHECK
        </button>

        <button
          className="action-btn call"
          onClick={() => onAction('CALL')}
          disabled={!isYourTurn || !validActions.includes('CALL')}
        >
          CALL {callAmount > 0 ? callAmount.toLocaleString() : ''}
        </button>

        <button
          className="action-btn all-in"
          onClick={() => onAction('ALL_IN')}
          disabled={!isYourTurn || !validActions.includes('ALL_IN')}
        >
          ALL IN
        </button>
      </div>

      {/* ベット/レイズコントロール */}
      {isFixedLimit ? (
        /* Fixed-Limit: シンプルな固定額ボタン */
        <div className={`bet-controls fixed-limit ${!canBetOrRaise || !isYourTurn || isCapped ? 'disabled' : ''}`}>
          <div className="bet-controls-divider" />
          <div className="fixed-bet-row">
            <button
              className="action-btn bet fixed-bet-btn"
              onClick={handleFixedBetAction}
              disabled={!isYourTurn || !canBetOrRaise || isCapped}
            >
              {validActions.includes('BET') ? 'BET' : 'RAISE TO'} {((currentBet || 0) + (fixedBetSize || 0)).toLocaleString()}
            </button>
          </div>
        </div>
      ) : (
        /* No-Limit / Pot-Limit: スライダー付き */
        <div className={`bet-controls ${!canBetOrRaise || !isYourTurn ? 'disabled' : ''}`}>
          <div className="bet-controls-divider" />

          {/* クイックベットボタン */}
          <div className="quick-bet-row">
            {quickBets.map((qb) => (
              <button
                key={qb.label}
                className="quick-bet-btn"
                onClick={() => handleBetChange(qb.value)}
                disabled={!isYourTurn || !canBetOrRaise || qb.value < minRaise || qb.value > maxBet}
              >
                {qb.label}
              </button>
            ))}
          </div>

          {/* スライダー */}
          <div className="bet-slider-container">
            <span className="slider-min">{minRaise > 0 ? minRaise.toLocaleString() : '-'}</span>
            <input
              type="range"
              className="bet-slider"
              min={minRaise || 0}
              max={maxBet || 100}
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
              disabled={!isYourTurn || !canBetOrRaise}
            />
            <span className="slider-max">
              {maxBet > 0 ? maxBet.toLocaleString() : '-'}
              {isPotLimit && <span className="max-label"> (POT)</span>}
            </span>
          </div>

          {/* ベット額入力と実行ボタン */}
          <div className="bet-submit-row">
            <input
              type="number"
              className="bet-input"
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
              min={minRaise || 0}
              max={maxBet || 100}
              disabled={!isYourTurn || !canBetOrRaise}
            />
            <button
              className="action-btn bet"
              onClick={handleBetAction}
              disabled={!isYourTurn || !canBetOrRaise}
            >
              {validActions.includes('BET') ? 'BET' : 'RAISE'} {betAmount > 0 ? betAmount.toLocaleString() : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ActionPanel;
