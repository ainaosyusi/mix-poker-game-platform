/**
 * GameEngine action handler unit tests (Phase 3 - Option 2)
 */

import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import type { Room, Player, PlayerStatus } from '../types.js';

function createPlayer(id: string, stack: number, bet = 0, status: PlayerStatus = 'ACTIVE'): Player {
  return {
    socketId: id,
    name: id,
    stack,
    bet,
    totalBet: 0,
    status,
    hand: null
  };
}

function createRoom(options: {
  gameVariant?: string;
  currentBet?: number;
  minRaise?: number;
  raisesThisRound?: number;
  potMain?: number;
  activePlayers?: number;
} = {}): Room {
  const gameVariant = options.gameVariant ?? 'NLH';
  const activePlayers = options.activePlayers ?? 2;
  const players: (Player | null)[] = Array(6).fill(null);

  for (let i = 0; i < activePlayers; i += 1) {
    players[i] = createPlayer(`p${i + 1}`, 100, 0, 'ACTIVE');
  }

  return {
    id: 'room-1',
    config: {
      maxPlayers: 6,
      smallBlind: 1,
      bigBlind: 2,
      buyInMin: 40,
      buyInMax: 200,
      allowedGames: [gameVariant]
    },
    gameState: {
      status: 'PREFLOP' as any,
      gameVariant,
      street: 0,
      pot: { main: options.potMain ?? 0, side: [] },
      board: [],
      deckStatus: { stubCount: 52, burnCount: 0 },
      currentBet: options.currentBet ?? 0,
      minRaise: options.minRaise ?? 2,
      handNumber: 1,
      raisesThisRound: options.raisesThisRound ?? 0,
      deck: []
    },
    players,
    dealerBtnIndex: 0,
    activePlayerIndex: 0,
    streetStarterIndex: 0,
    lastAggressorIndex: -1,
    rotation: {
      enabled: false,
      gamesList: [gameVariant],
      currentGameIndex: 0,
      handsPerGame: 8,
      orbitCount: 0
    },
    metaGame: {
      standUp: { isActive: false, remainingPlayers: [] },
      sevenDeuce: false
    },
    createdAt: Date.now()
  };
}

describe('GameEngine.processAction - per-action behavior', () => {
  it('FOLD should mark player as FOLDED', () => {
    const engine = new GameEngine();
    const room = createRoom();

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'FOLD',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(room.players[0]?.status).toBe('FOLDED');
  });

  it('CHECK should fail when facing a bet', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 10 });

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'CHECK',
      timestamp: Date.now()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot check, must call or raise');
  });

  it('CHECK should succeed when bets are matched', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 10 });
    const player = room.players[0]!;
    player.bet = 10;

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'CHECK',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(player.status).toBe('ACTIVE');
  });

  it('CALL should move chips and update pot', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 10, potMain: 5 });
    const player = room.players[0]!;
    player.bet = 2;
    player.stack = 20;

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'CALL',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(player.bet).toBe(10);
    expect(player.stack).toBe(12);
    expect(player.totalBet).toBe(8);
    expect(room.gameState.pot.main).toBe(13);
  });

  it('BET/RAISE should reject invalid amount', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 0 });

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'BET',
      amount: 0,
      timestamp: Date.now()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid bet amount');
  });

  it('BET/RAISE should enforce Fixed-Limit cap when 3+ active players', () => {
    const engine = new GameEngine();
    const room = createRoom({ gameVariant: '2-7_TD', raisesThisRound: 4, activePlayers: 3 });

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'RAISE',
      amount: 10,
      timestamp: Date.now()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Betting is capped');
  });

  it('BET/RAISE should enforce minimum raise for no-limit', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 10, minRaise: 10 });

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'RAISE',
      amount: 5,
      timestamp: Date.now()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Minimum raise is 20');
  });

  it('BET/RAISE should enforce pot-limit max', () => {
    const engine = new GameEngine();
    const room = createRoom({ gameVariant: 'PLO', currentBet: 10, potMain: 100 });
    const player = room.players[0]!;
    player.stack = 500;

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'RAISE',
      amount: 200,
      timestamp: Date.now()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Maximum bet is 120 (pot limit)');
  });

  it('BET/RAISE should update state on success (no-limit)', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 10, minRaise: 10, potMain: 0 });
    const player = room.players[0]!;

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'RAISE',
      amount: 30,
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(player.bet).toBe(30);
    expect(player.stack).toBe(70);
    expect(player.totalBet).toBe(30);
    expect(room.gameState.pot.main).toBe(30);
    expect(room.gameState.currentBet).toBe(30);
    expect(room.gameState.minRaise).toBe(20);
    expect(room.streetStarterIndex).toBe(0);
    expect(room.lastAggressorIndex).toBe(0);
  });

  it('ALL_IN should move full stack and update raise info', () => {
    const engine = new GameEngine();
    const room = createRoom({ currentBet: 20, minRaise: 10, potMain: 0 });
    const player = room.players[0]!;
    player.bet = 10;
    player.stack = 50;

    const result = engine.processAction(room, {
      playerId: 'p1',
      type: 'ALL_IN',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(player.status).toBe('ALL_IN');
    expect(player.stack).toBe(0);
    expect(player.bet).toBe(60);
    expect(room.gameState.pot.main).toBe(50);
    expect(room.gameState.currentBet).toBe(60);
    expect(room.gameState.minRaise).toBe(40);
    expect(room.gameState.raisesThisRound).toBe(1);
  });
});
