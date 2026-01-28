// ========================================
// Mix Poker - Card Component
// リアルカジノ風カードデザイン
// ========================================

import { memo, useRef, useEffect } from 'react';
import type { CardProps } from '../../types/table';

// スートの設定
const SUITS: Record<string, { symbol: string; color: string }> = {
  '♠': { symbol: '♠', color: '#1e293b' },
  '♥': { symbol: '♥', color: '#ef4444' },
  '♦': { symbol: '♦', color: '#ef4444' },
  '♣': { symbol: '♣', color: '#1e293b' },
  's': { symbol: '♠', color: '#1e293b' },
  'h': { symbol: '♥', color: '#ef4444' },
  'd': { symbol: '♦', color: '#ef4444' },
  'c': { symbol: '♣', color: '#1e293b' },
};

// ランクの表示変換
const getRankDisplay = (rank: string): string => {
  if (rank === 'T') return '10';
  return rank;
};

// カードをパース
function parseCard(card: string): { rank: string; suit: string } {
  if (card.length === 2) {
    return { rank: card[0], suit: card[1] };
  }
  if (card.length === 3 && card[0] === 'T') {
    return { rank: 'T', suit: card.slice(1) };
  }
  return { rank: card[0], suit: card.slice(1) };
}

// サイズの設定
const CARD_SIZES: Record<string, { width: number; height: number; rankSize: number; centerSize: number }> = {
  tiny: { width: 28, height: 40, rankSize: 10, centerSize: 14 },
  small: { width: 40, height: 56, rankSize: 12, centerSize: 18 },
  medium: { width: 56, height: 80, rankSize: 14, centerSize: 24 },
  large: { width: 70, height: 100, rankSize: 16, centerSize: 30 },
};

export const Card = memo(function Card({
  card,
  animate = false,
  size = 'medium',
  faceDown = false
}: CardProps) {
  const sizeConfig = CARD_SIZES[size] || CARD_SIZES.medium;

  // カード裏面
  if (faceDown) {
    return (
      <div
        style={{
          width: sizeConfig.width,
          height: sizeConfig.height,
          background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
          borderRadius: 6,
          border: '1px solid #991b1b',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
          }}
        />
      </div>
    );
  }

  const { rank, suit } = parseCard(card);
  const suitConfig = SUITS[suit] || SUITS['♠'];

  return (
    <div
      style={{
        width: sizeConfig.width,
        height: sizeConfig.height,
        background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
        borderRadius: 6,
        border: '1px solid #d1d5db',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 4,
        position: 'relative',
        userSelect: 'none',
        transition: animate ? 'transform 0.2s' : undefined,
      }}
    >
      {/* 左上 */}
      <div
        style={{
          fontSize: sizeConfig.rankSize,
          fontWeight: 'bold',
          color: suitConfig.color,
          alignSelf: 'flex-start',
          lineHeight: 1,
        }}
      >
        {getRankDisplay(rank)}
      </div>

      {/* 中央 */}
      <div
        style={{
          fontSize: sizeConfig.centerSize,
          color: suitConfig.color,
        }}
      >
        {suitConfig.symbol}
      </div>

      {/* 右下 */}
      <div
        style={{
          fontSize: sizeConfig.rankSize,
          fontWeight: 'bold',
          color: suitConfig.color,
          alignSelf: 'flex-end',
          transform: 'rotate(180deg)',
          lineHeight: 1,
        }}
      >
        {getRankDisplay(rank)}
      </div>
    </div>
  );
});

// ホールカード
interface HoleCardsProps {
  cards: string[];
  animate?: boolean;
  size?: 'tiny' | 'small' | 'medium' | 'large';
}

export const HoleCards = memo(function HoleCards({
  cards,
  animate = false,
  size = 'medium'
}: HoleCardsProps) {
  return (
    <div style={{ display: 'flex', gap: -8, alignItems: 'center', justifyContent: 'center' }}>
      {cards.map((card, index) => (
        <div
          key={`${card}-${index}`}
          style={{
            transform: index === 0 ? 'rotate(-6deg)' : 'rotate(6deg)',
            marginLeft: index > 0 ? -8 : 0,
            zIndex: index,
          }}
        >
          <Card card={card} animate={animate} size={size} />
        </div>
      ))}
    </div>
  );
});

// コミュニティカード
interface CommunityCardsProps {
  cards: string[];
  animate?: boolean;
  highlightIndices?: number[]; // ハイライトするカードのインデックス（ショーダウン用）
  highlightCards?: string[];   // ハイライトするカード（役判定に使われたカード）
}

export const CommunityCards = memo(function CommunityCards({
  cards,
  animate = false,
  highlightIndices = [],
  highlightCards = [],
}: CommunityCardsProps) {
  // 前回のカード枚数を追跡
  const prevCountRef = useRef(0);

  // highlightCardsをインデックスに変換
  const highlightIndicesFromCards = highlightCards
    .map(cardStr => cards.indexOf(cardStr))
    .filter(idx => idx !== -1);
  const allHighlightIndices = [...highlightIndices, ...highlightIndicesFromCards];

  // 新しく追加されたカードのインデックス
  const newCardsStartIndex = animate ? prevCountRef.current : cards.length;

  // アニメーション完了後にカウントを更新
  useEffect(() => {
    if (cards.length !== prevCountRef.current) {
      // 少し遅延してからカウントを更新（アニメーション完了後）
      const timer = setTimeout(() => {
        prevCountRef.current = cards.length;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [cards.length]);

  // ボードがリセットされた場合は即座にカウントをリセット
  useEffect(() => {
    if (cards.length === 0) {
      prevCountRef.current = 0;
    }
  }, [cards.length]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      {cards.map((card, index) => {
        const isHighlighted = allHighlightIndices.includes(index);
        const isNewCard = animate && index >= newCardsStartIndex;
        // 新しいカードのみアニメーション、フロップは順番に
        const animationDelay = isNewCard ? (index - newCardsStartIndex) * 0.12 : 0;

        return (
          <div
            key={`community-${card}-${index}-${isNewCard ? 'new' : 'old'}`}
            style={{
              animation: isNewCard ? `cardDealIn 0.4s ease-out ${animationDelay}s both` : undefined,
              transform: isHighlighted ? 'translateY(-8px)' : undefined,
              transition: 'transform 0.3s ease',
              boxShadow: isHighlighted ? '0 0 20px 4px rgba(34, 197, 94, 0.8)' : undefined,
            }}
          >
            <div
              style={{
                boxShadow: isHighlighted ? '0 0 15px rgba(251, 191, 36, 0.8)' : undefined,
                borderRadius: 8,
              }}
            >
              <Card
                card={card}
                animate={false}
                size="medium"
              />
            </div>
          </div>
        );
      })}
      {/* 空のカードスロット */}
      {[...Array(5 - cards.length)].map((_, idx) => (
        <div
          key={`empty-${idx}`}
          style={{
            width: 56,
            height: 80,
            borderRadius: 6,
            border: '2px dashed rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.1)',
          }}
        />
      ))}
      {/* カードアニメーション用keyframes */}
      <style>{`
        @keyframes cardDealIn {
          0% {
            opacity: 0;
            transform: translateY(-30px) scale(0.8) rotateX(-15deg);
          }
          50% {
            opacity: 0.8;
            transform: translateY(5px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg);
          }
        }
      `}</style>
    </div>
  );
});

export default Card;
