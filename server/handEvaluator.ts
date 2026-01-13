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
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
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
    const values = Array.from(counts.keys()).sort((a, b) => b - a);
    const countArray = Array.from(counts.values()).sort((a, b) => b - a);

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
