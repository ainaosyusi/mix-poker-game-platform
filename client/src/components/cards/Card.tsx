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

// エース（A）判定
const isAce = (rank: string): boolean => rank === 'A';

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

// サイズの設定（指示に基づきランク・スートを拡大、パディングを縮小）
const CARD_SIZES: Record<string, {
  width: number; height: number;
  rankSize: number; cornerSuitSize: number; centerSize: number;
  padding: number; borderRadius: number;
  borderWidth: number; // 中央枠の太さ
}> = {
  tiny:   { width: 36,  height: 50,  rankSize: 18, cornerSuitSize: 12, centerSize: 14, padding: 2, borderRadius: 4, borderWidth: 1 },
  small:  { width: 50,  height: 70,  rankSize: 25, cornerSuitSize: 17, centerSize: 20, padding: 2.5, borderRadius: 5, borderWidth: 1 },
  medium: { width: 64,  height: 88,  rankSize: 32, cornerSuitSize: 22, centerSize: 26, padding: 3, borderRadius: 6, borderWidth: 1.5 },
  large:  { width: 80,  height: 112, rankSize: 40, cornerSuitSize: 28, centerSize: 34, padding: 4, borderRadius: 8, borderWidth: 2 },
};

// カードサイズに応じたオーバーラップ量
const OVERLAP: Record<string, number> = {
  tiny: -8, small: -12, medium: -16, large: -20,
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
  const isPictureOrAce = isFaceCard(rank) || isAce(rank);
  const isTen = rank === 'T';

  // コーナーの共通スタイル
  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 0.9,
    zIndex: 2,
  };

  // ランク文字のスタイル（10は2文字なので縮小）
  const rankTextStyle: React.CSSProperties = {
    fontSize: isTen ? s.rankSize * 0.72 : s.rankSize,
    fontWeight: 900,
    color: sc.color,
    fontFamily: 'Arial Black, "Helvetica Neue", Helvetica, sans-serif',
    letterSpacing: isTen ? -2 : -1,
    textShadow: '0 1px 1px rgba(0,0,0,0.1)',
  };

  // スートのスタイル
  const suitTextStyle: React.CSSProperties = {
    fontSize: s.cornerSuitSize,
    color: sc.color,
    marginTop: isTen ? -2 : 0,
  };

  // 中央枠のサイズ（カードサイズに対する比率で計算）
  const centerFrameW = Math.round(s.width * 0.58);
  const centerFrameH = Math.round(s.height * 0.56);

  return (
    <div style={{
      width: s.width, height: s.height,
      background: '#ffffff',
      borderRadius: s.borderRadius,
      border: '1px solid #d0d0d0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.1)',
      position: 'relative',
      userSelect: 'none',
      overflow: 'hidden',
      transition: animate ? 'transform 0.2s' : undefined,
    }}>
      {/* 左上コーナー */}
      <div style={{ ...cornerStyle, top: s.padding, left: s.padding }}>
        <span style={rankTextStyle}>{rankDisplay}</span>
        {!isAce(rank) && <span style={suitTextStyle}>{sc.symbol}</span>}
      </div>

      {/* 中央 */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: isPictureOrAce ? centerFrameW : '100%',
        height: isPictureOrAce ? centerFrameH : '100%',
        border: isFaceCard(rank) ? `${s.borderWidth}px solid ${sc.color}` : 'none',
        borderRadius: s.borderRadius / 1.5,
        backgroundColor: isPictureOrAce ? '#ffffff' : 'transparent',
        zIndex: 1,
        boxSizing: 'border-box',
      }}>
        {isFaceCard(rank) ? (
          <FaceCardIllustration rank={rank} color={sc.color} size={s.centerSize * 2} />
        ) : isAce(rank) ? (
          <div style={{ fontSize: s.centerSize * 1.4, color: sc.color }}>
            {sc.symbol}
          </div>
        ) : (
          null
        )}
      </div>

      {/* 右下コーナー */}
      <div style={{ ...cornerStyle, bottom: s.padding, right: s.padding, transform: 'rotate(180deg)' }}>
        <span style={rankTextStyle}>{rankDisplay}</span>
        {!isAce(rank) && <span style={suitTextStyle}>{sc.symbol}</span>}
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
