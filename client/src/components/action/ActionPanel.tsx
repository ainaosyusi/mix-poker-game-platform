// ========================================
// Mix Poker - ActionPanel Component
// アクションパネルコンポーネント（タイマー・タイムバンク対応版）
// ========================================

import { memo, useState, useCallback, useEffect } from 'react';
import type { ActionType, ActionPanelProps } from '../../types/table';

interface ExtendedActionPanelProps extends ActionPanelProps {
  isYourTurn?: boolean;
  timerSeconds?: number;
  maxTimerSeconds?: number;
  timeBankChips?: number;
  onUseTimeBank?: () => void;
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
  raisesRemaining: _raisesRemaining,
  fixedBetSize,
  timerSeconds,
  maxTimerSeconds = 30,
  timeBankChips = 5,
  onUseTimeBank,
}: ExtendedActionPanelProps) {
  void _raisesRemaining; // unused but kept for API compatibility
  const [betAmount, setBetAmount] = useState(minRaise);
  const callAmount = currentBet - yourBet;

  const isFacingBet = currentBet > 0;
  const isFixedLimit = betStructure === 'fixed';
  const isPotLimit = betStructure === 'pot-limit';

  useEffect(() => {
    if (minRaise > 0) {
      setBetAmount(minRaise);
    }
  }, [minRaise]);

  useEffect(() => {
    if (isFixedLimit && fixedBetSize) {
      setBetAmount(currentBet + fixedBetSize);
    }
  }, [isFixedLimit, fixedBetSize, currentBet]);

  // クイックベットボタン
  const quickBets = isFixedLimit
    ? []
    : isPotLimit
      ? [
          { label: '1/3 POT', value: Math.floor((pot + callAmount) * 0.33) + currentBet },
          { label: '1/2 POT', value: Math.floor((pot + callAmount) * 0.5) + currentBet },
          { label: '2/3 POT', value: Math.floor((pot + callAmount) * 0.67) + currentBet },
          { label: 'POT', value: maxBet },
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
    if (isNaN(value) || value < 0) {
      setBetAmount(minRaise || 0);
      return;
    }
    const clampedValue = Math.max(minRaise || 0, Math.min(maxBet || 0, value));
    setBetAmount(clampedValue);
  }, [minRaise, maxBet]);

  const handleBetAction = useCallback(() => {
    const actionType: ActionType = validActions.includes('BET') ? 'BET' : 'RAISE';
    const additionalAmount = betAmount - yourBet;
    const playerStack = maxBet - yourBet;
    if (additionalAmount > playerStack) {
      alert(`スタック不足: 最大 ${playerStack} までベットできます`);
      return;
    }
    onAction(actionType, additionalAmount);
  }, [validActions, betAmount, yourBet, maxBet, onAction]);

  const handleFixedBetAction = useCallback(() => {
    const actionType: ActionType = validActions.includes('BET') ? 'BET' : 'RAISE';
    const totalBetTo = currentBet + (fixedBetSize || 0);
    const additionalAmount = totalBetTo - yourBet;
    onAction(actionType, additionalAmount);
  }, [validActions, fixedBetSize, currentBet, yourBet, onAction]);

  const canBetOrRaise = validActions.includes('BET') || validActions.includes('RAISE');

  const betStructureLabel = {
    'no-limit': 'NL',
    'pot-limit': 'PL',
    'fixed': 'FL',
  }[betStructure];

  // タイマーの進行度（%）
  const timerProgress = timerSeconds !== undefined
    ? Math.max(0, (timerSeconds / maxTimerSeconds) * 100)
    : 100;

  // アクションボタンのスタイル生成
  const getButtonStyle = (
    isEnabled: boolean,
    variant: 'fold' | 'check' | 'call' | 'raise' | 'allin'
  ): React.CSSProperties => {
    const colors = {
      fold: { bg: '#dc2626', border: '#ef4444', text: '#ffffff' },
      check: { bg: '#10b981', border: '#10b981', text: '#ffffff' },
      call: { bg: '#047857', border: '#10b981', text: '#ffffff' },
      raise: { bg: '#3b82f6', border: '#60a5fa', text: '#ffffff' },
      allin: { bg: '#7c3aed', border: '#a78bfa', text: '#ffffff' },
    };
    const c = colors[variant];

    if (!isEnabled) {
      // 選択不可能: 背景なし、薄い枠線
      return {
        padding: '8px 16px',
        borderRadius: 6,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontSize: 12,
        transition: 'all 0.2s',
        cursor: 'not-allowed',
        border: `1px solid ${c.border}33`,
        background: 'transparent',
        color: `${c.text}44`,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.4,
      };
    }

    // 選択可能: 背景塗りつぶし
    return {
      padding: '8px 16px',
      borderRadius: 6,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontSize: 12,
      transition: 'all 0.2s',
      cursor: 'pointer',
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    };
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,1) 100%)',
        borderTop: '1px solid #374151',
        padding: '10px 16px',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          maxWidth: 1024,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        {/* 左: ターン情報とタイマー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* アナログタイマー表示 */}
          {isYourTurn && timerSeconds !== undefined && (
            <div
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#1f2937',
                border: '2px solid #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* タイマー円グラフ */}
              <svg
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                }}
              >
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke={timerProgress > 30 ? '#fbbf24' : '#ef4444'}
                  strokeWidth="4"
                  strokeDasharray={`${(timerProgress / 100) * 113} 113`}
                  style={{ transition: 'stroke-dasharray 1s linear' }}
                />
              </svg>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: timerProgress > 30 ? '#fbbf24' : '#ef4444',
                  fontFamily: 'monospace',
                }}
              >
                {timerSeconds}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 12,
                color: isYourTurn ? '#fbbf24' : '#6b7280',
                fontWeight: isYourTurn ? 'bold' : 'normal',
              }}
            >
              {isYourTurn ? 'YOUR TURN' : '相手の番...'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#1f2937',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  color: '#9ca3af',
                  border: '1px solid #374151',
                }}
              >
                {betStructureLabel}
              </span>
              <span style={{ color: '#6b7280', fontSize: 10 }}>
                POT: ${pot.toLocaleString()}
              </span>
              {isFixedLimit && isCapped && (
                <span
                  style={{
                    background: 'rgba(127, 29, 29, 0.5)',
                    color: '#f87171',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}
                >
                  CAPPED
                </span>
              )}
            </div>
          </div>

          {/* タイムバンクボタン */}
          {isYourTurn && onUseTimeBank && timeBankChips > 0 && (
            <button
              onClick={onUseTimeBank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#1f2937',
                border: '1px solid #4b5563',
                color: '#fbbf24',
                fontSize: 11,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 14 }}>⏱️</span>
              <span>+30s</span>
              <span style={{ color: '#9ca3af' }}>({timeBankChips})</span>
            </button>
          )}
        </div>

        {/* 中央: スライダー（NL/PL用） */}
        {!isFixedLimit && canBetOrRaise && isYourTurn && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#111827',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #374151',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 'bold' }}>Bet</span>
            <input
              type="range"
              min={minRaise || 0}
              max={maxBet || 100}
              value={betAmount}
              onChange={(e) => handleBetChange(Number(e.target.value))}
              disabled={!isYourTurn || !canBetOrRaise}
              style={{
                width: 100,
                height: 6,
                background: '#374151',
                borderRadius: 4,
                cursor: 'pointer',
                accentColor: '#3b82f6',
              }}
            />
            <div
              style={{
                color: '#ffffff',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                minWidth: 60,
                textAlign: 'right',
                fontSize: 12,
              }}
            >
              ${betAmount.toLocaleString()}
            </div>
          </div>
        )}

        {/* 右: ボタン群 */}
        <div style={{ display: 'flex', gap: 8, height: 40 }}>
          {/* Fold */}
          <button
            onClick={() => onAction('FOLD')}
            disabled={!isYourTurn || !validActions.includes('FOLD')}
            style={getButtonStyle(
              isYourTurn && validActions.includes('FOLD'),
              'fold'
            )}
          >
            Fold
          </button>

          {/* Check */}
          <button
            onClick={() => onAction('CHECK')}
            disabled={!isYourTurn || !validActions.includes('CHECK')}
            style={getButtonStyle(
              isYourTurn && validActions.includes('CHECK'),
              'check'
            )}
          >
            Check
          </button>

          {/* Call */}
          <button
            onClick={() => onAction('CALL')}
            disabled={!isYourTurn || !validActions.includes('CALL')}
            style={getButtonStyle(
              isYourTurn && validActions.includes('CALL'),
              'call'
            )}
          >
            Call {callAmount > 0 ? `$${callAmount.toLocaleString()}` : ''}
          </button>

          {/* Raise/Bet (NL/PL) */}
          {!isFixedLimit && canBetOrRaise && (
            <button
              onClick={handleBetAction}
              disabled={!isYourTurn || !canBetOrRaise}
              style={getButtonStyle(
                isYourTurn && canBetOrRaise,
                'raise'
              )}
            >
              {validActions.includes('BET') ? 'Bet' : 'Raise'} ${betAmount.toLocaleString()}
            </button>
          )}

          {/* Raise (FL) */}
          {isFixedLimit && canBetOrRaise && !isCapped && (
            <button
              onClick={handleFixedBetAction}
              disabled={!isYourTurn || !canBetOrRaise || isCapped}
              style={getButtonStyle(
                isYourTurn && canBetOrRaise && !isCapped,
                'raise'
              )}
            >
              {validActions.includes('BET') ? 'Bet' : 'Raise'} ${((currentBet || 0) + (fixedBetSize || 0)).toLocaleString()}
            </button>
          )}

          {/* All-In */}
          <button
            onClick={() => onAction('ALL_IN')}
            disabled={!isYourTurn || !validActions.includes('ALL_IN')}
            style={getButtonStyle(
              isYourTurn && validActions.includes('ALL_IN'),
              'allin'
            )}
          >
            All In
          </button>
        </div>
      </div>

      {/* クイックベットボタン（NL/PL用） */}
      {!isFixedLimit && canBetOrRaise && isYourTurn && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 8,
          }}
        >
          {quickBets.map((qb) => {
            const isDisabled = qb.value < minRaise || qb.value > maxBet;
            return (
              <button
                key={qb.label}
                onClick={() => handleBetChange(qb.value)}
                disabled={isDisabled}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  background: isDisabled ? 'transparent' : '#1f2937',
                  color: isDisabled ? '#4b556366' : '#d1d5db',
                  fontSize: 10,
                  border: isDisabled ? '1px solid #374151' : '1px solid #4b5563',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {qb.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ActionPanel;
