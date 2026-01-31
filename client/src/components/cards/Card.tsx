// ========================================
// Mix Poker - Card Component
// プロポーカーアプリ風カードデザイン
// ========================================

import { memo, useRef, useEffect } from 'react';
import type { CardProps } from '../../types/table';
import { useCardPreferencesContext } from '../../contexts/CardPreferencesContext';
import { FaceCardIllustration } from './FaceCardIllustration';

// ランクの表示変換
const getRankDisplay = (rank: string): string => {
  if (rank === 'T') return '10';
  return rank;
};

// 絵札（J, Q, K）判定
const isFaceCard = (rank: string): boolean => rank === 'J' || rank === 'Q' || rank === 'K';

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

// サイズの設定（拡大 + フォントサイズ大幅増）
const CARD_SIZES: Record<string, {
  width: number; height: number;
  rankSize: number; cornerSuitSize: number; centerSize: number;
  padding: number; borderRadius: number;
}> = {
  tiny:   { width: 32,  height: 46,  rankSize: 13, cornerSuitSize: 9,  centerSize: 18, padding: 3, borderRadius: 5 },
  small:  { width: 44,  height: 62,  rankSize: 16, cornerSuitSize: 11, centerSize: 24, padding: 4, borderRadius: 6 },
  medium: { width: 60,  height: 84,  rankSize: 20, cornerSuitSize: 14, centerSize: 32, padding: 5, borderRadius: 7 },
  large:  { width: 74,  height: 104, rankSize: 24, cornerSuitSize: 16, centerSize: 40, padding: 6, borderRadius: 8 },
};

// カードサイズに応じたオーバーラップ量
const OVERLAP: Record<string, number> = {
  tiny: -6, small: -10, medium: -12, large: -14,
};

export const Card = memo(function Card({
  card,
  animate = false,
  size = 'medium',
  faceDown = false
}: CardProps) {
  const { suitConfig } = useCardPreferencesContext();
  const s = CARD_SIZES[size] || CARD_SIZES.medium;

  // カード裏面
  if (faceDown) {
    return (
      <div style={{
        width: s.width, height: s.height,
        background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
        borderRadius: s.borderRadius,
        border: '1.5px solid #991b1b',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: s.borderRadius - 2,
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 8px)',
        }} />
      </div>
    );
  }

  const { rank, suit } = parseCard(card);
  const sc = suitConfig[suit] || suitConfig['s'];
  const rankDisplay = getRankDisplay(rank);

  return (
    <div style={{
      width: s.width, height: s.height,
      background: `linear-gradient(145deg, #ffffff 0%, ${sc.bg.replace('0.08', '0.15')} 100%)`,
      borderRadius: s.borderRadius,
      border: `1.5px solid ${sc.color}30`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
      position: 'relative',
      userSelect: 'none',
      overflow: 'hidden',
      transition: animate ? 'transform 0.2s' : undefined,
    }}>
      {/* 左上コーナー: ランク + スート縦積み */}
      <div style={{
        position: 'absolute',
        top: s.padding,
        left: s.padding + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{
          fontSize: s.rankSize,
          fontWeight: 800,
          color: sc.color,
          textShadow: '0 1px 1px rgba(0,0,0,0.08)',
        }}>
          {rankDisplay}
        </span>
        <span style={{
          fontSize: s.cornerSuitSize,
          color: sc.color,
          marginTop: -1,
        }}>
          {sc.symbol}
        </span>
      </div>

      {/* 中央: 絵札はイラスト、その他はスートウォーターマーク */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}>
        {isFaceCard(rank) ? (
          <FaceCardIllustration rank={rank} color={sc.color} size={s.centerSize * 1.8} />
        ) : (
          <div style={{ fontSize: s.centerSize, color: sc.color, opacity: 0.15 }}>
            {sc.symbol}
          </div>
        )}
      </div>

      {/* 右下コーナー: ランク + スート縦積み（反転） */}
      <div style={{
        position: 'absolute',
        bottom: s.padding,
        right: s.padding + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{
          fontSize: s.rankSize,
          fontWeight: 800,
          color: sc.color,
          textShadow: '0 1px 1px rgba(0,0,0,0.08)',
        }}>
          {rankDisplay}
        </span>
        <span style={{
          fontSize: s.cornerSuitSize,
          color: sc.color,
          marginTop: -1,
        }}>
          {sc.symbol}
        </span>
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
  const overlap = OVERLAP[size] || -10;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {cards.map((card, index) => (
        <div
          key={`${card}-${index}`}
          style={{
            transform: index === 0 ? 'rotate(-6deg)' : 'rotate(6deg)',
            marginLeft: index > 0 ? overlap : 0,
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
  size?: 'tiny' | 'small' | 'medium' | 'large';
  highlightIndices?: number[];
  highlightCards?: string[];
}

export const CommunityCards = memo(function CommunityCards({
  cards,
  animate = false,
  size = 'medium',
  highlightIndices = [],
  highlightCards = [],
}: CommunityCardsProps) {
  const prevCountRef = useRef(0);
  const cardSize = CARD_SIZES[size] || CARD_SIZES.medium;

  const highlightIndicesFromCards = highlightCards
    .map(cardStr => cards.indexOf(cardStr))
    .filter(idx => idx !== -1);
  const allHighlightIndices = [...highlightIndices, ...highlightIndicesFromCards];

  const newCardsStartIndex = animate ? prevCountRef.current : cards.length;

  useEffect(() => {
    if (cards.length !== prevCountRef.current) {
      const timer = setTimeout(() => {
        prevCountRef.current = cards.length;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [cards.length]);

  useEffect(() => {
    if (cards.length === 0) {
      prevCountRef.current = 0;
    }
  }, [cards.length]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      {cards.map((card, index) => {
        const isHighlighted = allHighlightIndices.includes(index);
        const isNewCard = animate && index >= newCardsStartIndex;
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
            <div style={{
              boxShadow: isHighlighted ? '0 0 15px rgba(251, 191, 36, 0.8)' : undefined,
              borderRadius: cardSize.borderRadius + 1,
            }}>
              <Card card={card} animate={false} size={size} />
            </div>
          </div>
        );
      })}
      {/* 空のカードスロット */}
      {[...Array(5 - cards.length)].map((_, idx) => (
        <div
          key={`empty-${idx}`}
          style={{
            width: cardSize.width,
            height: cardSize.height,
            borderRadius: cardSize.borderRadius,
            border: '2px dashed rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.1)',
          }}
        />
      ))}
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
