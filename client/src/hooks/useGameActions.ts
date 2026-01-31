/**
 * useGameActions - テーブルアクションフック
 * プレイヤーのアクション（ベット、ドロー、離席、リバイ等）を管理
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type { ActionType } from '../types/table';

interface GameActionsOptions {
  socket: Socket | null;
  actionToken: string | null;
  timeBankChips: number;
  rebuyAmount: number;
  selectedDrawCards: number[];
  maxDrawCount: number;
  onLeaveRoom: () => void;
  setIsYourTurn: (value: boolean) => void;
  setTimerSeconds: Dispatch<SetStateAction<number | undefined>>;
  setTimeBankChips: Dispatch<SetStateAction<number>>;
  setSelectedDrawCards: (indexes: number[]) => void;
}

export function useGameActions({
  socket,
  actionToken,
  timeBankChips,
  rebuyAmount,
  selectedDrawCards,
  maxDrawCount,
  onLeaveRoom,
  setIsYourTurn,
  setTimerSeconds,
  setTimeBankChips,
  setSelectedDrawCards,
}: GameActionsOptions) {
  const handleAction = useCallback((type: ActionType, amount?: number) => {
    if (!socket) return;
    socket.emit('player-action', { type, amount, actionToken });
    setIsYourTurn(false);
    setTimerSeconds(undefined);
  }, [socket, actionToken, setIsYourTurn, setTimerSeconds]);

  const handleUseTimeBank = useCallback(() => {
    if (!socket || timeBankChips <= 0) return;
    socket.emit('use-timebank');
    setTimeBankChips(prev => Math.max(0, prev - 1));
    setTimerSeconds(prev => (prev || 0) + 30);
  }, [socket, timeBankChips, setTimeBankChips, setTimerSeconds]);

  const toggleDrawCard = useCallback((index: number) => {
    setSelectedDrawCards(
      selectedDrawCards.includes(index)
        ? selectedDrawCards.filter(i => i !== index)
        : selectedDrawCards.length >= maxDrawCount
          ? selectedDrawCards
          : [...selectedDrawCards, index]
    );
  }, [selectedDrawCards, maxDrawCount, setSelectedDrawCards]);

  const handleDraw = useCallback(() => {
    if (!socket) return;
    socket.emit('draw-exchange', { discardIndexes: selectedDrawCards });
  }, [socket, selectedDrawCards]);

  const handleLeaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leave-room');
    localStorage.removeItem('mgp-last-room');
    onLeaveRoom();
  }, [socket, onLeaveRoom]);

  const handleRebuy = useCallback(() => {
    if (!socket || rebuyAmount <= 0) return;
    socket.emit('rebuy', { amount: rebuyAmount });
  }, [socket, rebuyAmount]);

  const handleImBack = useCallback(() => {
    if (!socket) return;
    socket.emit('im-back');
  }, [socket]);

  return {
    handleAction,
    handleUseTimeBank,
    toggleDrawCard,
    handleDraw,
    handleLeaveRoom,
    handleRebuy,
    handleImBack,
  };
}
