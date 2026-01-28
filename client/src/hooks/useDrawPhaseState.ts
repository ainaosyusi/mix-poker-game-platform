import { useEffect } from 'react';
import type { Room } from '../types/table';

export function useDrawPhaseState(
  room: Room | null,
  isDrawPhase: boolean,
  setIsDrawPhase: (value: boolean) => void,
  setHasDrawnThisRound: (value: boolean) => void,
  setSelectedDrawCards: (indexes: number[]) => void
) {
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
}
