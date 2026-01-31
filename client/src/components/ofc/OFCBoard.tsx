// ========================================
// OFC Board - 3行ボード表示
// Top (3枚) / Middle (5枚) / Bottom (5枚)
// ========================================

import { memo } from 'react';
import { Card } from '../cards/Card';
import type { OFCRow } from '../../types/table';

interface OFCBoardProps {
  board: OFCRow;
  size?: 'tiny' | 'small';
  isFouled?: boolean;
  royalties?: { top: number; middle: number; bottom: number };
  handNames?: { top: string; middle: string; bottom: string };
}

const ROW_LABELS = ['Top', 'Middle', 'Bottom'] as const;
const ROW_SIZES = { top: 3, middle: 5, bottom: 5 } as const;

export const OFCBoard = memo(function OFCBoard({
  board,
  size = 'tiny',
  isFouled = false,
  royalties,
  handNames,
}: OFCBoardProps) {
  const cardWidth = size === 'tiny' ? 36 : 50;
  const gap = 2;

  const renderRow = (
    rowKey: 'top' | 'middle' | 'bottom',
    label: string,
    maxCards: number,
  ) => {
    const cards = board[rowKey];
    const royalty = royalties?.[rowKey];
    const handName = handNames?.[rowKey];

    return (
      <div key={rowKey} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
      }}>
        {/* Row label */}
        <div style={{
          width: 28,
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {label}
        </div>

        {/* Cards */}
        <div style={{
          display: 'flex',
          gap,
          alignItems: 'center',
        }}>
          {Array.from({ length: maxCards }).map((_, i) => {
            const card = cards[i];
            if (card) {
              return (
                <Card
                  key={`${rowKey}-${i}-${card}`}
                  card={card}
                  size={size}
                />
              );
            }
            return (
              <div
                key={`${rowKey}-empty-${i}`}
                style={{
                  width: cardWidth,
                  height: cardWidth * 1.4,
                  borderRadius: 3,
                  border: '1px dashed rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.1)',
                }}
              />
            );
          })}
        </div>

        {/* Hand name + royalty */}
        {(handName || royalty) && (
          <div style={{
            fontSize: 8,
            color: isFouled ? '#ef4444' : 'rgba(255,255,255,0.6)',
            marginLeft: 4,
            whiteSpace: 'nowrap',
          }}>
            {handName && <span>{handName}</span>}
            {royalty ? <span style={{ color: '#fbbf24', marginLeft: 3 }}>+{royalty}</span> : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: 4,
      borderRadius: 6,
      background: isFouled
        ? 'rgba(239, 68, 68, 0.1)'
        : 'rgba(0, 0, 0, 0.2)',
      border: isFouled
        ? '1px solid rgba(239, 68, 68, 0.3)'
        : '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      {renderRow('top', 'Top', 3)}
      {renderRow('middle', 'Mid', 5)}
      {renderRow('bottom', 'Bot', 5)}
      {isFouled && (
        <div style={{
          textAlign: 'center',
          fontSize: 10,
          color: '#ef4444',
          fontWeight: 700,
          marginTop: 2,
        }}>
          FOUL
        </div>
      )}
    </div>
  );
});
