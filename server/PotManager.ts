/**
 * Phase 3-B: Pot Manager
 * メインポットとサイドポットの計算・分配を管理
 */

import type { Room, Player, PotState, SidePot } from './types.js';

export class PotManager {
    /**
     * サイドポットを計算
     * オールインプレイヤーがいる場合に必要
     * @param players プレイヤー配列
     * @returns PotState
     */
    calculatePots(players: (Player | null)[]): PotState {
        // ベットしたプレイヤー全員（フォールドも含む）の貢献額を計算対象
        const allContributors = players.filter(p =>
            p !== null && p.totalBet > 0
        ) as Player[];

        // ショーダウンに残ったプレイヤー（勝者候補）
        const eligiblePlayers = players.filter(p =>
            p !== null &&
            p.status !== 'FOLDED' &&
            p.totalBet > 0
        ) as Player[];

        console.log('💰 PotManager.calculatePots:');
        console.log(`  Contributors: ${allContributors.map(p => `${p.name}(${p.totalBet})`).join(', ')}`);
        console.log(`  Eligible (not folded): ${eligiblePlayers.map(p => `${p.name}(${p.totalBet})`).join(', ')}`);

        if (allContributors.length === 0) {
            return { main: 0, side: [] };
        }

        // 全ての異なるベットレベルを取得（昇順）
        const betLevels = [...new Set(allContributors.map(p => p.totalBet))].sort((a, b) => a - b);

        const pots: { amount: number; eligible: string[] }[] = [];
        let prevBet = 0;

        for (const betLevel of betLevels) {
            if (betLevel > prevBet) {
                // このレベルに貢献したプレイヤーの数
                const contributorsAtLevel = allContributors.filter(p => p.totalBet >= betLevel).length;

                // このレベルで勝つ資格のあるプレイヤー（フォールドしていない）
                const eligible = eligiblePlayers
                    .filter(p => p.totalBet >= betLevel)
                    .map(p => p.socketId);

                // このレベルのポット額 = (このレベル - 前のレベル) * 貢献者数
                const contribution = betLevel - prevBet;
                const potAmount = contribution * contributorsAtLevel;

                // すでに存在するポットを更新するか、新規作成
                // 同じeligibleプレイヤーを持つポットがあれば統合
                const existingPot = pots.find(p =>
                    p.eligible.length === eligible.length &&
                    p.eligible.every(id => eligible.includes(id))
                );

                if (existingPot) {
                    existingPot.amount += potAmount;
                } else if (eligible.length > 0) {
                    // 勝者候補がいる場合のみポットを作成
                    pots.push({ amount: potAmount, eligible });
                }
                // eligible.length === 0 の場合: 全員フォールドした場合は最後の残りプレイヤーに全額

                prevBet = betLevel;
            }
        }

        // 最初のポットをメインポット、残りをサイドポット
        if (pots.length === 0) {
            // 全員フォールドした場合、残りのベット額を合算
            const totalBets = allContributors.reduce((sum, p) => sum + p.totalBet, 0);
            return { main: totalBets, side: [] };
        }

        const main = pots[0].amount;
        const side: SidePot[] = pots.slice(1).map(p => ({
            amount: p.amount,
            eligiblePlayers: p.eligible
        }));

        return { main, side };
    }

    /**
     * ポットを勝者に分配
     * @param potState ポット状態
     * @param winners 勝者（複数の場合あり）
     * @returns 各プレイヤーの獲得額
     */
    distributePots(
        potState: PotState,
        winners: { playerId: string; rank: number }[]
    ): { playerId: string; amount: number }[] {
        const distributions: { playerId: string; amount: number }[] = [];

        // メインポットの分配
        if (potState.main > 0) {
            const share = Math.floor(potState.main / winners.length);
            let remainder = potState.main % winners.length;

            for (const winner of winners) {
                const amount = share + (remainder > 0 ? 1 : 0);
                remainder--;
                distributions.push({ playerId: winner.playerId, amount });
            }
        }

        // サイドポットの分配
        for (const sidePot of potState.side) {
            // このサイドポットに参加できる勝者のみ
            const eligibleWinners = winners.filter(w =>
                sidePot.eligiblePlayers.includes(w.playerId)
            );

            if (eligibleWinners.length === 0) continue;

            const share = Math.floor(sidePot.amount / eligibleWinners.length);
            let remainder = sidePot.amount % eligibleWinners.length;

            for (const winner of eligibleWinners) {
                const amount = share + (remainder > 0 ? 1 : 0);
                remainder--;

                // 既存のエントリに追加
                const existing = distributions.find(d => d.playerId === winner.playerId);
                if (existing) {
                    existing.amount += amount;
                } else {
                    distributions.push({ playerId: winner.playerId, amount });
                }
            }
        }

        return distributions;
    }

    /**
     * 総ポット額を計算
     */
    getTotalPot(potState: PotState): number {
        const sideTotal = potState.side.reduce((sum, s) => sum + s.amount, 0);
        return potState.main + sideTotal;
    }

    /**
     * 現在のポットにベット額を追加
     */
    addToPot(room: Room, amount: number): void {
        room.gameState.pot.main += amount;
    }
}
