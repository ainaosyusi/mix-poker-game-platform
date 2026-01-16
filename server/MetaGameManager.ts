/**
 * Phase 3-D: Meta Game Manager
 * サイドゲーム（7-2ゲーム、スタンドアップ）の管理
 */

import type { Room, Player } from './types.js';

export interface SevenDeuceResult {
    winner: string;          // 勝者のsocketId
    loser: string;           // 負けたプレイヤー（7-2を見せたら勝ち）
    amount: number;          // 獲得チップ
}

export interface StandUpGameState {
    isActive: boolean;
    remainingPlayers: string[];  // まだ勝っていないプレイヤーのsocketId
    currentPrize: number;        // 残りの賞金プール
    lastWinner: string | null;
}

export class MetaGameManager {
    /**
     * 7-2ゲームを有効/無効にする
     */
    setSevenDeuce(room: Room, enabled: boolean): void {
        room.metaGame.sevenDeuce = enabled;
        console.log(`🃏 7-2 game ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 7-2ゲームが有効か確認
     */
    isSevenDeuceActive(room: Room): boolean {
        return room.metaGame.sevenDeuce;
    }

    /**
     * 7-2で勝った場合の処理
     * 7-2(オフスーツ)でポットを取ったプレイヤーは、テーブルの全員からボーナスを獲得
     * 注意: NLH(No-Limit Hold'em)でのみ有効
     * @param room 部屋
     * @param winnerId 7-2で勝ったプレイヤーID
     * @param winningHand 勝った手札
     * @returns 7-2ボーナスの結果（null = 7-2ではなかった）
     */
    checkSevenDeuce(room: Room, winnerId: string, winningHand: string[]): SevenDeuceResult | null {
        if (!room.metaGame.sevenDeuce) {
            return null;
        }

        // 7-2ゲームはNLHのみ適用
        if (room.gameState.gameVariant !== 'NLH') {
            return null;
        }

        // 7-2オフスーツかチェック
        const ranks = winningHand.map(c => c[0]).sort();
        const suits = winningHand.map(c => c[1]);

        const is72 = (ranks[0] === '2' && ranks[1] === '7') ||
            (ranks[0] === '7' && ranks[1] === '2');
        const isOffsuit = suits[0] !== suits[1];

        if (!is72 || !isOffsuit) {
            return null;
        }

        // 7-2ボーナス: BBの10倍を全員から徴収
        const bonus = room.config.bigBlind * 10;
        let totalBonus = 0;

        for (const player of room.players) {
            if (player && player.socketId !== winnerId && player.status !== 'SIT_OUT') {
                const amount = Math.min(player.stack, bonus);
                player.stack -= amount;
                totalBonus += amount;
            }
        }

        const winner = room.players.find(p => p?.socketId === winnerId);
        if (winner) {
            winner.stack += totalBonus;
        }

        console.log(`🎲 7-2 BONUS! ${winner?.name} wins ${totalBonus} from the table!`);

        return {
            winner: winnerId,
            loser: '',
            amount: totalBonus
        };
    }

    /**
     * スタンドアップゲームを開始
     * @param room 部屋
     * @param prizePool 賞金プール（参加費 × 人数など）
     */
    startStandUp(room: Room, prizePool: number): void {
        const players = room.players.filter(p => p !== null && p.status !== 'SIT_OUT');

        room.metaGame.standUp = {
            isActive: true,
            remainingPlayers: players.map(p => p!.socketId)
        };

        console.log(`🏆 Stand Up game started! ${players.length} players, prize: ${prizePool}`);
    }

    /**
     * スタンドアップでポットを獲得した場合の処理
     * @param room 部屋
     * @param winnerId ポットを取ったプレイヤーID
     * @returns ゲーム終了時は勝者ID、継続中はnull
     */
    checkStandUpWin(room: Room, winnerId: string): string | null {
        if (!room.metaGame.standUp.isActive) {
            return null;
        }

        // プレイヤーを「勝ち」リストから除外
        const idx = room.metaGame.standUp.remainingPlayers.indexOf(winnerId);
        if (idx !== -1) {
            room.metaGame.standUp.remainingPlayers.splice(idx, 1);
            console.log(`🎯 ${winnerId} scored! Remaining: ${room.metaGame.standUp.remainingPlayers.length}`);
        }

        // 最後の1人になったらゲーム終了
        if (room.metaGame.standUp.remainingPlayers.length === 1) {
            const loser = room.metaGame.standUp.remainingPlayers[0];
            const loserPlayer = room.players.find(p => p?.socketId === loser);

            console.log(`🏁 Stand Up game ended! Loser: ${loserPlayer?.name}`);

            room.metaGame.standUp.isActive = false;
            return loser;
        }

        return null;
    }

    /**
     * スタンドアップゲームをリセット
     */
    resetStandUp(room: Room): void {
        room.metaGame.standUp = {
            isActive: false,
            remainingPlayers: []
        };
    }

    /**
     * 現在のスタンドアップ状態を取得
     */
    getStandUpStatus(room: Room): {
        isActive: boolean;
        remainingCount: number;
        remainingPlayers: string[];
    } {
        return {
            isActive: room.metaGame.standUp.isActive,
            remainingCount: room.metaGame.standUp.remainingPlayers.length,
            remainingPlayers: room.metaGame.standUp.remainingPlayers
        };
    }
}
