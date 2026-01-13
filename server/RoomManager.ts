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

export class RoomManager {
    private rooms: Map<string, Room> = new Map();

    /**
     * 新しい部屋を作成する
     * @param hostId Private卓の場合はホストのsocketId、Open卓の場合はundefined
     * @param config 部屋の設定
     * @param customRoomId Private卓の場合、指定したいカスタムID（6桁数字）
     * @returns 作成されたRoom
     */
    createRoom(hostId: string | undefined, config: RoomConfig, customRoomId?: string): Room {
        let roomId: string;

        if (customRoomId) {
            // Private卓: カスタムIDを使用
            if (!/^\d{6}$/.test(customRoomId)) {
                throw new Error('Room ID must be exactly 6 digits');
            }
            if (this.rooms.has(customRoomId)) {
                throw new Error('Room ID already exists');
            }
            roomId = customRoomId;
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
     * すべての部屋のリストを取得（ロビー用）
     * @returns RoomListItem配列
     */
    getAllRooms(): RoomListItem[] {
        return Array.from(this.rooms.values()).map(room => ({
            id: room.id,
            playerCount: room.players.filter(p => p !== null).length,
            maxPlayers: room.config.maxPlayers,
            gameVariant: room.gameState.gameVariant,
            blinds: `${room.config.smallBlind}/${room.config.bigBlind}`,
            isPrivate: room.hostId !== undefined
        }));
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

        // 部屋が空になったら削除（オプション）
        const allEmpty = room.players.every(p => p === null);
        if (allEmpty) {
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
            gameVariant: config.allowedGames[0] || 'NLH',
            street: 0,
            pot: { main: 0, side: [] },
            board: [],
            deckStatus: {
                stubCount: 52,
                burnCount: 0
            },
            currentBet: 0,
            minRaise: config.bigBlind,
            handNumber: 0
        };
    }

    /**
     * デフォルトのローテーション状態を作成
     */
    private createInitialRotation(config: RoomConfig): RotationState {
        return {
            orbitCount: 0,
            gamesList: config.allowedGames,
            currentGameIndex: 0
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
}

// シングルトンインスタンスをエクスポート
export const roomManager = new RoomManager();
