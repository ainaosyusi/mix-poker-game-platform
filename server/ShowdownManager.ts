/**
 * Phase 3-B: Showdown Manager
 * ショーダウン時の勝者判定とポット分配
 */

import type { Room, Player, PotState } from './types.js';
import {
    evaluateHand,
    compareHands,
    evaluateLowHand8OrBetter,
    evaluateRazzHand,
    evaluateBadugiHand,
    evaluateDeuceSeven,
    evaluateHidugiHand,
    compareLowHands,
    compareBadugiHands,
    compareDeuceSeven,
    compareHidugiHands
} from './handEvaluator.js';
import { PotManager } from './PotManager.js';
import { getVariantConfig } from './gameVariants.js';

// カード文字列をCardオブジェクトに変換
interface Card {
    rank: string;
    suit: string;
}

function parseCard(cardStr: string): Card {
    // カード文字列は "AS", "KH", "TD" などの形式
    // Tは10を表す
    const rank = cardStr[0] === 'T' ? '10' : cardStr[0];
    const suit = cardStr[1];
    return { rank, suit };
}

function parseCards(cards: string[]): Card[] {
    return cards.map(parseCard);
}

/**
 * 配列からn個の要素の組み合わせを生成
 * @param arr 元の配列
 * @param n 選択する要素数
 * @returns n個の要素の組み合わせの配列
 */
function combinations<T>(arr: T[], n: number): T[][] {
    if (n === 0) return [[]];
    if (n > arr.length) return [];

    const result: T[][] = [];

    function helper(start: number, current: T[]) {
        if (current.length === n) {
            result.push([...current]);
            return;
        }

        for (let i = start; i <= arr.length - (n - current.length); i++) {
            current.push(arr[i]);
            helper(i + 1, current);
            current.pop();
        }
    }

    helper(0, []);
    return result;
}

// 7枚から最強の5枚を選ぶ
function getBestFiveCards(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;

    // すべての5枚の組み合わせを試す
    let bestHand = cards.slice(0, 5);
    let bestRank = evaluateHand(bestHand);

    for (const hand of combinations(cards, 5)) {
        const rank = evaluateHand(hand);
        if (rank.rank > bestRank.rank) {
            bestHand = hand;
            bestRank = rank;
        } else if (rank.rank === bestRank.rank) {
            // 同じ役の場合、高位カードで比較
            const comparison = compareHands(hand, bestHand);
            if (comparison > 0) {
                bestHand = hand;
                bestRank = rank;
            }
        }
    }

    return bestHand;
}

// PLO用: 手札から2枚、ボードから3枚を使用して最強の5枚を選ぶ
function getBestPLOFiveCards(holeCards: Card[], boardCards: Card[]): Card[] {
    if (holeCards.length < 2 || boardCards.length < 3) {
        // フォールバック: 通常の評価
        return getBestFiveCards([...holeCards, ...boardCards]);
    }

    let bestHand = [...holeCards.slice(0, 2), ...boardCards.slice(0, 3)];
    let bestRank = evaluateHand(bestHand);

    // 手札から2枚選ぶ組み合わせ (C(4,2) = 6通り、または C(n,2))
    const holeCombos = combinations(holeCards, 2);
    // ボードから3枚選ぶ組み合わせ (C(5,3) = 10通り)
    const boardCombos = combinations(boardCards, 3);

    for (const holeCombo of holeCombos) {
        for (const boardCombo of boardCombos) {
            const hand = [...holeCombo, ...boardCombo];
            const rank = evaluateHand(hand);
            if (rank.rank > bestRank.rank) {
                bestHand = hand;
                bestRank = rank;
            } else if (rank.rank === bestRank.rank) {
                const comparison = compareHands(hand, bestHand);
                if (comparison > 0) {
                    bestHand = hand;
                    bestRank = rank;
                }
            }
        }
    }

    return bestHand;
}

// PLO8用: 手札から2枚、ボードから3枚を使用して最強のローハンド5枚を選ぶ
function getBestPLOLowFiveCards(holeCards: Card[], boardCards: Card[]): Card[] | null {
    if (holeCards.length < 2 || boardCards.length < 3) {
        return null;
    }

    let bestHand: Card[] | null = null;
    let bestLow = evaluateLowHand8OrBetter([]);

    // 手札から2枚選ぶ組み合わせ
    const holeCombos = combinations(holeCards, 2);
    // ボードから3枚選ぶ組み合わせ
    const boardCombos = combinations(boardCards, 3);

    for (const holeCombo of holeCombos) {
        for (const boardCombo of boardCombos) {
            const hand = [...holeCombo, ...boardCombo];
            const lowResult = evaluateLowHand8OrBetter(hand);
            if (lowResult.valid) {
                if (!bestHand || compareLowHands(lowResult, bestLow) > 0) {
                    bestHand = hand;
                    bestLow = lowResult;
                }
            }
        }
    }

    return bestHand;
}

// 7枚から最強のローハンド5枚を選ぶ（8-or-better）
function getBestLowFiveCards(cards: Card[]): Card[] | null {
    if (cards.length < 5) return null;

    let bestHand: Card[] | null = null;
    let bestLow = evaluateLowHand8OrBetter([]);

    // すべての5枚の組み合わせを試す
    for (const hand of combinations(cards, 5)) {
        const lowResult = evaluateLowHand8OrBetter(hand);
        if (lowResult.valid) {
            if (!bestHand || compareLowHands(lowResult, bestLow) > 0) {
                bestHand = hand;
                bestLow = lowResult;
            }
        }
    }

    return bestHand;
}

// Stud 2-7用: 7枚から最強の2-7ローハンド5枚を選ぶ
function getBestDeuce7FiveCards(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;

    let bestHand = cards.slice(0, 5);
    let bestResult = evaluateDeuceSeven(bestHand);

    for (const hand of combinations(cards, 5)) {
        const result = evaluateDeuceSeven(hand);
        if (compareDeuceSeven(result, bestResult) > 0) {
            bestHand = hand;
            bestResult = result;
        }
    }

    return bestHand;
}

// スプリットゲーム用: N枚からバドゥーギ最強の4枚を選ぶ
function getBestBadugiFourCards(cards: Card[]): Card[] {
    if (cards.length <= 4) return cards;

    let bestHand = cards.slice(0, 4);
    let bestResult = evaluateBadugiHand(bestHand);

    for (const hand of combinations(cards, 4)) {
        const result = evaluateBadugiHand(hand);
        if (compareBadugiHands(result, bestResult) > 0) {
            bestHand = hand;
            bestResult = result;
        }
    }

    return bestHand;
}

// Razz用: 7枚から最強のローハンド5枚を選ぶ
function getBestRazzFiveCards(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;

    let bestHand = cards.slice(0, 5);
    let bestLow = evaluateRazzHand(bestHand);

    for (const hand of combinations(cards, 5)) {
        const lowResult = evaluateRazzHand(hand);
        if (compareLowHands(lowResult, bestLow) > 0) {
            bestHand = hand;
            bestLow = lowResult;
        }
    }

    return bestHand;
}

export interface ShowdownResult {
    winners: {
        playerId: string;
        playerName: string;
        hand: string[];
        handRank: string;
        amount: number;
        qualifyingHoleCards?: string[];  // 役判定に使われたホールカード
        qualifyingBoardCards?: string[]; // 役判定に使われたボードカード
    }[];
    allHands: {
        playerId: string;
        playerName: string;
        hand: string[] | null;  // nullの場合はマック（非表示）
        handRank: string;
        isMucked?: boolean;     // マックされたかどうか
    }[];
}

export class ShowdownManager {
    private potManager: PotManager;

    constructor() {
        this.potManager = new PotManager();
    }

    /**
     * 勝者の役を構成するカードを特定
     * bestFiveから、ホールカードとボードカードを分離
     */
    private identifyQualifyingCards(
        bestFive: Card[],
        holeCards: Card[],
        boardCards: Card[]
    ): { qualifyingHoleCards: string[]; qualifyingBoardCards: string[] } {
        const qualifyingHoleCards: string[] = [];
        const qualifyingBoardCards: string[] = [];

        for (const card of bestFive) {
            const cardStr = `${card.rank}${card.suit}`;
            // ホールカードに含まれるかチェック
            const inHole = holeCards.some(h => h.rank === card.rank && h.suit === card.suit);
            if (inHole) {
                qualifyingHoleCards.push(cardStr);
            } else {
                // ボードカードに含まれるかチェック
                const inBoard = boardCards.some(b => b.rank === card.rank && b.suit === card.suit);
                if (inBoard) {
                    qualifyingBoardCards.push(cardStr);
                }
            }
        }

        return { qualifyingHoleCards, qualifyingBoardCards };
    }

    /**
     * ショーダウン順序を決定
     * - ラストアグレッサーがいる場合: アグレッサーから時計回り
     * - いない場合（全員チェック）: ボタンの左（SB位置）から時計回り
     */
    private getShowdownOrder(room: Room, players: Player[]): Player[] {
        const maxPlayers = room.config.maxPlayers;
        const lastAggressorIdx = room.lastAggressorIndex;
        const buttonIdx = room.dealerBtnIndex;

        // プレイヤーのseatIndexを取得
        const playerSeats = players.map(p => {
            const seatIdx = room.players.findIndex(rp => rp?.socketId === p.socketId);
            return { player: p, seatIndex: seatIdx };
        });

        let startIndex: number;
        if (lastAggressorIdx !== -1 && room.players[lastAggressorIdx]) {
            // ラストアグレッサーがいる場合、その人から開始
            startIndex = lastAggressorIdx;
        } else {
            // 全員チェックの場合、ボタンの次（SB位置）から開始
            startIndex = (buttonIdx + 1) % maxPlayers;
        }

        // startIndexから時計回りにソート
        playerSeats.sort((a, b) => {
            const distA = (a.seatIndex - startIndex + maxPlayers) % maxPlayers;
            const distB = (b.seatIndex - startIndex + maxPlayers) % maxPlayers;
            return distA - distB;
        });

        return playerSeats.map(ps => ps.player);
    }

    /**
     * オールインが発生しているかチェック
     */
    private hasAllInPlayer(room: Room): boolean {
        return room.players.some(p => p !== null && p.status === 'ALL_IN');
    }

    /**
     * ショーダウンを実行し、勝者を決定してポットを分配
     * ゲームバリアントに応じた評価を行う
     */
    executeShowdown(room: Room): ShowdownResult {
        const board = room.gameState.board;
        const variant = room.gameState.gameVariant;
        const variantConfig = getVariantConfig(variant);

        // アクティブなプレイヤーを取得
        const showdownPlayers = room.players.filter(p =>
            p !== null &&
            (p.status === 'ACTIVE' || p.status === 'ALL_IN') &&
            p.hand !== null
        ) as Player[];

        if (showdownPlayers.length === 0) {
            return { winners: [], allHands: [] };
        }

        // ゲームバリアントに応じた評価
        switch (variantConfig.handEvaluation) {
            case 'highlow':
                return this.executeHiLoShowdown(room, showdownPlayers, board);
            case 'razz':
            case 'a5':
                return this.executeRazzShowdown(room, showdownPlayers, board);
            case 'badugi':
                return this.executeBadugiShowdown(room, showdownPlayers);
            case 'hidugi':
                return this.executeHidugiShowdown(room, showdownPlayers);
            case '2-7':
                return this.executeDeuce7Showdown(room, showdownPlayers);
            case 'stud27':
                return this.executeStud27Showdown(room, showdownPlayers);
            case 'baduecey':
            case 'badacey':
            case 'archie':
            case 'razzdugi':
                return this.executeSplitShowdown(room, showdownPlayers, variantConfig.handEvaluation);
            default:
                return this.executeHighShowdown(room, showdownPlayers, board);
        }
    }

    /**
     * ハイハンドのみの評価（NLH, PLO等）
     */
    private executeHighShowdown(room: Room, players: Player[], board: string[]): ShowdownResult {
        const variant = room.gameState.gameVariant;
        const variantConfig = getVariantConfig(variant);
        const useOmahaSelection = variantConfig.holeCardsForSelection !== undefined;
        const isAllInShowdown = this.hasAllInPlayer(room);

        // ショーダウン順序を決定
        const orderedPlayers = this.getShowdownOrder(room, players);

        // 各プレイヤーの手役を評価
        const evaluations = orderedPlayers.map(player => {
            const holeCards = parseCards(player.hand!);
            const boardCards = parseCards(board);

            // Omaha系: 手札から必ずN枚使用 + ボード3枚の組み合わせ
            // Hold'em系: 全カードから最強の5枚
            const bestFive = useOmahaSelection
                ? getBestPLOFiveCards(holeCards, boardCards)
                : getBestFiveCards([...holeCards, ...boardCards]);

            const handResult = evaluateHand(bestFive);

            return {
                player,
                bestFive,
                handResult,
                handRank: handResult.name
            };
        });

        // サイドポット対応のポット分配（勝者の決定）
        const winners = this.distributeToWinnersWithSidePots(room, evaluations, compareHands, board);
        const winnerIds = new Set(winners.map(w => w.playerId));

        // 手札の表示/マック判定
        let allHands: ShowdownResult['allHands'];

        if (isAllInShowdown) {
            // オールインの場合: 全員強制オープン（共謀防止）
            // ハンドはコピーして参照問題を防ぐ
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],  // 深いコピー
                handRank: e.handRank,
                isMucked: false
            }));
            console.log(`🏆 All-In Showdown: All hands revealed`);
        } else {
            // 通常ショーダウン: 順序に従ってShow/Muck判定
            allHands = this.determineShowMuck(evaluations, winnerIds, compareHands);
        }

        console.log(`🏆 Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * ショーダウン順序に従ってShow/Muckを判定
     * - 1番手: 必ずShow
     * - 2番手以降: 現在のベストより強いか同じならShow、弱ければMuck
     */
    private determineShowMuck<T extends { player: Player; bestFive: Card[]; handRank: string }>(
        evaluations: T[],
        winnerIds: Set<string>,
        compareFunc: (a: Card[], b: Card[]) => number
    ): ShowdownResult['allHands'] {
        let currentBestFive: Card[] | null = null;

        return evaluations.map((e, index) => {
            // 1番手は必ずShow
            if (index === 0) {
                currentBestFive = e.bestFive;
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            }

            // 2番手以降: 現在のベストと比較
            const comparison = compareFunc(e.bestFive, currentBestFive!);

            if (comparison > 0) {
                // 勝っている → Show & ベスト更新
                currentBestFive = e.bestFive;
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            } else if (comparison === 0) {
                // 引き分け → Show（ポット分割の権利）
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            } else {
                // 負けている → Muck
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: null,
                    handRank: 'Mucked',
                    isMucked: true
                };
            }
        });
    }

    /**
     * Hi-Lo評価（PLO8, 7CS8等）
     * ポットをハイとローで半分ずつ分ける
     * 注: Hi-Loでは、HighまたはLowのいずれかで勝てる場合にShow。両方で負ける場合のみMuck。
     */
    private executeHiLoShowdown(room: Room, players: Player[], board: string[]): ShowdownResult {
        const variant = room.gameState.gameVariant;
        const variantConfig = getVariantConfig(variant);
        const useOmahaSelection = variantConfig.holeCardsForSelection !== undefined;
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        // ハイハンド評価（ショーダウン順序で評価）
        const highEvaluations = orderedPlayers.map(player => {
            const holeCards = parseCards(player.hand!);
            const boardCards = parseCards(board);

            // Omaha系: 手札から必ずN枚使用 + ボード3枚の組み合わせ
            // Stud系: 全カードから最強の5枚
            const bestFive = useOmahaSelection
                ? getBestPLOFiveCards(holeCards, boardCards)
                : getBestFiveCards([...holeCards, ...boardCards]);

            const handResult = evaluateHand(bestFive);
            return { player, bestFive, handResult, handRank: handResult.name };
        });

        // ローハンド評価
        const lowEvaluations = orderedPlayers.map(player => {
            const holeCards = parseCards(player.hand!);
            const boardCards = parseCards(board);

            // Omaha系: 手札から必ずN枚使用 + ボード3枚の組み合わせ
            // Stud系: 全カードから最強の5枚
            const bestLowFive = useOmahaSelection
                ? getBestPLOLowFiveCards(holeCards, boardCards)
                : getBestLowFiveCards([...holeCards, ...boardCards]);

            const lowResult = bestLowFive ? evaluateLowHand8OrBetter(bestLowFive) : { valid: false, cards: [], name: 'No Low' };
            return { player, bestLowFive, lowResult, handRank: lowResult.name };
        }).filter(e => e.lowResult.valid);

        const winnersMap = new Map<string, { player: Player; amount: number; highRank?: string; lowRank?: string }>();

        const addWinnings = (player: Player, amount: number, side: 'high' | 'low', handRank: string) => {
            if (amount <= 0) return;
            const existing = winnersMap.get(player.socketId);
            if (existing) {
                existing.amount += amount;
                if (side === 'high') existing.highRank = handRank;
                if (side === 'low') existing.lowRank = handRank;
            } else {
                winnersMap.set(player.socketId, {
                    player,
                    amount,
                    highRank: side === 'high' ? handRank : undefined,
                    lowRank: side === 'low' ? handRank : undefined
                });
            }
        };

        const allEligibleIds = highEvaluations.map(e => e.player.socketId);
        const potSlices = [
            { amount: room.gameState.pot.main, eligiblePlayers: allEligibleIds },
            ...room.gameState.pot.side.map(p => ({ amount: p.amount, eligiblePlayers: p.eligiblePlayers }))
        ];

        for (const pot of potSlices) {
            if (pot.amount <= 0) continue;

            const eligibleHigh = highEvaluations.filter(e =>
                pot.eligiblePlayers.includes(e.player.socketId)
            );
            if (eligibleHigh.length === 0) continue;

            let bestHighEval = eligibleHigh[0];
            for (const e of eligibleHigh) {
                if (compareHands(e.bestFive, bestHighEval.bestFive) > 0) {
                    bestHighEval = e;
                }
            }
            const highWinners = eligibleHigh.filter(e =>
                compareHands(e.bestFive, bestHighEval.bestFive) === 0
            );

            const eligibleLow = lowEvaluations.filter(e =>
                pot.eligiblePlayers.includes(e.player.socketId)
            );

            const hasLowWinner = eligibleLow.length > 0;
            const highPot = hasLowWinner ? Math.floor(pot.amount / 2) : pot.amount;
            const lowPot = hasLowWinner ? pot.amount - highPot : 0;

            const highShare = Math.floor(highPot / highWinners.length);
            const highRemainder = highPot % highWinners.length;
            highWinners.forEach((w, i) => {
                const amount = highShare + (i < highRemainder ? 1 : 0);
                w.player.stack += amount;
                addWinnings(w.player, amount, 'high', w.handRank);
            });

            if (hasLowWinner) {
                let bestLowEval = eligibleLow[0];
                for (const e of eligibleLow) {
                    if (compareLowHands(e.lowResult, bestLowEval.lowResult) > 0) {
                        bestLowEval = e;
                    }
                }
                const lowWinners = eligibleLow.filter(e =>
                    compareLowHands(e.lowResult, bestLowEval.lowResult) === 0
                );

                const lowShare = Math.floor(lowPot / lowWinners.length);
                const lowRemainder = lowPot % lowWinners.length;
                lowWinners.forEach((w, i) => {
                    const amount = lowShare + (i < lowRemainder ? 1 : 0);
                    w.player.stack += amount;
                    addWinnings(w.player, amount, 'low', w.handRank);
                });
            }
        }

        room.gameState.pot = { main: 0, side: [] };

        const winners: ShowdownResult['winners'] = Array.from(winnersMap.values()).map(w => {
            const rankParts: string[] = [];
            if (w.highRank) rankParts.push(`High: ${w.highRank}`);
            if (w.lowRank) rankParts.push(`Low: ${w.lowRank}`);
            return {
                playerId: w.player.socketId,
                playerName: w.player.name,
                hand: [...w.player.hand!],  // 深いコピー
                handRank: rankParts.join(' / '),
                amount: w.amount
            };
        });

        // 勝者のIDセット
        const winnerIds = new Set(winners.map(w => w.playerId));

        // 手札の表示/マック判定
        const allHands = highEvaluations.map(e => {
            const isWinner = winnerIds.has(e.player.socketId);
            const lowEval = lowEvaluations.find(le => le.player.socketId === e.player.socketId);
            const rankStr = isWinner || isAllInShowdown
                ? (lowEval ? `High: ${e.handRank} / Low: ${lowEval.handRank}` : `High: ${e.handRank}`)
                : 'Mucked';
            return {
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: (isWinner || isAllInShowdown) ? [...e.player.hand!] : null,  // 深いコピー
                handRank: rankStr,
                isMucked: !(isWinner || isAllInShowdown)
            };
        });

        console.log(`🏆 Hi-Lo Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * Razz評価（最も低いハンドが勝ち）
     */
    private executeRazzShowdown(room: Room, players: Player[], board: string[]): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        const evaluations = orderedPlayers.map(player => {
            const allCards = parseCards([...player.hand!, ...board]);
            const bestFive = getBestRazzFiveCards(allCards);
            const handResult = evaluateRazzHand(bestFive);
            return { player, bestFive, handResult, handRank: handResult.name };
        });

        // サイドポット対応: handResultを使った比較
        const winners = this.distributeWithHandResultComparison(
            room,
            evaluations,
            (a, b) => compareLowHands(a.handResult, b.handResult)
        );

        const winnerIds = new Set(winners.map(w => w.playerId));

        // 手札の表示/マック判定
        let allHands: ShowdownResult['allHands'];
        if (isAllInShowdown) {
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],  // 深いコピー
                handRank: e.handRank,
                isMucked: false
            }));
        } else {
            allHands = this.determineShowMuckWithHandResult(
                evaluations,
                winnerIds,
                (a, b) => compareLowHands(a.handResult, b.handResult)
            );
        }

        console.log(`🏆 Razz Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * Badugi評価
     */
    private executeBadugiShowdown(room: Room, players: Player[]): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        const evaluations = orderedPlayers.map(player => {
            const cards = parseCards(player.hand!);
            const handResult = evaluateBadugiHand(cards);
            return { player, handResult, handRank: handResult.name };
        });

        // サイドポット対応
        const winners = this.distributeWithHandResultComparison(
            room,
            evaluations,
            (a, b) => compareBadugiHands(a.handResult, b.handResult)
        );

        const winnerIds = new Set(winners.map(w => w.playerId));

        // 手札の表示/マック判定
        let allHands: ShowdownResult['allHands'];
        if (isAllInShowdown) {
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],  // 深いコピー
                handRank: e.handRank,
                isMucked: false
            }));
        } else {
            allHands = this.determineShowMuckWithHandResult(
                evaluations,
                winnerIds,
                (a, b) => compareBadugiHands(a.handResult, b.handResult)
            );
        }

        console.log(`🏆 Badugi Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * 2-7 Lowball評価
     */
    private executeDeuce7Showdown(room: Room, players: Player[]): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        const evaluations = orderedPlayers.map(player => {
            const cards = parseCards(player.hand!);
            const handResult = evaluateDeuceSeven(cards);
            return { player, handResult, handRank: handResult.name };
        });

        // サイドポット対応
        const winners = this.distributeWithHandResultComparison(
            room,
            evaluations,
            (a, b) => compareDeuceSeven(a.handResult, b.handResult)
        );

        const winnerIds = new Set(winners.map(w => w.playerId));

        // 手札の表示/マック判定
        let allHands: ShowdownResult['allHands'];
        if (isAllInShowdown) {
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],  // 深いコピー
                handRank: e.handRank,
                isMucked: false
            }));
        } else {
            allHands = this.determineShowMuckWithHandResult(
                evaluations,
                winnerIds,
                (a, b) => compareDeuceSeven(a.handResult, b.handResult)
            );
        }

        console.log(`🏆 2-7 Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * handResultベースのShow/Muck判定（Razz, Badugi, 2-7用）
     */
    private determineShowMuckWithHandResult<T extends { player: Player; handResult: any; handRank: string }>(
        evaluations: T[],
        winnerIds: Set<string>,
        compareFunc: (a: T, b: T) => number
    ): ShowdownResult['allHands'] {
        let currentBest: T | null = null;

        return evaluations.map((e, index) => {
            // 1番手は必ずShow
            if (index === 0) {
                currentBest = e;
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            }

            // 2番手以降: 現在のベストと比較
            const comparison = compareFunc(e, currentBest!);

            if (comparison > 0) {
                // 勝っている → Show & ベスト更新
                currentBest = e;
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            } else if (comparison === 0) {
                // 引き分け → Show
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: [...e.player.hand!],  // 深いコピー
                    handRank: e.handRank,
                    isMucked: false
                };
            } else {
                // 負けている → Muck
                return {
                    playerId: e.player.socketId,
                    playerName: e.player.name,
                    hand: null,
                    handRank: 'Mucked',
                    isMucked: true
                };
            }
        });
    }

    /**
     * 汎用的なサイドポット対応分配（handResultを使う比較用）
     */
    private distributeWithHandResultComparison<T extends { player: Player; handRank: string }>(
        room: Room,
        allEvaluations: T[],
        compareFunc: (a: T, b: T) => number
    ): ShowdownResult['winners'] {
        const winnersMap = new Map<string, { player: Player; handRank: string; amount: number }>();

        // メインポットの分配
        if (room.gameState.pot.main > 0 && allEvaluations.length > 0) {
            let bestEval = allEvaluations[0];
            for (const e of allEvaluations) {
                if (compareFunc(e, bestEval) > 0) {
                    bestEval = e;
                }
            }

            const mainWinners = allEvaluations.filter(e => compareFunc(e, bestEval) === 0);
            const share = Math.floor(room.gameState.pot.main / mainWinners.length);
            const remainder = room.gameState.pot.main % mainWinners.length;

            mainWinners.forEach((w, i) => {
                const amount = share + (i < remainder ? 1 : 0);
                w.player.stack += amount;
                winnersMap.set(w.player.socketId, {
                    player: w.player,
                    handRank: w.handRank,
                    amount
                });
            });
        }

        // サイドポットの分配
        for (const sidePot of room.gameState.pot.side) {
            if (sidePot.amount <= 0) continue;

            const eligibleEvaluations = allEvaluations.filter(e =>
                sidePot.eligiblePlayers.includes(e.player.socketId)
            );
            if (eligibleEvaluations.length === 0) continue;

            let bestEval = eligibleEvaluations[0];
            for (const e of eligibleEvaluations) {
                if (compareFunc(e, bestEval) > 0) {
                    bestEval = e;
                }
            }

            const sideWinners = eligibleEvaluations.filter(e => compareFunc(e, bestEval) === 0);
            const share = Math.floor(sidePot.amount / sideWinners.length);
            const remainder = sidePot.amount % sideWinners.length;

            sideWinners.forEach((w, i) => {
                const amount = share + (i < remainder ? 1 : 0);
                w.player.stack += amount;

                const existing = winnersMap.get(w.player.socketId);
                if (existing) {
                    existing.amount += amount;
                } else {
                    winnersMap.set(w.player.socketId, {
                        player: w.player,
                        handRank: w.handRank,
                        amount
                    });
                }
            });
        }

        room.gameState.pot = { main: 0, side: [] };

        return Array.from(winnersMap.values()).map(w => ({
            playerId: w.player.socketId,
            playerName: w.player.name,
            hand: [...w.player.hand!],  // 深いコピー
            handRank: w.handRank,
            amount: w.amount
        }));
    }

    /**
     * サイドポット対応のポット分配
     * 各ポットごとに参加資格のあるプレイヤーの中から勝者を決定
     */
    /**
     * 単一ポットの分配：資格者の中から最強ハンドを見つけ、同着分割して winnersMap に加算
     */
    private distributePot(
        potAmount: number,
        potLabel: string,
        eligibleEvaluations: { player: Player; bestFive: Card[]; handRank: string }[],
        compareFunc: (a: Card[], b: Card[]) => number,
        winnersMap: Map<string, { player: Player; handRank: string; amount: number; bestFive: Card[] }>
    ): void {
        if (potAmount <= 0 || eligibleEvaluations.length === 0) return;

        console.log(`💰 ${potLabel}: ${potAmount}, ${eligibleEvaluations.length} eligible players`);

        let bestEval = eligibleEvaluations[0];
        for (const e of eligibleEvaluations) {
            if (compareFunc(e.bestFive, bestEval.bestFive) > 0) {
                bestEval = e;
            }
        }

        const winners = eligibleEvaluations.filter(e =>
            compareFunc(e.bestFive, bestEval.bestFive) === 0
        );
        console.log(`🏆 ${potLabel} winners: ${winners.map(w => `${w.player.name} (${w.handRank})`).join(', ')}`);

        const share = Math.floor(potAmount / winners.length);
        const remainder = potAmount % winners.length;

        winners.forEach((w, i) => {
            const amount = share + (i < remainder ? 1 : 0);
            w.player.stack += amount;

            const existing = winnersMap.get(w.player.socketId);
            if (existing) {
                existing.amount += amount;
            } else {
                winnersMap.set(w.player.socketId, {
                    player: w.player,
                    handRank: w.handRank,
                    amount,
                    bestFive: w.bestFive
                });
            }
        });
    }

    private distributeToWinnersWithSidePots(
        room: Room,
        allEvaluations: { player: Player; bestFive: Card[]; handRank: string }[],
        compareFunc: (a: Card[], b: Card[]) => number,
        board: string[]
    ): ShowdownResult['winners'] {
        const winnersMap = new Map<string, { player: Player; handRank: string; amount: number; bestFive: Card[] }>();
        const boardCards = parseCards(board);

        // メインポットの分配
        this.distributePot(room.gameState.pot.main, 'Main pot', allEvaluations, compareFunc, winnersMap);

        // サイドポットの分配
        for (const sidePot of room.gameState.pot.side) {
            const eligible = allEvaluations.filter(e =>
                sidePot.eligiblePlayers.includes(e.player.socketId)
            );
            this.distributePot(sidePot.amount, 'Side pot', eligible, compareFunc, winnersMap);
        }

        room.gameState.pot = { main: 0, side: [] };

        return Array.from(winnersMap.values()).map(w => {
            const holeCards = parseCards(w.player.hand!);
            const { qualifyingHoleCards, qualifyingBoardCards } = this.identifyQualifyingCards(
                w.bestFive,
                holeCards,
                boardCards
            );

            return {
                playerId: w.player.socketId,
                playerName: w.player.name,
                hand: [...w.player.hand!],
                handRank: w.handRank,
                amount: w.amount,
                qualifyingHoleCards,
                qualifyingBoardCards
            };
        });
    }

    /**
     * 勝者へのポット分配共通処理（後方互換性のため残す）
     */
    private distributeToWinners(room: Room, winningPlayers: any[]): ShowdownResult['winners'] {
        const totalPot = room.gameState.pot.main +
            room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);

        const share = Math.floor(totalPot / winningPlayers.length);
        const remainder = totalPot % winningPlayers.length;

        const winners = winningPlayers.map((w, i) => {
            const amount = share + (i < remainder ? 1 : 0);
            w.player.stack += amount;
            return {
                playerId: w.player.socketId,
                playerName: w.player.name,
                hand: [...w.player.hand!],  // 深いコピー
                handRank: w.handRank,
                amount
            };
        });

        room.gameState.pot = { main: 0, side: [] };
        return winners;
    }

    /**
     * Hidugi評価（高いバドゥーギが勝ち）
     */
    private executeHidugiShowdown(room: Room, players: Player[]): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        const evaluations = orderedPlayers.map(player => {
            const cards = parseCards(player.hand!);
            const handResult = evaluateHidugiHand(cards);
            return { player, handResult, handRank: handResult.name };
        });

        const winners = this.distributeWithHandResultComparison(
            room,
            evaluations,
            (a, b) => compareHidugiHands(a.handResult, b.handResult)
        );

        const winnerIds = new Set(winners.map(w => w.playerId));

        let allHands: ShowdownResult['allHands'];
        if (isAllInShowdown) {
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],
                handRank: e.handRank,
                isMucked: false
            }));
        } else {
            allHands = this.determineShowMuckWithHandResult(
                evaluations,
                winnerIds,
                (a, b) => compareHidugiHands(a.handResult, b.handResult)
            );
        }

        console.log(`🏆 Hidugi Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);
        return { winners, allHands };
    }

    /**
     * Stud 2-7評価（7枚から最強の2-7ロー5枚を選ぶ）
     */
    private executeStud27Showdown(room: Room, players: Player[]): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        const evaluations = orderedPlayers.map(player => {
            const cards = parseCards(player.hand!);
            const bestFive = getBestDeuce7FiveCards(cards);
            const handResult = evaluateDeuceSeven(bestFive);
            return { player, handResult, handRank: handResult.name };
        });

        const winners = this.distributeWithHandResultComparison(
            room,
            evaluations,
            (a, b) => compareDeuceSeven(a.handResult, b.handResult)
        );

        const winnerIds = new Set(winners.map(w => w.playerId));

        let allHands: ShowdownResult['allHands'];
        if (isAllInShowdown) {
            allHands = evaluations.map(e => ({
                playerId: e.player.socketId,
                playerName: e.player.name,
                hand: [...e.player.hand!],
                handRank: e.handRank,
                isMucked: false
            }));
        } else {
            allHands = this.determineShowMuckWithHandResult(
                evaluations,
                winnerIds,
                (a, b) => compareDeuceSeven(a.handResult, b.handResult)
            );
        }

        console.log(`🏆 Stud 2-7 Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);
        return { winners, allHands };
    }

    /**
     * スプリットポットショーダウン（Baduecey, Badacey, Archie, Razzdugi用）
     * ポットを2つの評価方法で半分ずつ分ける
     */
    private executeSplitShowdown(
        room: Room,
        players: Player[],
        evalType: string
    ): ShowdownResult {
        const isAllInShowdown = this.hasAllInPlayer(room);
        const orderedPlayers = this.getShowdownOrder(room, players);

        // スプリットゲームの評価タイプ設定テーブル
        const SPLIT_CONFIG: Record<string, { sideA: 'a5' | '2-7'; sideB: '2-7' | 'badugi' }> = {
            'baduecey': { sideA: '2-7', sideB: 'badugi' },
            'badacey':  { sideA: 'a5',  sideB: 'badugi' },
            'archie':   { sideA: 'a5',  sideB: '2-7' },
            'razzdugi': { sideA: 'a5',  sideB: 'badugi' },
        };

        // 評価タイプ別のevaluator/comparator/名称
        type SideEval = { player: Player; handResult: any; handRank: string };
        const SIDE_EVALUATORS: Record<string, {
            name: string;
            evaluate: (cards: Card[], isStud: boolean) => any;
            compare: (a: any, b: any) => number;
        }> = {
            '2-7':   { name: '2-7',   evaluate: (c, s) => evaluateDeuceSeven(s ? getBestDeuce7FiveCards(c) : c), compare: compareDeuceSeven },
            'a5':    { name: 'A-5',   evaluate: (c, s) => evaluateRazzHand(s ? getBestRazzFiveCards(c) : c),     compare: compareLowHands },
            'badugi': { name: 'Badugi', evaluate: (c, _) => evaluateBadugiHand(c.length > 4 ? getBestBadugiFourCards(c) : c), compare: compareBadugiHands },
        };

        const config = SPLIT_CONFIG[evalType] || SPLIT_CONFIG['baduecey'];
        const isStud = evalType === 'razzdugi';

        const buildSideEvals = (sideType: string) => {
            const ev = SIDE_EVALUATORS[sideType];
            const evals: SideEval[] = orderedPlayers.map(player => {
                const cards = parseCards(player.hand!);
                const handResult = ev.evaluate(cards, isStud);
                return { player, handResult, handRank: handResult.name };
            });
            const compare = (a: SideEval, b: SideEval) => ev.compare(a.handResult, b.handResult);
            return { evals, compare, name: ev.name };
        };

        const sideA = buildSideEvals(config.sideA);
        const sideB = buildSideEvals(config.sideB);

        // ポット分配
        const winnersMap = new Map<string, { player: Player; amount: number; sideARank?: string; sideBRank?: string }>();

        const addWinnings = (player: Player, amount: number, side: 'A' | 'B', handRank: string) => {
            if (amount <= 0) return;
            const existing = winnersMap.get(player.socketId);
            if (existing) {
                existing.amount += amount;
                if (side === 'A') existing.sideARank = handRank;
                else existing.sideBRank = handRank;
            } else {
                winnersMap.set(player.socketId, {
                    player, amount,
                    sideARank: side === 'A' ? handRank : undefined,
                    sideBRank: side === 'B' ? handRank : undefined
                });
            }
        };

        // Side勝者にポットを分配するヘルパー
        const distributeSidePot = (
            sideEvals: SideEval[],
            compareFunc: (a: SideEval, b: SideEval) => number,
            eligibleIds: string[],
            potAmount: number,
            side: 'A' | 'B'
        ) => {
            const eligible = sideEvals.filter(e => eligibleIds.includes(e.player.socketId));
            if (eligible.length === 0) return;
            let best = eligible[0];
            for (const e of eligible) {
                if (compareFunc(e, best) > 0) best = e;
            }
            const sideWinners = eligible.filter(e => compareFunc(e, best) === 0);
            const share = Math.floor(potAmount / sideWinners.length);
            const rem = potAmount % sideWinners.length;
            sideWinners.forEach((w, i) => {
                const amount = share + (i < rem ? 1 : 0);
                w.player.stack += amount;
                addWinnings(w.player, amount, side, w.handRank);
            });
        };

        const allEligibleIds = orderedPlayers.map(p => p.socketId);
        const potSlices = [
            { amount: room.gameState.pot.main, eligiblePlayers: allEligibleIds },
            ...room.gameState.pot.side.map(p => ({ amount: p.amount, eligiblePlayers: p.eligiblePlayers }))
        ];

        for (const pot of potSlices) {
            if (pot.amount <= 0) continue;
            const halfA = Math.floor(pot.amount / 2);
            const halfB = pot.amount - halfA;
            distributeSidePot(sideA.evals, sideA.compare, pot.eligiblePlayers, halfA, 'A');
            distributeSidePot(sideB.evals, sideB.compare, pot.eligiblePlayers, halfB, 'B');
        }

        room.gameState.pot = { main: 0, side: [] };

        const winners: ShowdownResult['winners'] = Array.from(winnersMap.values()).map(w => {
            const rankParts: string[] = [];
            if (w.sideARank) rankParts.push(`${sideA.name}: ${w.sideARank}`);
            if (w.sideBRank) rankParts.push(`${sideB.name}: ${w.sideBRank}`);
            return {
                playerId: w.player.socketId,
                playerName: w.player.name,
                hand: [...w.player.hand!],
                handRank: rankParts.join(' / '),
                amount: w.amount
            };
        });

        const winnerIds = new Set(winners.map(w => w.playerId));

        const allHands = orderedPlayers.map(player => {
            const isWinner = winnerIds.has(player.socketId);
            const evalA = sideA.evals.find(e => e.player.socketId === player.socketId);
            const evalB = sideB.evals.find(e => e.player.socketId === player.socketId);
            const rankStr = (isWinner || isAllInShowdown)
                ? `${sideA.name}: ${evalA?.handRank || '?'} / ${sideB.name}: ${evalB?.handRank || '?'}`
                : 'Mucked';
            return {
                playerId: player.socketId,
                playerName: player.name,
                hand: (isWinner || isAllInShowdown) ? [...player.hand!] : null,
                handRank: rankStr,
                isMucked: !(isWinner || isAllInShowdown)
            };
        });

        console.log(`🏆 Split Showdown (${sideA.name}/${sideB.name}): ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);
        return { winners, allHands };
    }

    /**
     * 1人を除いて全員フォールドした場合の処理
     * 不戦勝のため、勝者のハンドは表示しない（Muck扱い）
     */
    awardToLastPlayer(room: Room): ShowdownResult {
        const lastPlayer = room.players.find(p =>
            p !== null &&
            (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        ) as Player | undefined;

        if (!lastPlayer) {
            return { winners: [], allHands: [] };
        }

        const totalPot = room.gameState.pot.main +
            room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);

        lastPlayer.stack += totalPot;
        room.gameState.pot = { main: 0, side: [] };

        console.log(`🏆 ${lastPlayer.name} wins ${totalPot} (others folded)`);

        // 不戦勝: 勝者のハンドは表示しない（hand: null）
        // ポーカールール: ショーダウンに進んでいないため、ハンドを見せる義務はない
        return {
            winners: [{
                playerId: lastPlayer.socketId,
                playerName: lastPlayer.name,
                hand: [],  // 空配列 = ハンド非表示
                handRank: 'Uncontested',
                amount: totalPot
            }],
            allHands: []
        };
    }
}
