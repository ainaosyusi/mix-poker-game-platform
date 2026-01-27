/**
 * 自動着席ロジック
 * 空席からランダムに選択
 */

import type { Player } from './types.js';

/**
 * 空席からランダムに1つ選択
 * @returns 空席のインデックス、満席の場合はnull
 */
export function findRandomEmptySeat(players: (Player | null)[]): number | null {
    const emptySeats = players
        .map((p, i) => p === null ? i : -1)
        .filter(i => i !== -1);

    if (emptySeats.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * emptySeats.length);
    return emptySeats[randomIndex];
}
