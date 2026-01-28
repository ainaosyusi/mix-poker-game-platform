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
import { GameLog, createActionLog, createEventLog } from './components/log/GameLog';
import type { LogEntry } from './components/log/GameLog';
import { evaluateHandRank } from './handEvaluator';
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

  // Draw game用state
  const [isDrawPhase, setIsDrawPhase] = useState(false);
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDrawnThisRound, setHasDrawnThisRound] = useState(false);

  // ランアウト(オールイン)用state
  const [isRunout, setIsRunout] = useState(false);

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

    socket.on('your-turn', (data: {
      validActions: ActionType[];
      currentBet: number;
      minRaise: number;
      maxBet?: number;
      betStructure?: 'no-limit' | 'pot-limit' | 'fixed';
      isCapped?: boolean;
      raisesRemaining?: number;
      fixedBetSize?: number;
      actionToken?: string;
    }) => {
      setIsYourTurn(true);
      setValidActions(data.validActions);
      setCurrentBetInfo({
        currentBet: data.currentBet,
        minRaise: data.minRaise,
        maxBet: data.maxBet || 10000,
        betStructure: data.betStructure || 'no-limit',
        isCapped: data.isCapped || false,
        raisesRemaining: data.raisesRemaining ?? 4,
        fixedBetSize: data.fixedBetSize,
      });
      setActionToken(data.actionToken || null);
      setTimerSeconds(maxTimerSeconds);
    });

    socket.on('timer-update', (data: { seconds: number }) => {
      setTimerSeconds(data.seconds);
    });

    socket.on('timebank-update', (data: { chips: number }) => {
      setTimeBankChips(data.chips);
    });

    socket.on('showdown-result', (result: ShowdownResult) => {
      setShowdownResult(result);
      setYourHand([]);
      setIsYourTurn(false);
      result.winners.forEach(w => {
        addLog(createEventLog(
          'win',
          `${w.playerName} wins ${w.amount.toLocaleString()} (${w.handRank})`,
          w.hand && w.hand.length > 0 ? w.hand : undefined
        ));
      });
    });

    socket.on('action-invalid', (data: { reason: string }) => {
      if (data.reason === 'Not your turn') {
        return;
      }
      if (data.reason === 'Invalid action token' || data.reason === 'Action token expired' || data.reason === 'Room is processing another action') {
        socket.emit('request-room-state');
      }
      console.warn(`Invalid action: ${data.reason}`);
      addLog(createEventLog('info', `Invalid action: ${data.reason}`));
    });

    socket.on('sit-down-success', (data: { seatIndex: number }) => {
      console.log(`Seated at ${data.seatIndex}`);
    });

    socket.on('rebuy-success', (data: { amount: number; newStack: number }) => {
      addLog(createEventLog('info', `Added ${data.amount} chips (total: ${data.newStack})`));
    });

    socket.on('draw-complete', (data: { newHand: string[] }) => {
      setYourHand(data.newHand);
      setHasDrawnThisRound(true);
      setSelectedDrawCards([]);
    });

    socket.on('player-drew', (data: { playerId: string; playerName: string; cardCount: number }) => {
      addLog(createEventLog('info', `${data.playerName} drew ${data.cardCount} cards`));
    });

    socket.on('runout-started', (_data: { runoutPhase: string; fullBoard: string[] }) => {
      setIsRunout(true);
      addLog(createEventLog('info', 'All-in runout...'));
    });

    socket.on('runout-board', (data: { board: string[]; phase: string }) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            board: data.board,
          }
        };
      });
      if (data.phase === 'FLOP') {
        addLog(createEventLog('flop', data.board.slice(0, 3).join(' ')));
      } else if (data.phase === 'TURN') {
        addLog(createEventLog('turn', data.board[3]));
      } else if (data.phase === 'RIVER') {
        addLog(createEventLog('river', data.board[4]));
        setTimeout(() => setIsRunout(false), 500);
      }
    });

    return () => {
      // イベントリスナーをクリーンアップ
      socket.off('room-state-update');
      socket.off('room-joined');
      socket.off('game-started');
      socket.off('your-turn');
      socket.off('showdown-result');
      socket.off('action-invalid');
      socket.off('sit-down-success');
      socket.off('rebuy-success');
      socket.off('draw-complete');
      socket.off('player-drew');
      socket.off('runout-started');
      socket.off('runout-board');
      socket.off('timer-update');
      socket.off('timebank-update');
    };
  }, [socket, actionToken]);

  // コンポーネントアンマウント時のみルームから退出
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-room');
      }
    };
  }, []); // 空の依存配列 = マウント/アンマウント時のみ実行

  // タイマーカウントダウン
  useEffect(() => {
    if (!isYourTurn || timerSeconds === undefined) return;

    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev === undefined || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isYourTurn, timerSeconds !== undefined]);

  useEffect(() => {
    if (timerSeconds === 0 && isYourTurn) {
      setTimerSeconds(undefined);
    }
  }, [timerSeconds, isYourTurn]);

  // ドローフェーズ検出
  useEffect(() => {
    if (!room) return;

    const gameState = room.gameState as any;
    const isInDrawPhase = gameState.isDrawPhase === true;

    if (isInDrawPhase && !isDrawPhase) {
      setIsDrawPhase(true);
      setHasDrawnThisRound(false);
      setSelectedDrawCards([]);
    } else if (!isInDrawPhase && isDrawPhase) {
      setIsDrawPhase(false);
      setHasDrawnThisRound(false);
      setSelectedDrawCards([]);
    }
  }, [room?.gameState]);

  useEffect(() => {
    if (!room) return;
    const seatIndex = room.players.findIndex(p => p?.socketId === yourSocketId);
    if (seatIndex === -1) return;
    const player = room.players[seatIndex];
    if (player?.hand && player.hand.length > 0 && yourHand.length === 0) {
      setYourHand(player.hand);
    }
  }, [room, yourSocketId, yourHand.length]);

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
  const isSittingOut = yourPlayer?.status === 'SIT_OUT' || yourPlayer?.pendingSitOut;

  const currentRoundBets = room.players.reduce((sum, p) => sum + (p?.bet || 0), 0);
  const totalPotRaw = room.gameState.pot.main + room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  const displayPot = totalPotRaw - currentRoundBets;
  const totalPot = totalPotRaw;

  const yourBet = isSeated ? (room.players[yourSeatIndex]?.bet || 0) : 0;
  const yourStack = isSeated ? (room.players[yourSeatIndex]?.stack || 0) : 0;
  const maxPlayers = (room.config.maxPlayers as 6 | 8) || 6;

  return (
    <div className="table-page">
      {/* ヘッダー */}
      <header className="table-header">
        <div className="header-left">
          <h1 className="room-title">🎰 Room {roomId}</h1>
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
        <button className="action-btn fold" onClick={handleLeaveRoom}>
          Leave
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
        showdownResult={showdownResult}
        isRunout={isRunout}
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

      {/* アクションパネル */}
      {isSeated && !isWaiting && !showdownResult && !isSittingOut && (
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
            bottom: 140,
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
