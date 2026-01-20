// ========================================
// Mix Poker - PlayerSeat Component
// プレイヤー席コンポーネント（改良版）
// ========================================

import { memo } from 'react';
import type { Player } from '../../types/table';
import { Card } from '../cards/Card';
import { ChipStack } from '../chips/ChipStack';

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  maxPlayers?: 6 | 8;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isYou: boolean;
  isSelected?: boolean;
  style: React.CSSProperties;
  chipPositionClass?: string;
  onSeatClick?: () => void;
  showdownHand?: string[] | null;
  isWinner?: boolean;
  gameVariant?: string;
  holeCards?: string[] | null;
  timerSeconds?: number;
  maxTimerSeconds?: number;
  handRank?: string; // 役名（自分のハンド用）
  lastAction?: string; // 最後のアクション
}

// チップ位置を座席に応じて計算（テーブル中央寄りに配置）
function getChipPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    // 6人テーブル
    switch (seatIndex) {
      case 0: // 下中央 - チップは上（テーブル中央寄り）
        return { bottom: '100%', marginBottom: 30, left: '50%', transform: 'translateX(-50%)' };
      case 1: // 左下 - チップは右上（中央寄り）
        return { bottom: '70%', right: '-20%' };
      case 2: // 左上 - チップは右下（中央寄り）
        return { top: '70%', right: '-20%' };
      case 3: // 上中央 - チップは下（テーブル中央寄り）
        return { top: '100%', marginTop: 30, left: '50%', transform: 'translateX(-50%)' };
      case 4: // 右上 - チップは左下（中央寄り）
        return { top: '70%', left: '-20%' };
      case 5: // 右下 - チップは左上（中央寄り）
        return { bottom: '70%', left: '-20%' };
      default:
        return { top: '100%', marginTop: 30 };
    }
  } else {
    // 8人テーブル
    switch (seatIndex) {
      case 0: // 下中央
        return { bottom: '100%', marginBottom: 30, left: '50%', transform: 'translateX(-50%)' };
      case 1: // 左下
        return { bottom: '50%', right: '-25%' };
      case 2: // 左
        return { top: '50%', right: '-30%', transform: 'translateY(-50%)' };
      case 3: // 左上
        return { top: '50%', right: '-25%' };
      case 4: // 上中央
        return { top: '100%', marginTop: 30, left: '50%', transform: 'translateX(-50%)' };
      case 5: // 右上
        return { top: '50%', left: '-25%' };
      case 6: // 右
        return { top: '50%', left: '-30%', transform: 'translateY(-50%)' };
      case 7: // 右下
        return { bottom: '50%', left: '-25%' };
      default:
        return { top: '100%', marginTop: 30 };
    }
  }
}

// ディーラーボタン位置を座席に応じて計算
function getDealerButtonPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 35, left: '30%' };
      case 1: return { bottom: '80%', right: '-25%' };
      case 2: return { top: '80%', right: '-25%' };
      case 3: return { top: '100%', marginTop: 35, left: '30%' };
      case 4: return { top: '80%', left: '-25%' };
      case 5: return { bottom: '80%', left: '-25%' };
      default: return { top: '100%', marginTop: 35 };
    }
  } else {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 35, left: '30%' };
      case 1: return { bottom: '60%', right: '-30%' };
      case 2: return { top: '30%', right: '-35%' };
      case 3: return { top: '60%', right: '-30%' };
      case 4: return { top: '100%', marginTop: 35, left: '30%' };
      case 5: return { top: '60%', left: '-30%' };
      case 6: return { top: '30%', left: '-35%' };
      case 7: return { bottom: '60%', left: '-30%' };
      default: return { top: '100%', marginTop: 35 };
    }
  }
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
  isSelected = false,
  style,
  onSeatClick,
  showdownHand,
  isWinner = false,
  gameVariant = 'NLH',
  holeCards,
  timerSeconds,
  maxTimerSeconds = 30,
  handRank,
  lastAction,
}: PlayerSeatProps) {
  const isFolded = player?.status === 'FOLDED';
  const isAllIn = player?.status === 'ALL_IN';

  // ゲームタイプ判定
  const isStudGame = ['7CS', '7CS8', 'RAZZ'].includes(gameVariant);
  const isDrawGame = ['2-7_TD', 'BADUGI'].includes(gameVariant);

  // 上部プレイヤー判定（カードを下に配置するため）
  const isTopSeat = maxPlayers === 6 ? seatIndex === 3 : seatIndex === 4;

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
          cursor: 'pointer',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={onSeatClick}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: 999,
            border: isSelected ? '2px solid #10b981' : '2px dashed #4b5563',
            transition: 'all 0.2s',
            minWidth: 120,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #4b5563',
            }}
          >
            <span style={{ color: '#6b7280', fontSize: 14 }}>+</span>
          </div>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>
            {isSelected ? '選択中' : `空席 ${seatIndex + 1}`}
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
  const chipPosition = getChipPosition(seatIndex, maxPlayers);

  // ディーラーボタン位置
  const dealerBtnPosition = getDealerButtonPosition(seatIndex, maxPlayers);

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
      {/* 上部プレイヤー(seat3/4)はカードを下に配置してヘッダーと重ならないように */}
      {!isStudGame && !isFolded && (displayCards || showFaceDown) && (
        <div
          style={{
            position: 'absolute',
            // 上部プレイヤーはカードを下に配置
            ...(isTopSeat
              ? { top: '100%', marginTop: 8 }
              : { bottom: isDrawGame ? '65%' : '55%' }),
            display: 'flex',
            gap: isDrawGame ? -6 : -8,
            zIndex: 10,
            transform: isWinner ? 'scale(1.08)' : undefined,
          }}
        >
          {displayCards ? (
            // 表向きのカード
            displayCards.slice(0, isDrawGame ? 5 : 4).map((card, i) => (
              <div
                key={i}
                style={{
                  transform: isDrawGame
                    ? `translateX(${i * -1}px)`
                    : `rotate(${(i - (displayCards.length - 1) / 2) * 5}deg)`,
                  zIndex: i,
                }}
              >
                <Card card={card} size="small" />
              </div>
            ))
          ) : (
            // 伏せカード（他プレイヤー）
            [...Array(isDrawGame ? 5 : 2)].map((_, i) => (
              <div
                key={i}
                style={{
                  transform: isDrawGame
                    ? `translateX(${i * -1}px)`
                    : `rotate(${(i - 0.5) * 5}deg)`,
                  zIndex: i,
                }}
              >
                <Card card="" size="small" faceDown />
              </div>
            ))
          )}
        </div>
      )}

      {/* Stud用：ダウンカード（ネームタグ上部） - 自分のみ表示 */}
      {isStudGame && isYou && holeCards && !isFolded && (
        <div
          style={{
            position: 'absolute',
            ...(isTopSeat ? { top: '100%', marginTop: 8 } : { bottom: '55%' }),
            display: 'flex',
            gap: -8,
            zIndex: 10,
          }}
        >
          {/* 最初の2枚のダウンカードのみ表示 */}
          {holeCards.slice(0, 2).map((card, i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${(i - 0.5) * 5}deg)`,
                zIndex: i,
              }}
            >
              <Card card={card} size="small" />
            </div>
          ))}
        </div>
      )}

      {/* Stud用：他プレイヤーのダウンカード（伏せ） */}
      {isStudGame && !isYou && !isFolded && (player.status === 'ACTIVE' || player.status === 'ALL_IN') && (
        <div
          style={{
            position: 'absolute',
            ...(isTopSeat ? { top: '100%', marginTop: 8 } : { bottom: '55%' }),
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
              <Card card="" size="small" faceDown />
            </div>
          ))}
        </div>
      )}

      {/* Stud用アップカード（テーブル上に斜めに配置） */}
      {isStudGame && player.studUpCards && player.studUpCards.length > 0 && (
        <div
          style={{
            position: 'absolute',
            ...(isTopSeat
              ? { top: '130%', marginTop: 8 }
              : { bottom: '85%' }),
            left: '50%',
            display: 'flex',
            transform: 'translateX(-50%)',
            zIndex: 15,
          }}
        >
          {player.studUpCards.map((card, i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${(i - (player.studUpCards!.length - 1) / 2) * 8}deg)`,
                marginLeft: i > 0 ? -10 : 0,
                zIndex: i,
              }}
            >
              <Card card={card} size="tiny" />
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
          gap: 8,
          padding: '6px 12px',
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
          minWidth: 140,
          zIndex: 30,
        }}
      >
        {/* アバター */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isYou ? '2px solid #10b981' : '2px solid #4b5563',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 16 }}>{isYou ? '👤' : '🎭'}</span>
          </div>
        </div>

        {/* 名前とスタック */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
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
            {isYou && <span style={{ color: '#10b981', fontSize: 9 }}>(you)</span>}
          </div>
          <div
            style={{
              fontSize: 13,
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
            top: isTopSeat ? undefined : '100%',
            bottom: isTopSeat ? '100%' : undefined,
            marginTop: isTopSeat ? undefined : 4,
            marginBottom: isTopSeat ? 4 : undefined,
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
          <ChipStack amount={player.bet} />
        </div>
      )}
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
