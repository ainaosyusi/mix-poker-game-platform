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
import { useOrientation } from '../../hooks/useOrientation';

interface OFCTableProps {
  socket: Socket;
  room: Room;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

// 3人用座席配置（landscape: テーブル上/左下/右下）
const SEAT_POSITIONS_LANDSCAPE = [
  { top: '8%', left: '50%', transform: 'translateX(-50%)' },   // 上
  { bottom: '8%', left: '12%' },                                // 左下
  { bottom: '8%', right: '12%' },                               // 右下
];

// 3人用座席配置（portrait: 自分=下、他=上に配置して重ならない）
const SEAT_POSITIONS_PORTRAIT = [
  { top: '3%', left: '50%', transform: 'translateX(-50%)' },   // 上（自分）
  { top: '3%', left: '5%' },                                    // 左上
  { top: '3%', right: '5%' },                                   // 右上
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

  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';
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
  const isPineapple = ofcState?.phase === 'OFC_PINEAPPLE_PLACING';

  // 全ラウンド順番制: currentTurnSocketIdが自分の時だけ配置可能
  const isMyTurn = ofcState?.currentTurnSocketId === yourSocketId || ofcState?.currentTurnSocketId == null;
  const canPlace = isPlacingPhase && myOFCPlayer && !myOFCPlayer.hasPlaced && yourCards.length > 0 && isMyTurn;

  // Sort players: you first, then others
  const sortedPlayers = ofcState?.players
    ? [
        ...ofcState.players.filter(p => p.socketId === yourSocketId),
        ...ofcState.players.filter(p => p.socketId !== yourSocketId),
      ]
    : [];

  // Button player's socketId
  const buttonSocketId = ofcState?.players[ofcState.buttonIndex]?.socketId;

  // Lobby state: first hand requires manual start
  const isLobby = !ofcState || ofcState.phase === 'OFC_WAITING';
  const seatedCount = room.players.filter(p => p !== null).length;
  const canAddBot = isLobby && seatedCount < 3;
  const canStartGame = isLobby && seatedCount >= 2;

  const handleAddBot = useCallback(() => {
    socket.emit('ofc-add-bot');
  }, [socket]);

  const handleRemoveBot = useCallback((seatIndex: number) => {
    socket.emit('ofc-remove-bot', { seatIndex });
  }, [socket]);

  const handleStartGame = useCallback(() => {
    socket.emit('ofc-start-game');
  }, [socket]);

  // Choose seat positions based on orientation
  const seatPositions = isPortrait ? SEAT_POSITIONS_PORTRAIT : SEAT_POSITIONS_LANDSCAPE;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
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
      {!isPortrait && (
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
      )}

      {/* Center info / Lobby controls */}
      <div style={{
        position: 'absolute',
        top: isPortrait ? '35%' : '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        zIndex: 15,
      }}>
        {isLobby ? (
          /* ===== Lobby: Bot管理 + Start Game ===== */
          <div style={{
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 240,
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 12,
            }}>
              Pineapple OFC Lobby
            </div>

            {/* Seat list */}
            <div style={{ marginBottom: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => {
                const p = room.players[i];
                const isBot = p?.socketId.startsWith('bot-');
                const isYou = p?.socketId === yourSocketId;
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 10px',
                    marginBottom: 4,
                    borderRadius: 6,
                    background: p
                      ? isYou ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: p
                      ? isYou ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)'
                      : '1px dashed rgba(255,255,255,0.15)',
                  }}>
                    <span style={{
                      fontSize: 12,
                      color: p ? (isYou ? '#22c55e' : '#fff') : 'rgba(255,255,255,0.3)',
                    }}>
                      Seat {i + 1}: {p ? p.name : 'Empty'}
                      {isYou && ' (You)'}
                    </span>
                    {isBot && (
                      <button
                        onClick={() => handleRemoveBot(i)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: '1px solid rgba(239,68,68,0.4)',
                          background: 'rgba(239,68,68,0.15)',
                          color: '#ef4444',
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={handleAddBot}
                disabled={!canAddBot}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: canAddBot ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
                  color: canAddBot ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: canAddBot ? 'pointer' : 'default',
                }}
              >
                + Add Bot
              </button>
              <button
                onClick={handleStartGame}
                disabled={!canStartGame}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: canStartGame
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canStartGame ? 'pointer' : 'default',
                  opacity: canStartGame ? 1 : 0.4,
                }}
              >
                Start Game
              </button>
            </div>
          </div>
        ) : (
          /* ===== In-game phase display ===== */
          <>
            {ofcState?.phase === 'OFC_INITIAL_PLACING' && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Initial Placement
                {ofcState.currentTurnSocketId && (
                  <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>
                    {ofcState.currentTurnSocketId === yourSocketId
                      ? 'Your turn'
                      : `${ofcState.players.find(p => p.socketId === ofcState.currentTurnSocketId)?.name || '...'}'s turn`}
                  </div>
                )}
              </div>
            )}
            {ofcState?.phase === 'OFC_PINEAPPLE_PLACING' && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Pineapple Round {(ofcState.round || 1) - 1}
                {ofcState.currentTurnSocketId && (
                  <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>
                    {ofcState.currentTurnSocketId === yourSocketId
                      ? 'Your turn'
                      : `${ofcState.players.find(p => p.socketId === ofcState.currentTurnSocketId)?.name || '...'}'s turn`}
                  </div>
                )}
              </div>
            )}
            {ofcState?.phase === 'OFC_SCORING' && (
              <div style={{ fontSize: 13, color: '#fbbf24' }}>
                Scoring...
              </div>
            )}
            {ofcState?.phase === 'OFC_DONE' && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Next hand starting...
              </div>
            )}
          </>
        )}
      </div>

      {/* Player boards */}
      {sortedPlayers.map((player, idx) => {
        const isYou = player.socketId === yourSocketId;
        const isButton = player.socketId === buttonSocketId;
        const isCurrentTurn = player.socketId === ofcState?.currentTurnSocketId;
        const posStyle = isPortrait
          ? (idx === 0
              // 自分: portrait時は下に配置（カードプレーサーの上）
              ? { bottom: isPlacingPhase && canPlace ? '38%' : '25%', left: '50%', transform: 'translateX(-50%)' }
              // 他プレイヤー: portrait時は上に並べる
              : idx === 1
                ? { top: '3%', left: '5%' }
                : { top: '3%', right: '5%' })
          : (seatPositions[idx] || {});
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
            {/* Player name + status + button indicator */}
            <div style={{
              textAlign: 'center',
              marginBottom: 4,
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isCurrentTurn && isPlacingPhase
                  ? '#fbbf24'
                  : isYou ? '#22c55e' : '#fff',
                background: isCurrentTurn && isPlacingPhase
                  ? 'rgba(251,191,36,0.15)'
                  : 'rgba(0,0,0,0.5)',
                padding: '2px 8px',
                borderRadius: 4,
                border: isCurrentTurn && isPlacingPhase
                  ? '1px solid rgba(251,191,36,0.4)'
                  : 'none',
              }}>
                {isButton && (
                  <span style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    lineHeight: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    color: '#000',
                    fontSize: 9,
                    fontWeight: 800,
                    textAlign: 'center',
                    marginRight: 4,
                    verticalAlign: 'middle',
                    border: '1px solid #333',
                  }}>
                    D
                  </span>
                )}
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
                    {isCurrentTurn ? 'Turn' : 'Waiting'}
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

      {/* Waiting for turn indicator (any placing phase, not your turn) */}
      {isPlacingPhase && myOFCPlayer && !myOFCPlayer.hasPlaced && yourCards.length > 0 && !isMyTurn && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 8,
          padding: '8px 16px',
          border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            Waiting for your turn...
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            {ofcState?.currentTurnSocketId
              ? `${ofcState.players.find(p => p.socketId === ofcState.currentTurnSocketId)?.name || '...'} is placing`
              : ''}
          </div>
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
