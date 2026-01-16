/**
 * Hand Evaluator Tests
 * テスト仕様書: V-NLH, V-PLO, V-RAZZ, V-27, V-BAD
 */

import { describe, it, expect } from 'vitest';
import {
    evaluateHand,
    compareHands,
    evaluateLowHand8OrBetter,
    evaluateRazzHand,
    compareLowHands,
    evaluateBadugiHand,
    compareBadugiHands,
    evaluateDeuceSeven,
    compareDeuceSeven
} from './handEvaluator.ts';

// Helper: カード文字列をCardオブジェクトに変換
function parseCard(str: string): { suit: string; rank: string } {
    // 例: "A♠" -> { rank: 'A', suit: '♠' }
    // "T♠" -> { rank: '10', suit: '♠' }
    let rank = str.slice(0, -1);
    const suit = str.slice(-1);
    // handEvaluatorは'T'を'10'として扱う
    if (rank === 'T') rank = '10';
    return { rank, suit };
}

function parseCards(cards: string[]): { suit: string; rank: string }[] {
    return cards.map(parseCard);
}

describe('Standard Hand Evaluation (V-NLH)', () => {
    describe('役の判定', () => {
        it('Royal Flush (Straight Flush A-high)', () => {
            const hand = parseCards(['A♠', 'K♠', 'Q♠', 'J♠', 'T♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(8);
            expect(result.name).toBe('Straight Flush');
        });

        it('Straight Flush', () => {
            const hand = parseCards(['9♥', '8♥', '7♥', '6♥', '5♥']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(8);
            expect(result.name).toBe('Straight Flush');
        });

        it('Four of a Kind', () => {
            const hand = parseCards(['K♠', 'K♥', 'K♦', 'K♣', '2♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(7);
            expect(result.name).toBe('Four of a Kind');
        });

        it('Full House', () => {
            const hand = parseCards(['Q♠', 'Q♥', 'Q♦', '7♣', '7♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(6);
            expect(result.name).toBe('Full House');
        });

        it('Flush', () => {
            const hand = parseCards(['A♦', 'J♦', '8♦', '6♦', '3♦']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(5);
            expect(result.name).toBe('Flush');
        });

        it('Straight', () => {
            const hand = parseCards(['T♠', '9♥', '8♦', '7♣', '6♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(4);
            expect(result.name).toBe('Straight');
        });

        it('Wheel (A-2-3-4-5)', () => {
            const hand = parseCards(['5♠', '4♥', '3♦', '2♣', 'A♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(4);
            expect(result.name).toBe('Straight');
        });

        it('Three of a Kind', () => {
            const hand = parseCards(['8♠', '8♥', '8♦', 'K♣', '3♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(3);
            expect(result.name).toBe('Three of a Kind');
        });

        it('Two Pair', () => {
            const hand = parseCards(['J♠', 'J♥', '5♦', '5♣', 'A♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(2);
            expect(result.name).toBe('Two Pair');
        });

        it('One Pair', () => {
            const hand = parseCards(['9♠', '9♥', 'A♦', 'K♣', '4♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(1);
            expect(result.name).toBe('One Pair');
        });

        it('High Card', () => {
            const hand = parseCards(['A♠', 'J♥', '8♦', '5♣', '2♠']);
            const result = evaluateHand(hand);
            expect(result.rank).toBe(0);
            expect(result.name).toBe('High Card');
        });
    });

    describe('Hand Comparison', () => {
        it('Flush beats Straight', () => {
            const flush = parseCards(['A♦', 'J♦', '8♦', '6♦', '3♦']);
            const straight = parseCards(['T♠', '9♥', '8♦', '7♣', '6♠']);
            expect(compareHands(flush, straight)).toBe(1);
        });

        it('Higher pair wins', () => {
            const pairK = parseCards(['K♠', 'K♥', 'A♦', '8♣', '3♠']);
            const pairQ = parseCards(['Q♠', 'Q♥', 'A♦', '8♣', '3♠']);
            expect(compareHands(pairK, pairQ)).toBe(1);
        });

        it('Same pair, kicker decides', () => {
            const pairA_K = parseCards(['A♠', 'A♥', 'K♦', '8♣', '3♠']);
            const pairA_Q = parseCards(['A♦', 'A♣', 'Q♦', '8♣', '3♠']);
            expect(compareHands(pairA_K, pairA_Q)).toBe(1);
        });

        it('Identical hands tie', () => {
            const hand1 = parseCards(['A♠', 'K♥', 'Q♦', 'J♣', '9♠']);
            const hand2 = parseCards(['A♦', 'K♣', 'Q♠', 'J♥', '9♦']);
            expect(compareHands(hand1, hand2)).toBe(0);
        });
    });
});

describe('8-or-Better Low Hand (V-PLO8, V-7CS8)', () => {
    it('Valid 8-low', () => {
        const hand = parseCards(['8♠', '6♥', '4♦', '3♣', 'A♠']);
        const result = evaluateLowHand8OrBetter(hand);
        expect(result.valid).toBe(true);
        expect(result.cards).toEqual([1, 3, 4, 6, 8]);
    });

    it('Wheel is best low', () => {
        const hand = parseCards(['5♠', '4♥', '3♦', '2♣', 'A♠']);
        const result = evaluateLowHand8OrBetter(hand);
        expect(result.valid).toBe(true);
        expect(result.cards).toEqual([1, 2, 3, 4, 5]);
    });

    it('No low - contains 9', () => {
        const hand = parseCards(['9♠', '6♥', '4♦', '3♣', 'A♠']);
        const result = evaluateLowHand8OrBetter(hand);
        expect(result.valid).toBe(false);
    });

    it('No low - has pair', () => {
        const hand = parseCards(['8♠', '6♥', '6♦', '3♣', 'A♠']);
        const result = evaluateLowHand8OrBetter(hand);
        expect(result.valid).toBe(false);
    });

    it('Compare lows - 6-low beats 7-low', () => {
        const low6 = evaluateLowHand8OrBetter(parseCards(['6♠', '5♥', '4♦', '3♣', 'A♠']));
        const low7 = evaluateLowHand8OrBetter(parseCards(['7♠', '5♥', '4♦', '3♣', 'A♠']));
        expect(compareLowHands(low6, low7)).toBe(1);
    });
});

describe('Razz Hand Evaluation (V-RAZZ)', () => {
    it('Wheel (A-2-3-4-5) is best', () => {
        const hand = parseCards(['5♠', '4♥', '3♦', '2♣', 'A♠']);
        const result = evaluateRazzHand(hand);
        expect(result.valid).toBe(true);
        expect(result.cards).toEqual([1, 2, 3, 4, 5]);
    });

    it('Pair is valid but weak', () => {
        const hand = parseCards(['8♠', '8♥', '4♦', '3♣', 'A♠']);
        const result = evaluateRazzHand(hand);
        expect(result.valid).toBe(true);
        expect(result.name).toContain('Pair');
    });

    it('No 8-or-better restriction', () => {
        const hand = parseCards(['K♠', 'Q♥', 'J♦', 'T♣', '9♠']);
        const result = evaluateRazzHand(hand);
        expect(result.valid).toBe(true);
    });

    it('Compare Razz - lower hand wins', () => {
        const low7 = evaluateRazzHand(parseCards(['7♠', '5♥', '4♦', '3♣', 'A♠']));
        const low8 = evaluateRazzHand(parseCards(['8♠', '5♥', '4♦', '3♣', 'A♠']));
        expect(compareLowHands(low7, low8)).toBe(1);
    });
});

describe('2-7 Triple Draw Evaluation (V-27)', () => {
    it('7-5-4-3-2 offsuit is nuts', () => {
        const hand = parseCards(['7♠', '5♥', '4♦', '3♣', '2♠']);
        const result = evaluateDeuceSeven(hand);
        expect(result.rank).toBe(0);
        expect(result.hasHand).toBe(false);
        expect(result.name).toBe('7-High');
    });

    it('Pair is bad', () => {
        const hand = parseCards(['7♠', '7♥', '5♦', '3♣', '2♠']);
        const result = evaluateDeuceSeven(hand);
        expect(result.rank).toBe(1);
        expect(result.name).toBe('One Pair');
    });

    it('Straight is bad', () => {
        const hand = parseCards(['7♠', '6♥', '5♦', '4♣', '3♠']);
        const result = evaluateDeuceSeven(hand);
        expect(result.rank).toBe(4);
        expect(result.name).toBe('Straight');
    });

    it('Flush is bad', () => {
        const hand = parseCards(['9♠', '7♠', '5♠', '3♠', '2♠']);
        const result = evaluateDeuceSeven(hand);
        expect(result.rank).toBe(5);
        expect(result.name).toBe('Flush');
    });

    it('A is always high (14)', () => {
        const hand = parseCards(['A♠', '5♥', '4♦', '3♣', '2♠']);
        const result = evaluateDeuceSeven(hand);
        // A-5-4-3-2 is a straight (bad)
        expect(result.rank).toBe(4);
        expect(result.name).toBe('Straight');
    });

    it('Compare - lower high card wins', () => {
        const hand7 = evaluateDeuceSeven(parseCards(['7♠', '5♥', '4♦', '3♣', '2♠']));
        const hand8 = evaluateDeuceSeven(parseCards(['8♠', '5♥', '4♦', '3♣', '2♠']));
        expect(compareDeuceSeven(hand7, hand8)).toBe(1);
    });

    it('No-pair beats pair', () => {
        const noPair = evaluateDeuceSeven(parseCards(['K♠', 'Q♥', 'J♦', 'T♣', '8♠']));
        const pair = evaluateDeuceSeven(parseCards(['7♠', '7♥', '5♦', '3♣', '2♠']));
        expect(compareDeuceSeven(noPair, pair)).toBe(1);
    });
});

describe('Badugi Evaluation (V-BAD)', () => {
    it('4-card Badugi (A-2-3-4 rainbow)', () => {
        const hand = parseCards(['A♠', '2♥', '3♦', '4♣']);
        const result = evaluateBadugiHand(hand);
        expect(result.cardCount).toBe(4);
        expect(result.name).toContain('Badugi');
    });

    it('3-card hand (same suit conflict)', () => {
        const hand = parseCards(['A♠', '2♠', '3♦', '4♣']);
        const result = evaluateBadugiHand(hand);
        expect(result.cardCount).toBe(3);
        expect(result.name).toContain('3-Card');
    });

    it('3-card hand (same rank conflict)', () => {
        const hand = parseCards(['A♠', 'A♥', '3♦', '4♣']);
        const result = evaluateBadugiHand(hand);
        expect(result.cardCount).toBe(3);
    });

    it('2-card hand', () => {
        const hand = parseCards(['A♠', '2♠', '3♠', '4♣']);
        const result = evaluateBadugiHand(hand);
        expect(result.cardCount).toBe(2);
    });

    it('Compare - 4-card beats 3-card', () => {
        const badugi4 = evaluateBadugiHand(parseCards(['A♠', '2♥', '3♦', '4♣']));
        const badugi3 = evaluateBadugiHand(parseCards(['A♠', '2♠', '3♦', '4♣']));
        expect(compareBadugiHands(badugi4, badugi3)).toBe(1);
    });

    it('Compare - lower cards win', () => {
        const low = evaluateBadugiHand(parseCards(['A♠', '2♥', '3♦', '4♣']));
        const high = evaluateBadugiHand(parseCards(['A♠', '2♥', '3♦', '5♣']));
        expect(compareBadugiHands(low, high)).toBe(1);
    });
});

describe('Edge Cases (E-01, E-02)', () => {
    it('Invalid hand length returns Invalid Hand', () => {
        const hand = parseCards(['A♠', 'K♠', 'Q♠']);
        const result = evaluateHand(hand);
        expect(result.rank).toBe(0);
        expect(result.name).toBe('Invalid Hand');
    });

    it('Empty hand returns Invalid Hand', () => {
        const result = evaluateHand([]);
        expect(result.name).toBe('Invalid Hand');
    });

    it('Chop pot scenario - identical rankings', () => {
        // Both have Q-high flush
        const hand1 = parseCards(['Q♠', 'J♠', '9♠', '7♠', '3♠']);
        const hand2 = parseCards(['Q♥', 'J♥', '9♥', '7♥', '3♥']);
        expect(compareHands(hand1, hand2)).toBe(0);
    });
});
