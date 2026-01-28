/**
 * GameEngine.ts リファクタリング後の個別ハンドラーユニットテスト
 * Phase 2 で分割された5つの関数の動作検証
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import type { Room, Player, PlayerAction } from '../types.js';

describe('GameEngine Handlers - processFold', () => {
  let engine: GameEngine;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 100,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
  });

  it('should set player status to FOLDED', () => {
    const result = engine.__testing__.processFold(mockPlayer);
    expect(result).toBeNull();
    expect(mockPlayer.status).toBe('FOLDED');
  });

  it('should return null (no error)', () => {
    const result = engine.__testing__.processFold(mockPlayer);
    expect(result).toBeNull();
  });
});

describe('GameEngine Handlers - processCheck', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 100,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'FLOP',
        gameVariant: 'NLH',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 2,
        handNumber: 1,
        street: 1,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should succeed when player bet equals currentBet', () => {
    mockRoom.gameState.currentBet = 10;
    mockPlayer.bet = 10;
    const result = engine.__testing__.processCheck(mockRoom, mockPlayer);
    expect(result).toBeNull();
  });

  it('should fail when player bet is less than currentBet', () => {
    mockRoom.gameState.currentBet = 10;
    mockPlayer.bet = 5;
    const result = engine.__testing__.processCheck(mockRoom, mockPlayer);
    expect(result).toBe('Cannot check, must call or raise');
  });
});

describe('GameEngine Handlers - processCall', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 100,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'FLOP',
        gameVariant: 'NLH',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 2,
        handNumber: 1,
        street: 1,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should call correctly with sufficient stack', () => {
    mockRoom.gameState.currentBet = 20;
    mockRoom.gameState.pot.main = 30;
    mockPlayer.bet = 5;
    mockPlayer.stack = 100;

    const result = engine.__testing__.processCall(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(85); // 100 - 15
    expect(mockPlayer.bet).toBe(20); // 5 + 15
    expect(mockPlayer.totalBet).toBe(15);
    expect(mockRoom.gameState.pot.main).toBe(45); // 30 + 15
    expect(mockPlayer.status).toBe('ACTIVE');
  });

  it('should set status to ALL_IN when stack becomes zero', () => {
    mockRoom.gameState.currentBet = 50;
    mockPlayer.bet = 10;
    mockPlayer.stack = 40; // callAmount = 40

    const result = engine.__testing__.processCall(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(0);
    expect(mockPlayer.bet).toBe(50);
    expect(mockPlayer.status).toBe('ALL_IN');
  });

  it('should handle short call (stack less than call amount)', () => {
    mockRoom.gameState.currentBet = 100;
    mockPlayer.bet = 10;
    mockPlayer.stack = 50; // callAmount should be 90, but stack is only 50

    const result = engine.__testing__.processCall(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(0);
    expect(mockPlayer.bet).toBe(60); // 10 + 50 (not full call)
    expect(mockPlayer.status).toBe('ALL_IN');
  });

  it('should handle call with zero call amount', () => {
    mockRoom.gameState.currentBet = 10;
    mockPlayer.bet = 10;
    mockPlayer.stack = 100;
    const initialStack = mockPlayer.stack;

    const result = engine.__testing__.processCall(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(initialStack);
    expect(mockPlayer.bet).toBe(10);
    expect(mockPlayer.status).toBe('ACTIVE');
  });
});

describe('GameEngine Handlers - processBetOrRaise (No-Limit)', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 100,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'FLOP',
        gameVariant: 'NLH',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 2,
        handNumber: 1,
        street: 1,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should process valid raise in No-Limit', () => {
    mockRoom.gameState.currentBet = 10;
    mockRoom.gameState.minRaise = 5;
    mockPlayer.bet = 5;
    mockPlayer.stack = 100;

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 10 // total bet = 5 + 10 = 15
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(90); // 100 - 10
    expect(mockPlayer.bet).toBe(15); // 5 + 10
    expect(mockRoom.gameState.currentBet).toBe(15);
    expect(mockRoom.gameState.minRaise).toBe(5); // raiseSize = 15 - 10 = 5
    expect(mockRoom.lastAggressorIndex).toBe(0);
  });

  it('should reject bet below minimum (non all-in)', () => {
    mockRoom.gameState.currentBet = 10;
    mockRoom.gameState.minRaise = 10;
    mockPlayer.bet = 0;
    mockPlayer.stack = 100;

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 15 // totalBet = 15, minTotal = 20
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toContain('Minimum raise is');
  });

  it('should reject bet exceeding stack', () => {
    mockPlayer.stack = 50;

    const action: PlayerAction = {
      type: 'BET',
      playerId: 'player-1',
      amount: 100
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBe('Not enough chips');
  });

  it('should set ALL_IN status when stack becomes zero', () => {
    mockPlayer.stack = 50;

    const action: PlayerAction = {
      type: 'BET',
      playerId: 'player-1',
      amount: 50
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(0);
    expect(mockPlayer.status).toBe('ALL_IN');
  });

  it('should reject invalid bet amount', () => {
    const action: PlayerAction = {
      type: 'BET',
      playerId: 'player-1',
      amount: -10
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBe('Invalid bet amount');
  });
});

describe('GameEngine Handlers - processBetOrRaise (Pot-Limit)', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 200,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'FLOP',
        gameVariant: 'PLO',
        board: [],
        pot: { main: 50, side: [] },
        currentBet: 10,
        minRaise: 10,
        handNumber: 1,
        street: 1,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should allow bet within pot limit', () => {
    // pot = 50, amountToCall = 10
    // maxPotBet = 50 + (10 * 2) = 70
    mockPlayer.stack = 200;
    mockPlayer.bet = 0;

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 60 // totalBet = 60, within pot limit
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockPlayer.bet).toBe(60);
  });

  it('should reject bet exceeding pot limit', () => {
    // pot = 50, amountToCall = 10
    // maxPotBet = 50 + (10 * 2) = 70
    mockPlayer.stack = 200;
    mockPlayer.bet = 0;

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 80 // totalBet = 80, exceeds pot limit
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toContain('pot limit');
  });
});

describe('GameEngine Handlers - processBetOrRaise (Fixed-Limit)', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 200,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'THIRD_STREET',
        gameVariant: '7CS',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 2,
        handNumber: 1,
        street: 0,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should use Small Bet on early streets (3rd Street)', () => {
    // 3rd Street: Small Bet = BB = 2
    mockRoom.gameState.status = 'THIRD_STREET';
    mockRoom.gameState.street = 0;

    const action: PlayerAction = {
      type: 'BET',
      playerId: 'player-1',
      amount: 2 // Small Bet
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockPlayer.bet).toBe(2);
    expect(mockRoom.gameState.raisesThisRound).toBe(1);
  });

  it('should use Big Bet on later streets (5th Street)', () => {
    // 5th Street: Big Bet = 2 * BB = 4
    mockRoom.gameState.status = 'FIFTH_STREET';
    mockRoom.gameState.street = 2;

    const action: PlayerAction = {
      type: 'BET',
      playerId: 'player-1',
      amount: 4 // Big Bet
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockPlayer.bet).toBe(4);
    expect(mockRoom.gameState.raisesThisRound).toBe(1);
  });

  it('should reject raise when cap is reached', () => {
    mockRoom.gameState.raisesThisRound = 4; // cap = 4 for multi-way

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 10
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBe('Betting is capped');
  });

  it('should increment raisesThisRound on reopening raise', () => {
    mockRoom.gameState.currentBet = 2;
    mockRoom.gameState.minRaise = 2;
    mockRoom.gameState.raisesThisRound = 1;

    const action: PlayerAction = {
      type: 'RAISE',
      playerId: 'player-1',
      amount: 4 // totalBet = 4, raiseSize = 2 (reopens)
    };

    const result = engine.__testing__.processBetOrRaise(mockRoom, mockPlayer, action);

    expect(result).toBeNull();
    expect(mockRoom.gameState.raisesThisRound).toBe(2);
  });
});

describe('GameEngine Handlers - processAllIn', () => {
  let engine: GameEngine;
  let mockRoom: Room;
  let mockPlayer: Player;

  beforeEach(() => {
    engine = new GameEngine();
    mockPlayer = {
      socketId: 'player-1',
      name: 'TestPlayer',
      stack: 50,
      bet: 0,
      totalBet: 0,
      status: 'ACTIVE',
      hand: null,
      pendingJoin: false,
      waitingForBB: false,
      disconnected: false
    };
    mockRoom = {
      id: 'test-room',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [mockPlayer, null, null, null, null, null],
      dealerBtnIndex: 0,
      activePlayerIndex: 0,
      gameState: {
        status: 'FLOP',
        gameVariant: 'NLH',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 2,
        handNumber: 1,
        street: 1,
        raisesThisRound: 0
      },
      streetStarterIndex: 0,
      lastAggressorIndex: -1
    };
  });

  it('should move all stack to pot and set ALL_IN status', () => {
    mockPlayer.stack = 50;
    mockRoom.gameState.pot.main = 20;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.stack).toBe(0);
    expect(mockPlayer.status).toBe('ALL_IN');
    expect(mockPlayer.bet).toBe(50);
    expect(mockPlayer.totalBet).toBe(50);
    expect(mockRoom.gameState.pot.main).toBe(70); // 20 + 50
  });

  it('should update currentBet when all-in exceeds it', () => {
    mockPlayer.stack = 50;
    mockRoom.gameState.currentBet = 20;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockRoom.gameState.currentBet).toBe(50);
    expect(mockRoom.lastAggressorIndex).toBe(0);
  });

  it('should reopen action when raise size meets minRaise', () => {
    mockPlayer.stack = 50;
    mockRoom.gameState.currentBet = 20;
    mockRoom.gameState.minRaise = 20;
    mockRoom.streetStarterIndex = 2;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockRoom.gameState.minRaise).toBe(30); // raiseSize = 50 - 20
    expect(mockRoom.streetStarterIndex).toBe(0); // updated to activePlayerIndex
  });

  it('should increment raisesThisRound in Fixed-Limit when reopening', () => {
    mockRoom.gameState.gameVariant = '7CS';
    mockPlayer.stack = 50;
    mockRoom.gameState.currentBet = 20;
    mockRoom.gameState.minRaise = 20;
    mockRoom.gameState.raisesThisRound = 1;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockRoom.gameState.raisesThisRound).toBe(2);
  });

  it('should increment raisesThisRound in No-Limit when exceeding currentBet', () => {
    mockRoom.gameState.gameVariant = 'NLH';
    mockPlayer.stack = 50;
    mockRoom.gameState.currentBet = 20;
    mockRoom.gameState.minRaise = 10;
    mockRoom.gameState.raisesThisRound = 0;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockRoom.gameState.raisesThisRound).toBe(1);
  });

  it('should not update currentBet when all-in is below it (short all-in)', () => {
    mockPlayer.stack = 10;
    mockRoom.gameState.currentBet = 50;

    const result = engine.__testing__.processAllIn(mockRoom, mockPlayer);

    expect(result).toBeNull();
    expect(mockPlayer.bet).toBe(10);
    expect(mockRoom.gameState.currentBet).toBe(50); // unchanged
    expect(mockRoom.lastAggressorIndex).toBe(-1); // not updated
  });
});
