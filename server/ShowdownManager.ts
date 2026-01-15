/**
 * Phase 3-B: Showdown Manager
 * ショーダウン時の勝者判定とポット分配
 */

import type { Room, Player, PotState } from './types.js';
import { evaluateHand, compareHands } from './handEvaluator.js';
import { PotManager } from './PotManager.js';

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

// 7枚から最強の5枚を選ぶ
function getBestFiveCards(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;

    // すべての5枚の組み合わせを試す
    let bestHand = cards.slice(0, 5);
    let bestRank = evaluateHand(bestHand);

    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            for (let k = j + 1; k < cards.length; k++) {
                for (let l = k + 1; l < cards.length; l++) {
                    for (let m = l + 1; m < cards.length; m++) {
                        const hand = [cards[i], cards[j], cards[k], cards[l], cards[m]];
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
                }
            }
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
    }[];
    allHands: {
        playerId: string;
        playerName: string;
        hand: string[];
        handRank: string;
    }[];
}

export class ShowdownManager {
    private potManager: PotManager;

    constructor() {
        this.potManager = new PotManager();
    }

    /**
     * ショーダウンを実行し、勝者を決定してポットを分配
     */
    executeShowdown(room: Room): ShowdownResult {
        const board = room.gameState.board;

        // アクティブなプレイヤーを取得
        const showdownPlayers = room.players.filter(p =>
            p !== null &&
            (p.status === 'ACTIVE' || p.status === 'ALL_IN') &&
            p.hand !== null
        ) as Player[];

        if (showdownPlayers.length === 0) {
            return { winners: [], allHands: [] };
        }

        // 各プレイヤーの手役を評価
        const evaluations = showdownPlayers.map(player => {
            const allCards = parseCards([...player.hand!, ...board]);
            const bestFive = getBestFiveCards(allCards);
            const handResult = evaluateHand(bestFive);

            return {
                player,
                bestFive,
                handResult,
                handRank: handResult.name
            };
        });

        // 全員の手役を記録
        const allHands = evaluations.map(e => ({
            playerId: e.player.socketId,
            playerName: e.player.name,
            hand: e.player.hand!,
            handRank: e.handRank
        }));

        // 最強の手を見つける
        let bestEval = evaluations[0];
        for (let i = 1; i < evaluations.length; i++) {
            const comparison = compareHands(evaluations[i].bestFive, bestEval.bestFive);
            if (comparison > 0) {
                bestEval = evaluations[i];
            }
        }

        // 同じ強さの手を持つプレイヤーを見つける（スプリット）
        const winningPlayers = evaluations.filter(e =>
            compareHands(e.bestFive, bestEval.bestFive) === 0
        );

        // ポットを再計算
        const potState = this.potManager.calculatePots(room.players);
        const totalPot = this.potManager.getTotalPot(potState);

        // 勝者をボタン位置に基づいてソート（OOP優先）
        // 端数チップ（Odd Chip）をポジション的に不利なプレイヤーから順に配分するため
        const btnIndex = room.dealerBtnIndex;
        const maxPlayers = room.config.maxPlayers;

        const sortedWinners = winningPlayers
            .map(w => {
                const seatIndex = room.players.findIndex(p => p?.socketId === w.player.socketId);
                // ボタンからの距離を計算 (SB=0, BB=1, ..., ボタン=maxPlayers-1)
                const distance = (seatIndex - btnIndex + maxPlayers - 1) % maxPlayers;
                return { ...w, seatIndex, distance };
            })
            .sort((a, b) => a.distance - b.distance);

        const winnerIds = sortedWinners.map(w => ({
            playerId: w.player.socketId,
            rank: w.handResult.rank
        }));

        const distributions = this.potManager.distributePots(potState, winnerIds);

        // 勝者にチップを渡す
        const winners = winningPlayers.map(w => {
            const dist = distributions.find(d => d.playerId === w.player.socketId);
            const amount = dist?.amount || 0;

            w.player.stack += amount;

            return {
                playerId: w.player.socketId,
                playerName: w.player.name,
                hand: w.player.hand!,
                handRank: w.handRank,
                amount
            };
        });

        // ポットをリセット
        room.gameState.pot = { main: 0, side: [] };

        console.log(`🏆 Showdown: ${winners.map(w => `${w.playerName} wins ${w.amount} (${w.handRank})`).join(', ')}`);

        return { winners, allHands };
    }

    /**
     * 1人を除いて全員フォールドした場合の処理
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

        return {
            winners: [{
                playerId: lastPlayer.socketId,
                playerName: lastPlayer.name,
                hand: lastPlayer.hand || [],
                handRank: 'Uncontested',
                amount: totalPot
            }],
            allHands: []
        };
    }
}
