/**
 * Game Engine Tests
 * Betting/min-raise behaviors
 */

import { describe, it, expect } from 'vitest';
import { GameEngine } from './GameEngine.js';
import type { Room, Player, PlayerStatus } from './types.js';

function createPlayer(
    socketId: string,
    stack: number,
    bet: number,
    status: PlayerStatus = 'ACTIVE'
): Player {
    return {
        socketId,
        name: socketId,
        stack,
        bet,
        totalBet: bet,
        status,
        hand: ['A♠', 'K♠']
    };
}

function createRoom(players: (Player | null)[], gameVariant: string, status: any): Room {
    return {
        id: 'test-room',
        hostId: 'host',
        config: {
            maxPlayers: 6,
            smallBlind: 5,
            bigBlind: 10,
            timeLimit: 30
        },
        players,
        dealerBtnIndex: 0,
        activePlayerIndex: 0,
        streetStarterIndex: 1,
        lastAggressorIndex: -1,
        rotation: {
            enabled: false,
            gamesList: [gameVariant],
            currentGameIndex: 0,
            handsPerGame: 8
        },
        metaGame: {
            standUp: { isActive: false, remainingPlayers: [] },
            sevenDeuce: false
        },
        createdAt: Date.now(),
        gameState: {
            status,
            street: 1,
            gameVariant,
            board: [],
            pot: { main: 0, side: [] },
            deckStatus: { stubCount: 0, burnCount: 0 },
            currentBet: 100,
            minRaise: 50,
            handNumber: 1,
            raisesThisRound: 0,
            deck: []
        }
    };
}

describe('GameEngine - Minimum Raise Handling', () => {
    it('all-in below min raise does not reopen betting', () => {
        const engine = new GameEngine();
        const player0 = createPlayer('p0', 20, 100, 'ACTIVE');
        const player1 = createPlayer('p1', 200, 100, 'ACTIVE');
        const room = createRoom([player0, player1], 'NLH', 'FLOP');

        room.activePlayerIndex = 0;
        room.streetStarterIndex = 1;

        const result = engine.processAction(room, {
            playerId: 'p0',
            type: 'RAISE',
            amount: 20,
            timestamp: Date.now()
        });

        expect(result.success).toBe(true);
        expect(room.gameState.currentBet).toBe(120);
        expect(room.gameState.minRaise).toBe(50);
        expect(room.streetStarterIndex).toBe(1);
        expect(room.lastAggressorIndex).toBe(0);
    });
});

describe('GameEngine - Fixed Limit Min Bet', () => {
    it('fixed-limit uses big bet on later draw streets', () => {
        const engine = new GameEngine();
        const player0 = createPlayer('p0', 200, 0, 'ACTIVE');
        const room = createRoom([player0], '2-7_TD', 'SECOND_DRAW');

        room.gameState.currentBet = 0;
        room.gameState.minRaise = 10;

        const info = engine.getBettingInfo(room, 'p0');
        expect(info.minBet).toBe(20);
    });
});

describe('GameEngine - Join/Disconnect Flags', () => {
    function normalizePlayers(players: (Player | null)[]): (Player | null)[] {
        const padded = [...players];
        while (padded.length < 6) {
            padded.push(null);
        }
        return padded;
    }

    function createRoomForStartHand(players: (Player | null)[]): Room {
        return {
            id: 'test-room',
            hostId: 'host',
            config: {
                maxPlayers: 6,
                smallBlind: 5,
                bigBlind: 10,
                timeLimit: 30
            },
            players: normalizePlayers(players),
            dealerBtnIndex: 0,
            activePlayerIndex: 0,
            streetStarterIndex: 0,
            lastAggressorIndex: -1,
            rotation: {
                enabled: false,
                gamesList: ['NLH'],
                currentGameIndex: 0,
                handsPerGame: 8
            },
            metaGame: {
                standUp: { isActive: false, remainingPlayers: [] },
                sevenDeuce: false
            },
            createdAt: Date.now(),
            gameState: {
                status: 'WAITING' as any,
                street: 0,
                gameVariant: 'NLH',
                board: [],
                pot: { main: 0, side: [] },
                deckStatus: { stubCount: 0, burnCount: 0 },
                currentBet: 0,
                minRaise: 10,
                handNumber: 0,
                raisesThisRound: 0,
                deck: []
            }
        };
    }

    it('pendingJoinのみのSIT_OUTは次ハンドでACTIVEになる', () => {
        const engine = new GameEngine();
        const joiner: Player = {
            socketId: 'p0',
            name: 'p0',
            stack: 100,
            bet: 0,
            totalBet: 0,
            status: 'SIT_OUT',
            hand: null,
            pendingJoin: true,
            waitingForBB: false
        };
        const other1 = createPlayer('p1', 100, 0, 'ACTIVE');
        const other2 = createPlayer('p2', 100, 0, 'ACTIVE');
        const room = createRoomForStartHand([joiner, other1, other2]);

        const result = engine.startHand(room);

        expect(result).toBe(true);
        expect(joiner.status).toBe('ACTIVE');
        expect(joiner.pendingJoin).toBe(false);
    });

    it('BB待ちは次ハンドでもSIT_OUTのまま', () => {
        const engine = new GameEngine();
        const joiner: Player = {
            socketId: 'p0',
            name: 'p0',
            stack: 100,
            bet: 0,
            totalBet: 0,
            status: 'SIT_OUT',
            hand: null,
            pendingJoin: true,
            waitingForBB: true
        };
        const other1 = createPlayer('p1', 100, 0, 'ACTIVE');
        const other2 = createPlayer('p2', 100, 0, 'ACTIVE');
        const room = createRoomForStartHand([joiner, other1, other2]);

        const result = engine.startHand(room);

        expect(result).toBe(true);
        expect(joiner.status).toBe('SIT_OUT');
        expect(joiner.pendingJoin).toBe(true);
        expect(joiner.waitingForBB).toBe(true);
    });

    it('disconnectedは次ハンド開始時にSIT_OUTになる', () => {
        const engine = new GameEngine();
        const player: Player = {
            socketId: 'p0',
            name: 'p0',
            stack: 100,
            bet: 0,
            totalBet: 0,
            status: 'ACTIVE',
            hand: null,
            disconnected: true
        };
        const other1 = createPlayer('p1', 100, 0, 'ACTIVE');
        const other2 = createPlayer('p2', 100, 0, 'ACTIVE');
        const room = createRoomForStartHand([player, other1, other2]);

        const result = engine.startHand(room);

        expect(result).toBe(true);
        expect(player.status).toBe('SIT_OUT');
    });
});
