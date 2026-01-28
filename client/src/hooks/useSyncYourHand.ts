import { useEffect } from 'react';
import type { Room } from '../types/table';

export function useSyncYourHand(
  room: Room | null,
  yourSocketId: string,
  yourHandLength: number,
  setYourHand: (hand: string[]) => void
) {
  useEffect(() => {
    if (!room) return;
    const seatIndex = room.players.findIndex(p => p?.socketId === yourSocketId);
    if (seatIndex === -1) return;
    const player = room.players[seatIndex];
    if (player?.hand && player.hand.length > 0 && yourHandLength === 0) {
      setYourHand(player.hand);
    }
  }, [room, yourSocketId, yourHandLength]);
}
