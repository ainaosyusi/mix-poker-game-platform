// ========================================
// OFC Scoring Engine
// Pineapple OFC - JOPT Standard Scoring
// ========================================

import { evaluateHand, compareHands } from './handEvaluator.js';
import type { OFCRow, OFCPlayerState, OFCRoundScore } from './types.js';

// Card interface (matching handEvaluator)
interface Card {
    suit: string;
    rank: string;
}

// 3-card hand rank (Top row)
interface ThreeCardHandRank {
    rank: number;        // 0=High Card, 1=Pair, 3=Trips (matches 5-card numbering)
    name: string;
    highCards: number[]; // Tiebreak values, sorted by count desc then rank desc
}

// ========================================
// Card Parsing
// ========================================

function parseCard(cardStr: string): Card {
    // "Ah" → { rank: 'A', suit: 'h' }
    // "Td" → { rank: 'T', suit: 'd' }
    return { rank: cardStr[0], suit: cardStr.slice(1) };
}

function parseCards(cardStrs: string[]): Card[] {
    return cardStrs.map(parseCard);
}

// Rank to numeric value
const rankValue = (rank: string): number => {
    const values: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
        '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[rank] || 0;
};

// Rank value to display name
const rankName = (val: number): string => {
    const names: Record<number, string> = {
        2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
        9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
    };
    return names[val] || '?';
};

// ========================================
// 3-Card Hand Evaluation (Top Row)
// ========================================

export function evaluateThreeCardHand(cards: Card[]): ThreeCardHandRank {
    if (cards.length !== 3) {
        return { rank: 0, name: 'Invalid', highCards: [] };
    }

    const values = cards.map(c => rankValue(c.rank));

    // Count ranks
    const counts = new Map<number, number>();
    for (const v of values) {
        counts.set(v, (counts.get(v) || 0) + 1);
    }

    // Sort by count descending, then rank descending
    const sortedEntries = Array.from(counts.entries())
        .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]);
    const highCards = sortedEntries.map(([rank]) => rank);
    const topCount = sortedEntries[0][1];

    // Three of a Kind
    if (topCount === 3) {
        const r = rankName(highCards[0]);
        return { rank: 3, name: `Trip ${r}s`, highCards };
    }

    // Pair
    if (topCount === 2) {
        const r = rankName(highCards[0]);
        return { rank: 1, name: `Pair of ${r}s`, highCards };
    }

    // High Card
    const sorted = [...values].sort((a, b) => b - a);
    return { rank: 0, name: `${rankName(sorted[0])}-High`, highCards: sorted };
}

// Compare two 3-card hands (1 = hand1 wins, -1 = hand2 wins, 0 = tie)
export function compareThreeCardHands(hand1: ThreeCardHandRank, hand2: ThreeCardHandRank): number {
    if (hand1.rank > hand2.rank) return 1;
    if (hand1.rank < hand2.rank) return -1;

    for (let i = 0; i < Math.min(hand1.highCards.length, hand2.highCards.length); i++) {
        if (hand1.highCards[i] > hand2.highCards[i]) return 1;
        if (hand1.highCards[i] < hand2.highCards[i]) return -1;
    }

    return 0;
}

// ========================================
// Royalty Calculations (JOPT Standard)
// ========================================

/** Top Row Royalties (3 cards) */
export function getTopRoyalties(cards: Card[]): number {
    const hand = evaluateThreeCardHand(cards);

    // Trips: 222=10, 333=11, ..., AAA=22
    if (hand.rank === 3) {
        return hand.highCards[0] - 2 + 10;
    }

    // Pairs: 66=1, 77=2, 88=3, 99=4, TT=5, JJ=6, QQ=7, KK=8, AA=9
    if (hand.rank === 1) {
        const pairRank = hand.highCards[0];
        if (pairRank >= 6) {
            return pairRank - 5;
        }
    }

    return 0;
}

/** Middle Row Royalties (5 cards) */
export function getMiddleRoyalties(cards: Card[]): number {
    const hand = evaluateHand(cards);

    switch (hand.rank) {
        case 3: return 2;   // Three of a Kind
        case 4: return 4;   // Straight
        case 5: return 8;   // Flush
        case 6: return 12;  // Full House
        case 7: return 20;  // Four of a Kind
        case 8: {
            // Royal Flush = A-high straight flush
            const isRoyal = hand.highCards[0] === 14 && hand.highCards[1] === 13;
            return isRoyal ? 50 : 30;
        }
        default: return 0;
    }
}

/** Bottom Row Royalties (5 cards) */
export function getBottomRoyalties(cards: Card[]): number {
    const hand = evaluateHand(cards);

    switch (hand.rank) {
        case 4: return 2;   // Straight
        case 5: return 4;   // Flush
        case 6: return 6;   // Full House
        case 7: return 10;  // Four of a Kind
        case 8: {
            const isRoyal = hand.highCards[0] === 14 && hand.highCards[1] === 13;
            return isRoyal ? 25 : 15;
        }
        default: return 0;
    }
}

// ========================================
// Foul Detection
// ========================================

/**
 * Foul check: Bottom >= Middle >= Top in hand strength.
 * Returns true if the board is fouled.
 */
export function checkFoul(board: OFCRow): boolean {
    if (board.top.length !== 3 || board.middle.length !== 5 || board.bottom.length !== 5) {
        return true; // Incomplete board = foul
    }

    const topCards = parseCards(board.top);
    const middleCards = parseCards(board.middle);
    const bottomCards = parseCards(board.bottom);

    // Bottom must be >= Middle (both 5-card)
    const bottomVsMiddle = compareHands(bottomCards, middleCards);
    if (bottomVsMiddle < 0) return true;

    // Middle must be >= Top (5-card vs 3-card)
    const middleHand = evaluateHand(middleCards);
    const topHand = evaluateThreeCardHand(topCards);

    // Compare by abstract hand rank (3-card rank numbers align with 5-card)
    if (middleHand.rank < topHand.rank) return true;
    if (middleHand.rank > topHand.rank) return false;

    // Same rank category: compare detail values
    for (let i = 0; i < Math.min(middleHand.highCards.length, topHand.highCards.length); i++) {
        if (middleHand.highCards[i] > topHand.highCards[i]) return false;
        if (middleHand.highCards[i] < topHand.highCards[i]) return true;
    }

    return false; // Equal is OK
}

// ========================================
// Fantasyland
// ========================================

/** Entry: QQ+ on top, no foul */
export function checkFantasylandEntry(board: OFCRow, isFouled: boolean): boolean {
    if (isFouled) return false;
    if (board.top.length !== 3) return false;

    const hand = evaluateThreeCardHand(parseCards(board.top));

    // Trips always qualifies
    if (hand.rank === 3) return true;

    // Pair of QQ or better (Q=12, K=13, A=14)
    if (hand.rank === 1 && hand.highCards[0] >= 12) return true;

    return false;
}

/** Continuation: Top trips+, Middle FH+, Bottom quads+ */
export function checkFantasylandContinuation(board: OFCRow, isFouled: boolean): boolean {
    if (isFouled) return false;
    if (board.top.length !== 3 || board.middle.length !== 5 || board.bottom.length !== 5) {
        return false;
    }

    // Top: Trips or better
    const topHand = evaluateThreeCardHand(parseCards(board.top));
    if (topHand.rank >= 3) return true;

    // Middle: Full House or better (rank 6+)
    const middleHand = evaluateHand(parseCards(board.middle));
    if (middleHand.rank >= 6) return true;

    // Bottom: Quads or better (rank 7+)
    const bottomHand = evaluateHand(parseCards(board.bottom));
    if (bottomHand.rank >= 7) return true;

    return false;
}

// ========================================
// Row Comparison Helpers
// ========================================

function compareTopRow(board1: OFCRow, board2: OFCRow): number {
    return compareThreeCardHands(
        evaluateThreeCardHand(parseCards(board1.top)),
        evaluateThreeCardHand(parseCards(board2.top)),
    );
}

function compareMiddleRow(board1: OFCRow, board2: OFCRow): number {
    return compareHands(parseCards(board1.middle), parseCards(board2.middle));
}

function compareBottomRow(board1: OFCRow, board2: OFCRow): number {
    return compareHands(parseCards(board1.bottom), parseCards(board2.bottom));
}

// ========================================
// Main Scoring Function
// ========================================

/**
 * Calculate OFC scores for all players at the end of a hand.
 *
 * Scoring rules (JOPT standard):
 *   - Each row: win +1, lose -1 (per opponent)
 *   - Scoop (win all 3 rows vs one opponent): +3 bonus
 *   - Royalties: net difference exchanged per matchup
 *   - Fouled player: loses all rows + pays opponent royalties
 *   - Both fouled: no exchange
 *   - chipChange = totalPoints * bigBlind
 */
export function calculateOFCScores(
    players: OFCPlayerState[],
    bigBlind: number,
): OFCRoundScore[] {
    // Evaluate each player's board
    const data = players.map(p => {
        const isFouled = checkFoul(p.board);
        const topCards = parseCards(p.board.top);
        const middleCards = parseCards(p.board.middle);
        const bottomCards = parseCards(p.board.bottom);

        return {
            playerId: p.socketId,
            playerName: p.name,
            board: p.board,
            isFouled,
            topRoyalties: isFouled ? 0 : getTopRoyalties(topCards),
            middleRoyalties: isFouled ? 0 : getMiddleRoyalties(middleCards),
            bottomRoyalties: isFouled ? 0 : getBottomRoyalties(bottomCards),
            topHand: isFouled ? 'FOUL' : evaluateThreeCardHand(topCards).name,
            middleHand: isFouled ? 'FOUL' : evaluateHand(middleCards).name,
            bottomHand: isFouled ? 'FOUL' : evaluateHand(bottomCards).name,
            points: 0,
        };
    });

    // Head-to-head comparison (all pairs)
    for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
            const p1 = data[i];
            const p2 = data[j];

            // Both fouled: no exchange
            if (p1.isFouled && p2.isFouled) continue;

            // One fouled: opponent wins all 3 rows + scoop
            if (p1.isFouled) {
                p1.points -= 6;
                p2.points += 6;
                // Royalty: p1 pays p2's royalties (p1 has 0)
                const p2Roy = p2.topRoyalties + p2.middleRoyalties + p2.bottomRoyalties;
                p1.points -= p2Roy;
                p2.points += p2Roy;
                continue;
            }
            if (p2.isFouled) {
                p1.points += 6;
                p2.points -= 6;
                const p1Roy = p1.topRoyalties + p1.middleRoyalties + p1.bottomRoyalties;
                p1.points += p1Roy;
                p2.points -= p1Roy;
                continue;
            }

            // Normal head-to-head
            let p1Wins = 0;
            let p2Wins = 0;

            const topResult = compareTopRow(p1.board, p2.board);
            if (topResult > 0) p1Wins++;
            else if (topResult < 0) p2Wins++;

            const middleResult = compareMiddleRow(p1.board, p2.board);
            if (middleResult > 0) p1Wins++;
            else if (middleResult < 0) p2Wins++;

            const bottomResult = compareBottomRow(p1.board, p2.board);
            if (bottomResult > 0) p1Wins++;
            else if (bottomResult < 0) p2Wins++;

            // Row points
            let netPoints = p1Wins - p2Wins;

            // Scoop bonus
            if (p1Wins === 3) netPoints += 3;
            if (p2Wins === 3) netPoints -= 3;

            // Royalty exchange (net difference)
            const p1Roy = p1.topRoyalties + p1.middleRoyalties + p1.bottomRoyalties;
            const p2Roy = p2.topRoyalties + p2.middleRoyalties + p2.bottomRoyalties;
            netPoints += (p1Roy - p2Roy);

            p1.points += netPoints;
            p2.points -= netPoints;
        }
    }

    // Convert to result format
    return data.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        topHand: p.topHand,
        middleHand: p.middleHand,
        bottomHand: p.bottomHand,
        topRoyalties: p.topRoyalties,
        middleRoyalties: p.middleRoyalties,
        bottomRoyalties: p.bottomRoyalties,
        totalPoints: p.points,
        chipChange: p.points * bigBlind,
        isFouled: p.isFouled,
    }));
}
