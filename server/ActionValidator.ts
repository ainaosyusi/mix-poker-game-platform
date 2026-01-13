/**
 * Phase 3-B: Action Validator
 * プレイヤーのアクションが有効かどうかを検証
 */

import type { Room, Player, ActionType, ActionValidation } from './types.js';

export class ActionValidator {
    /**
     * アクションが有効かどうかを検証
     * @param room 部屋
     * @param player プレイヤー
     * @param actionType アクション種別
     * @param amount ベット/レイズ額（オプション）
     * @returns 検証結果
     */
    validate(
        room: Room,
        player: Player,
        actionType: ActionType,
        amount?: number
    ): ActionValidation {
        const validActions = this.getValidActions(room, player);
        const currentBet = room.gameState.currentBet;
        const playerBet = player.bet;
        const stack = player.stack;
        const minRaise = room.gameState.minRaise;

        // プレイヤーがアクティブかチェック
        if (player.status !== 'ACTIVE') {
            return {
                isValid: false,
                reason: 'Player is not active',
                validActions: []
            };
        }

        // ターンかどうかチェック
        const activePlayer = room.players[room.activePlayerIndex];
        if (!activePlayer || activePlayer.socketId !== player.socketId) {
            return {
                isValid: false,
                reason: 'Not your turn',
                validActions: []
            };
        }

        // アクションが有効かチェック
        if (!validActions.includes(actionType)) {
            return {
                isValid: false,
                reason: `${actionType} is not a valid action`,
                validActions
            };
        }

        // 額のチェック（BET/RAISE/ALL_IN）
        if (actionType === 'BET' || actionType === 'RAISE') {
            if (amount === undefined) {
                return {
                    isValid: false,
                    reason: 'Amount is required for BET/RAISE',
                    validActions,
                    minBet: this.getMinBet(room, player),
                    maxBet: stack
                };
            }

            const minBet = this.getMinBet(room, player);
            const maxBet = stack;

            if (amount < minBet) {
                return {
                    isValid: false,
                    reason: `Minimum bet is ${minBet}`,
                    validActions,
                    minBet,
                    maxBet
                };
            }

            if (amount > maxBet) {
                return {
                    isValid: false,
                    reason: `Maximum bet is ${maxBet} (your stack)`,
                    validActions,
                    minBet,
                    maxBet
                };
            }
        }

        return {
            isValid: true,
            validActions,
            minBet: this.getMinBet(room, player),
            maxBet: stack
        };
    }

    /**
     * プレイヤーの有効なアクション一覧を取得
     */
    getValidActions(room: Room, player: Player): ActionType[] {
        const actions: ActionType[] = [];
        const currentBet = room.gameState.currentBet;
        const playerBet = player.bet;
        const stack = player.stack;

        // FOLDは常に可能
        actions.push('FOLD');

        // CHECK: 現在のベットと同額以上払っている場合
        if (playerBet >= currentBet) {
            actions.push('CHECK');
        }

        // CALL: 現在のベットが自分より高い場合
        if (currentBet > playerBet && stack > 0) {
            actions.push('CALL');
        }

        // BET: まだ誰もベットしていない場合
        if (currentBet === 0 && stack > 0) {
            actions.push('BET');
        }

        // RAISE: 他者がベットしていて、自分がさらに上乗せできる場合
        if (currentBet > 0 && stack > currentBet - playerBet) {
            actions.push('RAISE');
        }

        // ALL_IN: スタックがあれば常に可能
        if (stack > 0) {
            actions.push('ALL_IN');
        }

        return actions;
    }

    /**
     * 最小ベット/レイズ額を取得
     */
    getMinBet(room: Room, player: Player): number {
        const currentBet = room.gameState.currentBet;
        const minRaise = room.gameState.minRaise;

        if (currentBet === 0) {
            // 最初のベット: ビッグブラインド以上
            return room.config.bigBlind;
        } else {
            // レイズ: 現在のベット + 最小レイズ額
            return currentBet - player.bet + minRaise;
        }
    }

    /**
     * CALLに必要な額を計算
     */
    getCallAmount(room: Room, player: Player): number {
        return Math.min(
            room.gameState.currentBet - player.bet,
            player.stack
        );
    }
}
