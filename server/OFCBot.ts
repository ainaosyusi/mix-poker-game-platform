// ========================================
// OFC Bot
// ランダム配置BOT（ファウル回避ロジック付き）
// ========================================

import type { OFCPlacement, OFCRow } from './types.js';

// Rank value for sorting
const rankVal = (card: string): number => {
    const r = card[0];
    const values: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
        '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[r] || 0;
};

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Simple heuristic: sort cards by rank descending.
 * Put strongest 2 in bottom, next 2 in middle, weakest 1 in top.
 * This minimizes foul risk since bottom > middle > top in strength.
 */
export function botPlaceInitial(cards: string[]): OFCPlacement[] {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));

    // Bottom gets 2 highest, Middle gets 2 middle, Top gets 1 lowest
    const placements: OFCPlacement[] = [
        { card: sorted[0], row: 'bottom' },
        { card: sorted[1], row: 'bottom' },
        { card: sorted[2], row: 'middle' },
        { card: sorted[3], row: 'middle' },
        { card: sorted[4], row: 'top' },
    ];

    return placements;
}

/**
 * Pineapple round: 3 cards → place 2, discard 1.
 * Strategy: discard the weakest card, place remaining in rows
 * that need cards, preferring bottom/middle for stronger cards.
 */
export function botPlacePineapple(
    cards: string[],
    currentBoard: OFCRow,
): { placements: OFCPlacement[]; discard: string } {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));

    // Discard the weakest card
    const discard = sorted[2];
    const toPlace = [sorted[0], sorted[1]];

    // Calculate remaining capacity
    const topCap = 3 - currentBoard.top.length;
    const midCap = 5 - currentBoard.middle.length;
    const botCap = 5 - currentBoard.bottom.length;

    const placements: OFCPlacement[] = [];

    for (const card of toPlace) {
        // Priority: bottom > middle > top (to keep strength order)
        if (botCap - placements.filter(p => p.row === 'bottom').length > 0) {
            placements.push({ card, row: 'bottom' });
        } else if (midCap - placements.filter(p => p.row === 'middle').length > 0) {
            placements.push({ card, row: 'middle' });
        } else if (topCap - placements.filter(p => p.row === 'top').length > 0) {
            placements.push({ card, row: 'top' });
        } else {
            // Fallback: find any available row
            if (midCap > placements.filter(p => p.row === 'middle').length) {
                placements.push({ card, row: 'middle' });
            } else {
                placements.push({ card, row: 'top' });
            }
        }
    }

    return { placements, discard };
}

/**
 * Fantasyland: 14 cards → place 13, discard 1.
 * Strategy: Sort all cards, distribute Bottom:5, Middle:5, Top:3.
 * Put best 5 in bottom, next 5 in middle, next 3 in top, discard weakest.
 */
export function botPlaceFantasyland(
    cards: string[],
): { placements: OFCPlacement[]; discard: string } {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));

    // Discard the weakest
    const discard = sorted[13];

    const placements: OFCPlacement[] = [];

    // Bottom: 5 strongest
    for (let i = 0; i < 5; i++) {
        placements.push({ card: sorted[i], row: 'bottom' });
    }
    // Middle: next 5
    for (let i = 5; i < 10; i++) {
        placements.push({ card: sorted[i], row: 'middle' });
    }
    // Top: next 3
    for (let i = 10; i < 13; i++) {
        placements.push({ card: sorted[i], row: 'top' });
    }

    return { placements, discard };
}
