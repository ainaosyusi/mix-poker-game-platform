// ========================================
// Mix Poker - PokerTable Component
// メインテーブルコンポーネント
// ========================================

import React, { memo, useRef } from 'react';
import { useTableLayout, getCommunityCardsPosition, getPotPosition } from '../../hooks/useTableLayout';
import { PlayerSeat, PlayerBet } from '../player/PlayerSeat';
import { CommunityCards, Card } from '../cards/Card';
import { PotDisplay } from './PotDisplay';
import type { Player, GameState, ShowdownResult } from '../../types/table';

interface PokerTableProps {
  maxPlayers: 6 | 8;
  players: (Player | null)[];
  gameState: GameState;
  dealerBtnIndex: number;
  activePlayerIndex: number;
  yourSocketId: string;
  selectedSeat: number | null;
  onSeatClick: (index: number) => void;
  showdownResult?: ShowdownResult | null;
  isRunout?: boolean;
}

export const PokerTable = memo(function PokerTable({
  maxPlayers,
  players,
  gameState,
  dealerBtnIndex,
  activePlayerIndex,
  yourSocketId,
  selectedSeat,
  onSeatClick,
  showdownResult,
  isRunout = false,
}: PokerTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const { getSeatStyle, getBetStyle } = useTableLayout({
    maxPlayers,
    containerRef: tableRef,
  });

  // SB/BBのインデックス計算
  const sbIndex = (dealerBtnIndex + 1) % maxPlayers;
  const bbIndex = (dealerBtnIndex + 2) % maxPlayers;

  // ポット合計（確定ポット：現在のラウンドのベットを除く）
  // 各プレイヤーの player.bet は手前に別途表示されるため、
  // 中央のポットは確定分のみ表示する
  const totalPotRaw = gameState.pot.main + gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  const currentRoundBets = players.reduce((sum, p) => sum + (p?.bet || 0), 0);
  const displayPot = Math.max(0, totalPotRaw - currentRoundBets);

  return (
    <div className={`poker-table-container ${isRunout ? 'runout-active' : ''}`}>
      <div className="poker-table" ref={tableRef}>
        {/* テーブルのフェルト模様 */}
        <div className="table-felt">
          {/* テーブルロゴ（オプション） */}
          <div className="table-logo">
            <span>MIX POKER</span>
          </div>
        </div>

        {/* レール（クッション部分） */}
        <div className="table-rail" />

        {/* ポット表示（確定ポットのみ） */}
        {displayPot > 0 && (
          <PotDisplay
            mainPot={displayPot}
            sidePots={gameState.pot.side}
            style={getPotPosition()}
          />
        )}

        {/* コミュニティカード */}
        {gameState.board.length > 0 && (
          <div className="community-cards-area" style={getCommunityCardsPosition()}>
            <CommunityCards cards={gameState.board} animate />
          </div>
        )}

        {/* プレイヤー席 */}
        {players.map((player, index) => {
          const isDealer = index === dealerBtnIndex;
          const isSB = index === sbIndex && gameState.status !== 'WAITING';
          const isBB = index === bbIndex && gameState.status !== 'WAITING';
          const isActive = index === activePlayerIndex && gameState.status === 'PLAYING';
          const isYou = player?.socketId === yourSocketId;
          const isSelected = selectedSeat === index;

          // ショーダウン時のプレイヤーハンド
          const showdownHand = showdownResult?.allHands?.find(h => h.playerId === player?.socketId);
          const isWinner = showdownResult?.winners?.some(w => w.playerId === player?.socketId);
          const seatStyle = getSeatStyle(index);

          return (
            <React.Fragment key={`seat-${index}`}>
              {/* ショーダウン時のカード表示（席の上） */}
              {showdownHand && showdownHand.hand && (
                <div
                  className={`showdown-cards ${isWinner ? 'winner' : ''}`}
                  style={{
                    position: 'absolute',
                    left: seatStyle.left,
                    top: `calc(${seatStyle.top} - 50px)`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isWinner ? 35 : 25,
                  }}
                >
                  <div className="showdown-cards-inner">
                    {showdownHand.hand.map((card, ci) => (
                      <Card key={ci} card={card} size="small" />
                    ))}
                  </div>
                  {showdownHand.handRank && (
                    <div className={`hand-rank-badge ${isWinner ? 'winner' : ''}`}>
                      {showdownHand.handRank}
                    </div>
                  )}
                </div>
              )}

              {/* プレイヤー席 */}
              <PlayerSeat
                player={player}
                seatIndex={index}
                isActive={isActive}
                isDealer={isDealer}
                isSB={isSB}
                isBB={isBB}
                isYou={isYou}
                isSelected={isSelected}
                style={seatStyle}
                onSeatClick={() => !player && onSeatClick(index)}
              />

              {/* ベット表示 */}
              {player && player.bet > 0 && (
                <PlayerBet
                  amount={player.bet}
                  style={getBetStyle(index)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

export default PokerTable;
