// ========================================
// Mix Poker - PlayerSeat Component
// プレイヤー席コンポーネント（改良版）
// ========================================

import { memo, useRef, useEffect, useState } from 'react';
import type { Player } from '../../types/table';
import type { Orientation } from '../../hooks/useOrientation';
import { Card } from '../cards/Card';
import { ChipStack } from '../chips/ChipStack';
import {
  getChipPosition,
  getChipPositionPortrait,
  getStudUpCardsPosition,
  getStudUpCardsPositionPortrait,
  getDealerButtonPosition,
  getDealerButtonPositionPortrait,
} from './seatPositionUtils';

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  maxPlayers?: 6 | 8;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isYou: boolean;
  style: React.CSSProperties;
  chipPositionClass?: string;
  showdownHand?: string[] | null;
  isWinner?: boolean;
  gameVariant?: string;
  holeCards?: string[] | null;
  timerSeconds?: number;
  maxTimerSeconds?: number;
  handRank?: string;
  highlightCards?: string[];
  orientation?: Orientation;
}

export const PlayerSeat = memo(function PlayerSeat({
  player,
  seatIndex,
  maxPlayers = 6,
  isActive,
  isDealer,
  isSB,
  isBB,
  isYou,
  style,
  showdownHand,
  isWinner = false,
  gameVariant = 'NLH',
  holeCards,
  timerSeconds,
  maxTimerSeconds = 30,
  handRank,
  highlightCards = [],
  orientation = 'landscape',
}: PlayerSeatProps) {
  const isPortrait = orientation === 'portrait';
  // ポートレート時: 自分=small, 他人=tiny / ランドスケープ: 全員small
  const cardSize: 'tiny' | 'small' | 'medium' | 'large' = isPortrait
    ? (isYou ? 'small' : 'tiny')
    : 'small';
  const isFolded = player?.status === 'FOLDED';
  const isAllIn = player?.status === 'ALL_IN';

  // ベット変化検出用
  const prevBetRef = useRef(player?.bet ?? 0);
  const [chipAnimate, setChipAnimate] = useState<'bet' | 'win' | null>(null);

  // ベットが増えた時にアニメーションをトリガー
  useEffect(() => {
    const currentBet = player?.bet ?? 0;
    if (currentBet > prevBetRef.current && currentBet > 0) {
      setChipAnimate('bet');
      const timer = setTimeout(() => setChipAnimate(null), 400);
      prevBetRef.current = currentBet;
      return () => clearTimeout(timer);
    }
    prevBetRef.current = currentBet;
  }, [player?.bet]);

  // 勝者エフェクト
  useEffect(() => {
    if (isWinner) {
      setChipAnimate('win');
    } else {
      setChipAnimate(null);
    }
  }, [isWinner]);

  // ホールカード配布アニメーション
  const prevHoleCardsRef = useRef<string[] | null>(null);
  const [cardDealAnimate, setCardDealAnimate] = useState(false);

  useEffect(() => {
    const hadCards = prevHoleCardsRef.current && prevHoleCardsRef.current.length > 0;
    const hasCards = holeCards && holeCards.length > 0;

    // カードがない状態から持っている状態に変わった時
    if (!hadCards && hasCards) {
      setCardDealAnimate(true);
      const timer = setTimeout(() => setCardDealAnimate(false), 500);
      prevHoleCardsRef.current = holeCards;
      return () => clearTimeout(timer);
    }

    // カードがなくなった時（新しいハンド）
    if (hadCards && !hasCards) {
      prevHoleCardsRef.current = null;
      setCardDealAnimate(false);
    }

    prevHoleCardsRef.current = holeCards || null;
  }, [holeCards]);

  // ゲームタイプ判定
  const isStudGame = ['7CS', '7CS8', 'RAZZ'].includes(gameVariant);
  const isDrawGame = ['2-7_TD', 'BADUGI'].includes(gameVariant);
  const isPloGame = ['PLO', 'PLO8'].includes(gameVariant);

  // ゲームタイプ別のカード枚数
  const holeCardCount = isDrawGame ? 5 : isPloGame ? 4 : 2;

  // 空席
  if (!player) {
    return (
      <div
        style={{
          ...style,
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isPortrait ? 5 : 8,
            padding: isPortrait ? '5px 10px' : '8px 16px',
            background: 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: 999,
            border: '2px dashed #4b5563',
            minWidth: isPortrait ? 90 : 120,
          }}
        >
          <div
            style={{
              width: isPortrait ? 24 : 32,
              height: isPortrait ? 24 : 32,
              borderRadius: '50%',
              background: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #4b5563',
            }}
          >
            <span style={{ color: '#6b7280', fontSize: isPortrait ? 11 : 14 }}>+</span>
          </div>
          <span style={{ color: '#9ca3af', fontSize: isPortrait ? 10 : 12 }}>
            Empty
          </span>
        </div>
      </div>
    );
  }

  // カード表示の決定
  const displayCards = showdownHand || (isYou && holeCards) || null;
  const showFaceDown = !isYou && !showdownHand && !isFolded && (player.status === 'ACTIVE' || player.status === 'ALL_IN');

  // タイマーの進行度（%）
  const timerProgress = timerSeconds !== undefined
    ? Math.max(0, (timerSeconds / maxTimerSeconds) * 100)
    : 100;

  // チップ位置
  const chipPosition = isPortrait
    ? getChipPositionPortrait(seatIndex, maxPlayers)
    : getChipPosition(seatIndex, maxPlayers);

  // ディーラーボタン位置
  const dealerBtnPosition = isPortrait
    ? getDealerButtonPositionPortrait(seatIndex, maxPlayers)
    : getDealerButtonPosition(seatIndex, maxPlayers);

  return (
    <div
      style={{
        ...style,
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* ディーラーボタン（テーブル上に配置） */}
      {isDealer && (
        <div
          style={{
            position: 'absolute',
            ...dealerBtnPosition,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%)',
            border: '2px solid #1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 'bold',
            color: '#1f2937',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            zIndex: 25,
          }}
        >
          D
        </div>
      )}

      {/* カード表示（ネームタグの上に重なる） - 非Studゲーム用 */}
      {/* 全プレイヤー共通でカードはネームタグの上に配置 */}
      {!isStudGame && !isFolded && (displayCards || showFaceDown) && (
        <div
          style={{
            position: 'absolute',
            bottom: isPortrait
              ? (isDrawGame ? '60%' : '52%')
              : (isDrawGame ? '68%' : '58%'),
            display: 'flex',
            gap: isDrawGame ? -6 : -8,
            zIndex: 10,
            transform: isWinner ? 'scale(1.08)' : undefined,
          }}
        >
          {displayCards ? (
            // 表向きのカード
            displayCards.slice(0, isDrawGame ? 5 : 4).map((card, i) => {
              const isHighlighted = highlightCards.includes(card);
              return (
              <div
                key={i}
                style={{
                  transform: isDrawGame
                    ? `translateX(${i * -1}px)`
                    : `rotate(${(i - (displayCards.length - 1) / 2) * 5}deg)`,
                  zIndex: i,
                  animation: cardDealAnimate && isYou ? `cardDealIn 0.4s ease-out ${i * 0.1}s both` : undefined,
                  filter: isHighlighted ? 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.9))' : undefined,
                }}
              >
                <Card card={card} size={cardSize} />
              </div>
            );
            })
          ) : (
            // 伏せカード（他プレイヤー）
            [...Array(holeCardCount)].map((_, i) => (
              <div
                key={i}
                style={{
                  transform: isDrawGame
                    ? `translateX(${i * -1}px)`
                    : `rotate(${(i - (holeCardCount - 1) / 2) * 5}deg)`,
                  zIndex: i,
                  animation: cardDealAnimate ? `cardDealIn 0.4s ease-out ${i * 0.1}s both` : undefined,
                }}
              >
                <Card card="" size={cardSize} faceDown />
              </div>
            ))
          )}
        </div>
      )}

      {/* Stud用：ダウンカード（ネームタグ上部） - 自分のみ表示 */}
      {isStudGame && isYou && holeCards && !isFolded && (() => {
        // ダウンカード = holeCards から upCards を除いたもの（2枚 + 7th street 1枚）
        const upCardsSet = new Set(player.studUpCards || []);
        const downCards = holeCards.filter(c => !upCardsSet.has(c));
        return downCards.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              bottom: isPortrait ? '52%' : '58%',
              display: 'flex',
              gap: -8,
              zIndex: 10,
            }}
          >
            {downCards.map((card, i) => (
              <div
                key={i}
                style={{
                  transform: `rotate(${(i - (downCards.length - 1) / 2) * 5}deg)`,
                  zIndex: i,
                }}
              >
                <Card card={card} size={cardSize} />
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {/* Stud用：他プレイヤーのダウンカード（伏せ） */}
      {isStudGame && !isYou && !isFolded && (player.status === 'ACTIVE' || player.status === 'ALL_IN') && (
        <div
          style={{
            position: 'absolute',
            bottom: isPortrait ? '52%' : '58%',
            display: 'flex',
            gap: -8,
            zIndex: 10,
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${(i - 0.5) * 5}deg)`,
                zIndex: i,
              }}
            >
              <Card card="" size={cardSize} faceDown />
            </div>
          ))}
        </div>
      )}

      {/* Stud用アップカード（テーブル上にきれいに配置、座席に応じた位置） */}
      {isStudGame && player.studUpCards && player.studUpCards.length > 0 && !isFolded && (
        <div
          style={{
            position: 'absolute',
            ...(isPortrait
              ? getStudUpCardsPositionPortrait(seatIndex, maxPlayers)
              : getStudUpCardsPosition(seatIndex, maxPlayers)),
            display: 'flex',
            gap: isPortrait ? 1 : 2,
            zIndex: 15,
          }}
        >
          {player.studUpCards.map((card, i) => (
            <div key={i} style={{ zIndex: i }}>
              <Card card={card} size={cardSize} />
            </div>
          ))}
        </div>
      )}

      {/* プレイヤー情報パネル */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: isPortrait ? 5 : 8,
          padding: isPortrait ? '4px 8px' : '6px 12px',
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 999,
          border: isYou
            ? '2px solid #10b981'
            : isActive
              ? '2px solid #fbbf24'
              : isWinner
                ? '2px solid #22c55e'
                : '1px solid #4b5563',
          boxShadow: isActive
            ? '0 0 20px rgba(251, 191, 36, 0.4)'
            : '0 4px 20px rgba(0,0,0,0.4)',
          opacity: isFolded ? 0.5 : 1,
          minWidth: isPortrait ? 110 : 140,
          zIndex: 30,
        }}
      >
        {/* アバター */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: isPortrait ? 28 : 36,
              height: isPortrait ? 28 : 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isYou ? '2px solid #10b981' : '2px solid #4b5563',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: isPortrait ? 12 : 16 }}>{isYou ? '👤' : '🎭'}</span>
          </div>
        </div>

        {/* 名前とスタック */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: isPortrait ? 10 : 11,
              color: '#d1d5db',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {player.name}
            {isYou && <span style={{ color: '#10b981', fontSize: isPortrait ? 8 : 9 }}>(you)</span>}
          </div>
          <div
            style={{
              fontSize: isPortrait ? 11 : 13,
              color: '#ffffff',
              fontWeight: 'bold',
            }}
          >
            ${player.stack.toLocaleString()}
          </div>
        </div>

        {/* SB/BBマーカー */}
        {(isSB || isBB) && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 'bold',
              background: isSB ? '#2563eb' : '#ca8a04',
              color: '#ffffff',
            }}
          >
            {isSB ? 'SB' : 'BB'}
          </div>
        )}

        {/* ステータス */}
        {isAllIn && (
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 'bold',
              background: '#dc2626',
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: 1,
              whiteSpace: 'nowrap',
            }}
          >
            ALL IN
          </div>
        )}
        {isFolded && (
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 'bold',
              background: '#374151',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: 1,
              whiteSpace: 'nowrap',
            }}
          >
            FOLD
          </div>
        )}
        {/* 最後のアクション表示（ALL_IN/FOLD以外） */}
        {!isAllIn && !isFolded && player.lastAction && (
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 'bold',
              background: player.lastAction === 'RAISE' || player.lastAction === 'BET'
                ? '#d97706' : player.lastAction === 'CALL'
                ? '#2563eb' : '#059669',
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {player.lastAction}
          </div>
        )}

        {/* タイマーバー */}
        {isActive && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 20,
              right: 20,
              height: 3,
              background: '#374151',
              borderRadius: 999,
              overflow: 'hidden',
              transform: 'translateY(2px)',
            }}
          >
            <div
              style={{
                height: '100%',
                background: timerProgress > 30 ? '#fbbf24' : '#ef4444',
                width: `${timerProgress}%`,
                transition: 'width 1s linear, background 0.3s',
              }}
            />
          </div>
        )}
      </div>

      {/* 自分のハンドの役名表示（フォールド以外） */}
      {isYou && handRank && !isFolded && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 500,
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          {handRank}
        </div>
      )}

      {/* ベットチップ（座席に応じた位置） */}
      {player.bet > 0 && (
        <div
          style={{
            position: 'absolute',
            ...chipPosition,
            zIndex: 20,
          }}
        >
          <ChipStack amount={player.bet} animate={chipAnimate} />

          {/* ALL-INマーカー（赤い三角）- チップの横に配置 */}
          {isAllIn && (
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: -25,
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: '20px solid #dc2626',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                animation: 'allinPulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </div>
      )}

      {/* アニメーション用keyframes */}
      <style>{`
        @keyframes cardDealIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(-40px) rotate(-15deg);
          }
          60% {
            opacity: 1;
            transform: scale(1.05) translateY(5px) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0) rotate(0deg);
          }
        }

        @keyframes allinPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
});

// 後方互換用
interface PlayerBetProps {
  amount: number;
  style: React.CSSProperties;
}

export const PlayerBet = memo(function PlayerBet({ amount, style }: PlayerBetProps) {
  if (amount <= 0) return null;

  return (
    <div style={{ ...style, position: 'absolute', zIndex: 20 }}>
      <ChipStack amount={amount} />
    </div>
  );
});

export default PlayerSeat;
