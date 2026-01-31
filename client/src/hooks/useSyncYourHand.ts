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
    // サーバーからの手札が多い場合に同期（Stud 4th-7th streetの新規カード対応）
    if (player?.hand && player.hand.length > 0 && player.hand.length > yourHandLength) {
      setYourHand(player.hand);
    }
  }, [room, yourSocketId, yourHandLength]);
}
