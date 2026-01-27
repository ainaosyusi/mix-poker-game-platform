/**
 * Phase 3-A: Room Manager
 * Manages multiple poker rooms in memory
 */

import {
    Room,
    RoomConfig,
    Player,
    GameState,
    RotationState,
    MetaGameState,
    PotState,
    RoomListItem
} from './types.js';
import { PRESET_ROOMS, type PresetRoomConfig } from './roomDefinitions.js';

export class RoomManager {
    private rooms: Map<string, Room> = new Map();

    /**
     * 新しい部屋を作成する
     * @param hostId Private卓の場合はホストのsocketId、Open卓の場合はundefined
     * @param config 部屋の設定
     * @param customRoomId Private卓の場合、指定したいカスタムID（6桁数字）。未指定ならランダム
     * @returns 作成されたRoom
     */
    createRoom(hostId: string | undefined, config: RoomConfig, customRoomId?: string): Room {
        let roomId: string;

        if (customRoomId) {
            // カスタムIDを使用（プリセットルームまたはPrivate卓）
            if (this.rooms.has(customRoomId)) {
                throw new Error('Room ID already exists');
            }
            // Private卓は6桁数字のみ、プリセットは任意の文字列
            if (hostId && !/^\d{6}$/.test(customRoomId)) {
                throw new Error('Room ID must be exactly 6 digits');
            }
            roomId = customRoomId;
        } else if (hostId) {
            // Private卓でも部屋番号未指定ならランダム生成
            roomId = this.generateRoomId();
        } else {
            // Open卓: ランダムIDを生成
            roomId = this.generateRoomId();
        }

        const room: Room = {
            id: roomId,
            hostId,
            config,
            gameState: this.createInitialGameState(config),
            players: Array(config.maxPlayers).fill(null),
            dealerBtnIndex: 0,
            activePlayerIndex: -1, // -1は誰もアクション待ちでない
            streetStarterIndex: -1, // 各ストリートで最初にアクションするプレイヤー
            lastAggressorIndex: -1, // 最後にベット/レイズしたプレイヤー
            rotation: this.createInitialRotation(config),
            metaGame: this.createInitialMetaGame(),
            createdAt: Date.now()
        };

        this.rooms.set(roomId, room);
        console.log(`✅ Room created: ${roomId} (${hostId ? 'Private' : 'Open'})`);
        return room;
    }

    /**
     * 部屋IDから部屋を取得
     * @param roomId 6桁の部屋ID
     * @returns Room or null
     */
    getRoomById(roomId: string): Room | null {
        return this.rooms.get(roomId) || null;
    }

    /**
     * 部屋を削除
     * @param roomId 6桁の部屋ID
     * @returns 削除成功時true
     */
    deleteRoom(roomId: string): boolean {
        const deleted = this.rooms.delete(roomId);
        if (deleted) {
            console.log(`🗑️  Room deleted: ${roomId}`);
        }
        return deleted;
    }

    /**
     * 空の部屋を削除（クリーンアップ）
     * @returns 削除された部屋数
     */
    cleanupEmptyRooms(): number {
        let deletedCount = 0;
        for (const [roomId, room] of this.rooms) {
            if (room.isPreset) continue; // プリセットルームは削除しない
            const playerCount = room.players.filter(p => p !== null).length;
            if (playerCount === 0) {
                this.rooms.delete(roomId);
                console.log(`🧹 Empty room cleaned up: ${roomId}`);
                deletedCount++;
            }
        }
        return deletedCount;
    }

    /**
     * オープン部屋のリストのみを取得（ロビー用）
     * プライベート部屋は非表示
     * 注: 空の部屋は standUp() 時に自動削除される
     * @returns RoomListItem配列
     */
    getAllRooms(): RoomListItem[] {
        return Array.from(this.rooms.values())
            .filter(room => room.hostId === undefined) // Open部屋・プリセット部屋のみ
            .map(room => ({
                id: room.id,
                playerCount: room.players.filter(p => p !== null).length,
                maxPlayers: room.config.maxPlayers,
                gameVariant: room.gameState.gameVariant,
                blinds: `${room.config.smallBlind}/${room.config.bigBlind}`,
                isPrivate: false,
                buyInMin: room.config.buyInMin,
                buyInMax: room.config.buyInMax,
                displayName: room.displayName,
                category: room.category,
                rotationGames: room.rotation.enabled ? room.rotation.gamesList : undefined,
            }));
    }

    /**
     * 部屋がプライベートかどうかを確認
     * @param roomId 部屋ID
     * @returns Private部屋ならtrue
     */
    isPrivateRoom(roomId: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.hostId !== undefined : false;
    }

    /**
     * 部屋の総数を取得
     * @returns 部屋の数
     */
    getRoomCount(): number {
        return this.rooms.size;
    }

    /**
     * プレイヤーを部屋に追加（着席処理）
     * @param roomId 部屋ID
     * @param seatIndex 座席番号（0-5）
     * @param player プレイヤー情報
     * @returns 成功時true
     */
    sitDown(roomId: string, seatIndex: number, player: Player): boolean {
        const room = this.getRoomById(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        if (seatIndex < 0 || seatIndex >= room.config.maxPlayers) {
            throw new Error('Invalid seat index');
        }

        if (room.players[seatIndex] !== null) {
            throw new Error('Seat already occupied');
        }

        // 同じプレイヤーがすでに別の席に座っていないかチェック
        const alreadySeated = room.players.some(p => p?.socketId === player.socketId);
        if (alreadySeated) {
            throw new Error('Player already seated in this room');
        }

        room.players[seatIndex] = player;
        console.log(`👤 ${player.name} sat down at seat ${seatIndex} in room ${roomId}`);
        return true;
    }

    /**
     * プレイヤーを部屋から離席させる
     * @param roomId 部屋ID
     * @param socketId プレイヤーのsocketId
     * @returns 成功時true
     */
    standUp(roomId: string, socketId: string): boolean {
        const room = this.getRoomById(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        const seatIndex = room.players.findIndex(p => p?.socketId === socketId);
        if (seatIndex === -1) {
            throw new Error('Player not found in this room');
        }

        const playerName = room.players[seatIndex]?.name;
        room.players[seatIndex] = null;
        console.log(`🚶 ${playerName} left seat ${seatIndex} in room ${roomId}`);

        // 部屋が空になったら削除（プリセットルームは除外）
        const allEmpty = room.players.every(p => p === null);
        if (allEmpty && !room.isPreset) {
            this.deleteRoom(roomId);
        }

        return true;
    }

    /**
     * デフォルトのゲーム状態を作成
     */
    private createInitialGameState(config: RoomConfig): GameState {
        return {
            status: 'WAITING',
            gameVariant: config.allowedGames?.[0] || 'NLH',
            street: 0,
            pot: { main: 0, side: [] },
            board: [],
            deckStatus: {
                stubCount: 52,
                burnCount: 0
            },
            currentBet: 0,
            minRaise: config.bigBlind,
            handNumber: 0,
            raisesThisRound: 0,
            deck: []
        };
    }

    /**
     * デフォルトのローテーション状態を作成
     */
    private createInitialRotation(config: RoomConfig): RotationState {
        return {
            enabled: false,
            gamesList: config.allowedGames || ['NLH'],
            currentGameIndex: 0,
            handsPerGame: 8,
            orbitCount: 0
        };
    }

    /**
     * デフォルトのメタゲーム状態を作成
     */
    private createInitialMetaGame(): MetaGameState {
        return {
            standUp: {
                isActive: false,
                remainingPlayers: []
            },
            sevenDeuce: false
        };
    }

    /**
     * ランダムな6桁の部屋IDを生成（Open卓用）
     * @returns 6桁の数字文字列
     */
    private generateRoomId(): string {
        let id: string;
        do {
            // 100000 〜 999999 のランダムな数字
            id = Math.floor(100000 + Math.random() * 900000).toString();
        } while (this.rooms.has(id)); // 重複チェック
        return id;
    }

    /**
     * プリセットルームを初期化
     * サーバー起動時に呼び出す
     */
    initializePresetRooms(): void {
        for (const preset of PRESET_ROOMS) {
            if (this.rooms.has(preset.id)) {
                console.log(`⚠️ Preset room already exists: ${preset.id}`);
                continue;
            }

            const room = this.createRoom(undefined, preset.roomConfig, preset.id);
            room.isPreset = true;
            room.presetId = preset.id;
            room.displayName = preset.displayName;
            room.category = preset.category;

            // ローテーション設定
            if (preset.rotationConfig) {
                room.rotation.enabled = preset.rotationConfig.enabled;
                room.rotation.gamesList = preset.rotationConfig.gamesList;
                room.rotation.handsPerGame = preset.rotationConfig.handsPerGame;
                room.gameState.gameVariant = preset.rotationConfig.gamesList[0];
            }

            console.log(`🏠 Preset room initialized: ${preset.id} (${preset.displayName})`);
        }
        console.log(`✅ ${PRESET_ROOMS.length} preset rooms initialized`);
    }
}

// シングルトンインスタンスをエクスポート
export const roomManager = new RoomManager();
