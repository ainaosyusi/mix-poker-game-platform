// ========================================
// Mix Poker - PokerTable Component
// メインテーブルコンポーネント
// ========================================

import React, { memo, useRef } from 'react';
import { useTableLayout, getCommunityCardsPosition, getPotPosition } from '../../hooks/useTableLayout';
import { PlayerSeat, PlayerBet } from '../player/PlayerSeat';
import { CommunityCards } from '../cards/Card';
import { PotDisplay } from './PotDisplay';
import type { Player, GameState } from '../../types/table';

interface PokerTableProps {
  maxPlayers: 6 | 8;
  players: (Player | null)[];
  gameState: GameState;
  dealerBtnIndex: number;
  activePlayerIndex: number;
  yourSocketId: string;
  selectedSeat: number | null;
  onSeatClick: (index: number) => void;
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
}: PokerTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const { getSeatStyle, getBetStyle } = useTableLayout({
    maxPlayers,
    containerRef: tableRef,
  });

  // SB/BBのインデックス計算
  const sbIndex = (dealerBtnIndex + 1) % maxPlayers;
  const bbIndex = (dealerBtnIndex + 2) % maxPlayers;

  // ポット合計
  const totalPot = gameState.pot.main + gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="poker-table-container">
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

        {/* ポット表示 */}
        {totalPot > 0 && (
          <PotDisplay
            mainPot={gameState.pot.main}
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

          return (
            <React.Fragment key={`seat-${index}`}>
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
                style={getSeatStyle(index)}
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
