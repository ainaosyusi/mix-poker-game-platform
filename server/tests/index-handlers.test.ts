/**
 * server/index.ts リファクタリング後のヘルパー関数ユニットテスト
 * Phase 2 で分割された関数の動作検証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRoomIdOrError,
  getRoomOrError,
  getEngineOrError,
  checkActionRateLimit,
  validateActionToken,
  validateQuickJoinBuyIn,
  createQuickJoinPlayer,
  removeExistingPlayerSession,
  __testing__
} from '../index.js';
import { roomManager } from '../RoomManager.js';
import { GameEngine } from '../GameEngine.js';
import type { Room, Player } from '../types.js';

describe('Index Handlers - Basic Validation Functions', () => {
  let mockSocket: any;
  let mockRoom: any;

  beforeEach(() => {
    // Socket mock
    mockSocket = {
      id: 'socket-123',
      rooms: new Set(['socket-123', 'room:test-room-1']),
      emit: vi.fn(),
      data: {},
      handshake: {
        address: '127.0.0.1'
      }
    };

    // Room mock
    mockRoom = {
      id: 'test-room-1',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [null, null, null, null, null, null],
      gameState: {
        status: 'WAITING',
        gameVariant: 'NLH',
        board: [],
        pot: { main: 0, side: [] },
        currentBet: 0,
        minRaise: 0,
        handNumber: 0
      }
    };

    // Clean up test state
    __testing__.clearActionTokens();
    __testing__.clearActionRateLimit();
    __testing__.clearInvalidActionCounts();
  });

  describe('getRoomIdOrError', () => {
    it('should return roomId when socket is in a room', () => {
      const roomId = getRoomIdOrError(mockSocket);
      expect(roomId).toBe('test-room-1');
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should emit error when socket is not in any room', () => {
      mockSocket.rooms = new Set(['socket-123']);
      const roomId = getRoomIdOrError(mockSocket);
      expect(roomId).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'You are not in any room' });
    });

    it('should return null when socket has no rooms', () => {
      mockSocket.rooms = new Set();
      const roomId = getRoomIdOrError(mockSocket);
      expect(roomId).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'You are not in any room' });
    });
  });

  describe('getRoomOrError', () => {
    beforeEach(() => {
      vi.spyOn(roomManager, 'getRoomById').mockReturnValue(mockRoom);
    });

    it('should return room when room exists', () => {
      const room = getRoomOrError('test-room-1', mockSocket);
      expect(room).toBe(mockRoom);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should emit error when room not found', () => {
      vi.spyOn(roomManager, 'getRoomById').mockReturnValue(null);
      const room = getRoomOrError('non-existent', mockSocket);
      expect(room).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Room not found' });
    });
  });

  describe('getEngineOrError', () => {
    let mockEngine: GameEngine;

    beforeEach(() => {
      mockEngine = new GameEngine();
      __testing__.setGameEngine('test-room-1', mockEngine);
    });

    it('should return engine when engine exists', () => {
      const engine = getEngineOrError('test-room-1', mockSocket);
      expect(engine).toBe(mockEngine);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should emit error when engine not found', () => {
      const engine = getEngineOrError('non-existent', mockSocket);
      expect(engine).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Game not started' });
    });
  });

  describe('checkActionRateLimit', () => {
    it('should allow first action within window', () => {
      const now = Date.now();
      const result = checkActionRateLimit(mockSocket, 'test-room-1', now);
      expect(result).toBe(true);
      expect(mockSocket.emit).not.toHaveBeenCalled();

      const rateLimit = __testing__.getActionRateLimit(mockSocket.id);
      expect(rateLimit).toEqual({ count: 1, windowStart: now });
    });

    it('should allow actions under limit', () => {
      const now = Date.now();
      // 最大6回まで許可
      for (let i = 1; i <= __testing__.ACTION_RATE_LIMIT_MAX; i++) {
        const result = checkActionRateLimit(mockSocket, 'test-room-1', now + i);
        expect(result).toBe(true);
      }
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should reject when rate limit exceeded', () => {
      const now = Date.now();
      // まず上限まで実行
      for (let i = 1; i <= __testing__.ACTION_RATE_LIMIT_MAX; i++) {
        checkActionRateLimit(mockSocket, 'test-room-1', now + i);
      }

      // 7回目は拒否される
      const result = checkActionRateLimit(mockSocket, 'test-room-1', now + 100);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('action-invalid', { reason: 'Too many actions' });
    });

    it('should reset counter after window expires', () => {
      const now = Date.now();
      // 上限まで実行（最初のタイムスタンプから2秒経過する必要がある）
      for (let i = 0; i < __testing__.ACTION_RATE_LIMIT_MAX; i++) {
        checkActionRateLimit(mockSocket, 'test-room-1', now + i);
      }

      // ウィンドウ期限後 (最初のタイムスタンプから2秒 + 1ms)
      const afterWindow = now + __testing__.ACTION_RATE_LIMIT_WINDOW_MS + 1;
      const result = checkActionRateLimit(mockSocket, 'test-room-1', afterWindow);
      expect(result).toBe(true);

      const rateLimit = __testing__.getActionRateLimit(mockSocket.id);
      expect(rateLimit?.count).toBe(1);
      expect(rateLimit?.windowStart).toBe(afterWindow);
    });
  });

  describe('validateActionToken', () => {
    const validToken = 'valid-token-123';
    const now = Date.now();

    beforeEach(() => {
      __testing__.setActionToken(mockSocket.id, validToken, now);
    });

    it('should accept valid token within TTL', () => {
      const result = validateActionToken(mockSocket, 'test-room-1', validToken, now + 1000);
      expect(result).toBe(true);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should reject when token is undefined', () => {
      const result = validateActionToken(mockSocket, 'test-room-1', undefined, now);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('action-invalid', { reason: 'Invalid action token' });
    });

    it('should reject invalid token', () => {
      const result = validateActionToken(mockSocket, 'test-room-1', 'wrong-token', now);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('action-invalid', { reason: 'Invalid action token' });
    });

    it('should reject expired token', () => {
      const expiredTime = now + __testing__.ACTION_TOKEN_TTL_MS + 1;
      const result = validateActionToken(mockSocket, 'test-room-1', validToken, expiredTime);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('action-invalid', { reason: 'Action token expired' });

      // トークンは削除される
      const token = __testing__.getActionToken(mockSocket.id);
      expect(token).toBeUndefined();
    });

    it('should reject when no expected token exists', () => {
      const newSocket = { ...mockSocket, id: 'new-socket' };
      const result = validateActionToken(newSocket, 'test-room-1', validToken, now);
      expect(result).toBe(false);
      expect(newSocket.emit).toHaveBeenCalledWith('action-invalid', { reason: 'Invalid action token' });
    });
  });
});

describe('Index Handlers - Quick Join Helpers', () => {
  let mockSocket: any;
  let mockRoom: any;
  let mockUser: any;

  beforeEach(() => {
    mockSocket = {
      id: 'socket-123',
      emit: vi.fn(),
      data: {}
    };

    mockRoom = {
      id: 'test-room-1',
      config: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        buyInMin: 40,
        buyInMax: 200
      },
      players: [null, null, null, null, null, null],
      gameState: {
        status: 'WAITING',
        gameVariant: 'NLH'
      }
    };

    mockUser = {
      userId: 'user-456',
      displayName: 'TestPlayer',
      avatarIcon: 'avatar-1'
    };
  });

  describe('validateQuickJoinBuyIn', () => {
    it('should accept buy-in within min-max range', () => {
      const result = validateQuickJoinBuyIn(mockRoom, 100, mockSocket);
      expect(result).toBe(true);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should accept buy-in at minimum', () => {
      const result = validateQuickJoinBuyIn(mockRoom, 40, mockSocket);
      expect(result).toBe(true);
    });

    it('should accept buy-in at maximum', () => {
      const result = validateQuickJoinBuyIn(mockRoom, 200, mockSocket);
      expect(result).toBe(true);
    });

    it('should reject buy-in below minimum', () => {
      const result = validateQuickJoinBuyIn(mockRoom, 39, mockSocket);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Buy-in must be between 40 and 200'
      });
    });

    it('should reject buy-in above maximum', () => {
      const result = validateQuickJoinBuyIn(mockRoom, 201, mockSocket);
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Buy-in must be between 40 and 200'
      });
    });

    it('should use default min/max when not configured', () => {
      delete mockRoom.config.buyInMin;
      delete mockRoom.config.buyInMax;

      // デフォルト: BB * 20 ~ BB * 100 = 40 ~ 200
      const result1 = validateQuickJoinBuyIn(mockRoom, 100, mockSocket);
      expect(result1).toBe(true);

      const result2 = validateQuickJoinBuyIn(mockRoom, 39, mockSocket);
      expect(result2).toBe(false);
    });
  });

  describe('createQuickJoinPlayer', () => {
    it('should create player with ACTIVE status in WAITING state', () => {
      mockRoom.gameState.status = 'WAITING';

      const player = createQuickJoinPlayer(mockSocket, mockUser, mockRoom, 100);

      expect(player).toMatchObject({
        socketId: 'socket-123',
        name: 'TestPlayer',
        stack: 100,
        bet: 0,
        totalBet: 0,
        status: 'ACTIVE',
        hand: null,
        pendingJoin: false,
        waitingForBB: false,
        disconnected: false,
        userId: 'user-456',
        avatarIcon: 'avatar-1'
      });
    });

    it('should create player with SIT_OUT status in active hand', () => {
      mockRoom.gameState.status = 'FLOP';

      const player = createQuickJoinPlayer(mockSocket, mockUser, mockRoom, 100);

      expect(player).toMatchObject({
        status: 'SIT_OUT',
        pendingJoin: true,
        waitingForBB: true
      });
    });

    it('should set pendingJoin flag when game is in progress', () => {
      mockRoom.gameState.status = 'TURN';

      const player = createQuickJoinPlayer(mockSocket, mockUser, mockRoom, 100);

      expect(player.pendingJoin).toBe(true);
      expect(player.status).toBe('SIT_OUT');
    });

    it('should use Guest name when user is not provided', () => {
      const player = createQuickJoinPlayer(mockSocket, null, mockRoom, 100);

      expect(player.name).toBe('Guest');
      expect(player.userId).toBeUndefined();
      expect(player.avatarIcon).toBeUndefined();
    });

    it('should handle button-less games (Stud/Draw)', () => {
      mockRoom.gameState.gameVariant = '7CS';
      mockRoom.gameState.status = 'THIRD_STREET';

      const player = createQuickJoinPlayer(mockSocket, mockUser, mockRoom, 100);

      // Studゲームはボタンがないので waitingForBB は false
      expect(player.waitingForBB).toBe(false);
      expect(player.pendingJoin).toBe(true);
    });
  });

  describe('removeExistingPlayerSession', () => {
    let mockEngine: GameEngine;

    beforeEach(() => {
      mockEngine = new GameEngine();
      __testing__.setGameEngine('test-room-1', mockEngine);
      vi.spyOn(mockEngine, 'processAction');
    });

    it('should do nothing when no existing player', () => {
      removeExistingPlayerSession(mockRoom, mockSocket, mockUser, 'test-room-1');
      expect(mockRoom.players.every((p: any) => p === null)).toBe(true);
    });

    it('should remove player by socket ID', () => {
      mockRoom.players[0] = {
        socketId: 'socket-123',
        name: 'OldPlayer',
        stack: 50,
        status: 'ACTIVE'
      };

      removeExistingPlayerSession(mockRoom, mockSocket, null, 'test-room-1');

      expect(mockRoom.players[0]).toBeNull();
    });

    it('should remove player by user ID', () => {
      mockRoom.players[2] = {
        socketId: 'old-socket-999',
        userId: 'user-456',
        name: 'OldSession',
        stack: 75,
        status: 'ACTIVE'
      };

      removeExistingPlayerSession(mockRoom, mockSocket, mockUser, 'test-room-1');

      expect(mockRoom.players[2]).toBeNull();
    });

    it('should auto-fold active player in active hand', () => {
      mockRoom.players[1] = {
        socketId: 'socket-123',
        name: 'ActivePlayer',
        stack: 100,
        status: 'ACTIVE'
      };
      mockRoom.gameState.status = 'FLOP';
      mockRoom.activePlayerIndex = 1;

      removeExistingPlayerSession(mockRoom, mockSocket, null, 'test-room-1');

      expect(mockEngine.processAction).toHaveBeenCalledWith(
        mockRoom,
        expect.objectContaining({
          playerId: 'socket-123',
          type: 'FOLD'
        })
      );
      expect(mockRoom.players[1]).toBeNull();
    });

    it('should not auto-fold when not active player', () => {
      mockRoom.players[3] = {
        socketId: 'socket-123',
        name: 'WaitingPlayer',
        stack: 100,
        status: 'ACTIVE'
      };
      mockRoom.gameState.status = 'FLOP';
      mockRoom.activePlayerIndex = 0;  // 別のプレイヤーがアクティブ

      removeExistingPlayerSession(mockRoom, mockSocket, null, 'test-room-1');

      expect(mockEngine.processAction).not.toHaveBeenCalled();
      expect(mockRoom.players[3]).toBeNull();
    });

    it('should not auto-fold in WAITING state', () => {
      mockRoom.players[0] = {
        socketId: 'socket-123',
        name: 'Player',
        stack: 100,
        status: 'ACTIVE'
      };
      mockRoom.gameState.status = 'WAITING';
      mockRoom.activePlayerIndex = 0;

      removeExistingPlayerSession(mockRoom, mockSocket, null, 'test-room-1');

      expect(mockEngine.processAction).not.toHaveBeenCalled();
      expect(mockRoom.players[0]).toBeNull();
    });
  });
});

/**
 * TODO: Showdown helpers と Draw validation のテスト
 *
 * handleAllInRunout, handleNormalShowdown, maybeHandleShowdown, validateDrawExchangeRequest
 * は Server (Socket.IO) インスタンスに強く依存しているため、
 * より詳細なモック戦略が必要。
 *
 * 現在のテストでは基本的なvalidation関数とhelper関数をカバー。
 * Phase 3 で統合テストとして追加予定。
 */
