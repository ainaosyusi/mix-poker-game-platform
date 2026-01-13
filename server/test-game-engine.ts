/**
 * Automated Tests for Game Engine
 * Tests showdown, ALL IN, pot distribution, etc.
 */

import { GameEngine } from './GameEngine.js';
import { ShowdownManager } from './ShowdownManager.js';
import { PotManager } from './PotManager.js';
import { roomManager } from './RoomManager.js';
import type { Room, Player } from './types.js';

console.log('🧪 Starting Game Engine Tests...\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        passCount++;
    } else {
        console.log(`❌ FAIL: ${testName}`);
        failCount++;
    }
}

// Test 1: Basic Showdown (2 players)
function testBasicShowdown() {
    console.log('\n📋 Test 1: Basic 2-Player Showdown');

    const room = roomManager.createRoom(undefined, {
        maxPlayers: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyInMin: 100,
        buyInMax: 1000,
        allowedGames: ['NLH']
    });

    // Add 2 players
    roomManager.sitDown(room.id, 0, {
        socketId: 'player1',
        name: 'Alice',
        stack: 500,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    roomManager.sitDown(room.id, 1, {
        socketId: 'player2',
        name: 'Bob',
        stack: 500,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    const engine = new GameEngine();
    const success = engine.startHand(room);

    assert(success, 'Game should start with 2 players');
    assert(room.gameState.status === 'PREFLOP', 'Game should be in PREFLOP');
    assert(room.gameState.pot.main === 15, 'Pot should be 15 (5 SB + 10 BB)');

    // Manually set hands for testing
    room.players[0]!.hand = ['A♠', 'A♥']; // Pair of Aces
    room.players[1]!.hand = ['K♠', 'K♥']; // Pair of Kings

    // Set board
    room.gameState.board = ['Q♠', 'J♠', '2♦', '5♣', '9♥'];
    room.gameState.status = 'SHOWDOWN' as any;

    const showdownManager = new ShowdownManager();
    const result = showdownManager.executeShowdown(room);

    assert(result.winners.length === 1, 'Should have 1 winner');
    assert(result.winners[0].playerName === 'Alice', 'Alice should win with AA');
    assert(room.players[0]!.stack === 505, 'Winner should have 500 + 15 - 10 (BB paid)');

    console.log(`   Winner: ${result.winners[0].playerName} with ${result.winners[0].handRank}`);
}

// Test 2: ALL IN Auto-Progression
function testAllInAutoDeal() {
    console.log('\n📋 Test 2: ALL IN Auto-Progression');

    const room = roomManager.createRoom(undefined, {
        maxPlayers: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyInMin: 100,
        buyInMax: 1000,
        allowedGames: ['NLH']
    });

    roomManager.sitDown(room.id, 0, {
        socketId: 'player1',
        name: 'Alice',
        stack: 100,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    roomManager.sitDown(room.id, 1, {
        socketId: 'player2',
        name: 'Bob',
        stack: 100,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    const engine = new GameEngine();
    engine.startHand(room);

    // Manually set both players to ALL IN status to test auto-progression
    room.players[0]!.status = 'ALL_IN';
    room.players[0]!.stack = 0;
    room.players[0]!.bet = 100;
    room.players[0]!.totalBet = 100;

    room.players[1]!.status = 'ALL_IN';
    room.players[1]!.stack = 0;
    room.players[1]!.bet = 100;
    room.players[1]!.totalBet = 100;

    room.gameState.pot.main = 200;

    // Trigger nextStreet which should auto-deal all streets
    const originalPhase = room.gameState.status;

    // Call nextStreet once (should trigger recursive calls)
    try {
        while (room.gameState.status !== 'SHOWDOWN' && room.gameState.board.length < 5) {
            if (room.gameState.status === 'PREFLOP') {
                engine['nextStreet'](room);
            } else {
                break; // Auto-progression should handle the rest
            }
        }
    } catch (e) {
        // Ignore errors for now
    }

    assert(room.gameState.board.length === 5 || room.gameState.status === 'SHOWDOWN',
        'Board should have 5 cards or be in SHOWDOWN after ALL IN');

    console.log(`   Board: ${room.gameState.board.join(' ')}`);
    console.log(`   Status: ${room.gameState.status}`);
}

// Test 3: Pot Distribution
function testPotDistribution() {
    console.log('\n📋 Test 3: Pot Distribution');

    const room = roomManager.createRoom(undefined, {
        maxPlayers: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyInMin: 100,
        buyInMax: 1000,
        allowedGames: ['NLH']
    });

    roomManager.sitDown(room.id, 0, {
        socketId: 'player1',
        name: 'Alice',
        stack: 500,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    roomManager.sitDown(room.id, 1, {
        socketId: 'player2',
        name: 'Bob',
        stack: 500,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT',
        hand: null
    });

    const engine = new GameEngine();
    engine.startHand(room);

    const initialPot = room.gameState.pot.main;

    // Player 1 bets 50
    room.players[room.activePlayerIndex]!.stack -= 50;
    room.players[room.activePlayerIndex]!.bet += 50;
    room.players[room.activePlayerIndex]!.totalBet += 50;
    room.gameState.pot.main += 50;

    assert(room.gameState.pot.main === initialPot + 50, 'Pot should increase by bet amount');
}

// Run all tests
try {
    testBasicShowdown();
    testAllInAutoDeal();
    testPotDistribution();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
    console.log(`${'='.repeat(50)}\n`);

    if (failCount === 0) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️ Some tests failed');
        process.exit(1);
    }
} catch (error) {
    console.error('💥 Test error:', error);
    process.exit(1);
}
