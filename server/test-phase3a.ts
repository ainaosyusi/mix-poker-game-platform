/**
 * Phase 3-A 自動検査スクリプト
 * RoomManagerクラスの全機能を検証
 */

import { RoomManager } from './RoomManager.js';
import type { RoomConfig, Player } from './types.js';

console.log('🧪 Phase 3-A 自動検査を開始します\n');

const roomManager = new RoomManager();
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passCount++;
    } catch (error: any) {
        console.log(`❌ ${name}`);
        console.log(`   エラー: ${error.message}`);
        failCount++;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

// テスト用設定
const defaultConfig: RoomConfig = {
    maxPlayers: 6,
    smallBlind: 5,
    bigBlind: 10,
    buyInMin: 100,
    buyInMax: 1000,
    allowedGames: ['NLH']
};

console.log('=== 1. 部屋作成機能 ===\n');

test('1-1. Open卓の作成', () => {
    const room = roomManager.createRoom(undefined, defaultConfig);
    assert(room.id.length === 6, '部屋IDは6桁');
    assert(/^\d{6}$/.test(room.id), '部屋IDは数字のみ');
    assert(room.hostId === undefined, 'Open卓はhostIdがundefined');
    assert(room.players.length === 6, 'プレイヤー配列は6要素');
});

test('1-2. Private卓の作成（カスタムID）', () => {
    const customId = '123456';
    const room = roomManager.createRoom('host-socket-id', defaultConfig, customId);
    assert(room.id === customId, 'カスタムIDが使用される');
    assert(room.hostId === 'host-socket-id', 'hostIdが設定される');
});

test('1-3. 重複IDエラー', () => {
    try {
        roomManager.createRoom('host2', defaultConfig, '123456');
        throw new Error('重複チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Room ID already exists', '重複エラーが発生');
    }
});

test('1-4. 不正なカスタムID（5桁）', () => {
    try {
        roomManager.createRoom('host3', defaultConfig, '12345');
        throw new Error('ID検証が機能していない');
    } catch (error: any) {
        assert(error.message.includes('6 digits'), '6桁チェックが機能');
    }
});

test('1-5. 不正なカスタムID（文字含む）', () => {
    try {
        roomManager.createRoom('host4', defaultConfig, 'ABC123');
        throw new Error('ID検証が機能していない');
    } catch (error: any) {
        assert(error.message.includes('6 digits'), '数字チェックが機能');
    }
});

console.log('\n=== 2. 部屋取得・削除機能 ===\n');

test('2-1. 部屋取得（存在する）', () => {
    const room = roomManager.getRoomById('123456');
    assert(room !== null, '部屋が取得できる');
    assert(room?.id === '123456', '正しい部屋が取得される');
});

test('2-2. 部屋取得（存在しない）', () => {
    const room = roomManager.getRoomById('999999');
    assert(room === null, '存在しない部屋はnull');
});

test('2-3. 部屋削除', () => {
    const result = roomManager.deleteRoom('123456');
    assert(result === true, '削除成功時はtrue');
    const room = roomManager.getRoomById('123456');
    assert(room === null, '削除後は取得できない');
});

test('2-4. 存在しない部屋の削除', () => {
    const result = roomManager.deleteRoom('999999');
    assert(result === false, '存在しない部屋の削除はfalse');
});

console.log('\n=== 3. 部屋リスト取得 ===\n');

test('3-1. 空の部屋リスト', () => {
    // 全部屋を削除
    const allRooms = roomManager.getAllRooms();
    allRooms.forEach(room => roomManager.deleteRoom(room.id));

    const rooms = roomManager.getAllRooms();
    assert(rooms.length === 0, '部屋がない場合は空配列');
});

test('3-2. 複数部屋のリスト', () => {
    roomManager.createRoom(undefined, defaultConfig);
    roomManager.createRoom(undefined, defaultConfig);
    const rooms = roomManager.getAllRooms();
    assert(rooms.length === 2, '2つの部屋が取得できる');
    assert(rooms[0].playerCount === 0, '初期状態はプレイヤー0人');
    assert(rooms[0].maxPlayers === 6, '最大6人');
});

console.log('\n=== 4. 着席機能 ===\n');

const testRoom = roomManager.createRoom(undefined, defaultConfig);
const testPlayer: Player = {
    socketId: 'test-socket-1',
    name: 'TestPlayer1',
    stack: 500,
    bet: 0,
    totalBet: 0,
    status: 'SIT_OUT',
    hand: null
};

test('4-1. 空席に着席', () => {
    const result = roomManager.sitDown(testRoom.id, 0, testPlayer);
    assert(result === true, '着席成功');
    const room = roomManager.getRoomById(testRoom.id);
    assert(room?.players[0]?.socketId === 'test-socket-1', 'プレイヤーが着席');
});

test('4-2. すでに着席済みの席', () => {
    try {
        roomManager.sitDown(testRoom.id, 0, { ...testPlayer, socketId: 'test-socket-2' });
        throw new Error('着席チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Seat already occupied', '着席済みエラー');
    }
});

test('4-3. 同じプレイヤーの重複着席', () => {
    try {
        roomManager.sitDown(testRoom.id, 1, testPlayer);
        throw new Error('重複チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Player already seated in this room', '重複着席エラー');
    }
});

test('4-4. 不正な座席番号（負の値）', () => {
    try {
        roomManager.sitDown(testRoom.id, -1, { ...testPlayer, socketId: 'test-socket-3' });
        throw new Error('座席番号チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Invalid seat index', '不正な座席番号エラー');
    }
});

test('4-5. 不正な座席番号（範囲外）', () => {
    try {
        roomManager.sitDown(testRoom.id, 10, { ...testPlayer, socketId: 'test-socket-4' });
        throw new Error('座席番号チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Invalid seat index', '範囲外エラー');
    }
});

console.log('\n=== 5. 離席機能 ===\n');

test('5-1. 着席中のプレイヤーの離席', () => {
    const result = roomManager.standUp(testRoom.id, 'test-socket-1');
    assert(result === true, '離席成功');
    const room = roomManager.getRoomById(testRoom.id);
    assert(room?.players[0] === null, '座席が空席になる');
});

test('5-2. 着席していないプレイヤーの離席', () => {
    try {
        roomManager.standUp(testRoom.id, 'non-existent-socket');
        throw new Error('離席チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Player not found in this room', '未着席エラー');
    }
});

test('5-3. 全員離席時の部屋削除', () => {
    // 新しい部屋を作成して1人着席させる
    const tempRoom = roomManager.createRoom(undefined, defaultConfig);
    const tempPlayer: Player = {
        socketId: 'temp-socket',
        name: 'TempPlayer',
        stack: 500,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    };
    roomManager.sitDown(tempRoom.id, 0, tempPlayer);

    // 離席
    roomManager.standUp(tempRoom.id, 'temp-socket');

    // 部屋が削除されているか確認
    const room = roomManager.getRoomById(tempRoom.id);
    assert(room === null, '全員離席で部屋が自動削除される');
});

console.log('\n=== 6. エッジケース ===\n');

test('6-1. 存在しない部屋への着席', () => {
    try {
        roomManager.sitDown('999999', 0, testPlayer);
        throw new Error('部屋存在チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Room not found', '部屋不存在エラー');
    }
});

test('6-2. 存在しない部屋からの離席', () => {
    try {
        roomManager.standUp('999999', 'test-socket');
        throw new Error('部屋存在チェックが機能していない');
    } catch (error: any) {
        assert(error.message === 'Room not found', '部屋不存在エラー');
    }
});

// 最終結果
console.log('\n' + '='.repeat(50));
console.log('検査結果:');
console.log(`✅ 成功: ${passCount}`);
console.log(`❌ 失敗: ${failCount}`);
console.log(`📊 成功率: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
console.log('='.repeat(50) + '\n');

if (failCount === 0) {
    console.log('🎉 すべての検査に合格しました！');
    process.exit(0);
} else {
    console.log('⚠️  一部の検査に失敗しました。');
    process.exit(1);
}
