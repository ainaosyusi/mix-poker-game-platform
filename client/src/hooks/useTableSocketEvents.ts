import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { createEventLog } from '../components/log/GameLog';
import type { LogEntry } from '../components/log/GameLog';
import type { ActionType, Room, ShowdownResult } from '../types/table';

interface TurnPayload {
  validActions: ActionType[];
  currentBet: number;
  minRaise: number;
  maxBet?: number;
  betStructure?: 'no-limit' | 'pot-limit' | 'fixed';
  isCapped?: boolean;
  raisesRemaining?: number;
  fixedBetSize?: number;
  actionToken?: string;
}

interface TableSocketOptions {
  socket: Socket | null;
  maxTimerSeconds: number;
  addLog: (entry: LogEntry) => void;
  setRoom: Dispatch<SetStateAction<Room | null>>;
  setYourHand: (hand: string[]) => void;
  setShowdownResult: (result: ShowdownResult | null) => void;
  setIsYourTurn: (value: boolean) => void;
  setValidActions: (actions: ActionType[]) => void;
  setCurrentBetInfo: (info: {
    currentBet: number;
    minRaise: number;
    maxBet: number;
    betStructure: 'no-limit' | 'pot-limit' | 'fixed';
    isCapped: boolean;
    raisesRemaining: number;
    fixedBetSize: number | undefined;
  }) => void;
  setActionToken: (token: string | null) => void;
  setTimerSeconds: Dispatch<SetStateAction<number | undefined>>;
  setTimeBankChips: Dispatch<SetStateAction<number>>;
  setHasDrawnThisRound: (value: boolean) => void;
  setSelectedDrawCards: (indexes: number[]) => void;
}

export function useTableSocketEvents({
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
}: TableSocketOptions) {
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (updatedRoom: Room) => {
      setRoom(updatedRoom);
    };

    const handleRoomJoined = (data: { room: Room }) => {
      setRoom(data.room);
    };

    const handleGameStarted = (data: { room: Room; yourHand: string[] }) => {
      setRoom(data.room);
      setYourHand(data.yourHand || []);
      setShowdownResult(null);
    };

    const handleYourTurn = (data: TurnPayload) => {
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
    };

    const handleTimerUpdate = (data: { seconds: number }) => {
      setTimerSeconds(data.seconds);
    };

    const handleTimebankUpdate = (data: { chips: number }) => {
      setTimeBankChips(data.chips);
    };

    const handleShowdownResult = (result: ShowdownResult) => {
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
    };

    const handleActionInvalid = (data: { reason: string }) => {
      if (data.reason === 'Not your turn') {
        return;
      }
      if (
        data.reason === 'Invalid action token' ||
        data.reason === 'Action token expired' ||
        data.reason === 'Room is processing another action'
      ) {
        socket.emit('request-room-state');
      }
      console.warn(`Invalid action: ${data.reason}`);
      addLog(createEventLog('info', `Invalid action: ${data.reason}`));
    };

    const handleSitDownSuccess = (data: { seatIndex: number }) => {
      console.log(`Seated at ${data.seatIndex}`);
    };

    const handleRebuySuccess = (data: { amount: number; newStack: number }) => {
      addLog(createEventLog('info', `Added ${data.amount} chips (total: ${data.newStack})`));
    };

    const handleImBackSuccess = () => {
      addLog(createEventLog('info', "You're back in the game!"));
    };

    const handleDrawComplete = (data: { newHand: string[] }) => {
      setYourHand(data.newHand);
      setHasDrawnThisRound(true);
      setSelectedDrawCards([]);
    };

    const handlePlayerDrew = (data: { playerId: string; playerName: string; cardCount: number }) => {
      addLog(createEventLog('info', `${data.playerName} drew ${data.cardCount} cards`));
    };

    const handleRunoutStarted = (data: {
      runoutPhase: string;
      fullBoard: string[];
      revealedHands?: Array<{ playerId: string; playerName: string; hand: string[] }>
    }) => {
      addLog(createEventLog('info', 'All-in runout...'));

      // ハンド開示をログに追加
      if (data.revealedHands && data.revealedHands.length > 0) {
        data.revealedHands.forEach(reveal => {
          addLog(createEventLog('info', `${reveal.playerName} shows: ${reveal.hand.join(' ')}`));
        });
      }
    };

    const handleRunoutBoard = (data: { board: string[]; phase: string }) => {
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
      }
    };

    socket.on('room-state-update', handleRoomState);
    socket.on('room-joined', handleRoomJoined);
    socket.on('game-started', handleGameStarted);
    socket.on('your-turn', handleYourTurn);
    socket.on('timer-update', handleTimerUpdate);
    socket.on('timebank-update', handleTimebankUpdate);
    socket.on('showdown-result', handleShowdownResult);
    socket.on('action-invalid', handleActionInvalid);
    socket.on('sit-down-success', handleSitDownSuccess);
    socket.on('rebuy-success', handleRebuySuccess);
    socket.on('im-back-success', handleImBackSuccess);
    socket.on('draw-complete', handleDrawComplete);
    socket.on('player-drew', handlePlayerDrew);
    socket.on('runout-started', handleRunoutStarted);
    socket.on('runout-board', handleRunoutBoard);

    return () => {
      socket.off('room-state-update', handleRoomState);
      socket.off('room-joined', handleRoomJoined);
      socket.off('game-started', handleGameStarted);
      socket.off('your-turn', handleYourTurn);
      socket.off('timer-update', handleTimerUpdate);
      socket.off('timebank-update', handleTimebankUpdate);
      socket.off('showdown-result', handleShowdownResult);
      socket.off('action-invalid', handleActionInvalid);
      socket.off('sit-down-success', handleSitDownSuccess);
      socket.off('rebuy-success', handleRebuySuccess);
      socket.off('im-back-success', handleImBackSuccess);
      socket.off('draw-complete', handleDrawComplete);
      socket.off('player-drew', handlePlayerDrew);
      socket.off('runout-started', handleRunoutStarted);
      socket.off('runout-board', handleRunoutBoard);
    };
  }, [
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
  ]);
}
