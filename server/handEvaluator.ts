// ポーカーの役判定ロジック

interface Card {
    suit: string;
    rank: string;
}

interface HandRank {
    rank: number; // 役の強さ（数値が大きいほど強い）
    name: string; // 役の名前
    highCards: number[]; // タイブレーク用の高位カード
}

// ランクを数値に変換
const rankValue = (rank: string): number => {
    const values: { [key: string]: number } = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || 0;
};

// ランクのカウント（ペア、スリーカード等の判定用）
const countRanks = (hand: Card[]): Map<number, number> => {
    const counts = new Map<number, number>();
    for (const card of hand) {
        const value = rankValue(card.rank);
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
};

// フラッシュ判定
const isFlush = (hand: Card[]): boolean => {
    const suit = hand[0].suit;
    return hand.every(card => card.suit === suit);
};

// ストレート判定
const isStraight = (hand: Card[]): boolean => {
    const values = hand.map(c => rankValue(c.rank)).sort((a, b) => a - b);

    // 通常のストレート
    for (let i = 0; i < values.length - 1; i++) {
        if (values[i + 1] - values[i] !== 1) {
            // A-2-3-4-5のストレート（ホイール）も考慮
            if (!(values[0] === 2 && values[4] === 14 &&
                values[1] === 3 && values[2] === 4 && values[3] === 5)) {
                return false;
            }
        }
    }
    return true;
};

// 手札の評価
export const evaluateHand = (hand: Card[]): HandRank => {
    if (hand.length !== 5) {
        return { rank: 0, name: 'Invalid Hand', highCards: [] };
    }

    const counts = countRanks(hand);
    // カウント降順 → 同カウント内はランク降順でソート（ペアのランクがキッカーより先に来る）
    const sortedEntries = Array.from(counts.entries())
        .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]);
    const values = sortedEntries.map(([rank]) => rank);
    const countArray = sortedEntries.map(([, count]) => count);

    const flush = isFlush(hand);
    const straight = isStraight(hand);

    // ストレートフラッシュ
    if (straight && flush) {
        return { rank: 8, name: 'Straight Flush', highCards: values };
    }

    // フォーカード
    if (countArray[0] === 4) {
        return { rank: 7, name: 'Four of a Kind', highCards: values };
    }

    // フルハウス
    if (countArray[0] === 3 && countArray[1] === 2) {
        return { rank: 6, name: 'Full House', highCards: values };
    }

    // フラッシュ
    if (flush) {
        return { rank: 5, name: 'Flush', highCards: values };
    }

    // ストレート
    if (straight) {
        return { rank: 4, name: 'Straight', highCards: values };
    }

    // スリーカード
    if (countArray[0] === 3) {
        return { rank: 3, name: 'Three of a Kind', highCards: values };
    }

    // ツーペア
    if (countArray[0] === 2 && countArray[1] === 2) {
        return { rank: 2, name: 'Two Pair', highCards: values };
    }

    // ワンペア
    if (countArray[0] === 2) {
        return { rank: 1, name: 'One Pair', highCards: values };
    }

    // ハイカード
    return { rank: 0, name: 'High Card', highCards: values };
};

// 2つの手札を比較（プレイヤー1が勝ちなら1、プレイヤー2が勝ちなら-1、引き分けなら0）
export const compareHands = (hand1: Card[], hand2: Card[]): number => {
    const rank1 = evaluateHand(hand1);
    const rank2 = evaluateHand(hand2);

    // 役のランクで比較
    if (rank1.rank > rank2.rank) return 1;
    if (rank1.rank < rank2.rank) return -1;

    // 同じ役の場合、高位カードで比較
    for (let i = 0; i < rank1.highCards.length; i++) {
        if (rank1.highCards[i] > rank2.highCards[i]) return 1;
        if (rank1.highCards[i] < rank2.highCards[i]) return -1;
    }

    return 0; // 完全に引き分け
};

// ========================================
// LOW HAND EVALUATION - ローハンド評価
// ========================================

interface LowHandRank {
    valid: boolean;      // 8-or-betterを満たしているか
    cards: number[];     // ローハンドのカード（低い順）
    name: string;        // 表示名
}

// ローハンドでのランク値（Aは1として扱う）
const lowRankValue = (rank: string): number => {
    if (rank === 'A') return 1;
    const values: { [key: string]: number } = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, '10': 10,
        'J': 11, 'Q': 12, 'K': 13
    };
    return values[rank] || 0;
};

/**
 * 8-or-better ローハンド評価（PLO8, 7CS8用）
 * 5枚の手札から最も強いローハンドを評価
 * ペアがなく、8以下のカードのみで構成される必要がある
 */
export const evaluateLowHand8OrBetter = (hand: Card[]): LowHandRank => {
    if (hand.length !== 5) {
        return { valid: false, cards: [], name: 'No Low' };
    }

    // ランク値を取得（重複を排除）
    const uniqueRanks = new Set<number>();
    for (const card of hand) {
        const val = lowRankValue(card.rank);
        if (val > 8) {
            return { valid: false, cards: [], name: 'No Low' };
        }
        uniqueRanks.add(val);
    }

    // 5枚のユニークなカードが必要
    if (uniqueRanks.size !== 5) {
        return { valid: false, cards: [], name: 'No Low' };
    }

    const sortedCards = Array.from(uniqueRanks).sort((a, b) => a - b);
    const highCard = sortedCards[4];
    const lowName = sortedCards.join('-');

    return {
        valid: true,
        cards: sortedCards,
        name: `${highCard}-Low (${lowName})`
    };
};

/**
 * Razz評価（A-5ロー、8-or-better制限なし）
 * ストレート・フラッシュはカウントしない
 * Aは常に1として扱う
 */
export const evaluateRazzHand = (hand: Card[]): LowHandRank => {
    if (hand.length !== 5) {
        return { valid: false, cards: [], name: 'Invalid' };
    }

    // ランク値を取得（重複を含む）
    const ranks = hand.map(c => lowRankValue(c.rank)).sort((a, b) => a - b);

    // ペアチェック（Razzではペアは弱い）
    const uniqueRanks = new Set(ranks);
    const hasPair = uniqueRanks.size < 5;

    // ペアがある場合、高いランク扱い
    if (hasPair) {
        // ペアの数に応じてペナルティ
        const pairPenalty = 5 - uniqueRanks.size;
        return {
            valid: true,
            cards: ranks,
            name: `Pair${pairPenalty > 1 ? 's' : ''} (${ranks.join('-')})`
        };
    }

    const highCard = ranks[4];
    return {
        valid: true,
        cards: ranks,
        name: `${highCard}-Low (${ranks.join('-')})`
    };
};

/**
 * 2つのローハンドを比較
 * 低い方が勝ち（戻り値: 1=hand1勝ち, -1=hand2勝ち, 0=引き分け）
 */
export const compareLowHands = (hand1: LowHandRank, hand2: LowHandRank): number => {
    // 無効なローは負け
    if (!hand1.valid && !hand2.valid) return 0;
    if (!hand1.valid) return -1;
    if (!hand2.valid) return 1;

    // 高いカードから比較（低い方が勝ち）
    for (let i = hand1.cards.length - 1; i >= 0; i--) {
        if (hand1.cards[i] < hand2.cards[i]) return 1;
        if (hand1.cards[i] > hand2.cards[i]) return -1;
    }

    return 0; // 完全に引き分け
};

// ========================================
// BADUGI EVALUATION - バドゥーギ評価
// ========================================

interface BadugiHandRank {
    cardCount: number;   // 有効カード数（4が最強）
    cards: number[];     // カードランク（低い順）
    name: string;        // 表示名
}

/**
 * バドゥーギ評価
 * 4枚の手札で、スートとランクが全て異なるカードを選ぶ
 * 4枚全て異なれば「バドゥーギ」、3枚なら「3-Card」、etc.
 */
export const evaluateBadugiHand = (hand: Card[]): BadugiHandRank => {
    if (hand.length !== 4) {
        return { cardCount: 0, cards: [], name: 'Invalid' };
    }

    // 各スートで最も低いカードを選ぶ
    const suitBest: Map<string, number> = new Map();
    const suitCards: Map<string, Card> = new Map();

    for (const card of hand) {
        const val = lowRankValue(card.rank);
        const current = suitBest.get(card.suit);
        if (current === undefined || val < current) {
            suitBest.set(card.suit, val);
            suitCards.set(card.suit, card);
        }
    }

    // ランクの重複をチェックして除外
    const usedRanks = new Set<number>();
    const validCards: number[] = [];

    // 低いカードから優先して使用
    const sortedSuits = Array.from(suitBest.entries())
        .sort((a, b) => a[1] - b[1]);

    for (const [suit, val] of sortedSuits) {
        if (!usedRanks.has(val)) {
            usedRanks.add(val);
            validCards.push(val);
        }
    }

    validCards.sort((a, b) => a - b);

    const cardCount = validCards.length;
    let name: string;
    if (cardCount === 4) {
        name = `Badugi (${validCards.join('-')})`;
    } else {
        name = `${cardCount}-Card (${validCards.join('-')})`;
    }

    return { cardCount, cards: validCards, name };
};

/**
 * 2つのバドゥーギハンドを比較
 */
export const compareBadugiHands = (hand1: BadugiHandRank, hand2: BadugiHandRank): number => {
    // カード数が多い方が勝ち
    if (hand1.cardCount > hand2.cardCount) return 1;
    if (hand1.cardCount < hand2.cardCount) return -1;

    // 同じカード数なら、高いカードから比較（低い方が勝ち）
    for (let i = hand1.cards.length - 1; i >= 0; i--) {
        if (hand1.cards[i] < hand2.cards[i]) return 1;
        if (hand1.cards[i] > hand2.cards[i]) return -1;
    }

    return 0;
};

// ========================================
// 2-7 LOWBALL EVALUATION - 2-7ロー評価
// ========================================

interface DeuceSevenHandRank {
    rank: number;        // 役の弱さ（数値が小さいほど強い）
    cards: number[];     // カードランク（高い順）
    name: string;        // 表示名
    hasHand: boolean;    // ペア・ストレート・フラッシュがあるか
}

/**
 * 2-7 Triple Draw評価
 * 最も悪い手が勝ち（ストレート・フラッシュもカウント）
 * Aは常に14（高い）として扱う
 * 最強は 7-5-4-3-2 オフスート
 */
export const evaluateDeuceSeven = (hand: Card[]): DeuceSevenHandRank => {
    if (hand.length !== 5) {
        return { rank: 999, cards: [], name: 'Invalid', hasHand: true };
    }

    const counts = countRanks(hand);
    const values = hand.map(c => rankValue(c.rank)).sort((a, b) => b - a);

    // フラッシュチェック
    const flush = isFlush(hand);

    // ストレートチェック（2-7では悪い）
    const sortedValues = [...values].sort((a, b) => a - b);
    let straight = true;
    for (let i = 0; i < sortedValues.length - 1; i++) {
        if (sortedValues[i + 1] - sortedValues[i] !== 1) {
            straight = false;
            break;
        }
    }
    // A-2-3-4-5もストレートとしてカウント（2-7では悪い）
    if (!straight && sortedValues[0] === 2 && sortedValues[4] === 14) {
        if (sortedValues[1] === 3 && sortedValues[2] === 4 && sortedValues[3] === 5) {
            straight = true;
        }
    }

    // ペアチェック
    const countArray = Array.from(counts.values()).sort((a, b) => b - a);
    const hasPair = countArray[0] >= 2;

    // ストレートフラッシュ（最悪）
    if (straight && flush) {
        return { rank: 8, cards: values, name: 'Straight Flush', hasHand: true };
    }

    // フォーカード
    if (countArray[0] === 4) {
        return { rank: 7, cards: values, name: 'Four of a Kind', hasHand: true };
    }

    // フルハウス
    if (countArray[0] === 3 && countArray[1] === 2) {
        return { rank: 6, cards: values, name: 'Full House', hasHand: true };
    }

    // フラッシュ
    if (flush) {
        return { rank: 5, cards: values, name: 'Flush', hasHand: true };
    }

    // ストレート
    if (straight) {
        return { rank: 4, cards: values, name: 'Straight', hasHand: true };
    }

    // スリーカード
    if (countArray[0] === 3) {
        return { rank: 3, cards: values, name: 'Three of a Kind', hasHand: true };
    }

    // ツーペア
    if (countArray[0] === 2 && countArray[1] === 2) {
        return { rank: 2, cards: values, name: 'Two Pair', hasHand: true };
    }

    // ワンペア
    if (hasPair) {
        return { rank: 1, cards: values, name: 'One Pair', hasHand: true };
    }

    // ノーペア（これが良い！）- 高いカードの値で評価
    const highCard = values[0];
    return {
        rank: 0,
        cards: values,
        name: `${highCard}-High`,
        hasHand: false
    };
};

/**
 * 2つの2-7ハンドを比較（低いランクが勝ち）
 */
export const compareDeuceSeven = (hand1: DeuceSevenHandRank, hand2: DeuceSevenHandRank): number => {
    // ランクで比較（低い方が勝ち）
    if (hand1.rank < hand2.rank) return 1;
    if (hand1.rank > hand2.rank) return -1;

    // 同じランクの場合、高いカードから比較（低い方が勝ち）
    for (let i = 0; i < hand1.cards.length; i++) {
        if (hand1.cards[i] < hand2.cards[i]) return 1;
        if (hand1.cards[i] > hand2.cards[i]) return -1;
    }

    return 0;
};

// ========================================
// A-5 LOWBALL EVALUATION - A-5ロー評価
// ========================================

/**
 * A-5 Lowball評価（Razz評価と同一ロジック）
 * ストレート・フラッシュはカウントしない、Aは常に1
 */
export const evaluateA5Hand = evaluateRazzHand;

// ========================================
// HIDUGI EVALUATION - ハイドゥーギ評価
// ========================================

/**
 * ハイドゥーギ評価（高いバドゥーギ）
 * バドゥーギと同じルールだが、高い方が勝ち
 * 各スートで最も高いカードを選び、ランク重複を排除
 */
export const evaluateHidugiHand = (hand: Card[]): BadugiHandRank => {
    if (hand.length !== 4) {
        return { cardCount: 0, cards: [], name: 'Invalid' };
    }

    // 各スートで最も高いカードを選ぶ
    const suitBest: Map<string, number> = new Map();

    for (const card of hand) {
        const val = rankValue(card.rank); // A=14（高い）
        const current = suitBest.get(card.suit);
        if (current === undefined || val > current) {
            suitBest.set(card.suit, val);
        }
    }

    // ランクの重複をチェックして除外（高いカードから優先）
    const usedRanks = new Set<number>();
    const validCards: number[] = [];

    const sortedSuits = Array.from(suitBest.entries())
        .sort((a, b) => b[1] - a[1]); // 降順（高い方優先）

    for (const [, val] of sortedSuits) {
        if (!usedRanks.has(val)) {
            usedRanks.add(val);
            validCards.push(val);
        }
    }

    validCards.sort((a, b) => a - b);

    const cardCount = validCards.length;
    let name: string;
    if (cardCount === 4) {
        name = `Hidugi (${validCards.join('-')})`;
    } else {
        name = `${cardCount}-Card (${validCards.join('-')})`;
    }

    return { cardCount, cards: validCards, name };
};

/**
 * 2つのハイドゥーギハンドを比較（高い方が勝ち）
 */
export const compareHidugiHands = (hand1: BadugiHandRank, hand2: BadugiHandRank): number => {
    // カード数が多い方が勝ち
    if (hand1.cardCount > hand2.cardCount) return 1;
    if (hand1.cardCount < hand2.cardCount) return -1;

    // 同じカード数なら、高いカードから比較（高い方が勝ち）
    for (let i = hand1.cards.length - 1; i >= 0; i--) {
        if (hand1.cards[i] > hand2.cards[i]) return 1;
        if (hand1.cards[i] < hand2.cards[i]) return -1;
    }

    return 0;
};
