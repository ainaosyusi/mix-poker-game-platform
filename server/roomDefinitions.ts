/**
 * プリセットルーム定義
 * サーバー起動時に自動作成されるルーム
 */

import type { RoomConfig } from './types.js';

export interface PresetRoomConfig {
    id: string;                    // 安定したルームID (例: "nlh-1-2")
    displayName: string;           // 表示名 (例: "NLH 1/2")
    category: 'nlh' | 'mix';      // カテゴリ
    roomConfig: RoomConfig;        // ルーム設定
    rotationConfig?: {
        enabled: boolean;
        gamesList: string[];
        handsPerGame: number;
    };
}

export const PRESET_ROOMS: PresetRoomConfig[] = [
    // ========== NLH ルーム ==========
    {
        id: 'nlh-1-2',
        displayName: 'NLH 1/2',
        category: 'nlh',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 1,
            bigBlind: 2,
            buyInMin: 100,    // 50BB
            buyInMax: 400,    // 200BB
            allowedGames: ['NLH'],
        },
    },
    {
        id: 'nlh-2-5',
        displayName: 'NLH 2/5',
        category: 'nlh',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,    // 50BB
            buyInMax: 1000,   // 200BB
            allowedGames: ['NLH'],
        },
    },
    {
        id: 'nlh-5-10',
        displayName: 'NLH 5/10',
        category: 'nlh',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 5,
            bigBlind: 10,
            buyInMin: 500,    // 50BB
            buyInMax: 2000,   // 200BB
            allowedGames: ['NLH'],
        },
    },

    // ========== Mix ルーム ==========
    {
        id: 'mix-plo',
        displayName: 'PLO Mix',
        category: 'mix',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,    // 50BB
            buyInMax: 1000,   // 200BB
            allowedGames: ['PLO', 'PLO8'],
        },
        rotationConfig: {
            enabled: true,
            gamesList: ['PLO', 'PLO8'],
            handsPerGame: 8,
        },
    },
    {
        id: 'mix-8game',
        displayName: '8-Game Mix',
        category: 'mix',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,    // 50BB
            buyInMax: 1000,   // 200BB
            allowedGames: ['2-7_TD', 'NLH', 'PLO', 'RAZZ', '7CS', '7CS8', 'PLO8', 'BADUGI'],
        },
        rotationConfig: {
            enabled: true,
            gamesList: ['2-7_TD', 'NLH', 'PLO', 'RAZZ', '7CS', '7CS8', 'PLO8', 'BADUGI'],
            handsPerGame: 8,
        },
    },
    {
        id: 'mix-10game',
        displayName: '10-Game Mix',
        category: 'mix',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,    // 50BB
            buyInMax: 1000,   // 200BB
            allowedGames: ['2-7_TD', 'NLH', 'PLO', 'RAZZ', '7CS', '7CS8', 'PLO8', 'BADUGI', 'NLH', 'PLO'],
        },
        rotationConfig: {
            enabled: true,
            gamesList: ['2-7_TD', 'NLH', 'PLO', 'RAZZ', '7CS', '7CS8', 'PLO8', 'BADUGI', 'NLH', 'PLO'],
            handsPerGame: 8,
        },
    },
    {
        id: 'mix-10game-plus',
        displayName: '10-Game+ Mix',
        category: 'mix',
        roomConfig: {
            maxPlayers: 6,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,    // 50BB
            buyInMax: 1000,   // 200BB
            allowedGames: ['NLH', 'PLO', 'PLO8', '7CS', '7CS8', 'RAZZ', '2-7_TD', 'BADUGI'],
        },
        rotationConfig: {
            enabled: true,
            gamesList: ['NLH', 'PLO', 'PLO8', '7CS', '7CS8', 'RAZZ', '2-7_TD', 'BADUGI'],
            handsPerGame: 8,
        },
    },

    // ========== OFC ルーム ==========
    {
        id: 'ofc-1-2',
        displayName: 'OFC 1/2',
        category: 'mix',
        roomConfig: {
            maxPlayers: 3,             // OFCは最大3人
            smallBlind: 1,
            bigBlind: 2,               // 1ポイント = 2チップ
            buyInMin: 100,
            buyInMax: 400,
            allowedGames: ['OFC'],
        },
    },
    {
        id: 'ofc-2-5',
        displayName: 'OFC 2/5',
        category: 'mix',
        roomConfig: {
            maxPlayers: 3,
            smallBlind: 2,
            bigBlind: 5,
            buyInMin: 250,
            buyInMax: 1000,
            allowedGames: ['OFC'],
        },
    },
];
