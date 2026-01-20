/**
 * Phase 3-B: Action Validator
 * プレイヤーのアクションが有効かどうかを検証
 */

import type { Room, Player, ActionType, ActionValidation } from './types.js';
import { getVariantConfig } from './gameVariants.js';

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
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        const callAmount = Math.max(0, currentBet - playerBet);

        if (playerBet >= currentBet) {
            actions.push('CHECK');
        } else {
            actions.push('FOLD');
            actions.push('CALL');
        }

        const otherActivePlayers = room.players.filter(p =>
            p !== null && p.socketId !== player.socketId && p.status === 'ACTIVE'
        );

        const canAffordRaise = stack > callAmount;
        const isCapped = variantConfig.betStructure === 'fixed' &&
            room.gameState.raisesThisRound >= this.getCapLimit(room);
        const canRaise = canAffordRaise && !isCapped && otherActivePlayers.length > 0;

        if (canRaise) {
            if (currentBet === 0) {
                actions.push('BET');
            } else {
                actions.push('RAISE');
            }
        }

        if (variantConfig.betStructure === 'no-limit' && stack > 0 && callAmount < stack) {
            actions.push('ALL_IN');
        }

        return actions;
    }

    /**
     * 最小ベット/レイズ額を取得
     */
    getMinBet(room: Room, player: Player): number {
        const currentBet = room.gameState.currentBet;
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const minRaise = room.gameState.minRaise;

        if (variantConfig.betStructure === 'fixed') {
            const fixedBetSize = this.getFixedBetSize(room);
            return currentBet === 0
                ? fixedBetSize
                : currentBet - player.bet + fixedBetSize;
        }

        return currentBet === 0
            ? room.config.bigBlind
            : currentBet - player.bet + minRaise;
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

    private getFixedBetSize(room: Room): number {
        const smallBet = room.config.bigBlind;
        const bigBet = smallBet * 2;
        const phase = room.gameState.status;
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        if (variantConfig.communityCardType === 'stud') {
            if (phase === 'FIFTH_STREET' || phase === 'SIXTH_STREET' || phase === 'SEVENTH_STREET') {
                return bigBet;
            }
            return smallBet;
        }

        if (variantConfig.hasDrawPhase) {
            if (phase === 'SECOND_DRAW' || phase === 'THIRD_DRAW') {
                return bigBet;
            }
            return smallBet;
        }

        if (phase === 'TURN' || phase === 'RIVER') {
            return bigBet;
        }

        return smallBet;
    }

    private getCapLimit(room: Room): number {
        const activePlayers = room.players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        ).length;

        if (activePlayers === 2) {
            return 99;
        }

        return 4;
    }
}
