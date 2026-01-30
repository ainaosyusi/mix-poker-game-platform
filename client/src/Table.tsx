// ========================================
// Mix Poker - Table Component (Simplified)
// メインテーブルページコンポーネント
// 自動着席・自動開始対応版
// ========================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { PokerTable } from './components/table/PokerTable';
import { ActionPanel } from './components/action/ActionPanel';
import { Card } from './components/cards/Card';
import { GameLog } from './components/log/GameLog';
import type { LogEntry } from './components/log/GameLog';
import { evaluateHandRank } from './handEvaluator';
import { useTableSocketEvents } from './hooks/useTableSocketEvents';
import { useTurnTimer } from './hooks/useTurnTimer';
import { useDrawPhaseState } from './hooks/useDrawPhaseState';
import { useLeaveRoomOnUnmount } from './hooks/useLeaveRoomOnUnmount';
import { useOrientation } from './hooks/useOrientation';
import { useSyncYourHand } from './hooks/useSyncYourHand';
import { HostControlsPanel } from './components/HostControlsPanel';
import type {
  Player,
  GameState,
  Room,
  ActionType,
  ShowdownResult,
} from './types/table';

// ゲームバリアントの表示名マッピング
const GAME_VARIANT_NAMES: Record<string, string> = {
  NLH: "No Limit Hold'em",
  PLO: 'Pot Limit Omaha',
  PLO8: 'PLO Hi-Lo',
  '2-7_TD': '2-7 Triple Draw',
  '7CS': '7 Card Stud',
  '7CS8': '7 Card Stud Hi-Lo',
  RAZZ: 'Razz',
  BADUGI: 'Badugi',
};
const DRAW_MAX_BY_VARIANT: Record<string, number> = {
  '2-7_TD': 5,
  BADUGI: 4,
};

function getGameVariantFullName(variantId: string): string {
  return GAME_VARIANT_NAMES[variantId] || variantId;
}

interface TableProps {
  socket: Socket | null;
  roomId: string;
  initialRoomData: Room | null;
  initialHand?: string[] | null;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

export function Table({
  socket,
  roomId,
  initialRoomData,
  initialHand = null,
  yourSocketId,
  onLeaveRoom
}: TableProps) {
  const [room, setRoom] = useState<Room | null>(initialRoomData);
  const [yourHand, setYourHand] = useState<string[]>(initialHand || []);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [validActions, setValidActions] = useState<ActionType[]>([]);
  const [showdownResult, setShowdownResult] = useState<ShowdownResult | null>(null);
  const [currentBetInfo, setCurrentBetInfo] = useState({
    currentBet: 0,
    minRaise: 0,
    maxBet: 0,
    betStructure: 'no-limit' as 'no-limit' | 'pot-limit' | 'fixed',
    isCapped: false,
    raisesRemaining: 4,
    fixedBetSize: undefined as number | undefined,
  });
  const [gameLogs, setGameLogs] = useState<LogEntry[]>([]);
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(500);
  const [actionToken, setActionToken] = useState<string | null>(null);

  // Host controls
  const [showHostControls, setShowHostControls] = useState(false);

  // Draw game用state
  const [isDrawPhase, setIsDrawPhase] = useState(false);
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDrawnThisRound, setHasDrawnThisRound] = useState(false);

  // タイマー関連state
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(undefined);
  const [timeBankChips, setTimeBankChips] = useState(5);
  const maxTimerSeconds = 30;
  const maxDrawCount = room ? (DRAW_MAX_BY_VARIANT[room.gameState.gameVariant] || 5) : 5;

  // socketをrefで追跡（アンマウント時に最新のsocketを参照するため）
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // ログを追加するヘルパー
  const addLog = useCallback((entry: LogEntry) => {
    setGameLogs(prev => [...prev.slice(-49), entry]); // 最大50件保持
  }, []);

  useTableSocketEvents({
    socket,
    maxTimerSeconds,
    addLog,
    setRoom,
    setYourHand,
    setShowdownResult,
    setIsYourTurn,
    setValidActions,
    setCurrentBetInfo,
    setActionToken,
    setTimerSeconds,
    setTimeBankChips,
    setHasDrawnThisRound,
    setSelectedDrawCards,
  });

  useLeaveRoomOnUnmount(socketRef);
  useTurnTimer(isYourTurn, timerSeconds, setTimerSeconds);
  useDrawPhaseState(room, isDrawPhase, setIsDrawPhase, setHasDrawnThisRound, setSelectedDrawCards);
  useSyncYourHand(room, yourSocketId, yourHand.length, setYourHand);
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';

  // アクション実行
  const handleAction = useCallback((type: ActionType, amount?: number) => {
    if (!socket) return;
    socket.emit('player-action', { type, amount, actionToken });
    setIsYourTurn(false);
    setTimerSeconds(undefined);
  }, [socket, actionToken]);

  // タイムバンク使用
  const handleUseTimeBank = useCallback(() => {
    if (!socket || timeBankChips <= 0) return;
    socket.emit('use-timebank');
    setTimeBankChips(prev => Math.max(0, prev - 1));
    setTimerSeconds(prev => (prev || 0) + 30);
  }, [socket, timeBankChips]);

  // ドローカード選択トグル
  const toggleDrawCard = useCallback((index: number) => {
    setSelectedDrawCards(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        if (prev.length >= maxDrawCount) {
          return prev;
        }
        return [...prev, index];
      }
    });
  }, [maxDrawCount]);

  // ドロー実行
  const handleDraw = useCallback(() => {
    if (!socket) return;
    socket.emit('draw-exchange', { discardIndexes: selectedDrawCards });
  }, [socket, selectedDrawCards]);

  // 離席（leave-room発行 → メインメニューへ）
  const handleLeaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leave-room');
    localStorage.removeItem('mgp-last-room');
    onLeaveRoom();
  }, [socket, onLeaveRoom]);

  // リバイ
  const handleRebuy = useCallback(() => {
    if (!socket || rebuyAmount <= 0) return;
    socket.emit('rebuy', { amount: rebuyAmount });
  }, [socket, rebuyAmount]);

  // I'm Back（仮離席から復帰）
  const handleImBack = useCallback(() => {
    if (!socket) return;
    socket.emit('im-back');
  }, [socket]);

  // ローディング中
  if (!room) {
    return (
      <div className="table-loading">
        <div className="loading-content">
          <div className="loading-icon">🎰</div>
          <h3>Loading...</h3>
          <p className="text-gray">Room: {roomId}</p>
          <button className="action-btn fold" onClick={onLeaveRoom}>
            Back
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
  const yourPlayer = isSeated ? room.players[yourSeatIndex] : null;
  const isPendingJoin = yourPlayer?.status === 'SIT_OUT' && yourPlayer?.pendingJoin;
  const isSittingOut = (yourPlayer?.status === 'SIT_OUT' || yourPlayer?.pendingSitOut) && !yourPlayer?.pendingJoin;

  const currentRoundBets = room.players.reduce((sum, p) => sum + (p?.bet || 0), 0);
  const totalPotRaw = room.gameState.pot.main + room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  const displayPot = totalPotRaw - currentRoundBets;
  const totalPot = totalPotRaw;

  const yourBet = isSeated ? (room.players[yourSeatIndex]?.bet || 0) : 0;
  const yourStack = isSeated ? (room.players[yourSeatIndex]?.stack || 0) : 0;
  const maxPlayers = (room.config.maxPlayers as 6 | 8) || 6;
  const isHost = room.hostId === yourSocketId;
  const isPrivateRoom = !!room.hostId;

  return (
    <div className="table-page">
      {/* ヘッダー */}
      <header className="table-header">
        <div className="header-left">
          <h1 className="room-title">
            {isPrivateRoom ? '🔒' : '🎰'} Room {roomId}
            {isPrivateRoom && (
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)',
                  fontSize: '10px', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px',
                  cursor: 'pointer', verticalAlign: 'middle',
                }}
                title="Copy room number"
              >
                Copy
              </button>
            )}
          </h1>
          <div className="room-info-row">
            <span className="blinds-info">{room.config.smallBlind}/{room.config.bigBlind}</span>
            <span className="hand-info">Hand #{room.gameState.handNumber}</span>
          </div>
        </div>
        <div className="game-variant-display">
          <span className="game-variant-label">Game</span>
          <span className="game-variant-name">{getGameVariantFullName(room.gameState.gameVariant)}</span>
          {room.rotation.gamesList.length > 1 && (
            <span className="rotation-info">
              ({room.rotation.currentGameIndex + 1}/{room.rotation.gamesList.length})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isHost && (
            <button
              className="action-btn"
              onClick={() => setShowHostControls(true)}
              style={{
                background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                color: '#c4b5fd', fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Settings
            </button>
          )}
          <button className="action-btn fold" onClick={handleLeaveRoom}>
            Leave
          </button>
        </div>
      </header>

      {/* 保留設定バナー */}
      {room.pendingConfig && (
        <div style={{
          position: 'fixed', top: '52px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '8px', padding: '6px 16px', zIndex: 50,
          color: '#fbbf24', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          Settings change pending after this hand
        </div>
      )}

      {/* ホストコントロールパネル */}
      {showHostControls && isHost && (
        <HostControlsPanel
          room={room}
          socket={socket}
          onClose={() => setShowHostControls(false)}
        />
      )}

      {/* ポーカーテーブル */}
      <PokerTable
        maxPlayers={maxPlayers}
        players={room.players}
        gameState={room.gameState}
        dealerBtnIndex={room.dealerBtnIndex}
        activePlayerIndex={room.activePlayerIndex}
        yourSocketId={yourSocketId}
        showdownResult={showdownResult}
        yourHand={yourHand}
        timerSeconds={timerSeconds}
        maxTimerSeconds={maxTimerSeconds}
      />

      {/* ドロー交換パネル */}
      {yourHand.length > 0 && isDrawPhase && isSeated && (
        <div className="draw-panel">
          <div className="draw-header">
            <span className="draw-title">
              {hasDrawnThisRound ? 'Draw complete - waiting for others...' : 'Select cards to discard'}
            </span>
            <span className="hand-rank-display">
              {evaluateHandRank(yourHand, room.gameState.board, room.gameState.gameVariant)}
            </span>
          </div>
          {!hasDrawnThisRound && (
            <div className="draw-limit">
              Selected {selectedDrawCards.length}/{maxDrawCount}
            </div>
          )}
          <div className="draw-cards">
            {yourHand.map((card, i) => (
              <div
                key={i}
                className={`draw-card-wrapper ${selectedDrawCards.includes(i) ? 'selected' : ''} ${hasDrawnThisRound ? 'disabled' : ''}`}
                onClick={() => !hasDrawnThisRound && toggleDrawCard(i)}
              >
                <Card card={card} size="medium" />
                {selectedDrawCards.includes(i) && (
                  <div className="discard-indicator">X</div>
                )}
              </div>
            ))}
          </div>
          {!hasDrawnThisRound && (
            <div className="draw-actions">
              <button className="draw-button stand-pat" onClick={() => handleDraw()}>
                Stand Pat (0)
              </button>
              <button
                className="draw-button draw-selected"
                onClick={handleDraw}
                disabled={selectedDrawCards.length === 0}
              >
                Draw {selectedDrawCards.length}
              </button>
            </div>
          )}
        </div>
      )}

      {/* アクションパネル（ドローフェーズ中は非表示） */}
      {isSeated && !isWaiting && !showdownResult && !isSittingOut && !isPendingJoin && !isDrawPhase && (
        <ActionPanel
          validActions={validActions}
          currentBet={currentBetInfo.currentBet}
          minRaise={currentBetInfo.minRaise}
          maxBet={Math.min(currentBetInfo.maxBet, yourStack + yourBet)}
          yourBet={yourBet}
          pot={totalPot}
          onAction={handleAction}
          isYourTurn={isYourTurn}
          betStructure={currentBetInfo.betStructure}
          isCapped={currentBetInfo.isCapped}
          raisesRemaining={currentBetInfo.raisesRemaining}
          fixedBetSize={currentBetInfo.fixedBetSize}
          timerSeconds={timerSeconds}
          maxTimerSeconds={maxTimerSeconds}
          timeBankChips={timeBankChips}
          onUseTimeBank={handleUseTimeBank}
        />
      )}

      {/* ショーダウン結果 */}
      {showdownResult && showdownResult.winners.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: isPortrait ? 200 : 140,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            padding: '8px 20px',
            borderRadius: 8,
            border: '2px solid #22c55e',
            zIndex: 100,
            textAlign: 'center',
          }}
        >
          {showdownResult.winners.map((w, i) => (
            <div key={i} style={{ color: '#fff', fontSize: 14 }}>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>🏆 {w.playerName}</span>
              {' wins '}
              <span style={{ color: '#fbbf24' }}>+{w.amount.toLocaleString()}</span>
              {w.handRank !== 'Uncontested' && (
                <span style={{ color: '#9ca3af' }}> ({w.handRank})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 待機中メッセージ */}
      {isSeated && isWaiting && seatedPlayerCount < 2 && yourStack > 0 && (
        <div className="waiting-message">
          Waiting for more players...
        </div>
      )}

      {/* リバイダイアログ - チップが0の場合 */}
      {isSeated && isWaiting && yourStack === 0 && (
        <div className="rebuy-panel">
          <div className="rebuy-header">
            <span className="rebuy-icon">💸</span>
            <h3 className="rebuy-title">Out of chips</h3>
          </div>
          <p className="rebuy-message">Add chips to continue playing</p>
          <div className="rebuy-controls">
            <label className="text-gray">Amount:</label>
            <input
              type="number"
              className="bet-input"
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(Number(e.target.value))}
              min={room.config.buyInMin}
              max={room.config.buyInMax}
            />
            <button
              className="action-btn check"
              onClick={handleRebuy}
              disabled={rebuyAmount < (room.config.buyInMin || 0) || rebuyAmount > (room.config.buyInMax || 10000)}
            >
              Add Chips
            </button>
          </div>
          <div className="rebuy-options">
            <button className="action-btn fold small" onClick={handleLeaveRoom}>
              Leave Table
            </button>
          </div>
        </div>
      )}

      {/* I'm Back パネル - SIT_OUT状態（チップあり） */}
      {isSeated && isSittingOut && yourStack > 0 && (
        <div className="rebuy-panel">
          <div className="rebuy-header">
            <span className="rebuy-icon">💤</span>
            <h3 className="rebuy-title">Sitting Out</h3>
          </div>
          <p className="rebuy-message">You are currently sitting out due to inactivity</p>
          <div className="rebuy-controls">
            <button
              className="action-btn check"
              onClick={handleImBack}
            >
              I'm Back
            </button>
          </div>
          <div className="rebuy-options">
            <button className="action-btn fold small" onClick={handleLeaveRoom}>
              Leave Table
            </button>
          </div>
        </div>
      )}

      {/* 復帰待ちパネル - Im Back押した後、次のハンド待ち */}
      {isSeated && isPendingJoin && yourStack > 0 && (
        <div className="rebuy-panel">
          <div className="rebuy-header">
            <span className="rebuy-icon">⏳</span>
            <h3 className="rebuy-title">Joining Next Hand</h3>
          </div>
          <p className="rebuy-message">You will join the next hand</p>
          <div className="rebuy-options">
            <button className="action-btn fold small" onClick={handleLeaveRoom}>
              Leave Table
            </button>
          </div>
        </div>
      )}

      {/* ゲームログ */}
      <GameLog
        entries={gameLogs}
        isCollapsed={isLogCollapsed}
        onToggle={() => setIsLogCollapsed(!isLogCollapsed)}
      />
    </div>
  );
}

export default Table;
