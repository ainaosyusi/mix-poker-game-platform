// ========================================
// Mix Poker - PokerTable Component
// メインテーブルコンポーネント
// ========================================

import { memo, useRef, useState, useEffect } from 'react';
import { useTableLayout, getCommunityCardsPosition, getPotPosition } from '../../hooks/useTableLayout';
import { PlayerSeat } from '../player/PlayerSeat';
import { CommunityCards } from '../cards/Card';
import { PotDisplay } from './PotDisplay';
import { evaluateHandRank } from '../../handEvaluator';
import type { Player, GameState, ShowdownResult } from '../../types/table';

interface PokerTableProps {
  maxPlayers: 6 | 8;
  players: (Player | null)[];
  gameState: GameState;
  dealerBtnIndex: number;
  activePlayerIndex: number;
  yourSocketId: string;
  showdownResult?: ShowdownResult | null;
  isRunout?: boolean;
  yourHand?: string[] | null;
  timerSeconds?: number;
  maxTimerSeconds?: number;
}

export const PokerTable = memo(function PokerTable({
  maxPlayers,
  players,
  gameState,
  dealerBtnIndex,
  activePlayerIndex,
  yourSocketId,
  showdownResult,
  isRunout = false,
  yourHand,
  timerSeconds,
  maxTimerSeconds = 30,
}: PokerTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const { getSeatStyle } = useTableLayout({
    maxPlayers,
    containerRef: tableRef,
  });

  // カードアニメーション用state
  const [prevBoardLength, setPrevBoardLength] = useState(0);
  const [animateCards, setAnimateCards] = useState(false);

  // 新しいカードが追加されたらアニメーションをトリガー
  useEffect(() => {
    const currentLength = gameState.board.length;
    if (currentLength > prevBoardLength) {
      setAnimateCards(true);
      // アニメーション後にリセット
      const timer = setTimeout(() => setAnimateCards(false), 600);
      setPrevBoardLength(currentLength);
      return () => clearTimeout(timer);
    }
    // ボードがリセットされた場合
    if (currentLength === 0 && prevBoardLength > 0) {
      setPrevBoardLength(0);
      setAnimateCards(false);
    }
  }, [gameState.board.length, prevBoardLength]);

  // SB/BBのインデックス計算
  const sbIndex = (dealerBtnIndex + 1) % maxPlayers;
  const bbIndex = (dealerBtnIndex + 2) % maxPlayers;

  // ポット計算
  const totalPotRaw = gameState.pot.main + gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  const currentRoundBets = players.reduce((sum, p) => sum + (p?.bet || 0), 0);
  const displayPot = Math.max(0, totalPotRaw - currentRoundBets);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        paddingBottom: '80px',
        minHeight: '55vh',
        animation: isRunout ? 'pulse 2s infinite' : undefined,
      }}
    >
      {/* 背景グラデーション */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
          pointerEvents: 'none',
          background: 'radial-gradient(circle, #2c3e50 0%, #000000 100%)',
        }}
      />

      {/* テーブルコンテナ */}
      <div
        ref={tableRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1000,
          maxHeight: '65vh',
          aspectRatio: '2.1 / 1',
        }}
      >
        {/* テーブル本体（楕円） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '16px solid #1a1a1a',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)',
            background: '#0d3f4a',
          }}
        >
          {/* フェルト */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'radial-gradient(ellipse at center, #135d6e 0%, #0a303a 100%)',
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.3)',
            }}
          />

          {/* 内側の装飾線 */}
          <div
            style={{
              position: 'absolute',
              inset: 16,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.05)',
              opacity: 0.3,
              pointerEvents: 'none',
            }}
          />

          {/* テーブルロゴ */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              opacity: 0.1,
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontSize: 32,
                fontWeight: 'bold',
                letterSpacing: '0.1em',
              }}
            >
              MIX POKER
            </span>
          </div>
        </div>

        {/* ポット表示 */}
        {displayPot > 0 && (
          <PotDisplay
            mainPot={displayPot}
            sidePots={gameState.pot.side}
            style={getPotPosition()}
          />
        )}

        {/* コミュニティカード */}
        <div style={getCommunityCardsPosition()}>
          <CommunityCards cards={gameState.board} animate={animateCards} />
        </div>

        {/* プレイヤー席 */}
        {players.map((player, index) => {
          const isDealer = index === dealerBtnIndex;
          const isSB = index === sbIndex && gameState.status !== 'WAITING';
          const isBB = index === bbIndex && gameState.status !== 'WAITING';
          const isActive = index === activePlayerIndex && gameState.status === 'PLAYING';
          const isYou = player?.socketId === yourSocketId;

          // ショーダウン時のハンド
          const showdownHand = showdownResult?.allHands?.find(h => h.playerId === player?.socketId);
          const isWinner = showdownResult?.winners?.some(w => w.playerId === player?.socketId);
          const seatStyle = getSeatStyle(index);

          // 自分の役名を計算
          const handRank = isYou && yourHand && yourHand.length > 0
            ? evaluateHandRank(yourHand, gameState.board, gameState.gameVariant)
            : undefined;

          return (
            <PlayerSeat
              key={`seat-${index}`}
              player={player}
              seatIndex={index}
              maxPlayers={maxPlayers}
              isActive={isActive}
              isDealer={isDealer}
              isSB={isSB}
              isBB={isBB}
              isYou={isYou}
              style={seatStyle}
              showdownHand={showdownHand?.hand}
              isWinner={isWinner}
              gameVariant={gameState.gameVariant}
              holeCards={isYou ? yourHand : null}
              timerSeconds={isActive ? timerSeconds : undefined}
              maxTimerSeconds={maxTimerSeconds}
              handRank={handRank}
            />
          );
        })}
      </div>
    </div>
  );
});

export default PokerTable;
