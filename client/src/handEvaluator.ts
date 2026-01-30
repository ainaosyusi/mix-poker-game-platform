/**
 * Client-side hand evaluator for displaying current hand rank
 * Supports NLH, PLO, Badugi, 2-7, Razz, Stud
 */

interface Card {
  rank: string;
  suit: string;
  value: number;
}

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// For low games (Razz, 2-7), A can be low
const LOW_RANK_VALUES: Record<string, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13
};

// For 2-7, A is always high (14)
const DEUCE_SEVEN_RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_NAMES: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
  '9': '9', 'T': 'T', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
};

function parseCard(cardStr: string): Card {
  const rank = cardStr[0];
  const suit = cardStr[1];
  return { rank, suit, value: RANK_VALUES[rank] || 0 };
}

function parseCards(cards: string[]): Card[] {
  return cards.map(parseCard);
}

interface HandResult {
  rank: number;       // 1-10 (high card to royal flush)
  name: string;       // Human readable name
  highCards: number[]; // Kicker cards
}

// Count occurrences of each rank
function getRankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    counts.set(card.value, (counts.get(card.value) || 0) + 1);
  }
  return counts;
}

// Check for flush
function isFlush(cards: Card[]): boolean {
  if (cards.length < 5) return false;
  const suits = new Map<string, number>();
  for (const card of cards) {
    suits.set(card.suit, (suits.get(card.suit) || 0) + 1);
  }
  return Array.from(suits.values()).some(count => count >= 5);
}

// Get flush cards
function getFlushCards(cards: Card[]): Card[] {
  const suits = new Map<string, Card[]>();
  for (const card of cards) {
    if (!suits.has(card.suit)) suits.set(card.suit, []);
    suits.get(card.suit)!.push(card);
  }
  for (const [_, suitCards] of suits) {
    if (suitCards.length >= 5) {
      return suitCards.sort((a, b) => b.value - a.value).slice(0, 5);
    }
  }
  return [];
}

// Check for straight and return high card
function getStraightHigh(cards: Card[]): number | null {
  const values = [...new Set(cards.map(c => c.value))].sort((a, b) => b - a);

  // Check for A-2-3-4-5 (wheel)
  if (values.includes(14) && values.includes(2) && values.includes(3) &&
      values.includes(4) && values.includes(5)) {
    return 5;
  }

  // Check for regular straight
  for (let i = 0; i <= values.length - 5; i++) {
    if (values[i] - values[i + 4] === 4) {
      return values[i];
    }
  }
  return null;
}

// Evaluate a 5-card hand
function evaluateFiveCards(cards: Card[]): HandResult {
  const counts = getRankCounts(cards);
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const isFlushHand = new Set(cards.map(c => c.suit)).size === 1;
  const straightHigh = getStraightHigh(cards);
  const isStraight = straightHigh !== null;

  // Sort by count, then by value
  const sortedCounts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // highCardは最も高いバリューのカード（フラッシュ等用）
  const highestValueCard = cards.reduce((max, c) => c.value > max.value ? c : max, cards[0]);
  const highCard = RANK_NAMES[highestValueCard.rank];

  // ペア等用のhighCard（最も多いランク）
  const mostFrequentCard = RANK_NAMES[cards.find(c => c.value === sortedCounts[0][0])?.rank || 'A'];

  // Royal Flush
  if (isFlushHand && isStraight && straightHigh === 14) {
    return { rank: 10, name: 'Royal Flush', highCards: values };
  }

  // Straight Flush
  if (isFlushHand && isStraight) {
    return { rank: 9, name: `${highCard}-high Straight Flush`, highCards: [straightHigh!] };
  }

  // Four of a Kind
  if (sortedCounts[0][1] === 4) {
    return { rank: 8, name: `${mostFrequentCard} Quads`, highCards: values };
  }

  // Full House
  if (sortedCounts[0][1] === 3 && sortedCounts[1]?.[1] >= 2) {
    const pairRank = RANK_NAMES[cards.find(c => c.value === sortedCounts[1][0])?.rank || ''];
    return { rank: 7, name: `${mostFrequentCard} Full of ${pairRank}`, highCards: values };
  }

  // Flush
  if (isFlushHand) {
    return { rank: 6, name: `${highCard}-high Flush`, highCards: values };
  }

  // Straight
  if (isStraight) {
    const straightHighName = straightHigh === 5 ? '5' :
      RANK_NAMES[Object.keys(RANK_VALUES).find(k => RANK_VALUES[k] === straightHigh) || ''];
    return { rank: 5, name: `${straightHighName}-high Straight`, highCards: [straightHigh!] };
  }

  // Three of a Kind
  if (sortedCounts[0][1] === 3) {
    return { rank: 4, name: `${mostFrequentCard} Trips`, highCards: values };
  }

  // Two Pair
  if (sortedCounts[0][1] === 2 && sortedCounts[1]?.[1] === 2) {
    const lowPairRank = RANK_NAMES[cards.find(c => c.value === sortedCounts[1][0])?.rank || ''];
    return { rank: 3, name: `${mostFrequentCard} & ${lowPairRank} Two Pair`, highCards: values };
  }

  // One Pair
  if (sortedCounts[0][1] === 2) {
    return { rank: 2, name: `${mostFrequentCard} Pair`, highCards: values };
  }

  // High Card
  return { rank: 1, name: `${highCard} High`, highCards: values };
}

// Get all 5-card combinations from n cards
function getCombinations(cards: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (cards.length === 0) return [];

  const [first, ...rest] = cards;
  const withFirst = getCombinations(rest, k - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// Find the best 5-card hand from n cards (NLH style)
function getBestHand(cards: Card[]): HandResult {
  if (cards.length <= 5) {
    return evaluateFiveCards(cards);
  }

  const combinations = getCombinations(cards, 5);
  let best = evaluateFiveCards(combinations[0]);

  for (const combo of combinations.slice(1)) {
    const result = evaluateFiveCards(combo);
    if (result.rank > best.rank ||
        (result.rank === best.rank && result.highCards[0] > best.highCards[0])) {
      best = result;
    }
  }

  return best;
}

// PLO: Must use exactly 2 hole cards and 3 board cards
function getBestPLOHand(holeCards: Card[], boardCards: Card[]): HandResult {
  if (holeCards.length < 2 || boardCards.length < 3) {
    return { rank: 0, name: '-', highCards: [] };
  }

  let best: HandResult = { rank: 0, name: '-', highCards: [] };

  // Get all 2-card combinations from hole cards
  const holeCombos = getCombinations(holeCards, 2);
  // Get all 3-card combinations from board cards
  const boardCombos = getCombinations(boardCards, 3);

  for (const holeCombo of holeCombos) {
    for (const boardCombo of boardCombos) {
      const hand = [...holeCombo, ...boardCombo];
      const result = evaluateFiveCards(hand);
      if (result.rank > best.rank ||
          (result.rank === best.rank && result.highCards[0] > best.highCards[0])) {
        best = result;
      }
    }
  }

  return best;
}

// ========================================
// BADUGI EVALUATION
// ========================================

interface BadugiResult {
  cardCount: number;
  cards: number[];
  name: string;
}

function evaluateBadugi(cards: Card[]): BadugiResult {
  if (cards.length !== 4) {
    return { cardCount: 0, cards: [], name: '-' };
  }

  // Pick the best card per suit (lowest value wins)
  const suitBest = new Map<string, { card: Card; value: number }>();

  for (const card of cards) {
    const val = LOW_RANK_VALUES[card.rank] || card.value;
    const current = suitBest.get(card.suit);
    if (!current || val < current.value) {
      suitBest.set(card.suit, { card, value: val });
    }
  }

  // Remove duplicate ranks (keep only unique)
  const usedRanks = new Set<number>();
  const validCards: number[] = [];

  // Sort by value (lowest first)
  const sortedSuits = Array.from(suitBest.entries())
    .sort((a, b) => a[1].value - b[1].value);

  for (const [, data] of sortedSuits) {
    if (!usedRanks.has(data.value)) {
      usedRanks.add(data.value);
      validCards.push(data.value);
    }
  }

  validCards.sort((a, b) => a - b);

  const cardCount = validCards.length;
  const cardNames = validCards.map(v => {
    const rank = Object.keys(LOW_RANK_VALUES).find(k => LOW_RANK_VALUES[k] === v);
    return rank || v.toString();
  });

  let name: string;
  if (cardCount === 4) {
    name = `Badugi: ${cardNames.join('-')}`;
  } else if (cardCount === 3) {
    name = `3-Card: ${cardNames.join('-')}`;
  } else if (cardCount === 2) {
    name = `2-Card: ${cardNames.join('-')}`;
  } else {
    name = `1-Card: ${cardNames.join('-')}`;
  }

  return { cardCount, cards: validCards, name };
}

// ========================================
// 2-7 LOWBALL EVALUATION
// ========================================

interface Deuce7Result {
  rank: number;  // Lower is better (0 = best no-pair hand)
  cards: number[];
  name: string;
  hasHand: boolean; // Has pair/straight/flush
}

function evaluateDeuce7(cards: Card[]): Deuce7Result {
  if (cards.length !== 5) {
    return { rank: 999, cards: [], name: '-', hasHand: true };
  }

  // Use 2-7 rank values (A is always 14)
  const values = cards.map(c => DEUCE_SEVEN_RANK_VALUES[c.rank] || c.value);
  const sortedValues = [...values].sort((a, b) => b - a);

  // Count ranks
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const countArr = Array.from(counts.values()).sort((a, b) => b - a);

  // Check flush
  const isFlush = new Set(cards.map(c => c.suit)).size === 1;

  // Check straight (including A-2-3-4-5 which is bad in 2-7)
  const uniqueValues = [...new Set(sortedValues)].sort((a, b) => a - b);
  let isStraight = false;
  if (uniqueValues.length >= 5) {
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      if (uniqueValues[i + 4] - uniqueValues[i] === 4) {
        isStraight = true;
        break;
      }
    }
    // Check A-2-3-4-5 (wheel is a straight in 2-7, which is bad)
    if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(2) &&
        uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
      isStraight = true;
    }
  }

  // Evaluate (lower rank number is better)
  if (isStraight && isFlush) {
    return { rank: 8, cards: sortedValues, name: 'Straight Flush', hasHand: true };
  }
  if (countArr[0] === 4) {
    return { rank: 7, cards: sortedValues, name: 'Four of a Kind', hasHand: true };
  }
  if (countArr[0] === 3 && countArr[1] === 2) {
    return { rank: 6, cards: sortedValues, name: 'Full House', hasHand: true };
  }
  if (isFlush) {
    return { rank: 5, cards: sortedValues, name: 'Flush', hasHand: true };
  }
  if (isStraight) {
    return { rank: 4, cards: sortedValues, name: 'Straight', hasHand: true };
  }
  if (countArr[0] === 3) {
    return { rank: 3, cards: sortedValues, name: 'Trips', hasHand: true };
  }
  if (countArr[0] === 2 && countArr[1] === 2) {
    return { rank: 2, cards: sortedValues, name: 'Two Pair', hasHand: true };
  }
  if (countArr[0] === 2) {
    return { rank: 1, cards: sortedValues, name: 'One Pair', hasHand: true };
  }

  // No pair! This is good in 2-7
  const cardNames = sortedValues.map(v => {
    const rank = Object.keys(DEUCE_SEVEN_RANK_VALUES).find(k => DEUCE_SEVEN_RANK_VALUES[k] === v);
    return rank || v.toString();
  });
  return { rank: 0, cards: sortedValues, name: `${cardNames.join('-')} Low`, hasHand: false };
}

// ========================================
// RAZZ / A-5 LOWBALL EVALUATION
// ========================================

interface RazzResult {
  cards: number[];
  name: string;
  hasPair: boolean;
}

function evaluateRazz(cards: Card[]): RazzResult {
  if (cards.length < 5) {
    // Show partial hand
    const values = cards.map(c => LOW_RANK_VALUES[c.rank] || c.value).sort((a, b) => a - b);
    const cardNames = values.map(v => {
      const rank = Object.keys(LOW_RANK_VALUES).find(k => LOW_RANK_VALUES[k] === v);
      return rank || v.toString();
    });
    return { cards: values, name: `${cardNames.join('-')} (${cards.length} cards)`, hasPair: false };
  }

  // Get 5 lowest cards (ignoring suits, straights don't count)
  const values = cards.map(c => LOW_RANK_VALUES[c.rank] || c.value).sort((a, b) => a - b);

  // Check for pairs
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const hasPair = Array.from(counts.values()).some(c => c >= 2);

  // Take best 5
  const bestFive = values.slice(0, 5);
  const cardNames = bestFive.map(v => {
    const rank = Object.keys(LOW_RANK_VALUES).find(k => LOW_RANK_VALUES[k] === v);
    return rank || v.toString();
  });

  if (hasPair) {
    return { cards: bestFive, name: `${cardNames.join('-')} (Pair)`, hasPair: true };
  }

  return { cards: bestFive, name: `${cardNames.join('-')} Low`, hasPair: false };
}

// ========================================
// A-5 LOW EVALUATION (for Hi-Lo games: PLO8, 7CS8)
// ========================================

// Compare two low hands (from highest card down). Returns negative if a is better.
function compareLowHands(a: number[], b: number[]): number {
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// PLO8 Lo: Must use exactly 2 hole cards and 3 board cards, all <= 8, no pairs
function getBestPLO8Low(holeCards: Card[], boardCards: Card[]): string | null {
  if (holeCards.length < 2 || boardCards.length < 3) return null;

  let bestCards: number[] | null = null;
  const holeCombos = getCombinations(holeCards, 2);
  const boardCombos = getCombinations(boardCards, 3);

  for (const holeCombo of holeCombos) {
    for (const boardCombo of boardCombos) {
      const hand = [...holeCombo, ...boardCombo];
      const lowValues = hand.map(c => LOW_RANK_VALUES[c.rank] || c.value);
      if (lowValues.some(v => v > 8)) continue;
      const uniqueValues = new Set(lowValues);
      if (uniqueValues.size < 5) continue; // has pairs
      const sorted = [...lowValues].sort((a, b) => a - b);
      if (!bestCards || compareLowHands(sorted, bestCards) < 0) {
        bestCards = sorted;
      }
    }
  }

  if (!bestCards) return null;
  const cardNames = bestCards.map(v => {
    const rank = Object.keys(LOW_RANK_VALUES).find(k => LOW_RANK_VALUES[k] === v);
    return rank || v.toString();
  });
  return `Lo: ${cardNames.join('-')}`;
}

// 7CS8 Lo: Best 5 low cards from all cards, all <= 8, no pairs
function getBest7CS8Low(cards: Card[]): string | null {
  if (cards.length < 5) return null;

  let bestCards: number[] | null = null;
  const combos = getCombinations(cards, 5);

  for (const combo of combos) {
    const lowValues = combo.map(c => LOW_RANK_VALUES[c.rank] || c.value);
    if (lowValues.some(v => v > 8)) continue;
    const uniqueValues = new Set(lowValues);
    if (uniqueValues.size < 5) continue;
    const sorted = [...lowValues].sort((a, b) => a - b);
    if (!bestCards || compareLowHands(sorted, bestCards) < 0) {
      bestCards = sorted;
    }
  }

  if (!bestCards) return null;
  const cardNames = bestCards.map(v => {
    const rank = Object.keys(LOW_RANK_VALUES).find(k => LOW_RANK_VALUES[k] === v);
    return rank || v.toString();
  });
  return `Lo: ${cardNames.join('-')}`;
}

/**
 * Evaluate hand and return human-readable rank
 * @param holeCards Player's hole cards (e.g., ['AS', 'KH'])
 * @param boardCards Community cards (e.g., ['QS', 'JS', 'TS', '2C', '3D'])
 * @param variant Game variant ('NLH', 'PLO', 'BADUGI', '2-7_TD', 'RAZZ', etc.)
 * @returns Human-readable hand rank string
 */
export function evaluateHandRank(
  holeCards: string[],
  boardCards: string[],
  variant: string = 'NLH'
): string {
  if (!holeCards || holeCards.length === 0) {
    return '-';
  }

  const hole = parseCards(holeCards);
  const board = parseCards(boardCards);

  // Handle draw games (Badugi, 2-7 TD) - no board cards
  if (variant === 'BADUGI') {
    if (hole.length === 4) {
      return evaluateBadugi(hole).name;
    }
    return '-';
  }

  if (variant === '2-7_TD') {
    if (hole.length === 5) {
      return evaluateDeuce7(hole).name;
    }
    return '-';
  }

  // Handle Stud games (Razz, 7CS, 7CS8) - cards are in hole array
  if (variant === 'RAZZ') {
    if (hole.length >= 3) {
      return evaluateRazz(hole).name;
    }
    return '-';
  }

  if (variant === '7CS') {
    if (hole.length >= 3) {
      return getBestHand(hole).name;
    }
    return '-';
  }

  if (variant === '7CS8') {
    if (hole.length >= 3) {
      const hiName = getBestHand(hole).name;
      if (hole.length >= 5) {
        const loName = getBest7CS8Low(hole);
        if (loName) return `${hiName} / ${loName}`;
      }
      return hiName;
    }
    return '-';
  }

  // For flop games (NLH, PLO, PLO8), check board status
  if (board.length === 0) {
    // Preflop display
    if (hole.length >= 2) {
      if (hole.length === 2) {
        // NLH preflop
        if (hole[0].value === hole[1].value) {
          return `${RANK_NAMES[hole[0].rank]} Pocket Pair`;
        }
        const sorted = hole.sort((a, b) => b.value - a.value);
        const suited = hole.every(c => c.suit === hole[0].suit);
        return `${RANK_NAMES[sorted[0].rank]}-${RANK_NAMES[sorted[1].rank]}${suited ? 's' : 'o'}`;
      } else if (hole.length === 4) {
        // PLO preflop - show high cards
        const sorted = hole.sort((a, b) => b.value - a.value);
        return `${RANK_NAMES[sorted[0].rank]}${RANK_NAMES[sorted[1].rank]}${RANK_NAMES[sorted[2].rank]}${RANK_NAMES[sorted[3].rank]}`;
      }
    }
    return '-';
  }

  // Postflop evaluation
  let result: HandResult;

  if (variant === 'PLO') {
    result = getBestPLOHand(hole, board);
  } else if (variant === 'PLO8') {
    result = getBestPLOHand(hole, board);
    const loName = getBestPLO8Low(hole, board);
    if (loName) {
      return `${result.name} / ${loName}`;
    }
    return result.name;
  } else {
    // NLH and other variants: use any 5 from 7
    result = getBestHand([...hole, ...board]);
  }

  return result.name;
}

export default evaluateHandRank;
