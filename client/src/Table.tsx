// ========================================
// Mix Poker - Table Component (Refactored)
// メインテーブルページコンポーネント
// ========================================

import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { PokerTable } from './components/table/PokerTable';
import { ActionPanel } from './components/action/ActionPanel';
import { Card, HoleCards } from './components/cards/Card';
import type {
  Player,
  GameState,
  Room,
  ActionType,
  ShowdownResult,
} from './types/table';

interface TableProps {
  socket: Socket | null;
  roomId: string;
  initialRoomData: Room | null;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

export function Table({
  socket,
  roomId,
  initialRoomData,
  yourSocketId,
  onLeaveRoom
}: TableProps) {
  const [room, setRoom] = useState<Room | null>(initialRoomData);
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [yourHand, setYourHand] = useState<string[]>([]);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [validActions, setValidActions] = useState<ActionType[]>([]);
  const [showdownResult, setShowdownResult] = useState<ShowdownResult | null>(null);
  const [currentBetInfo, setCurrentBetInfo] = useState({ currentBet: 0, minRaise: 0 });

  // Socket.io イベントハンドリング
  useEffect(() => {
    if (!socket) return;

    socket.on('room-state-update', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('room-joined', (data: { room: Room }) => {
      setRoom(data.room);
    });

    socket.on('game-started', (data: { room: Room; yourHand: string[] }) => {
      setRoom(data.room);
      setYourHand(data.yourHand || []);
      setShowdownResult(null);
    });

    socket.on('your-turn', (data: { validActions: ActionType[]; currentBet: number; minRaise: number }) => {
      setIsYourTurn(true);
      setValidActions(data.validActions);
      setCurrentBetInfo({ currentBet: data.currentBet, minRaise: data.minRaise });
    });

    socket.on('showdown-result', (result: ShowdownResult) => {
      setShowdownResult(result);
      setYourHand([]);
      setIsYourTurn(false);
    });

    socket.on('action-invalid', (data: { reason: string }) => {
      alert(`無効なアクション: ${data.reason}`);
    });

    return () => {
      socket.off('room-state-update');
      socket.off('room-joined');
      socket.off('game-started');
      socket.off('your-turn');
      socket.off('showdown-result');
      socket.off('action-invalid');
    };
  }, [socket]);

  // アクション実行
  const handleAction = useCallback((type: ActionType, amount?: number) => {
    if (!socket) return;
    socket.emit('player-action', { type, amount });
    setIsYourTurn(false);
  }, [socket]);

  // ゲーム開始
  const handleStartGame = useCallback(() => {
    if (!socket) return;
    socket.emit('start-game');
  }, [socket]);

  // 着席
  const handleSitDown = useCallback((seatIndex: number) => {
    if (!socket || !room) return;
    socket.emit('sit-down', { seatIndex, buyIn: buyInAmount });
    setSelectedSeat(null);
  }, [socket, room, buyInAmount]);

  // 離席
  const handleLeaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leave-seat');
    onLeaveRoom();
  }, [socket, onLeaveRoom]);

  // 座席選択
  const handleSeatClick = useCallback((index: number) => {
    setSelectedSeat(prev => prev === index ? null : index);
  }, []);

  // ローディング中
  if (!room) {
    return (
      <div className="table-loading">
        <div className="loading-content">
          <div className="loading-icon">🎰</div>
          <h3>部屋のデータを取得中...</h3>
          <p className="text-gray">ルームID: {roomId}</p>
          <button className="action-btn fold" onClick={onLeaveRoom}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // 計算
  const yourSeatIndex = room.players.findIndex(p => p?.socketId === yourSocketId);
  const isSeated = yourSeatIndex !== -1;
  const seatedPlayerCount = room.players.filter(p => p !== null).length;
  const isWaiting = room.gameState.status === 'WAITING';
  const totalPot = room.gameState.pot.main + room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  const yourBet = isSeated ? (room.players[yourSeatIndex]?.bet || 0) : 0;
  const yourStack = isSeated ? (room.players[yourSeatIndex]?.stack || 0) : 0;
  const maxPlayers = (room.config.maxPlayers as 6 | 8) || 6;

  return (
    <div className="table-page">
      {/* ヘッダー */}
      <header className="table-header">
        <div className="header-left">
          <h1 className="room-title">🎰 Room {roomId}</h1>
          <p className="room-info">
            {room.gameState.gameVariant} • {room.config.smallBlind}/{room.config.bigBlind} • Hand #{room.gameState.handNumber}
          </p>
        </div>
        <button className="action-btn fold" onClick={handleLeaveRoom}>
          ロビーに戻る
        </button>
      </header>

      {/* ポーカーテーブル */}
      <PokerTable
        maxPlayers={maxPlayers}
        players={room.players}
        gameState={room.gameState}
        dealerBtnIndex={room.dealerBtnIndex}
        activePlayerIndex={room.activePlayerIndex}
        yourSocketId={yourSocketId}
        selectedSeat={selectedSeat}
        onSeatClick={handleSeatClick}
      />

      {/* 自分の手札 */}
      {yourHand.length > 0 && (
        <div className="your-hand-area">
          <span className="hand-label">Your Hand:</span>
          <HoleCards cards={yourHand} animate size="medium" />
        </div>
      )}

      {/* アクションパネル */}
      {isYourTurn && (
        <ActionPanel
          validActions={validActions}
          currentBet={currentBetInfo.currentBet}
          minRaise={currentBetInfo.minRaise}
          maxBet={yourStack}
          yourBet={yourBet}
          pot={totalPot}
          onAction={handleAction}
        />
      )}

      {/* ショーダウン結果 */}
      {showdownResult && (
        <div className="showdown-panel">
          <h2>🏆 SHOWDOWN</h2>

          {/* 勝者 */}
          <div className="winners-section">
            <h3 className="text-green">Winners</h3>
            {showdownResult.winners.map((w, i) => (
              <div key={i} className="winner-display">
                <div className="player-name">{w.playerName}</div>
                <div className="hand-rank">{w.handRank}</div>
                <div className="cards-row">
                  {w.hand && w.hand.map((card: string, ci: number) => (
                    <Card key={ci} card={card} size="small" />
                  ))}
                </div>
                <div className="win-amount">+{w.amount.toLocaleString()} chips</div>
              </div>
            ))}
          </div>

          {/* 他プレイヤー */}
          {showdownResult.allHands && showdownResult.allHands.length > 0 && (
            <div className="losers-section">
              <h4 className="text-gray">Other Players</h4>
              {showdownResult.allHands
                .filter((h) => !showdownResult.winners.some((w) => w.playerId === h.playerId))
                .map((h, i) => (
                  <div key={i} className="loser-display">
                    <div className="player-name">{h.playerName}</div>
                    <div className="cards-row">
                      {h.hand && h.hand.map((card: string, ci: number) => (
                        <Card key={ci} card={card} size="small" />
                      ))}
                    </div>
                    {h.handRank && <div className="hand-rank">{h.handRank}</div>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 着席コントロール */}
      {!isSeated && (
        <div className="action-panel seat-panel">
          <h3>💺 着席する</h3>
          <div className="seat-controls">
            <label className="text-gray">Buy-in:</label>
            <input
              type="number"
              className="bet-input"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(Number(e.target.value))}
              min={room.config.buyInMin}
              max={room.config.buyInMax}
            />
            <button
              className="action-btn check"
              onClick={() => selectedSeat !== null && handleSitDown(selectedSeat)}
              disabled={selectedSeat === null}
              style={{ opacity: selectedSeat === null ? 0.5 : 1 }}
            >
              着席
            </button>
          </div>
          {selectedSeat === null && (
            <p className="seat-hint">テーブル上の空席をクリックして選択してください</p>
          )}
        </div>
      )}

      {/* ゲーム開始ボタン */}
      {isSeated && isWaiting && seatedPlayerCount >= 2 && (
        <div className="start-game-area">
          <button className="action-btn check start-btn" onClick={handleStartGame}>
            🎮 ゲーム開始
          </button>
        </div>
      )}

      {isSeated && isWaiting && seatedPlayerCount < 2 && (
        <div className="waiting-message">
          ゲーム開始には2人以上のプレイヤーが必要です
        </div>
      )}

      {/* 追加スタイル（インライン） */}
      <style>{`
        .table-page {
          padding: 20px;
          min-height: 100vh;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1000px;
          margin: 0 auto 30px auto;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .room-title {
          margin: 0;
          font-size: 28px;
          color: var(--gold);
        }

        .room-info {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .table-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          text-align: center;
        }

        .loading-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .your-hand-area {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin: 30px auto;
          padding: 20px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 16px;
          max-width: 400px;
        }

        .hand-label {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .seat-panel {
          margin-top: 20px;
        }

        .seat-panel h3 {
          margin: 0 0 16px 0;
          text-align: center;
        }

        .seat-controls {
          display: flex;
          gap: 12px;
          justify-content: center;
          align-items: center;
        }

        .seat-hint {
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
          margin-top: 12px;
        }

        .start-game-area {
          text-align: center;
          margin-top: 30px;
        }

        .start-btn {
          font-size: 18px;
          padding: 18px 48px;
        }

        .waiting-message {
          text-align: center;
          color: var(--text-secondary);
          padding: 30px;
        }

        .winners-section {
          margin-bottom: 24px;
        }

        .winners-section h3 {
          margin-bottom: 16px;
        }

        .losers-section {
          margin-top: 20px;
        }

        .losers-section h4 {
          margin-bottom: 12px;
          font-size: 14px;
        }

        .cards-row {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin: 12px 0;
        }

        @media (max-width: 768px) {
          .table-header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .room-title {
            font-size: 22px;
          }

          .your-hand-area {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default Table;
