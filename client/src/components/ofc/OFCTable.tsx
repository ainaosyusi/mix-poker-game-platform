// ========================================
// OFC Table - メインOFCテーブルUI
// 最大3プレイヤー配置 + ボード表示 + カード配置
// ========================================

import { useState, useEffect, useCallback, memo } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  Room, OFCPublicState, OFCRoundScore, OFCPlacement, OFCPlayerInfo,
} from '../../types/table';
import { OFCBoard } from './OFCBoard';
import { OFCCardPlacer } from './OFCCardPlacer';
import { OFCScoreboard } from './OFCScoreboard';

interface OFCTableProps {
  socket: Socket;
  room: Room;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

// 3人用座席配置（テーブル上/左下/右下）
const SEAT_POSITIONS_3 = [
  { top: '8%', left: '50%', transform: 'translateX(-50%)' },   // 上
  { bottom: '8%', left: '12%' },                                // 左下
  { bottom: '8%', right: '12%' },                               // 右下
];

export const OFCTable = memo(function OFCTable({
  socket,
  room,
  yourSocketId,
  onLeaveRoom,
}: OFCTableProps) {
  const [yourCards, setYourCards] = useState<string[]>([]);
  const [scoringResult, setScoringResult] = useState<OFCRoundScore[] | null>(null);
  const [fantasylandPlayers, setFantasylandPlayers] = useState<string[]>([]);

  const ofcState = room.ofcState;

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleOFCDeal = (data: {
      round: number;
      yourCards: string[];
      ofcState: OFCPublicState;
    }) => {
      setYourCards(data.yourCards);
      setScoringResult(null);
    };

    const handleOFCScoring = (data: {
      scores: OFCRoundScore[];
      fantasylandPlayers: string[];
    }) => {
      setScoringResult(data.scores);
      setFantasylandPlayers(data.fantasylandPlayers);
    };

    const handleOFCError = (data: { reason: string }) => {
      console.warn('OFC error:', data.reason);
    };

    socket.on('ofc-deal', handleOFCDeal);
    socket.on('ofc-scoring', handleOFCScoring);
    socket.on('ofc-error', handleOFCError);

    return () => {
      socket.off('ofc-deal', handleOFCDeal);
      socket.off('ofc-scoring', handleOFCScoring);
      socket.off('ofc-error', handleOFCError);
    };
  }, [socket]);

  // Handle card placement
  const handleConfirmPlacement = useCallback((
    placements: OFCPlacement[],
    discardCard?: string,
  ) => {
    socket.emit('ofc-place-cards', { placements, discardCard });
    setYourCards([]); // Clear local cards after sending
  }, [socket]);

  // Find "you" in OFC players
  const myOFCPlayer = ofcState?.players.find(p => p.socketId === yourSocketId);
  const isPlacingPhase = ofcState?.phase === 'OFC_INITIAL_PLACING' || ofcState?.phase === 'OFC_PINEAPPLE_PLACING';
  const canPlace = isPlacingPhase && myOFCPlayer && !myOFCPlayer.hasPlaced && yourCards.length > 0;

  // Sort players: you first, then others
  const sortedPlayers = ofcState?.players
    ? [
        ...ofcState.players.filter(p => p.socketId === yourSocketId),
        ...ofcState.players.filter(p => p.socketId !== yourSocketId),
      ]
    : [];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'radial-gradient(ellipse at center, #1a3a2a 0%, #0f1f17 70%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
      }}>
        <button
          onClick={onLeaveRoom}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Leave
        </button>
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          background: 'rgba(0,0,0,0.4)',
          padding: '3px 10px',
          borderRadius: 6,
        }}>
          Pineapple OFC
          {ofcState && (
            <span style={{ marginLeft: 6, color: '#fbbf24' }}>
              Hand #{ofcState.handNumber}
              {ofcState.round > 0 && ` R${ofcState.round}`}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(0,0,0,0.4)',
          padding: '3px 10px',
          borderRadius: 6,
        }}>
          {room.config.smallBlind}/{room.config.bigBlind}
        </div>
      </div>

      {/* Table felt */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%',
        maxWidth: 600,
        height: '60%',
        maxHeight: 400,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, #1e5a3a 0%, #14432b 100%)',
        border: '3px solid #2d7a4f',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.5)',
      }} />

      {/* Center info (phase status) */}
      <div style={{
        position: 'absolute',
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        zIndex: 5,
      }}>
        {ofcState?.phase === 'OFC_INITIAL_PLACING' && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            Initial Placement
          </div>
        )}
        {ofcState?.phase === 'OFC_PINEAPPLE_PLACING' && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            Pineapple Round {(ofcState.round || 1) - 1}
          </div>
        )}
        {ofcState?.phase === 'OFC_SCORING' && (
          <div style={{ fontSize: 13, color: '#fbbf24' }}>
            Scoring...
          </div>
        )}
        {(!ofcState || ofcState.phase === 'OFC_WAITING' || ofcState.phase === 'OFC_DONE') && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Waiting for next hand...
          </div>
        )}
      </div>

      {/* Player boards */}
      {sortedPlayers.map((player, idx) => {
        const isYou = player.socketId === yourSocketId;
        const posStyle = SEAT_POSITIONS_3[idx] || {};
        const showFoul = ofcState?.phase === 'OFC_SCORING' || ofcState?.phase === 'OFC_DONE';

        return (
          <div
            key={player.socketId}
            style={{
              position: 'absolute',
              ...posStyle,
              zIndex: isYou ? 8 : 5,
            }}
          >
            {/* Player name + status */}
            <div style={{
              textAlign: 'center',
              marginBottom: 4,
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isYou ? '#22c55e' : '#fff',
                background: 'rgba(0,0,0,0.5)',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                {player.name}
                {isYou && ' (You)'}
                {player.isFantasyland && ' FL'}
              </span>
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 2,
              }}>
                {player.stack.toLocaleString()} chips
                {!player.hasPlaced && isPlacingPhase && (
                  <span style={{ color: '#fbbf24', marginLeft: 6 }}>
                    Placing...
                  </span>
                )}
                {player.hasPlaced && isPlacingPhase && (
                  <span style={{ color: '#22c55e', marginLeft: 6 }}>
                    Done
                  </span>
                )}
              </div>
            </div>

            {/* Board */}
            <OFCBoard
              board={player.board}
              size={isYou ? 'small' : 'tiny'}
              isFouled={showFoul ? player.isFouled : false}
            />
          </div>
        );
      })}

      {/* Card placement UI (bottom center, only when it's your turn) */}
      {canPlace && myOFCPlayer && ofcState && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          maxWidth: 400,
          width: '90%',
        }}>
          <OFCCardPlacer
            cards={yourCards}
            currentBoard={myOFCPlayer.board}
            round={ofcState.round}
            isFantasyland={myOFCPlayer.isFantasyland}
            onConfirm={handleConfirmPlacement}
          />
        </div>
      )}

      {/* Scoring overlay */}
      {scoringResult && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 30,
        }}>
          <OFCScoreboard
            scores={scoringResult}
            cumulativeScores={ofcState?.scores || {}}
            yourSocketId={yourSocketId}
          />
          {fantasylandPlayers.length > 0 && (
            <div style={{
              textAlign: 'center',
              marginTop: 8,
              fontSize: 12,
              color: '#fbbf24',
              fontWeight: 700,
            }}>
              Fantasyland: {fantasylandPlayers.map(id => {
                const p = ofcState?.players.find(pp => pp.socketId === id);
                return p?.name || id;
              }).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
