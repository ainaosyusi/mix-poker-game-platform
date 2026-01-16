// ========================================
// Mix Poker - Card Component
// リアルカジノ風カードデザイン
// ========================================

import React, { memo } from 'react';
import type { CardProps } from '../../types/table';

// スートの記号マッピング
const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  '♠': { symbol: '♠', color: '#1a1a1a' },
  '♥': { symbol: '♥', color: '#dc2626' },
  '♦': { symbol: '♦', color: '#dc2626' },
  '♣': { symbol: '♣', color: '#1a1a1a' },
  's': { symbol: '♠', color: '#1a1a1a' },
  'h': { symbol: '♥', color: '#dc2626' },
  'd': { symbol: '♦', color: '#dc2626' },
  'c': { symbol: '♣', color: '#1a1a1a' },
};

// ランクの表示変換
const getRankDisplay = (rank: string): string => {
  if (rank === 'T') return '10';
  return rank;
};

// カードをパース（例: "A♠" -> { rank: "A", suit: "♠" }）
function parseCard(card: string): { rank: string; suit: string } {
  if (card.length === 2) {
    return { rank: card[0], suit: card[1] };
  }
  if (card.length === 3 && card[0] === 'T') {
    return { rank: 'T', suit: card.slice(1) };
  }
  // フォールバック
  return { rank: card[0], suit: card.slice(1) };
}

// サイズのスタイル
const CARD_SIZES: Record<string, { width: number; height: number; fontSize: number; suitSize: number }> = {
  tiny: { width: 28, height: 39, fontSize: 10, suitSize: 8 },
  small: { width: 45, height: 63, fontSize: 14, suitSize: 12 },
  medium: { width: 60, height: 84, fontSize: 18, suitSize: 16 },
  large: { width: 75, height: 105, fontSize: 22, suitSize: 20 },
};

export const Card = memo(function Card({
  card,
  animate = false,
  size = 'medium',
  faceDown = false
}: CardProps) {
  const sizeStyle = CARD_SIZES[size];

  // カード裏面
  if (faceDown) {
    return (
      <div
        className={`card-back ${animate ? 'card-animate' : ''}`}
        style={{
          width: sizeStyle.width,
          height: sizeStyle.height,
        }}
      >
        <div className="card-back-pattern" />
      </div>
    );
  }

  const { rank, suit } = parseCard(card);
  const suitInfo = SUIT_SYMBOLS[suit] || SUIT_SYMBOLS['♠'];
  const isRed = suitInfo.color === '#dc2626';

  return (
    <div
      className={`poker-card ${isRed ? 'red' : 'black'} ${animate ? 'card-animate' : ''}`}
      style={{
        width: sizeStyle.width,
        height: sizeStyle.height,
      }}
    >
      {/* カード内側のコンテンツ */}
      <div className="card-content">
        {/* 左上のランク＋スート */}
        <div className="card-corner top-left">
          <span className="card-rank" style={{ fontSize: sizeStyle.fontSize }}>
            {getRankDisplay(rank)}
          </span>
          <span className="card-suit" style={{ fontSize: sizeStyle.suitSize }}>
            {suitInfo.symbol}
          </span>
        </div>

        {/* 中央のスート */}
        <div className="card-center">
          <span className="card-center-suit" style={{ fontSize: sizeStyle.fontSize * 2 }}>
            {suitInfo.symbol}
          </span>
        </div>

        {/* 右下のランク＋スート（反転） */}
        <div className="card-corner bottom-right">
          <span className="card-rank" style={{ fontSize: sizeStyle.fontSize }}>
            {getRankDisplay(rank)}
          </span>
          <span className="card-suit" style={{ fontSize: sizeStyle.suitSize }}>
            {suitInfo.symbol}
          </span>
        </div>
      </div>
    </div>
  );
});

// ホールカード（手札）コンポーネント
interface HoleCardsProps {
  cards: string[];
  animate?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const HoleCards = memo(function HoleCards({
  cards,
  animate = false,
  size = 'medium'
}: HoleCardsProps) {
  return (
    <div className="hole-cards">
      {cards.map((card, index) => (
        <Card
          key={`${card}-${index}`}
          card={card}
          animate={animate}
          size={size}
        />
      ))}
    </div>
  );
});

// コミュニティカードコンポーネント
interface CommunityCardsProps {
  cards: string[];
  animate?: boolean;
}

export const CommunityCards = memo(function CommunityCards({
  cards,
  animate = false
}: CommunityCardsProps) {
  return (
    <div className="community-cards">
      {cards.map((card, index) => (
        <Card
          key={`community-${card}-${index}`}
          card={card}
          animate={animate}
          size="medium"
        />
      ))}
    </div>
  );
});

export default Card;
