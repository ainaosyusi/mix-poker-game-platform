/**
 * Phase 3-C: Rotation Manager
 * ゲームローテーションを管理
 */

import type { Room } from './types.js';
import { getVariantConfig, ROTATION_PRESETS } from './gameVariants.js';

export class RotationManager {
    private handsPerGame: number = 6; // デフォルト: 6ハンドごとに切り替え

    /**
     * ローテーション設定を更新
     */
    setHandsPerGame(count: number): void {
        this.handsPerGame = count;
    }

    /**
     * ハンド終了時にローテーションをチェック
     * @param room 部屋
     * @returns 次のゲームバリアントID（変更がない場合は現在のまま）
     */
    checkRotation(room: Room): { changed: boolean; nextGame: string } {
        const handNumber = room.gameState.handNumber;
        const gamesList = room.rotation.gamesList;

        if (gamesList.length <= 1) {
            // ローテーションなし
            return { changed: false, nextGame: room.gameState.gameVariant };
        }

        // ハンド数でローテーションをチェック
        if (handNumber > 0 && handNumber % this.handsPerGame === 0) {
            const nextIndex = (room.rotation.currentGameIndex + 1) % gamesList.length;
            const nextGame = gamesList[nextIndex];

            // ローテーションを更新
            room.rotation.currentGameIndex = nextIndex;
            room.gameState.gameVariant = nextGame;

            // 周回数を更新（全ゲームを回った場合）
            if (nextIndex === 0) {
                room.rotation.orbitCount = (room.rotation.orbitCount || 0) + 1;
            }

            console.log(`🔄 Game rotation: ${room.gameState.gameVariant} -> ${nextGame} (Orbit: ${room.rotation.orbitCount})`);

            return { changed: true, nextGame };
        }

        return { changed: false, nextGame: room.gameState.gameVariant };
    }

    /**
     * 次のゲームを取得（プレビュー用）
     */
    getNextGame(room: Room): string {
        const gamesList = room.rotation.gamesList;
        if (gamesList.length <= 1) {
            return room.gameState.gameVariant;
        }

        const nextIndex = (room.rotation.currentGameIndex + 1) % gamesList.length;
        return gamesList[nextIndex];
    }

    /**
     * 現在のゲームまでの残りハンド数を取得
     */
    getRemainingHands(room: Room): number {
        return this.handsPerGame - (room.gameState.handNumber % this.handsPerGame);
    }

    /**
     * ローテーションプリセットを適用
     */
    applyPreset(room: Room, presetName: string): boolean {
        const preset = ROTATION_PRESETS[presetName];
        if (!preset) {
            console.log(`⚠️ Unknown preset: ${presetName}`);
            return false;
        }

        room.rotation.gamesList = [...preset];
        room.rotation.currentGameIndex = 0;
        room.rotation.orbitCount = 0;
        room.gameState.gameVariant = preset[0];

        console.log(`📋 Applied rotation preset: ${presetName} (${preset.join(' -> ')})`);
        return true;
    }

    /**
     * カスタムローテーションを設定
     */
    setCustomRotation(room: Room, gamesList: string[]): void {
        room.rotation.gamesList = [...gamesList];
        room.rotation.currentGameIndex = 0;
        room.rotation.orbitCount = 0;
        room.gameState.gameVariant = gamesList[0] || 'NLH';

        console.log(`🎮 Set custom rotation: ${gamesList.join(' -> ')}`);
    }

    /**
     * 現在のローテーション状態を取得
     */
    getRotationStatus(room: Room): {
        currentGame: string;
        currentIndex: number;
        totalGames: number;
        remainingHands: number;
        nextGame: string;
        orbitCount: number;
    } {
        return {
            currentGame: room.gameState.gameVariant,
            currentIndex: room.rotation.currentGameIndex,
            totalGames: room.rotation.gamesList.length,
            remainingHands: this.getRemainingHands(room),
            nextGame: this.getNextGame(room),
            orbitCount: room.rotation.orbitCount || 0
        };
    }
}
