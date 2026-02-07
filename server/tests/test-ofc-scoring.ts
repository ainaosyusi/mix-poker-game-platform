// ========================================
// OFC Scoring + Joker Resolution Test Suite
// 200+ test cases
// ========================================

import { evaluateHand, compareHands } from '../handEvaluator.js';

// Re-implement the OFCScoring internals for testing
// (since they're not exported, we replicate the logic here)

interface Card { suit: string; rank: string; }
interface HandRank { rank: number; name: string; highCards: number[]; }
interface ThreeCardHandRank { rank: number; name: string; highCards: number[]; }

function isJoker(cardStr: string): boolean {
    return cardStr === 'JK1' || cardStr === 'JK2';
}
function isJokerCard(card: Card): boolean {
    return card.rank === 'JOKER';
}

const ALL_SUITS = ['♠', '♥', '♦', '♣'];
const ALL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function allStandardCards(): Card[] {
    const cards: Card[] = [];
    for (const suit of ALL_SUITS) {
        for (const rank of ALL_RANKS) {
            cards.push({ rank, suit });
        }
    }
    return cards;
}

function parseCard(cardStr: string): Card {
    if (isJoker(cardStr)) return { rank: 'JOKER', suit: cardStr };
    return { rank: cardStr[0], suit: cardStr.slice(1) };
}
function parseCards(cardStrs: string[]): Card[] {
    return cardStrs.map(parseCard);
}

const rankValue = (rank: string): number => {
    const values: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
        '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[rank] || 0;
};
const rankName = (val: number): string => {
    const names: Record<number, string> = {
        2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
        9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
    };
    return names[val] || '?';
};

function evaluateThreeCardHand(cards: Card[]): ThreeCardHandRank {
    if (cards.length !== 3) return { rank: 0, name: 'Invalid', highCards: [] };
    const values = cards.map(c => rankValue(c.rank));
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    const sortedEntries = Array.from(counts.entries())
        .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]);
    const highCards = sortedEntries.map(([rank]) => rank);
    const topCount = sortedEntries[0][1];
    if (topCount === 3) return { rank: 3, name: `Trip ${rankName(highCards[0])}s`, highCards };
    if (topCount === 2) return { rank: 1, name: `Pair of ${rankName(highCards[0])}s`, highCards };
    const sorted = [...values].sort((a, b) => b - a);
    return { rank: 0, name: `${rankName(sorted[0])}-High`, highCards: sorted };
}

function isHandBetter(a: HandRank, b: HandRank): boolean {
    if (a.rank > b.rank) return true;
    if (a.rank < b.rank) return false;
    for (let i = 0; i < Math.min(a.highCards.length, b.highCards.length); i++) {
        if (a.highCards[i] > b.highCards[i]) return true;
        if (a.highCards[i] < b.highCards[i]) return false;
    }
    return false;
}
function isThreeCardHandBetter(a: ThreeCardHandRank, b: ThreeCardHandRank): boolean {
    if (a.rank > b.rank) return true;
    if (a.rank < b.rank) return false;
    for (let i = 0; i < Math.min(a.highCards.length, b.highCards.length); i++) {
        if (a.highCards[i] > b.highCards[i]) return true;
        if (a.highCards[i] < b.highCards[i]) return false;
    }
    return false;
}

function resolveJokersForFiveCards(cards: Card[]): HandRank {
    const jokerIndices: number[] = [];
    const regularCards: Card[] = [];
    for (let i = 0; i < cards.length; i++) {
        if (isJokerCard(cards[i])) jokerIndices.push(i);
        else regularCards.push(cards[i]);
    }
    if (jokerIndices.length === 0) return evaluateHand(cards);
    const regularSet = new Set(regularCards.map(c => c.rank + c.suit));
    const candidates = allStandardCards().filter(c => !regularSet.has(c.rank + c.suit));
    let bestHand: HandRank = { rank: -1, name: '', highCards: [] };
    if (jokerIndices.length === 1) {
        for (const sub of candidates) {
            const testHand = [...cards];
            testHand[jokerIndices[0]] = sub;
            const result = evaluateHand(testHand);
            if (isHandBetter(result, bestHand)) bestHand = result;
        }
    } else {
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const testHand = [...cards];
                testHand[jokerIndices[0]] = candidates[i];
                testHand[jokerIndices[1]] = candidates[j];
                const result = evaluateHand(testHand);
                if (isHandBetter(result, bestHand)) bestHand = result;
            }
        }
    }
    return bestHand;
}

function resolveJokersForThreeCards(cards: Card[]): ThreeCardHandRank {
    const jokerIndices: number[] = [];
    const regularCards: Card[] = [];
    for (let i = 0; i < cards.length; i++) {
        if (isJokerCard(cards[i])) jokerIndices.push(i);
        else regularCards.push(cards[i]);
    }
    if (jokerIndices.length === 0) return evaluateThreeCardHand(cards);
    const regularSet = new Set(regularCards.map(c => c.rank + c.suit));
    const candidates = allStandardCards().filter(c => !regularSet.has(c.rank + c.suit));
    let bestHand: ThreeCardHandRank = { rank: -1, name: '', highCards: [] };
    if (jokerIndices.length === 1) {
        for (const sub of candidates) {
            const testHand = [...cards];
            testHand[jokerIndices[0]] = sub;
            const result = evaluateThreeCardHand(testHand);
            if (isThreeCardHandBetter(result, bestHand)) bestHand = result;
        }
    } else {
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const testHand = [...cards];
                testHand[jokerIndices[0]] = candidates[i];
                testHand[jokerIndices[1]] = candidates[j];
                const result = evaluateThreeCardHand(testHand);
                if (isThreeCardHandBetter(result, bestHand)) bestHand = result;
            }
        }
    }
    return bestHand;
}

// Royalties
function getTopRoyalties(cards: Card[]): number {
    const hand = resolveJokersForThreeCards(cards);
    if (hand.rank === 3) return hand.highCards[0] - 2 + 10;
    if (hand.rank === 1) { const pr = hand.highCards[0]; if (pr >= 6) return pr - 5; }
    return 0;
}
function getMiddleRoyalties(cards: Card[]): number {
    const hand = resolveJokersForFiveCards(cards);
    switch (hand.rank) {
        case 3: return 2; case 4: return 4; case 5: return 8; case 6: return 12; case 7: return 20;
        case 8: { const isRoyal = hand.highCards[0] === 14 && hand.highCards[1] === 13; return isRoyal ? 50 : 30; }
        default: return 0;
    }
}
function getBottomRoyalties(cards: Card[]): number {
    const hand = resolveJokersForFiveCards(cards);
    switch (hand.rank) {
        case 4: return 2; case 5: return 4; case 6: return 6; case 7: return 10;
        case 8: { const isRoyal = hand.highCards[0] === 14 && hand.highCards[1] === 13; return isRoyal ? 25 : 15; }
        default: return 0;
    }
}

// Foul check
function checkFoul(top: string[], middle: string[], bottom: string[]): boolean {
    if (top.length !== 3 || middle.length !== 5 || bottom.length !== 5) return true;
    const topCards = parseCards(top);
    const middleCards = parseCards(middle);
    const bottomCards = parseCards(bottom);
    const botHand = resolveJokersForFiveCards(bottomCards);
    const midHand = resolveJokersForFiveCards(middleCards);
    const topHand = resolveJokersForThreeCards(topCards);
    // Bottom >= Middle
    if (botHand.rank < midHand.rank) return true;
    if (botHand.rank === midHand.rank) {
        for (let i = 0; i < Math.min(botHand.highCards.length, midHand.highCards.length); i++) {
            if (botHand.highCards[i] > midHand.highCards[i]) break;
            if (botHand.highCards[i] < midHand.highCards[i]) return true;
        }
    }
    // Middle >= Top
    if (midHand.rank < topHand.rank) return true;
    if (midHand.rank === topHand.rank) {
        for (let i = 0; i < Math.min(midHand.highCards.length, topHand.highCards.length); i++) {
            if (midHand.highCards[i] > topHand.highCards[i]) break;
            if (midHand.highCards[i] < topHand.highCards[i]) return true;
        }
    }
    return false;
}

// Fantasyland
function checkFantasylandEntry(top: string[], isFouled: boolean): boolean {
    if (isFouled || top.length !== 3) return false;
    const hand = resolveJokersForThreeCards(parseCards(top));
    if (hand.rank === 3) return true;
    if (hand.rank === 1 && hand.highCards[0] >= 12) return true;
    return false;
}

// ========================================
// Test Runner
// ========================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        passed++;
    } else {
        failed++;
        const msg = detail ? `FAIL: ${testName} — ${detail}` : `FAIL: ${testName}`;
        failures.push(msg);
        console.log(`  ✗ ${msg}`);
    }
}

function assertEq(actual: any, expected: any, testName: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    assert(ok, testName, ok ? undefined : `expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
}

// ========================================
// TEST GROUP 1: handEvaluator 'T' rank fix (20 tests)
// ========================================
console.log('\n=== GROUP 1: handEvaluator T rank fix ===');
{
    // T card should have value 10
    const h1 = evaluateHand(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'A♠']));
    assertEq(h1.rank, 8, '1.1 Royal Flush with T');
    assertEq(h1.name, 'Straight Flush', '1.2 Royal Flush name');

    const h2 = evaluateHand(parseCards(['6♠', '7♠', '8♠', '9♠', 'T♠']));
    assertEq(h2.rank, 8, '1.3 Straight Flush 6-T');

    const h3 = evaluateHand(parseCards(['T♠', 'T♥', 'T♦', 'T♣', 'A♠']));
    assertEq(h3.rank, 7, '1.4 Four Tens');

    const h4 = evaluateHand(parseCards(['T♠', 'T♥', 'T♦', 'A♠', 'A♥']));
    assertEq(h4.rank, 6, '1.5 Full House TTT-AA');

    const h5 = evaluateHand(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', '2♠']));
    assertEq(h5.rank, 5, '1.6 Flush with T');

    const h6 = evaluateHand(parseCards(['T♠', 'J♥', 'Q♦', 'K♣', 'A♠']));
    assertEq(h6.rank, 4, '1.7 Straight T-A');

    const h7 = evaluateHand(parseCards(['8♠', '9♥', 'T♦', 'J♣', 'Q♠']));
    assertEq(h7.rank, 4, '1.8 Straight 8-Q');

    const h8 = evaluateHand(parseCards(['7♠', '8♥', '9♦', 'T♣', 'J♠']));
    assertEq(h8.rank, 4, '1.9 Straight 7-J');

    const h9 = evaluateHand(parseCards(['T♠', 'T♥', 'T♦', '5♣', '3♠']));
    assertEq(h9.rank, 3, '1.10 Three Tens');

    const h10 = evaluateHand(parseCards(['T♠', 'T♥', 'A♦', 'K♣', '3♠']));
    assertEq(h10.rank, 1, '1.11 Pair of Tens');

    const h11 = evaluateHand(parseCards(['T♠', '8♥', '6♦', '4♣', '2♠']));
    assertEq(h11.rank, 0, '1.12 High Card T');

    // Compare hands with T
    const cmp1 = compareHands(
        parseCards(['8♠', '9♥', 'T♦', 'J♣', 'Q♠']),
        parseCards(['4♠', '5♥', '6♦', '7♣', '8♥'])
    );
    assertEq(cmp1, 1, '1.13 Straight 8-Q beats Straight 4-8');

    const cmp2 = compareHands(
        parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'A♠']),
        parseCards(['9♠', 'T♠', 'J♠', 'Q♠', 'K♠'])
    );
    // Both are straight flushes; first is A-high, second is K-high
    assertEq(cmp2, 1, '1.14 Royal Flush beats K-high SF');

    // Wheel with T absent
    const h12 = evaluateHand(parseCards(['A♠', '2♥', '3♦', '4♣', '5♠']));
    assertEq(h12.rank, 4, '1.15 Wheel straight A-5');

    // Non-straight with T
    const h13 = evaluateHand(parseCards(['T♠', 'Q♥', 'K♦', 'A♣', '3♠']));
    assertEq(h13.rank, 0, '1.16 High Card A (T present, not straight)');

    // T-T two pair
    const h14 = evaluateHand(parseCards(['T♠', 'T♥', 'J♦', 'J♣', '3♠']));
    assertEq(h14.rank, 2, '1.17 Two Pair TT-JJ');

    // Straight 9-K
    const h15 = evaluateHand(parseCards(['9♠', 'T♥', 'J♦', 'Q♣', 'K♠']));
    assertEq(h15.rank, 4, '1.18 Straight 9-K');

    // Straight 5-9
    const h16 = evaluateHand(parseCards(['5♠', '6♥', '7♦', '8♣', '9♠']));
    assertEq(h16.rank, 4, '1.19 Straight 5-9 (no T)');

    // Four of a kind Tens vs Four Aces
    const cmp3 = compareHands(
        parseCards(['T♠', 'T♥', 'T♦', 'T♣', 'K♠']),
        parseCards(['A♠', 'A♥', 'A♦', 'A♣', '2♠'])
    );
    assertEq(cmp3, -1, '1.20 Four Tens loses to Four Aces');
}

// ========================================
// TEST GROUP 2: 5-card Joker resolution — 1 Joker (40 tests)
// ========================================
console.log('\n=== GROUP 2: 5-card with 1 Joker ===');
{
    // Joker completes a straight
    const r1 = resolveJokersForFiveCards(parseCards(['4♠', '5♥', 'JK1', '7♦', '8♣']));
    assertEq(r1.rank, 4, '2.1 Joker=6 → Straight 4-8');

    // Joker completes a straight flush
    const r2 = resolveJokersForFiveCards(parseCards(['4♠', '5♠', 'JK1', '7♠', '8♠']));
    assertEq(r2.rank, 8, '2.2 Joker=6♠ → Straight Flush 4-8');

    // Joker makes four of a kind
    const r3 = resolveJokersForFiveCards(parseCards(['A♠', 'A♥', 'A♦', 'JK1', 'K♠']));
    assertEq(r3.rank, 7, '2.3 Joker=A♣ → Four Aces');

    // Joker makes full house (trip + pair already)
    const r4 = resolveJokersForFiveCards(parseCards(['K♠', 'K♥', 'K♦', 'JK1', '5♠']));
    assertEq(r4.rank, 7, '2.4 Joker=K♣ → Four Kings');

    // Joker makes a flush
    const r5 = resolveJokersForFiveCards(parseCards(['2♠', '5♠', '9♠', 'Q♠', 'JK1']));
    assertEq(r5.rank, 5, '2.5 Joker=A♠ → Flush (A high)');

    // Joker makes royal flush
    const r6 = resolveJokersForFiveCards(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'JK1']));
    assertEq(r6.rank, 8, '2.6 Joker=A♠ → Royal Flush');
    assertEq(r6.highCards[0], 14, '2.7 Royal Flush A-high');

    // Joker makes straight with T card
    const r7 = resolveJokersForFiveCards(parseCards(['8♠', '9♥', 'T♦', 'JK1', 'Q♣']));
    assertEq(r7.rank, 4, '2.8 Joker=J → Straight 8-Q (T card)');

    // Joker + 4 cards makes best possible
    const r8 = resolveJokersForFiveCards(parseCards(['2♠', '5♥', '9♦', 'K♣', 'JK1']));
    assert(r8.rank >= 1, '2.9 Joker makes at least a pair');

    // Joker with pair → trips
    const r9 = resolveJokersForFiveCards(parseCards(['Q♠', 'Q♥', '5♦', '3♣', 'JK1']));
    assertEq(r9.rank, 3, '2.10 Joker+QQ → Three Queens');

    // Joker with two pair → full house
    const r10 = resolveJokersForFiveCards(parseCards(['K♠', 'K♥', '7♦', '7♣', 'JK1']));
    assertEq(r10.rank, 6, '2.11 Joker+KK77 → Full House');

    // Joker completes wheel
    const r11 = resolveJokersForFiveCards(parseCards(['A♠', '2♥', '3♦', '4♣', 'JK1']));
    assertEq(r11.rank, 4, '2.12 Joker=5 → Wheel A-5');

    // Joker + straight flush potential
    const r12 = resolveJokersForFiveCards(parseCards(['9♥', 'T♥', 'J♥', 'Q♥', 'JK1']));
    assertEq(r12.rank, 8, '2.13 Joker=K♥ or 8♥ → Straight Flush');

    // Joker as the high card of straight
    const r13 = resolveJokersForFiveCards(parseCards(['9♠', 'T♥', 'J♦', 'Q♣', 'JK2']));
    assertEq(r13.rank, 4, '2.14 Joker=K or 8 → Straight');

    // Joker + trips → four of a kind
    const r14 = resolveJokersForFiveCards(parseCards(['5♠', '5♥', '5♦', 'JK1', '9♣']));
    assertEq(r14.rank, 7, '2.15 Joker+555 → Four 5s');

    // Verify JK2 works same as JK1
    const r15 = resolveJokersForFiveCards(parseCards(['A♠', 'A♥', 'A♦', 'JK2', 'K♠']));
    assertEq(r15.rank, 7, '2.16 JK2: Four Aces');

    // Joker with all different suits/ranks → pair (best possible)
    const r16 = resolveJokersForFiveCards(parseCards(['2♠', '4♥', '7♦', 'J♣', 'JK1']));
    assert(r16.rank >= 1, '2.17 Joker makes at least pair');

    // Joker helps straight: A-2-3-4-Jo → Straight (wheel)
    const r17 = resolveJokersForFiveCards(parseCards(['A♠', '2♥', '3♦', '4♣', 'JK1']));
    assertEq(r17.rank, 4, '2.18 Joker → Wheel');

    // Joker in middle of straight
    const r18 = resolveJokersForFiveCards(parseCards(['3♠', '4♥', 'JK1', '6♦', '7♣']));
    assertEq(r18.rank, 4, '2.19 Joker=5 → Straight 3-7');

    // Joker helps flush but not straight flush (non-consecutive)
    const r19 = resolveJokersForFiveCards(parseCards(['2♦', '5♦', '8♦', 'J♦', 'JK1']));
    assertEq(r19.rank, 5, '2.20 Joker=A♦ → Flush');

    // Joker + AAKK → Full House (AA full of KK or KK full of AA... actually trips)
    const r20 = resolveJokersForFiveCards(parseCards(['A♠', 'A♥', 'K♠', 'K♥', 'JK1']));
    assertEq(r20.rank, 6, '2.21 Joker+AAKK → Full House');

    // Joker makes straight: T-J-Q-K-Jo → Straight (A or 9)
    const r21 = resolveJokersForFiveCards(parseCards(['T♠', 'J♥', 'Q♦', 'K♣', 'JK1']));
    assertEq(r21.rank, 4, '2.22 T-J-Q-K-Jo → Straight (A high)');
    assertEq(r21.highCards[0], 14, '2.23 Straight A-high');

    // Joker + 3 same suit + 1 diff → flush preferred over pair
    const r22 = resolveJokersForFiveCards(parseCards(['2♠', '5♠', '9♠', 'Q♠', 'JK1']));
    assertEq(r22.rank, 5, '2.24 Joker → Flush');

    // Joker with pair where straight also possible → should pick stronger
    const r23 = resolveJokersForFiveCards(parseCards(['9♠', 'T♥', 'J♦', 'J♣', 'JK1']));
    assert(r23.rank >= 3, '2.25 Joker+JJ+9T → at least trips');

    // Joker + nothing special → pair of highest card
    const r24 = resolveJokersForFiveCards(parseCards(['2♠', '4♥', '6♦', '9♣', 'JK1']));
    assert(r24.rank >= 1, '2.26 Joker → at least pair');

    // Verify the user's exact bug case: Bot 89TQJo
    const r25 = resolveJokersForFiveCards(parseCards(['8♠', '9♥', 'T♦', 'Q♣', 'JK1']));
    assertEq(r25.rank, 4, '2.27 8-9-T-Q-Jo → Straight (Joker=J)');

    // And the user's Mid case: 65Jo48
    const r26 = resolveJokersForFiveCards(parseCards(['6♠', '5♥', 'JK1', '4♦', '8♣']));
    assertEq(r26.rank, 4, '2.28 6-5-Jo-4-8 → Straight (Joker=7)');

    // Joker with high straight
    const r27 = resolveJokersForFiveCards(parseCards(['A♠', 'K♥', 'Q♦', 'J♣', 'JK1']));
    assertEq(r27.rank, 4, '2.29 A-K-Q-J-Jo → Straight (Joker=T)');
    assertEq(r27.highCards[0], 14, '2.30 Broadway straight A-high');

    // Joker makes pair of Aces (no better hand possible)
    const r28 = resolveJokersForFiveCards(parseCards(['A♠', '3♥', '6♦', '9♣', 'JK1']));
    assertEq(r28.rank, 1, '2.31 Joker=A → Pair of Aces');
    assertEq(r28.highCards[0], 14, '2.32 Pair of Aces high');

    // 4 to a flush + Joker
    const r29 = resolveJokersForFiveCards(parseCards(['A♥', 'K♥', 'Q♥', 'J♥', 'JK1']));
    assertEq(r29.rank, 8, '2.33 A♥K♥Q♥J♥+Jo → Royal Flush');

    // Joker + 3 of a kind + high kicker
    const r30 = resolveJokersForFiveCards(parseCards(['7♠', '7♥', '7♦', 'A♣', 'JK1']));
    assertEq(r30.rank, 7, '2.34 Joker+777A → Four 7s');

    // Straight flush potential with gap
    const r31 = resolveJokersForFiveCards(parseCards(['5♣', '6♣', '8♣', '9♣', 'JK1']));
    assertEq(r31.rank, 8, '2.35 5♣6♣_8♣9♣+Jo → Straight Flush (Joker=7♣)');

    // Straight with low cards
    const r32 = resolveJokersForFiveCards(parseCards(['2♠', '3♥', '4♦', '5♣', 'JK1']));
    assertEq(r32.rank, 4, '2.36 2-3-4-5-Jo → Straight (Joker=6 or A)');

    // Consecutive cards with Joker at end
    const r33 = resolveJokersForFiveCards(parseCards(['5♠', '6♥', '7♦', '8♣', 'JK1']));
    assertEq(r33.rank, 4, '2.37 5-6-7-8-Jo → Straight (Joker=9 or 4)');

    // Two pair + Joker → Full House
    const r34 = resolveJokersForFiveCards(parseCards(['T♠', 'T♥', '5♦', '5♣', 'JK1']));
    assertEq(r34.rank, 6, '2.38 TT55+Jo → Full House');

    // Flush with Joker and T
    const r35 = resolveJokersForFiveCards(parseCards(['2♠', 'T♠', 'Q♠', 'K♠', 'JK1']));
    // Jo=J♠ makes 2♠T♠J♠Q♠K♠ → Flush (not SF, 2 breaks consecutive). Jo=A♠ → Flush A-K-Q-T-2 suited.
    assertEq(r35.rank, 5, '2.39 2♠T♠Q♠K♠+Jo → Flush (best)');
}

// ========================================
// TEST GROUP 3: 5-card Joker resolution — 2 Jokers (30 tests)
// ========================================
console.log('\n=== GROUP 3: 5-card with 2 Jokers ===');
{
    // 2 Jokers + pair → four of a kind
    const r1 = resolveJokersForFiveCards(parseCards(['A♠', 'A♥', 'JK1', 'JK2', '5♠']));
    assertEq(r1.rank, 7, '3.1 AA+2Jo → Four Aces');

    // 2 Jokers + trips → cannot make 5-of-a-kind, but can make 4-of-a-kind + kicker
    const r2 = resolveJokersForFiveCards(parseCards(['K♠', 'K♥', 'K♦', 'JK1', 'JK2']));
    // Best: Jo1=K♣ (four kings) and Jo2=A♠ (best kicker) → Four Kings
    assertEq(r2.rank, 7, '3.2 KKK+2Jo → Four Kings');

    // 2 Jokers + 3 suited → straight flush potential
    const r3 = resolveJokersForFiveCards(parseCards(['T♠', 'J♠', 'Q♠', 'JK1', 'JK2']));
    assertEq(r3.rank, 8, '3.3 T♠J♠Q♠+2Jo → Straight Flush (Jo=K♠,A♠ or 9♠,8♠)');

    // 2 Jokers + random cards → at least trips
    const r4 = resolveJokersForFiveCards(parseCards(['A♠', '5♥', 'JK1', 'JK2', '9♦']));
    assert(r4.rank >= 3, '3.4 A+5+9+2Jo → at least Three of a Kind');

    // 2 Jokers + 3 consecutive suited → straight flush
    const r5 = resolveJokersForFiveCards(parseCards(['5♥', '6♥', '7♥', 'JK1', 'JK2']));
    assertEq(r5.rank, 8, '3.5 5♥6♥7♥+2Jo → Straight Flush');

    // 2 Jokers + pair → four of a kind
    const r6 = resolveJokersForFiveCards(parseCards(['T♠', 'T♥', '3♦', 'JK1', 'JK2']));
    assertEq(r6.rank, 7, '3.6 TT+3+2Jo → Four Tens');

    // 2 Jokers + nothing → trips or better
    const r7 = resolveJokersForFiveCards(parseCards(['2♠', '7♥', 'Q♦', 'JK1', 'JK2']));
    assert(r7.rank >= 3, '3.7 2+7+Q+2Jo → at least trips');

    // 2 Jokers + 3 to flush → flush
    const r8 = resolveJokersForFiveCards(parseCards(['2♦', '5♦', 'K♦', 'JK1', 'JK2']));
    assertEq(r8.rank, 5, '3.8 2♦5♦K♦+2Jo → Flush (or better)');
    assert(r8.rank >= 5, '3.9 At least flush');

    // 2 Jokers + A + suited cards → Royal Flush?
    const r9 = resolveJokersForFiveCards(parseCards(['A♠', 'K♠', 'Q♠', 'JK1', 'JK2']));
    assertEq(r9.rank, 8, '3.10 A♠K♠Q♠+2Jo → Royal Flush');

    // 2 Jokers + consecutive → straight or better
    const r10 = resolveJokersForFiveCards(parseCards(['8♠', '9♥', 'T♦', 'JK1', 'JK2']));
    assert(r10.rank >= 4, '3.11 8+9+T+2Jo → at least Straight');

    // 2 Jokers + single high card
    const r11 = resolveJokersForFiveCards(parseCards(['A♠', '3♥', '8♦', 'JK1', 'JK2']));
    assert(r11.rank >= 3, '3.12 A+3+8+2Jo → at least trips');

    // 2 Jokers help complete 4 to a straight flush
    const r12 = resolveJokersForFiveCards(parseCards(['6♣', '7♣', '9♣', 'JK1', 'JK2']));
    assertEq(r12.rank, 8, '3.13 6♣7♣_9♣+2Jo → Straight Flush (Jo=8♣,T♣ or 5♣,8♣)');

    // 2 Jokers + suited A-K → Royal Flush
    const r13 = resolveJokersForFiveCards(parseCards(['A♥', 'K♥', 'JK1', 'JK2', '2♠']));
    // Can't make Royal Flush because 2♠ takes a slot. Best: AK+QJT of hearts? No, only 2 Jokers.
    // Jo1=Q♥, Jo2=J♥ → A♥K♥Q♥J♥2♠ → not all same suit.
    // Best may be: Jo1=A♦, Jo2=A♣ → trips Aces or Jo1=K♦, Jo2=K♣ → trips Kings. Or better.
    assert(r13.rank >= 3, '3.14 AhKh+2♠+2Jo → at least trips');

    // 2 Jokers making full house from single card
    const r14 = resolveJokersForFiveCards(parseCards(['A♠', '2♥', '3♦', 'JK1', 'JK2']));
    assert(r14.rank >= 3, '3.15 A+2+3+2Jo → at least trips');

    // All low cards + 2 Jokers
    const r15 = resolveJokersForFiveCards(parseCards(['2♠', '3♥', '4♦', 'JK1', 'JK2']));
    assert(r15.rank >= 4, '3.16 2+3+4+2Jo → at least Straight (Jo=5,6 or A,5)');

    // Mixed suits + 2 Jokers with close ranks
    const r16 = resolveJokersForFiveCards(parseCards(['J♠', 'Q♥', 'K♦', 'JK1', 'JK2']));
    assert(r16.rank >= 4, '3.17 J+Q+K+2Jo → at least Straight');

    // 2 Jokers + all same rank (pair) + odd card
    const r17 = resolveJokersForFiveCards(parseCards(['8♠', '8♥', '3♦', 'JK1', 'JK2']));
    assertEq(r17.rank, 7, '3.18 88+3+2Jo → Four 8s');

    // Low pair + 2 Jokers
    const r18 = resolveJokersForFiveCards(parseCards(['2♠', '2♥', '9♦', 'JK1', 'JK2']));
    assertEq(r18.rank, 7, '3.19 22+9+2Jo → Four 2s');

    // Suit-heavy hand + 2 Jokers
    const r19 = resolveJokersForFiveCards(parseCards(['3♠', '7♠', 'J♠', 'JK1', 'JK2']));
    assertEq(r19.rank, 5, '3.20 3♠7♠J♠+2Jo → at least Flush');
    assert(r19.rank >= 5, '3.21 Flush or better');

    // 5♠6♠ + 2Jo + 9♦ → straight possible (Jo=7,8) or flush possible?
    const r20 = resolveJokersForFiveCards(parseCards(['5♠', '6♠', '9♦', 'JK1', 'JK2']));
    assert(r20.rank >= 3, '3.22 5♠6♠9♦+2Jo → at least trips');

    // Verify user's bug case: both rows together
    const bot = resolveJokersForFiveCards(parseCards(['8♠', '9♥', 'T♦', 'Q♣', 'JK1']));
    const mid = resolveJokersForFiveCards(parseCards(['6♠', '5♥', 'JK2', '4♦', '8♣']));
    assertEq(bot.rank, 4, '3.23 User bug: Bot is Straight');
    assertEq(mid.rank, 4, '3.24 User bug: Mid is Straight');
    assert(bot.highCards[0] > mid.highCards[0], '3.25 Bot straight > Mid straight');

    // 2 Jokers + 3 of same rank → four of a kind (can only add one more of same rank)
    const r21 = resolveJokersForFiveCards(parseCards(['A♠', 'A♥', 'A♦', 'JK1', 'JK2']));
    assertEq(r21.rank, 7, '3.26 AAA+2Jo → Four Aces (Jo=A♣, other=K)');

    // J♠ + Q♠ + K♠ + 2Jo → Royal Flush
    const r22 = resolveJokersForFiveCards(parseCards(['J♠', 'Q♠', 'K♠', 'JK1', 'JK2']));
    assertEq(r22.rank, 8, '3.27 J♠Q♠K♠+2Jo → Straight Flush (or Royal)');

    // All offsuit low + 2Jo
    const r23 = resolveJokersForFiveCards(parseCards(['2♠', '4♥', '6♦', 'JK1', 'JK2']));
    assert(r23.rank >= 3, '3.28 2+4+6+2Jo → at least trips');

    // Pair + same suit potential
    const r24 = resolveJokersForFiveCards(parseCards(['K♠', 'K♥', 'Q♠', 'JK1', 'JK2']));
    assertEq(r24.rank, 7, '3.29 KK+Q+2Jo → Four Kings');

    // Single card + 2 Jokers + 2 random → best possible
    const r25 = resolveJokersForFiveCards(parseCards(['A♠', '7♥', '2♦', 'JK1', 'JK2']));
    assert(r25.rank >= 3, '3.30 A+7+2+2Jo → at least trips');
}

// ========================================
// TEST GROUP 4: 3-card Joker resolution (40 tests)
// ========================================
console.log('\n=== GROUP 4: 3-card hands ===');
{
    // No Joker tests
    const t1 = resolveJokersForThreeCards(parseCards(['A♠', 'A♥', 'A♦']));
    assertEq(t1.rank, 3, '4.1 AAA → Trips');
    const t2 = resolveJokersForThreeCards(parseCards(['K♠', 'K♥', '3♦']));
    assertEq(t2.rank, 1, '4.2 KK3 → Pair of Kings');
    const t3 = resolveJokersForThreeCards(parseCards(['A♠', 'K♥', 'Q♦']));
    assertEq(t3.rank, 0, '4.3 AKQ → High Card');

    // 1 Joker tests
    const t4 = resolveJokersForThreeCards(parseCards(['K♠', 'K♥', 'JK1']));
    assertEq(t4.rank, 3, '4.4 KK+Jo → Trip Kings');
    assertEq(t4.highCards[0], 13, '4.5 Trip Kings highCard');

    const t5 = resolveJokersForThreeCards(parseCards(['A♠', 'A♥', 'JK1']));
    assertEq(t5.rank, 3, '4.6 AA+Jo → Trip Aces');
    assertEq(t5.highCards[0], 14, '4.7 Trip Aces highCard');

    const t6 = resolveJokersForThreeCards(parseCards(['Q♠', 'JK1', '5♦']));
    assertEq(t6.rank, 1, '4.8 Q+Jo+5 → Pair of Queens');
    assertEq(t6.highCards[0], 12, '4.9 Pair of Queens');

    const t7 = resolveJokersForThreeCards(parseCards(['A♠', 'JK1', '3♦']));
    assertEq(t7.rank, 1, '4.10 A+Jo+3 → Pair of Aces');
    assertEq(t7.highCards[0], 14, '4.11 Pair of Aces');

    const t8 = resolveJokersForThreeCards(parseCards(['2♠', 'JK1', '3♦']));
    assertEq(t8.rank, 1, '4.12 2+Jo+3 → Pair (best possible, likely pair of 3s or Aces)');
    assert(t8.highCards[0] >= 3, '4.13 At least pair of 3s');

    // Actually, Joker should become A → Pair of Aces (14) with kicker 3
    // vs Joker = 3 → Pair of 3s (3) with kicker A (wait, 2 is there)
    // Joker = A would give: A, 2, 3 → no pair... oh wait, A+2+3 has no pair.
    // Joker must match an existing card to make a pair. Existing cards: 2♠, 3♦
    // Joker=2 → pair of 2s (rank 1, highCards [2, 3])
    // Joker=3 → pair of 3s (rank 1, highCards [3, 2])
    // Joker=A → A, 2, 3 → high card A
    // Best pair: pair of 3s? No wait, Joker=A gives high card rank 0 vs pair rank 1
    // So Joker should match one of {2, 3} to make a pair. Pair of 3s (highCard 3, kicker 2) is better.
    // Actually wait, Joker could become any card. Joker=K gives K,2,3 → high card K.
    // But pair of 3s > high card K. So best is pair.
    // But what about Joker=A♠? That gives A♠,2♠,3♦ → High card A. Rank 0.
    // Joker=3♠ gives 3♠,2♠,3♦ → Pair of 3s. Rank 1. Better!
    // But Joker could also become 2♥ → 2♠,2♥,3♦ → Pair of 2s. Rank 1 but highCards=[2,3].
    // Pair of 3s highCards=[3,2] vs Pair of 2s highCards=[2,3] → Pair of 3s is better.
    // HOWEVER, could Joker become something even better? Let's check:
    // We need a card that when added to {2♠, 3♦} makes the best 3-card hand.
    // Any card X: if X.rank=2 → pair of 2s. If X.rank=3 → pair of 3s. Otherwise → high card.
    // So best is pair of 3s. But actually, what about X.rank=A?
    // A, 2, 3 → high card A (rank 0, highCards [14, 3, 2])
    // vs pair of 3s (rank 1, highCards [3, 2])
    // Pair (rank 1) > High card (rank 0). So best is pair of 3s.
    // But wait, could Joker become ANY card? Yes. So we should try Joker=K♠ → K,2,3 → high card K.
    // Still rank 0. Pair of 3s is better. So the answer is pair of 3s or pair of 2s.
    // Actually, pair of ANYTHING is better than high card. And the best pair from {2,3} + Joker is:
    // Joker = 3 of any suit not 3♦ → pair of 3s, highCards [3, 2]
    assertEq(t8.highCards[0], 3, '4.14 2+Jo+3 → Pair of 3s (highest possible pair)');

    // Actually, wait. The function tries ALL candidates. Could Joker become a rank not in {2,3}?
    // If Joker=K → K,2,3 → high card K → rank 0. Worse than pair.
    // If Joker=A → A,2,3 → high card A → rank 0. Worse than pair.
    // So yes, best is pair of 3s.

    const t9 = resolveJokersForThreeCards(parseCards(['T♠', 'JK1', '5♦']));
    assertEq(t9.rank, 1, '4.15 T+Jo+5 → Pair of Tens');
    assertEq(t9.highCards[0], 10, '4.16 Pair of Tens');

    const t10 = resolveJokersForThreeCards(parseCards(['J♠', 'JK1', 'Q♦']));
    assertEq(t10.rank, 1, '4.17 J+Jo+Q → Pair of Queens');
    assertEq(t10.highCards[0], 12, '4.18 Pair of Queens (Q > J)');

    // 2 Jokers in 3-card hand
    const t11 = resolveJokersForThreeCards(parseCards(['A♠', 'JK1', 'JK2']));
    assertEq(t11.rank, 3, '4.19 A+2Jo → Trip Aces');

    const t12 = resolveJokersForThreeCards(parseCards(['K♠', 'JK1', 'JK2']));
    assertEq(t12.rank, 3, '4.20 K+2Jo → Trip Kings');

    const t13 = resolveJokersForThreeCards(parseCards(['2♠', 'JK1', 'JK2']));
    assertEq(t13.rank, 3, '4.21 2+2Jo → Trip 2s');
    assertEq(t13.highCards[0], 2, '4.22 Trip 2s highCard');

    const t14 = resolveJokersForThreeCards(parseCards(['T♠', 'JK1', 'JK2']));
    assertEq(t14.rank, 3, '4.23 T+2Jo → Trip Tens');
    assertEq(t14.highCards[0], 10, '4.24 Trip Tens highCard');

    // Various single card + Joker → pair of that card
    for (const [rank, val, idx] of [
        ['2', 2, 25], ['3', 3, 26], ['4', 4, 27], ['5', 5, 28],
        ['6', 6, 29], ['7', 7, 30], ['8', 8, 31], ['9', 9, 32],
        ['T', 10, 33], ['J', 11, 34], ['Q', 12, 35], ['K', 13, 36], ['A', 14, 37],
    ] as [string, number, number][]) {
        const r = resolveJokersForThreeCards(parseCards([`${rank}♠`, 'JK1', `${rank}♥`]));
        assertEq(r.rank, 3, `4.${idx} ${rank}${rank}+Jo → Trips`);
    }

    // Joker with two different cards
    const t15 = resolveJokersForThreeCards(parseCards(['A♠', 'K♥', 'JK1']));
    assertEq(t15.rank, 1, '4.38 AK+Jo → Pair of Aces');
    assertEq(t15.highCards[0], 14, '4.39 Pair of Aces');

    const t16 = resolveJokersForThreeCards(parseCards(['5♠', '3♥', 'JK2']));
    assertEq(t16.rank, 1, '4.40 5+3+Jo → Pair of 5s');
    assertEq(t16.highCards[0], 5, '4.41 Pair of 5s');
}

// ========================================
// TEST GROUP 5: Foul Detection (40 tests)
// ========================================
console.log('\n=== GROUP 5: Foul Detection ===');
{
    // Valid boards (not fouled)
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['4♠', '5♥', '6♦', '7♣', '8♠'],
        ['T♠', 'J♥', 'Q♦', 'K♣', 'A♠']
    ), false, '5.1 High Card < Straight < Straight → Not foul');

    assertEq(checkFoul(
        ['K♠', 'K♥', '2♦'],
        ['4♠', '5♥', '6♦', '7♣', '8♠'],
        ['A♠', 'A♥', 'A♦', 'A♣', '2♠']
    ), false, '5.2 Pair < Straight < Four of a Kind → Not foul');

    assertEq(checkFoul(
        ['A♠', 'K♥', 'Q♦'],
        ['2♠', '2♥', '3♦', '3♣', '5♠'],
        ['T♠', 'T♥', 'T♦', 'K♣', '5♥']
    ), false, '5.3 High Card < Two Pair < Three of a Kind → Not foul');

    // User's bug case (should NOT be foul after fix)
    assertEq(checkFoul(
        ['K♠', 'K♥', '2♦'],
        ['6♠', '5♥', 'JK1', '4♦', '8♣'],
        ['8♠', '9♥', 'T♦', 'Q♣', 'JK2']
    ), false, '5.4 User bug case: KK < Straight 4-8 < Straight 8-Q → Not foul');

    // Fouled boards
    assertEq(checkFoul(
        ['A♠', 'A♥', 'A♦'],
        ['2♠', '3♥', '4♦', '5♣', '7♠'],
        ['8♠', '9♥', 'T♦', 'J♣', 'Q♠']
    ), true, '5.5 Trips > Straight → Foul (top > middle)');

    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['A♠', 'A♥', 'A♦', 'A♣', 'K♠'],
        ['4♠', '5♥', '6♦', '7♣', '8♠']
    ), true, '5.6 Four of a Kind > Straight → Foul (middle > bottom)');

    // Joker in top row makes pair → valid if middle/bottom are stronger
    assertEq(checkFoul(
        ['Q♠', 'JK1', '5♦'],
        ['4♠', '5♥', '6♦', '7♣', '8♠'],
        ['T♠', 'T♥', 'T♦', 'T♣', 'A♠']
    ), false, '5.7 Pair QQ < Straight < Four Tens → Not foul');

    // Joker in top makes trips
    // Bottom=2♠3♠4♠5♠6♠=SF(8), Middle=Four Kings(7), Top=Trip Aces(3). Bot>=Mid>=Top ✓
    assertEq(checkFoul(
        ['A♠', 'A♥', 'JK1'],
        ['A♦', 'K♠', 'K♥', 'K♦', 'K♣'],
        ['2♠', '3♠', '4♠', '5♠', '6♠']
    ), false, '5.8 Trip Aces < Four Kings < Straight Flush → Not foul');

    // Middle stronger than bottom → foul
    assertEq(checkFoul(
        ['2♠', '3♥', '4♦'],
        ['A♠', 'K♠', 'Q♠', 'J♠', 'T♠'],
        ['A♥', 'K♥', 'Q♥', 'J♥', '9♥']
    ), true, '5.9 Middle Royal Flush > Bottom Flush → Foul');

    // All rows equal rank type but proper ordering
    assertEq(checkFoul(
        ['2♠', '2♥', '3♦'],
        ['5♠', '5♥', '6♦', '6♣', '8♠'],
        ['A♠', 'A♥', 'K♦', 'K♣', '9♠']
    ), false, '5.10 Pair < Two Pair(66/55) < Two Pair(AA/KK) → Not foul');

    // Same rank type, wrong ordering
    // Top=Pair AA(1), Mid=Two Pair 66/55(2), Bot=Two Pair KK/22(2). Bot>=Mid>=Top ✓
    assertEq(checkFoul(
        ['A♠', 'A♥', '3♦'],
        ['5♠', '5♥', '6♦', '6♣', '8♠'],
        ['K♠', 'K♥', '2♦', '2♣', '9♠']
    ), false, '5.11 Pair AA < Two Pair 66/55 < Two Pair KK/22 → Not foul');

    // Actual foul: top trips, middle pair
    assertEq(checkFoul(
        ['K♠', 'K♥', 'K♦'],
        ['2♠', '2♥', '5♦', '7♣', '9♠'],
        ['A♠', 'A♥', 'A♦', 'A♣', '3♠']
    ), true, '5.12 Trip Kings(3) > Pair(1) for middle → Foul');

    // Joker in bottom making straight flush
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['4♠', '5♠', '6♠', '7♠', '8♠'],
        ['9♠', 'T♠', 'J♠', 'Q♠', 'JK1']
    ), false, '5.13 High Card < Straight Flush < Straight Flush → Not foul');

    // Joker in middle makes it too strong → foul
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['A♠', 'A♥', 'A♦', 'JK1', 'K♠'],
        ['4♠', '5♥', '6♦', '7♣', '8♠']
    ), true, '5.14 Four Aces(7) > Straight(4) → Foul (middle > bottom)');

    // Both Jokers in same row
    // Mid=4♠5♠6♠+2Jo → SF(rank 8) via Jo=7♠,8♠. Bot=Four Aces(7). Mid(8)>Bot(7) → FOUL
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['4♠', '5♠', '6♠', 'JK1', 'JK2'],
        ['A♠', 'A♥', 'A♦', 'A♣', 'K♠']
    ), true, '5.15 Mid SF(8) > Bot Four Aces(7) → Foul');

    // Incomplete board → foul
    assertEq(checkFoul(['K♠', 'K♥'], ['4♠', '5♥', '6♦', '7♣', '8♠'], ['T♠', 'J♥', 'Q♦', 'K♣', 'A♠']),
        true, '5.16 Incomplete top → Foul');
    assertEq(checkFoul(['K♠', 'K♥', '2♦'], ['4♠', '5♥', '6♦', '7♣'], ['T♠', 'J♥', 'Q♦', 'K♣', 'A♠']),
        true, '5.17 Incomplete middle → Foul');
    assertEq(checkFoul(['K♠', 'K♥', '2♦'], ['4♠', '5♥', '6♦', '7♣', '8♠'], ['T♠', 'J♥', 'Q♦']),
        true, '5.18 Incomplete bottom → Foul');

    // Pair in top, Pair in middle (same rank) → depends on kicker
    assertEq(checkFoul(
        ['A♠', 'A♥', '2♦'],
        ['A♦', 'A♣', '5♠', '7♥', '9♦'],
        ['K♠', 'K♥', 'K♦', 'K♣', '3♠']
    ), false, '5.19 Pair AA ≤ Pair AA (same rank, compare kickers) < Four Kings → Not foul');

    // Edge: All three rows same hand type
    assertEq(checkFoul(
        ['2♠', '2♥', '3♦'],
        ['5♠', '5♥', '8♦', '9♣', 'A♠'],
        ['K♠', 'K♥', '4♦', '7♣', 'J♠']
    ), false, '5.20 Pair 22 < Pair 55 < Pair KK → Not foul');

    // Joker makes middle stronger than bottom → foul
    assertEq(checkFoul(
        ['2♠', '3♥', '4♦'],
        ['T♠', 'T♥', 'T♦', 'JK1', '5♣'],
        ['J♠', 'J♥', 'J♦', '2♣', '8♠']
    ), true, '5.21 Mid=Four Tens(7) > Bot=Three Jacks(3) → Foul');

    // Straight in top? Can't have straight in 3 cards. Just checking rank ordering.
    assertEq(checkFoul(
        ['Q♠', 'Q♥', 'JK1'],
        ['A♠', 'A♥', 'A♦', '5♣', '5♠'],
        ['K♠', 'K♥', 'K♦', 'K♣', '9♠']
    ), false, '5.22 Trip QQ < Full House < Four Kings → Not foul');

    // Bot=Straight, Mid=Straight, same rank → foul if bot < mid
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['6♠', '7♥', '8♦', '9♣', 'T♠'],
        ['5♠', '6♥', '7♦', '8♣', '9♠']
    ), true, '5.23 Mid Straight 6-T > Bot Straight 5-9 → Foul');

    // Same straight → not foul (equal is ok)
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['5♠', '6♥', '7♦', '8♣', '9♠'],
        ['5♣', '6♦', '7♠', '8♥', '9♦']
    ), false, '5.24 Equal straights → Not foul');

    // With T and Joker (the exact bug scenario)
    assertEq(checkFoul(
        ['K♠', 'K♥', '2♦'],
        ['4♠', '5♥', '6♦', '7♣', 'JK1'],
        ['8♠', '9♥', 'T♦', 'J♣', 'JK2']
    ), false, '5.25 KK pair < Straight 4-8(Jo=8) < Straight 8-Q(Jo=Q) → Not foul');
    // Wait: Mid = 4,5,6,7,Jo → Jo=8 makes 4-5-6-7-8 straight OR Jo=3 makes 3-4-5-6-7? Both straights.
    // Best: Jo could make straight flush if all same suit. Otherwise straight.
    // Bot = 8,9,T,J,Jo → straight 8-9-T-J-Q (Jo=Q) or 7-8-9-T-J (Jo=7). Best is Q-high.
    // Actually 8-J already present, Jo=Q gives 8-9-T-J-Q (Q=12 high).
    // Compare: Bot straight Q-high > Mid straight 8-high → ✓

    // Fantasyland-eligible top with Joker
    assertEq(checkFoul(
        ['Q♠', 'Q♥', 'JK1'],
        ['5♠', '6♥', '7♦', '8♣', '9♠'],
        ['T♠', 'J♥', 'Q♦', 'K♣', 'A♠']
    ), false, '5.26 Trip QQ < Straight 5-9 < Straight T-A → Not foul');

    // Joker in all three rows can't happen (only 2 Jokers), but test 2 Jokers in different rows
    assertEq(checkFoul(
        ['A♠', 'JK1', '5♦'],
        ['4♠', '5♥', '6♦', '7♣', '8♠'],
        ['T♠', 'J♥', 'Q♦', 'K♣', 'JK2']
    ), false, '5.27 Pair AA < Straight 4-8 < Straight T-A → Not foul');

    // More T-card foul tests
    assertEq(checkFoul(
        ['5♠', '5♥', '3♦'],
        ['T♠', 'T♥', '7♦', '7♣', '2♠'],
        ['A♠', 'A♥', 'K♦', 'K♣', 'Q♠']
    ), false, '5.28 Pair 55 < Two Pair TT/77 < Two Pair AA/KK → Not foul');

    assertEq(checkFoul(
        ['T♠', 'T♥', '3♦'],
        ['K♠', 'K♥', 'K♦', '5♣', '8♠'],
        ['A♠', 'A♥', 'A♦', 'A♣', '2♠']
    ), false, '5.29 Pair TT < Trips KKK < Four Aces → Not foul');

    // Top=Trip TT(3) with Joker, Mid=Two Pair AA/55(2). Trip(3) > TwoPair(2) → FOUL
    assertEq(checkFoul(
        ['T♠', 'T♥', 'JK1'],
        ['A♠', 'A♥', '5♦', '5♣', '8♠'],
        ['K♠', 'K♥', 'K♦', 'K♣', '2♠']
    ), true, '5.30 Trip TT(3) > Two Pair(2) → Foul');

    // Proper ordering with all different hand types + Jokers
    assertEq(checkFoul(
        ['6♠', '6♥', 'JK1'],
        ['Q♠', 'Q♥', 'Q♦', '8♣', '8♠'],
        ['A♠', 'A♥', 'A♦', 'A♣', 'K♠']
    ), false, '5.31 Trip 6s(3) < Full House(6) < Four Aces(7) → Not foul');

    // More edge cases with Jokers
    assertEq(checkFoul(
        ['3♠', 'JK1', '7♦'],
        ['2♠', '2♥', '4♦', '4♣', '9♠'],
        ['K♠', 'K♥', 'K♦', '5♣', '5♠']
    ), false, '5.32 Pair 7s(1) < Two Pair(2) < Full House(6) → Not foul');

    assertEq(checkFoul(
        ['A♠', 'K♥', 'Q♦'],
        ['JK1', '5♥', '6♦', '7♣', '8♠'],
        ['T♠', 'T♥', 'T♦', 'T♣', '2♠']
    ), false, '5.33 High Card < Straight < Four Tens → Not foul');

    assertEq(checkFoul(
        ['A♠', 'K♥', 'JK1'],
        ['2♠', '3♥', '4♦', '5♣', '7♠'],
        ['T♠', 'J♥', 'Q♦', 'K♣', 'A♦']
    ), true, '5.34 Pair AA(1) < High Card(0)? No. Mid is High card 7. Top Pair AA(1) > Mid High(0) → Foul');

    assertEq(checkFoul(
        ['2♠', '3♥', '4♦'],
        ['A♠', 'K♥', 'Q♦', 'J♣', 'JK1'],
        ['A♥', 'K♦', 'Q♣', 'J♠', 'T♥']
    ), false, '5.35 High Card < Straight A-T (Jo=T) < Straight A-T → Not foul (equal bot/mid ok)');

    // Additional T-related tests
    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['T♠', 'J♥', 'Q♦', 'K♣', 'A♠'],
        ['T♥', 'J♠', 'Q♣', 'K♦', 'A♥']
    ), false, '5.36 Equal Broadway straights → Not foul');

    assertEq(checkFoul(
        ['2♠', '2♥', '3♦'],
        ['T♠', 'T♥', 'T♦', '5♣', '8♠'],
        ['T♣', 'J♠', 'Q♥', 'K♦', 'A♠']
    ), false, '5.37 Pair < Trips TTT < Straight T-A → Not foul');

    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['6♠', '7♥', '8♦', '9♣', 'T♠'],
        ['7♠', '8♥', '9♦', 'T♣', 'J♠']
    ), false, '5.38 High Card < Straight 6-T < Straight 7-J → Not foul');

    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['7♠', '8♥', '9♦', 'T♣', 'J♠'],
        ['6♠', '7♥', '8♦', '9♣', 'T♠']
    ), true, '5.39 Mid Straight 7-J > Bot Straight 6-T → Foul');

    assertEq(checkFoul(
        ['2♠', '3♥', '5♦'],
        ['8♠', '9♥', 'T♦', 'J♣', 'Q♠'],
        ['9♠', 'T♥', 'J♦', 'Q♣', 'K♠']
    ), false, '5.40 High Card < Straight 8-Q < Straight 9-K → Not foul');
}

// ========================================
// TEST GROUP 6: Royalties (30 tests)
// ========================================
console.log('\n=== GROUP 6: Royalties ===');
{
    // Top royalties
    assertEq(getTopRoyalties(parseCards(['A♠', 'A♥', 'A♦'])), 22, '6.1 Trip Aces top = 22');
    assertEq(getTopRoyalties(parseCards(['K♠', 'K♥', 'K♦'])), 21, '6.2 Trip Kings top = 21');
    assertEq(getTopRoyalties(parseCards(['2♠', '2♥', '2♦'])), 10, '6.3 Trip 2s top = 10');
    assertEq(getTopRoyalties(parseCards(['A♠', 'A♥', '3♦'])), 9, '6.4 Pair AA top = 9');
    assertEq(getTopRoyalties(parseCards(['K♠', 'K♥', '3♦'])), 8, '6.5 Pair KK top = 8');
    assertEq(getTopRoyalties(parseCards(['Q♠', 'Q♥', '3♦'])), 7, '6.6 Pair QQ top = 7');
    assertEq(getTopRoyalties(parseCards(['6♠', '6♥', '3♦'])), 1, '6.7 Pair 66 top = 1');
    assertEq(getTopRoyalties(parseCards(['5♠', '5♥', '3♦'])), 0, '6.8 Pair 55 top = 0 (below 66)');
    assertEq(getTopRoyalties(parseCards(['A♠', 'K♥', 'Q♦'])), 0, '6.9 High card top = 0');

    // Top royalties with Joker
    assertEq(getTopRoyalties(parseCards(['A♠', 'A♥', 'JK1'])), 22, '6.10 AA+Jo = Trip Aces = 22');
    assertEq(getTopRoyalties(parseCards(['K♠', 'K♥', 'JK1'])), 21, '6.11 KK+Jo = Trip Kings = 21');
    assertEq(getTopRoyalties(parseCards(['Q♠', 'JK1', '3♦'])), 7, '6.12 Q+Jo+3 = Pair QQ = 7');
    assertEq(getTopRoyalties(parseCards(['A♠', 'JK1', '3♦'])), 9, '6.13 A+Jo+3 = Pair AA = 9');
    assertEq(getTopRoyalties(parseCards(['5♠', 'JK1', '3♦'])), 0, '6.14 5+Jo+3 = Pair 5s = 0');
    assertEq(getTopRoyalties(parseCards(['6♠', 'JK1', '3♦'])), 1, '6.15 6+Jo+3 = Pair 6s = 1');

    // Middle royalties
    assertEq(getMiddleRoyalties(parseCards(['5♠', '5♥', '5♦', '3♣', '8♠'])), 2, '6.16 Trips mid = 2');
    assertEq(getMiddleRoyalties(parseCards(['4♠', '5♥', '6♦', '7♣', '8♠'])), 4, '6.17 Straight mid = 4');
    assertEq(getMiddleRoyalties(parseCards(['2♠', '5♠', '7♠', '9♠', 'J♠'])), 8, '6.18 Flush mid = 8');
    assertEq(getMiddleRoyalties(parseCards(['A♠', 'A♥', 'K♦', 'K♣', 'K♠'])), 12, '6.19 Full House mid = 12');
    assertEq(getMiddleRoyalties(parseCards(['T♠', 'T♥', 'T♦', 'T♣', '5♠'])), 20, '6.20 Four Tens mid = 20');
    assertEq(getMiddleRoyalties(parseCards(['5♠', '6♠', '7♠', '8♠', '9♠'])), 30, '6.21 SF mid = 30');
    assertEq(getMiddleRoyalties(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'A♠'])), 50, '6.22 Royal mid = 50');

    // Middle royalties with Joker
    assertEq(getMiddleRoyalties(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'JK1'])), 50, '6.23 Royal+Jo mid = 50');
    assertEq(getMiddleRoyalties(parseCards(['A♠', 'A♥', 'A♦', 'JK1', '5♣'])), 20, '6.24 Four Aces+Jo mid = 20');

    // Bottom royalties
    assertEq(getBottomRoyalties(parseCards(['4♠', '5♥', '6♦', '7♣', '8♠'])), 2, '6.25 Straight bot = 2');
    assertEq(getBottomRoyalties(parseCards(['2♠', '5♠', '7♠', '9♠', 'J♠'])), 4, '6.26 Flush bot = 4');
    assertEq(getBottomRoyalties(parseCards(['A♠', 'A♥', 'K♦', 'K♣', 'K♠'])), 6, '6.27 Full House bot = 6');
    assertEq(getBottomRoyalties(parseCards(['T♠', 'T♥', 'T♦', 'T♣', '5♠'])), 10, '6.28 Four Tens bot = 10');
    assertEq(getBottomRoyalties(parseCards(['T♠', 'J♠', 'Q♠', 'K♠', 'A♠'])), 25, '6.29 Royal bot = 25');
    assertEq(getBottomRoyalties(parseCards(['8♠', '9♥', 'T♦', 'J♣', 'JK1'])), 2, '6.30 Straight+Jo bot = 2');
}

// ========================================
// TEST GROUP 7: Fantasyland Entry (20 tests)
// ========================================
console.log('\n=== GROUP 7: Fantasyland Entry ===');
{
    assertEq(checkFantasylandEntry(['Q♠', 'Q♥', '3♦'], false), true, '7.1 QQ → FL entry');
    assertEq(checkFantasylandEntry(['K♠', 'K♥', '3♦'], false), true, '7.2 KK → FL entry');
    assertEq(checkFantasylandEntry(['A♠', 'A♥', '3♦'], false), true, '7.3 AA → FL entry');
    assertEq(checkFantasylandEntry(['J♠', 'J♥', '3♦'], false), false, '7.4 JJ → No FL');
    assertEq(checkFantasylandEntry(['T♠', 'T♥', '3♦'], false), false, '7.5 TT → No FL');
    assertEq(checkFantasylandEntry(['A♠', 'A♥', 'A♦'], false), true, '7.6 AAA → FL entry');
    assertEq(checkFantasylandEntry(['2♠', '2♥', '2♦'], false), true, '7.7 222 → FL entry (trips)');
    assertEq(checkFantasylandEntry(['A♠', 'K♥', 'Q♦'], false), false, '7.8 High card → No FL');

    // Fouled → no entry
    assertEq(checkFantasylandEntry(['Q♠', 'Q♥', '3♦'], true), false, '7.9 QQ fouled → No FL');

    // Joker entries
    assertEq(checkFantasylandEntry(['Q♠', 'JK1', '3♦'], false), true, '7.10 Q+Jo → QQ pair → FL');
    assertEq(checkFantasylandEntry(['K♠', 'JK1', '3♦'], false), true, '7.11 K+Jo → KK pair → FL');
    assertEq(checkFantasylandEntry(['A♠', 'JK1', '3♦'], false), true, '7.12 A+Jo → AA pair → FL');
    assertEq(checkFantasylandEntry(['J♠', 'JK1', '3♦'], false), false, '7.13 J+Jo → JJ pair → No FL');
    assertEq(checkFantasylandEntry(['A♠', 'A♥', 'JK1'], false), true, '7.14 AA+Jo → Trips → FL');
    assertEq(checkFantasylandEntry(['K♠', 'K♥', 'JK1'], false), true, '7.15 KK+Jo → Trips → FL');
    assertEq(checkFantasylandEntry(['2♠', '2♥', 'JK1'], false), true, '7.16 22+Jo → Trips → FL');

    // 2 Jokers
    assertEq(checkFantasylandEntry(['A♠', 'JK1', 'JK2'], false), true, '7.17 A+2Jo → Trip Aces → FL');
    assertEq(checkFantasylandEntry(['2♠', 'JK1', 'JK2'], false), true, '7.18 2+2Jo → Trip 2s → FL');

    // Edge: J+Jo is pair of Jacks (not QQ+)
    assertEq(checkFantasylandEntry(['J♠', 'JK1', '5♦'], false), false, '7.19 J+Jo+5 → Pair JJ → No FL');

    // T+Jo is pair of Tens (not QQ+)
    assertEq(checkFantasylandEntry(['T♠', 'JK1', '5♦'], false), false, '7.20 T+Jo+5 → Pair TT → No FL');
}

// ========================================
// Summary
// ========================================
console.log('\n========================================');
console.log(`TOTAL: ${passed + failed} tests`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
        console.log(`  ${f}`);
    }
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
