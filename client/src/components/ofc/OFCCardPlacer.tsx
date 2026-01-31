// ========================================
// OFC Card Placer - カード配置UI
// タップでカードを選択 → 行を選択して配置
// ========================================

import { useState, useCallback, memo } from 'react';
import { Card } from '../cards/Card';
import type { OFCRow, OFCPlacement } from '../../types/table';

interface OFCCardPlacerProps {
  cards: string[];
  currentBoard: OFCRow;
  round: number;             // 1 = initial (5 cards), 2-5 = pineapple (3 cards)
  isFantasyland: boolean;
  onConfirm: (placements: OFCPlacement[], discardCard?: string) => void;
}

type RowKey = 'top' | 'middle' | 'bottom';

export const OFCCardPlacer = memo(function OFCCardPlacer({
  cards,
  currentBoard,
  round,
  isFantasyland,
  onConfirm,
}: OFCCardPlacerProps) {
  // Pending placements (not yet confirmed)
  const [pendingPlacements, setPendingPlacements] = useState<OFCPlacement[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Calculate current + pending row counts
  const getRowCount = (row: RowKey) => {
    const existing = currentBoard[row].length;
    const pending = pendingPlacements.filter(p => p.row === row).length;
    return existing + pending;
  };

  const topCount = getRowCount('top');
  const midCount = getRowCount('middle');
  const botCount = getRowCount('bottom');

  // Cards not yet placed
  const placedCards = new Set(pendingPlacements.map(p => p.card));
  const remainingCards = cards.filter(c => !placedCards.has(c));

  // For pineapple: need exactly 2 placements from 3 cards
  const isPineapple = round >= 2 && !isFantasyland;
  const isInitial = round === 1 && !isFantasyland;
  const isFL = isFantasyland;

  // Required placement count
  const requiredPlacements = isFL ? 13 : isPineapple ? 2 : 5;
  const canConfirm = pendingPlacements.length === requiredPlacements;

  // Discard card (for pineapple: the remaining card after 2 placements)
  const discardCard = isPineapple && canConfirm ? remainingCards[0] : undefined;
  // For FL: discard is the remaining 1 card after 13 placements
  const flDiscardCard = isFL && canConfirm ? remainingCards[0] : undefined;

  const handleCardClick = useCallback((card: string) => {
    setSelectedCard(prev => prev === card ? null : card);
  }, []);

  const handleRowClick = useCallback((row: RowKey) => {
    if (!selectedCard) return;

    const maxCards = row === 'top' ? 3 : 5;
    const currentCount = getRowCount(row);
    if (currentCount >= maxCards) return;

    setPendingPlacements(prev => [...prev, { card: selectedCard, row }]);
    setSelectedCard(null);
  }, [selectedCard, currentBoard, pendingPlacements]);

  const handleUndo = useCallback(() => {
    setPendingPlacements(prev => {
      const last = prev[prev.length - 1];
      if (last && last.card === selectedCard) {
        setSelectedCard(null);
      }
      return prev.slice(0, -1);
    });
  }, [selectedCard]);

  const handleReset = useCallback(() => {
    setPendingPlacements([]);
    setSelectedCard(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(pendingPlacements, discardCard || flDiscardCard);
  }, [canConfirm, pendingPlacements, discardCard, flDiscardCard, onConfirm]);

  // Foul warning
  const totalTop = topCount;
  const totalMid = midCount;
  const totalBot = botCount;
  const foulWarning = totalTop > 3 || totalMid > 5 || totalBot > 5;

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 12,
      padding: 12,
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      {/* Round info */}
      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        {isFL ? 'Fantasyland - 13枚配置 + 1枚捨て' :
         isInitial ? 'Round 1 - 5枚を配置' :
         `Round ${round} - 2枚配置 + 1枚捨て`}
      </div>

      {/* Row buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 10,
      }}>
        {(['top', 'middle', 'bottom'] as RowKey[]).map(row => {
          const max = row === 'top' ? 3 : 5;
          const count = getRowCount(row);
          const full = count >= max;
          const pendingInRow = pendingPlacements.filter(p => p.row === row);

          return (
            <button
              key={row}
              onClick={() => handleRowClick(row)}
              disabled={!selectedCard || full}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderRadius: 6,
                border: selectedCard && !full
                  ? '2px solid rgba(34, 197, 94, 0.6)'
                  : '1px solid rgba(255,255,255,0.1)',
                background: selectedCard && !full
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(255,255,255,0.05)',
                color: '#fff',
                cursor: selectedCard && !full ? 'pointer' : 'default',
                opacity: full ? 0.4 : 1,
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {row === 'top' ? 'Top' : row === 'middle' ? 'Middle' : 'Bottom'}
                <span style={{ fontWeight: 400, marginLeft: 6, color: 'rgba(255,255,255,0.5)' }}>
                  ({count}/{max})
                </span>
              </span>
              {/* Show pending cards in this row */}
              <div style={{ display: 'flex', gap: 2 }}>
                {pendingInRow.map((p, i) => (
                  <Card key={`pending-${p.card}-${i}`} card={p.card} size="tiny" />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hand cards */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 4,
        flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        {remainingCards.map(card => {
          const isSelected = selectedCard === card;
          // Pineapple discard indicator
          const isDiscard = isPineapple && canConfirm && card === discardCard;

          return (
            <div
              key={card}
              onClick={() => handleCardClick(card)}
              style={{
                cursor: 'pointer',
                transform: isSelected ? 'translateY(-8px)' : undefined,
                transition: 'transform 0.15s',
                boxShadow: isSelected
                  ? '0 0 12px rgba(34, 197, 94, 0.6)'
                  : undefined,
                borderRadius: 6,
                opacity: isDiscard ? 0.4 : 1,
                position: 'relative',
              }}
            >
              <Card card={card} size="small" />
              {isDiscard && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#ef4444',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '2px 4px',
                  borderRadius: 3,
                }}>
                  捨て
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Foul warning */}
      {foulWarning && (
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: '#ef4444',
          marginBottom: 6,
        }}>
          Row capacity exceeded
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
      }}>
        <button
          onClick={handleUndo}
          disabled={pendingPlacements.length === 0}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 12,
            cursor: pendingPlacements.length > 0 ? 'pointer' : 'default',
            opacity: pendingPlacements.length > 0 ? 1 : 0.4,
          }}
        >
          Undo
        </button>
        <button
          onClick={handleReset}
          disabled={pendingPlacements.length === 0}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 12,
            cursor: pendingPlacements.length > 0 ? 'pointer' : 'default',
            opacity: pendingPlacements.length > 0 ? 1 : 0.4,
          }}
        >
          Reset
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          style={{
            padding: '6px 24px',
            borderRadius: 6,
            border: 'none',
            background: canConfirm
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: canConfirm ? 'pointer' : 'default',
            opacity: canConfirm ? 1 : 0.4,
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
});
