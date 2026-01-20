import express from 'express';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM用の__dirname取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { evaluateHand, compareHands } from './handEvaluator.js';
import { roomManager } from './RoomManager.js';
import { GameEngine } from './GameEngine.js';
import { ShowdownManager } from './ShowdownManager.js';
import { ActionValidator } from './ActionValidator.js';
import { Dealer } from './Dealer.js';
import type {
  CreateRoomRequest,
  JoinRoomRequest,
  SitDownRequest,
  Player as RoomPlayer,
  PlayerStatus,
  ActionType
} from './types.js';
import { RotationManager } from './RotationManager.js';
import { MetaGameManager } from './MetaGameManager.js';
import { PotManager } from './PotManager.js';
import { getVariantConfig } from './gameVariants.js';
import { logEvent, incrementMetric } from './logger.js';

// Phase 3-B: ゲームエンジンインスタンス（部屋ごとに管理）
const gameEngines: Map<string, GameEngine> = new Map();
const showdownManager = new ShowdownManager();
const actionValidator = new ActionValidator();
const metaGameManager = new MetaGameManager();
const rotationManager = new RotationManager();
const potManager = new PotManager();
const actionTokens: Map<string, { token: string; issuedAt: number }> = new Map(); // playerId -> token meta
const actionInFlight: Set<string> = new Set(); // playerId in progress
const roomActionInFlight: Set<string> = new Set(); // roomId in progress
const invalidActionCounts: Map<string, { count: number; lastAt: number }> = new Map();
const actionRateLimit: Map<string, { count: number; windowStart: number }> = new Map();

// タイマー管理
interface PlayerTimer {
  roomId: string;
  playerId: string;
  seconds: number;
  intervalId: NodeJS.Timeout;
  timeBankChips: number;
}
const activeTimers: Map<string, PlayerTimer> = new Map(); // playerId -> timer
const playerTimeBanks: Map<string, number> = new Map(); // playerId -> chips

const MAX_TIMER_SECONDS = 30;
const INITIAL_TIMEBANK_CHIPS = 5;
const HAND_END_DELAY_MS = 2000;
const ACTION_TOKEN_TTL_MS = 35000;
const ACTION_RATE_LIMIT_WINDOW_MS = 2000;
const ACTION_RATE_LIMIT_MAX = 6;

// タイマー開始関数
function startPlayerTimer(roomId: string, playerId: string, io: Server) {
  // 既存のタイマーをクリア
  clearPlayerTimer(playerId);

  // タイムバンク初期化（初回のみ）
  if (!playerTimeBanks.has(playerId)) {
    playerTimeBanks.set(playerId, INITIAL_TIMEBANK_CHIPS);
  }

  const timer: PlayerTimer = {
    roomId,
    playerId,
    seconds: MAX_TIMER_SECONDS,
    intervalId: setInterval(() => {
      const t = activeTimers.get(playerId);
      if (!t) return;

      t.seconds--;

      // クライアントにタイマー更新を送信
      io.to(playerId).emit('timer-update', { seconds: t.seconds });

      // タイムアウト時の自動アクション
      if (t.seconds <= 0) {
        clearPlayerTimer(playerId);
        handleTimerTimeout(roomId, playerId, io);
      }
    }, 1000),
    timeBankChips: playerTimeBanks.get(playerId) || INITIAL_TIMEBANK_CHIPS
  };

  activeTimers.set(playerId, timer);
}

// タイマークリア関数
function clearPlayerTimer(playerId: string) {
  const timer = activeTimers.get(playerId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(playerId);
  }
}

// タイムアウト時の自動アクション
function handleTimerTimeout(roomId: string, playerId: string, io: Server) {
  const room = roomManager.getRoomById(roomId);
  if (!room) return;

  const engine = gameEngines.get(roomId);
  if (!engine) return;

  const player = room.players.find(p => p?.socketId === playerId);
  if (!player) return;

  actionTokens.delete(playerId);

  // チェック可能ならチェック、そうでなければフォールド
  const validActions = engine.getValidActions(room, playerId);
  const actionType: ActionType = validActions.includes('CHECK') ? 'CHECK' : 'FOLD';

  console.log(`⏰ Timer timeout for ${player.name} - Auto ${actionType}`);

  const result = engine.processAction(room, {
    playerId,
    type: actionType,
    timestamp: Date.now()
  });

  if (result.success) {
    // ショーダウンチェック等の処理は player-action と同様に行う
    processPostAction(roomId, room, engine, io);
  }
}

function issueActionToken(playerId: string): string {
  const token = randomUUID();
  actionTokens.set(playerId, { token, issuedAt: Date.now() });
  return token;
}

function emitYourTurn(roomId: string, room: any, engine: GameEngine, io: Server, player: any) {
  const validActions = engine.getValidActions(room, player.socketId);
  const bettingInfo = engine.getBettingInfo(room, player.socketId);
  const actionToken = issueActionToken(player.socketId);
  io.to(player.socketId).emit('your-turn', {
    validActions,
    currentBet: room.gameState.currentBet,
    minRaise: bettingInfo.minBet,
    maxBet: bettingInfo.maxBet,
    betStructure: bettingInfo.betStructure,
    isCapped: bettingInfo.isCapped,
    raisesRemaining: bettingInfo.raisesRemaining,
    fixedBetSize: bettingInfo.fixedBetSize,
    timeout: MAX_TIMER_SECONDS * 1000,
    actionToken
  });

  startPlayerTimer(roomId, player.socketId, io);

  const timeBankChips = playerTimeBanks.get(player.socketId) || INITIAL_TIMEBANK_CHIPS;
  io.to(player.socketId).emit('timebank-update', { chips: timeBankChips });
}

// アクション後の共通処理
function processPostAction(roomId: string, room: any, engine: GameEngine, io: Server) {
  // ショーダウンチェック
  if (room.gameState.status === 'SHOWDOWN') {
    const activePlayers = room.players.filter((p: any) =>
      p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
    );

    if (room.gameState.isRunout && activePlayers.length >= 2) {
      // オールインランアウトの処理は既存のコードに任せる
      return;
    }

    let showdownResult;
    if (activePlayers.length === 1) {
      showdownResult = showdownManager.awardToLastPlayer(room);
    } else {
      const calculatedPots = potManager.calculatePots(room.players);
      room.gameState.pot = calculatedPots;
      showdownResult = showdownManager.executeShowdown(room);
    }

    io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

    // 7-2ボーナスチェック
    if (showdownResult.winners.length > 0) {
      for (const winner of showdownResult.winners) {
        const bonus = metaGameManager.checkSevenDeuce(room, winner.playerId, winner.hand);
        if (bonus) {
          io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
        }
      }
    }

    // ローテーションチェック
    const rotation = rotationManager.checkRotation(room);
    if (rotation.changed) {
      io.to(`room:${roomId}`).emit('next-game', {
        nextGame: rotation.nextGame,
        gamesList: room.rotation.gamesList
      });
    }

    room.gameState.status = 'WAITING' as any;
  }

  // 全員に更新を送信
  io.to(`room:${roomId}`).emit('room-state-update', room);

  // 次のアクティブプレイヤーに行動を促す
  if (room.activePlayerIndex !== -1) {
    const nextPlayer = room.players[room.activePlayerIndex];
    if (nextPlayer) {
      emitYourTurn(roomId, room, engine, io, nextPlayer);
    }
  }
}

/**
 * ルームデータをサニタイズ（他プレイヤーのhandを隠す）
 * @param room ルームオブジェクト
 * @param viewerSocketId 閲覧者のsocketId（この人には自分の手札が見える）
 */
function sanitizeRoomForViewer(room: any, viewerSocketId?: string): any {
  return {
    ...room,
    players: room.players.map((p: any) => {
      if (!p) return null;
      const isOwnPlayer = viewerSocketId && p.socketId === viewerSocketId;

      // Stud用: 4thストリートのカード（studUpCards[1]）は他プレイヤーには見せない
      // 自分には全て見える、他者にはドアカード(0)と5th(2)、6th(3)のみ
      let visibleUpCards = p.studUpCards || [];
      if (!isOwnPlayer && visibleUpCards.length > 1) {
        // 4thストリートカード（index 1）を除外
        visibleUpCards = visibleUpCards.filter((_: any, i: number) => i !== 1);
      }

      return {
        ...p,
        // 自分以外のhandは隠す
        hand: isOwnPlayer ? p.hand : null,
        // studUpCardsは4thストリート以外を他者に公開
        studUpCards: visibleUpCards
      };
    })
  };
}

// ヘルパー関数: socketからroomIdを取得
function getRoomIdFromSocket(socket: any): string | null {
  const rooms = Array.from(socket.rooms) as string[];
  const roomEntry = rooms.find((r: string) => r.startsWith('room:'));
  return roomEntry ? roomEntry.slice(5) : null;
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// CORS設定: 本番環境では同一オリジン、開発環境では複数ポート許可
const ALLOWED_ORIGINS: string[] = isProduction
  ? [process.env.CLIENT_URL].filter((url): url is string => Boolean(url))
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      process.env.CLIENT_URL
    ].filter((url): url is string => Boolean(url));

app.use(cors({
  origin: (origin, callback) => {
    // originがない場合（同一オリジンリクエスト）または許可リストに含まれる場合は許可
    if (!origin || ALLOWED_ORIGINS.includes(origin) || isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 本番環境: 静的ファイル配信
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  // API以外のリクエストはindex.htmlを返す（SPA対応）
  app.get('*', (req, res, next) => {
    // Socket.IOやAPIリクエストは除外
    if (req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // 開発環境: Health check endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Mix Poker Game Server is running' });
  });
}

const httpServer = createServer(app);
// Socket.ioの設定 (CORS許可)
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('🔥 Player connected! ID:', socket.id);

  // ========== Phase 3-A: Room Management Events ==========


  // 部屋作成
  socket.on('create-room', (data: CreateRoomRequest) => {
    try {
      const roomConfig = data.config;
      const hostId = data.isPrivate ? socket.id : undefined;

      const room = roomManager.createRoom(hostId, roomConfig, data.customRoomId);

      // 作成者自身をそのRoomの Socket.IO ルームに参加させる
      socket.join(`room:${room.id}`);

      socket.emit('room-created', {
        room,
        yourSocketId: socket.id
      });

      // ロビーにいる全員に新しい部屋リストを通知
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());

      console.log(`📦 Room ${room.id} created by ${data.playerName}`);
      logEvent('room_created', { roomId: room.id, playerName: data.playerName, isPrivate: data.isPrivate });
      incrementMetric('room_created', { isPrivate: Boolean(data.isPrivate) });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 部屋参加
  socket.on('join-room', (data: JoinRoomRequest) => {
    try {
      const room = roomManager.getRoomById(data.roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (data.resumeToken) {
        const existingPlayer = room.players.find(p => p?.resumeToken === data.resumeToken);
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
          existingPlayer.disconnected = false;
          (socket.data as any).playerName = existingPlayer.name;
          if (room.gameState.status === 'WAITING' && existingPlayer.status === 'SIT_OUT' && !existingPlayer.pendingSitOut) {
            existingPlayer.status = 'ACTIVE';
          } else if (room.gameState.status !== 'WAITING') {
            existingPlayer.pendingJoin = true;
          }

          socket.join(`room:${data.roomId}`);
          socket.emit('room-joined', {
            room: sanitizeRoomForViewer(room, socket.id),
            yourSocketId: socket.id,
            yourHand: existingPlayer.hand || null
          });
          logEvent('room_resumed', { roomId: data.roomId, playerName: existingPlayer.name });
          incrementMetric('room_resumed');
          io.to(`room:${data.roomId}`).emit('room-state-update', room);
          return;
        }
      }

      // プレイヤー名をsocket.dataに保存（sit-down時に使用）
      (socket.data as any).playerName = data.playerName;

      // Socket.IOのルームに参加
      socket.join(`room:${data.roomId}`);

      socket.emit('room-joined', {
        room: sanitizeRoomForViewer(room, socket.id),
        yourSocketId: socket.id,
        yourHand: null
      });

      console.log(`🚪 ${data.playerName} joined room ${data.roomId}`);
      logEvent('room_joined', { roomId: data.roomId, playerName: data.playerName });
      incrementMetric('room_joined');
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 部屋リスト取得（ロビー用）
  socket.on('get-room-list', () => {
    // ロビーのSocket.IOルームに参加
    socket.join('lobby');
    socket.emit('room-list-update', roomManager.getAllRooms());
  });

  // 部屋退出
  socket.on('leave-room', () => {
    const roomId = getRoomIdFromSocket(socket);
    if (!roomId) return;

    try {
      const room = roomManager.getRoomById(roomId);
      if (room) {
        // 着席していれば離席
        const seatIndex = room.players.findIndex(p => p?.socketId === socket.id);
        if (seatIndex !== -1) {
          roomManager.standUp(roomId, socket.id);
        }

        // Socket.IOのルームから離脱
        socket.leave(`room:${roomId}`);

        // 部屋がまだ存在すれば更新を通知
        const roomStillExists = roomManager.getRoomById(roomId);
        if (roomStillExists) {
          io.to(`room:${roomId}`).emit('room-state-update', roomStillExists);
        }

        // ロビーに部屋リスト更新を通知
        io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
      }
    } catch (error) {
      // エラーは無視
    }
  });

  // 着席
  socket.on('sit-down', (data: SitDownRequest) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // socket.dataにplayerNameを保存しておく（join-room時に設定することを想定）
      const playerName = (socket.data as any).playerName || 'Anonymous';
      const variantConfig = getVariantConfig(room.gameState.gameVariant);
      const isWaiting = room.gameState.status === 'WAITING';

      // 着席するプレイヤー情報を作成
      const player: RoomPlayer = {
        socketId: socket.id,
        name: playerName,
        stack: data.buyIn,
        bet: 0,
        totalBet: 0,
        status: (isWaiting ? 'ACTIVE' : 'SIT_OUT') as PlayerStatus,
        hand: null,
        resumeToken: data.resumeToken,
        pendingJoin: !isWaiting,
        waitingForBB: !isWaiting && variantConfig.hasButton,
        disconnected: false
      };

      roomManager.sitDown(roomId, data.seatIndex, player);

      console.log(`✅ ${playerName} sat down at seat ${data.seatIndex}`);
      logEvent('sit_down', { roomId, playerName, seatIndex: data.seatIndex });
      incrementMetric('sit_down');

      // 着席成功を通知（本人）
      socket.emit('sit-down-success', { seatIndex: data.seatIndex });

      // 部屋内の全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);

      // ロビーに部屋リスト更新を通知
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());

    } catch (error: any) {
      console.error(`❌ Sit-down failed: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // リバイ（チップ追加）
  socket.on('rebuy', (data: { amount: number }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // プレイヤーを探す
      const player = room.players.find(p => p?.socketId === socket.id);
      if (!player) {
        socket.emit('error', { message: 'You are not seated' });
        return;
      }

      // ゲーム中はリバイ不可
      if (room.gameState.status !== 'WAITING') {
        socket.emit('error', { message: 'Cannot rebuy during a hand' });
        return;
      }

      // 金額バリデーション
      const newStack = player.stack + data.amount;
      const buyInMin = room.config.buyInMin ?? room.config.bigBlind * 20;
      const buyInMax = room.config.buyInMax ?? room.config.bigBlind * 200;
      if (newStack < buyInMin) {
        socket.emit('error', { message: `Minimum buy-in is ${buyInMin}` });
        return;
      }
      if (newStack > buyInMax) {
        socket.emit('error', { message: `Maximum buy-in is ${buyInMax}` });
        return;
      }

      // リバイ実行
      player.stack = newStack;
      console.log(`💰 ${player.name} rebought for ${data.amount} (new stack: ${newStack})`);

      // リバイ成功を通知
      socket.emit('rebuy-success', { amount: data.amount, newStack });

      // 部屋内の全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ========== Phase 3-B: Game Engine Events ==========

  // ゲーム開始
  socket.on('start-game', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // GameEngineを取得または作成
      let engine = gameEngines.get(roomId);
      if (!engine) {
        engine = new GameEngine();
        gameEngines.set(roomId, engine);
      }

      // ハンドを開始
      const success = engine.startHand(room);
      if (!success) {
        socket.emit('error', { message: 'Need at least 2 players to start' });
        return;
      }

      // 全員にゲーム状態と自分のハンドを送信
      for (const player of room.players) {
        if (player) {
          io.to(player.socketId).emit('game-started', {
            room: {
              ...room,
              players: room.players.map(p => p ? {
                ...p,
                hand: p.socketId === player.socketId ? p.hand : null // 自分の手札のみ
              } : null)
            },
            yourHand: player.hand
          });
        }
      }

      // アクティブプレイヤーに行動を促す
      const activePlayer = room.players[room.activePlayerIndex];
      if (activePlayer) {
        emitYourTurn(roomId, room, engine, io, activePlayer);
      }

      console.log(`🎮 Game started in room ${roomId}`);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // タイムバンク使用
  socket.on('use-timebank', () => {
    try {
      const timer = activeTimers.get(socket.id);
      if (!timer) {
        socket.emit('error', { message: 'No active timer' });
        return;
      }

      const currentChips = playerTimeBanks.get(socket.id) || 0;
      if (currentChips <= 0) {
        socket.emit('error', { message: 'No time bank chips remaining' });
        return;
      }

      // タイムバンクチップを消費して30秒追加
      playerTimeBanks.set(socket.id, currentChips - 1);
      timer.seconds += 30;

      console.log(`⏱️ Time bank used by ${socket.id} (${currentChips - 1} chips remaining)`);

      // クライアントに更新を通知
      socket.emit('timer-update', { seconds: timer.seconds });
      socket.emit('timebank-update', { chips: currentChips - 1 });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // プレイヤーアクション
  socket.on('player-action', (data: { type: ActionType; amount?: number; actionToken?: string }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const engine = gameEngines.get(roomId);
      if (!engine) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      if (roomActionInFlight.has(roomId)) {
        socket.emit('action-invalid', { reason: 'Room is processing another action' });
        return;
      }

      if (room.gameState.isDrawPhase) {
        socket.emit('action-invalid', { reason: 'Draw phase in progress' });
        logEvent('action_invalid', { roomId, playerId: socket.id, reason: 'Draw phase in progress' });
        incrementMetric('action_invalid', { reason: 'draw_phase' });
        return;
      }

      const now = Date.now();
      const rate = actionRateLimit.get(socket.id);
      if (!rate || now - rate.windowStart > ACTION_RATE_LIMIT_WINDOW_MS) {
        actionRateLimit.set(socket.id, { count: 1, windowStart: now });
      } else {
        rate.count += 1;
        if (rate.count > ACTION_RATE_LIMIT_MAX) {
          const ip = socket.handshake.address;
          console.warn(`⚠️ Rate limit: ${socket.id} (${ip}) ${rate.count}/${ACTION_RATE_LIMIT_WINDOW_MS}ms`);
          socket.emit('action-invalid', { reason: 'Too many actions' });
          logEvent('rate_limited', { roomId, playerId: socket.id, ip, count: rate.count });
          incrementMetric('rate_limited');
          return;
        }
      }

      const token = data.actionToken;
      const expectedToken = actionTokens.get(socket.id);
      if (!token || !expectedToken || token !== expectedToken.token) {
        socket.emit('action-invalid', { reason: 'Invalid action token' });
        logEvent('action_invalid', { roomId, playerId: socket.id, reason: 'Invalid action token' });
        incrementMetric('action_invalid', { reason: 'invalid_token' });
        const stats = invalidActionCounts.get(socket.id);
        if (!stats || now - stats.lastAt > 5000) {
          invalidActionCounts.set(socket.id, { count: 1, lastAt: now });
        } else {
          stats.count += 1;
          stats.lastAt = now;
          if (stats.count >= 3) {
            console.warn(`⚠️ Repeated invalid actions from ${socket.id} (${stats.count} in 5s)`);
            logEvent('invalid_action_spam', { roomId, playerId: socket.id, count: stats.count });
            incrementMetric('invalid_action_spam');
          }
        }
        return;
      }

      if (Date.now() - expectedToken.issuedAt > ACTION_TOKEN_TTL_MS) {
        actionTokens.delete(socket.id);
        socket.emit('action-invalid', { reason: 'Action token expired' });
        logEvent('action_invalid', { roomId, playerId: socket.id, reason: 'Action token expired' });
        incrementMetric('action_invalid', { reason: 'token_expired' });
        return;
      }

      if (actionInFlight.has(socket.id)) {
        socket.emit('action-invalid', { reason: 'Action already in progress' });
        return;
      }

      // タイマーをクリア
      clearPlayerTimer(socket.id);

      actionInFlight.add(socket.id);
      roomActionInFlight.add(roomId);
      let result;
      try {
        // アクションを処理
        result = engine.processAction(room, {
          playerId: socket.id,
          type: data.type,
          amount: data.amount,
          timestamp: Date.now()
        });
      } finally {
        actionInFlight.delete(socket.id);
        roomActionInFlight.delete(roomId);
      }

      if (!result.success) {
        socket.emit('action-invalid', { reason: result.error });
        logEvent('action_invalid', { roomId, playerId: socket.id, reason: result.error });
        incrementMetric('action_invalid', { reason: 'engine_reject' });
        startPlayerTimer(roomId, socket.id, io);
        return;
      }
      actionTokens.delete(socket.id);

      // ショーダウンチェック
      if (room.gameState.status === 'SHOWDOWN') {
        // アクティブなプレイヤーをチェック
        const activePlayers = room.players.filter(p =>
          p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        );

        // オールインランアウトの場合、遅延表示
        if (room.gameState.isRunout && activePlayers.length >= 2) {
          const runoutPhase = room.gameState.runoutPhase || 'PREFLOP';
          const board = room.gameState.board;
          const DELAY = 1500; // 1.5秒

          console.log(`🎬 Starting all-in runout from ${runoutPhase}`);

          // ランアウト開始を通知
          io.to(`room:${roomId}`).emit('runout-started', {
            runoutPhase,
            fullBoard: board
          });

          // フェーズに応じてボードを段階的に公開
          const scheduleRunout = async () => {
            if (runoutPhase === 'PREFLOP') {
              // Flop (最初の3枚)
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 3), phase: 'FLOP' });

              // Turn (4枚目)
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 4), phase: 'TURN' });

              // River (5枚目)
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 5), phase: 'RIVER' });

            } else if (runoutPhase === 'FLOP') {
              // Turn
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 4), phase: 'TURN' });

              // River
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 5), phase: 'RIVER' });

            } else if (runoutPhase === 'TURN') {
              // River only
              await new Promise(r => setTimeout(r, DELAY));
              io.to(`room:${roomId}`).emit('runout-board', { board: board.slice(0, 5), phase: 'RIVER' });
            }

            // ショーダウン実行
            await new Promise(r => setTimeout(r, DELAY));

            // サイドポットを計算
            const calculatedPots = potManager.calculatePots(room.players);
            room.gameState.pot = calculatedPots;
            console.log(`💰 Pots calculated: Main=${calculatedPots.main}, Sides=${calculatedPots.side.map(s => s.amount).join(',')}`);

            // ショーダウン実行
            const showdownResult = showdownManager.executeShowdown(room);
            io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

            // 7-2ゲームボーナスチェック
            if (showdownResult.winners.length > 0) {
              for (const winner of showdownResult.winners) {
                const bonus = metaGameManager.checkSevenDeuce(room, winner.playerId, winner.hand);
                if (bonus) {
                  io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
                  console.log(`🎲 7-2 BONUS: ${winner.playerName} wins ${bonus.amount}`);
                }
              }
            }

            // ローテーションチェック
            const rotation = rotationManager.checkRotation(room);
            if (rotation.changed) {
              console.log(`🔄 Next game: ${rotation.nextGame}`);
              io.to(`room:${roomId}`).emit('next-game', {
                nextGame: rotation.nextGame,
                gamesList: room.rotation.gamesList
              });
            }

            // ランアウトフラグをクリア
            room.gameState.isRunout = false;
            room.gameState.runoutPhase = undefined;
            room.gameState.status = 'WAITING' as any;

            io.to(`room:${roomId}`).emit('room-state-update', room);
          };

          // 非同期でランアウトを実行
          scheduleRunout();
          return; // 通常のフローをスキップ

        } else {
          // 通常のショーダウン（ランアウトなし）
          let showdownResult;
          if (activePlayers.length === 1) {
            // 1人しか残っていない（他全員フォールド）
            showdownResult = showdownManager.awardToLastPlayer(room);
          } else {
            // サイドポットを計算
            const calculatedPots = potManager.calculatePots(room.players);
            room.gameState.pot = calculatedPots;
            console.log(`💰 Pots calculated: Main=${calculatedPots.main}, Sides=${calculatedPots.side.map(s => s.amount).join(',')}`);

            // ショーダウン実行
            showdownResult = showdownManager.executeShowdown(room);
          }

          io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

          // 7-2ゲームボーナスチェック
          if (showdownResult.winners.length > 0) {
            for (const winner of showdownResult.winners) {
              const bonus = metaGameManager.checkSevenDeuce(room, winner.playerId, winner.hand);
              if (bonus) {
                io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
                console.log(`🎲 7-2 BONUS: ${winner.playerName} wins ${bonus.amount}`);
              }
            }
          }

          // ローテーションチェック
          const rotation = rotationManager.checkRotation(room);
          if (rotation.changed) {
            console.log(`🔄 Next game: ${rotation.nextGame}`);
            io.to(`room:${roomId}`).emit('next-game', {
              nextGame: rotation.nextGame,
              gamesList: room.rotation.gamesList
            });
          }

          room.gameState.status = 'WAITING' as any;
        }
      }

      // 全員に更新を送信
      io.to(`room:${roomId}`).emit('room-state-update', room);

      // 次のアクティブプレイヤーに行動を促す
      if (room.activePlayerIndex !== -1) {
        const nextPlayer = room.players[room.activePlayerIndex];
        if (nextPlayer) {
          emitYourTurn(roomId, room, engine, io, nextPlayer);
        }
      }

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ドロー交換（2-7 Triple Draw, Badugi用）
  socket.on('draw-exchange', (data: { discardIndexes: number[] }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const engine = gameEngines.get(roomId);
      if (!engine) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      // プレイヤーを確認
      const player = room.players.find(p => p?.socketId === socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Drawフェーズか確認（交換フェーズでなければエラー）
      const status = room.gameState.status;
      const isDrawPhase = room.gameState.isDrawPhase;
      if (!isDrawPhase || (status !== 'FIRST_DRAW' && status !== 'SECOND_DRAW' && status !== 'THIRD_DRAW')) {
        socket.emit('error', { message: 'Not in draw exchange phase' });
        return;
      }

      // プレイヤーがアクティブか確認
      if (player.status !== 'ACTIVE' && player.status !== 'ALL_IN') {
        socket.emit('error', { message: 'You cannot draw' });
        return;
      }

      // 既に交換済みか確認
      const completedDraw = room.gameState.playersCompletedDraw || [];
      if (completedDraw.includes(socket.id)) {
        socket.emit('error', { message: 'You have already drawn this round' });
        return;
      }

      const variantConfig = getVariantConfig(room.gameState.gameVariant);
      const maxDrawCount = variantConfig.maxDrawCount ?? player.hand?.length ?? 0;
      const discardIndexes = Array.isArray(data.discardIndexes) ? data.discardIndexes : [];
      const uniqueIndexes = new Set<number>();
      for (const idx of discardIndexes) {
        if (!Number.isInteger(idx)) {
          socket.emit('error', { message: 'Invalid discard index' });
          return;
        }
        uniqueIndexes.add(idx);
      }
      if (discardIndexes.length !== uniqueIndexes.size) {
        socket.emit('error', { message: 'Duplicate discard indexes' });
        return;
      }
      if (discardIndexes.length > maxDrawCount) {
        socket.emit('error', { message: `Too many cards to discard (max ${maxDrawCount})` });
        return;
      }
      if (!player.hand || discardIndexes.some(idx => idx < 0 || idx >= player.hand!.length)) {
        socket.emit('error', { message: 'Discard index out of range' });
        return;
      }

      // カード交換を実行
      const deck = engine.getDeck();
      const dealer = new Dealer();
      dealer.exchangeDrawCards(deck, player, discardIndexes);

      // 交換枚数を記録
      player.drawDiscards = discardIndexes.length;

      // ドロー完了をマーク
      engine.markDrawComplete(room, socket.id);

      console.log(`🔄 ${player.name} drew ${discardIndexes.length} cards`);

      // プレイヤーに新しい手札を送信
      io.to(socket.id).emit('draw-complete', {
        newHand: player.hand
      });

      // 全プレイヤーに交換枚数を通知（手札は見せない）
      io.to(`room:${roomId}`).emit('player-drew', {
        playerId: socket.id,
        playerName: player.name,
        cardCount: discardIndexes.length
      });

      // 全員完了したかチェック
      if (engine.checkDrawPhaseComplete(room)) {
        // ベッティングフェーズに移行
        console.log(`✅ All players completed draw - starting betting for ${room.gameState.status}`);
      }

      // 全員に更新を送信
      io.to(`room:${roomId}`).emit('room-state-update', room);

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 状態再同期
  socket.on('request-room-state', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) return;
      const room = roomManager.getRoomById(roomId);
      if (!room) return;
      socket.emit('room-state-update', sanitizeRoomForViewer(room, socket.id));
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ========== ゲームルール変更 ==========

  // ブラインド・バイイン設定変更
  socket.on('update-room-config', (data: {
    smallBlind?: number;
    bigBlind?: number;
    buyInMin?: number;
    buyInMax?: number;
    timeLimit?: number;
    studAnte?: number;
  }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // ゲーム中は変更不可
      if (room.gameState.status !== 'WAITING') {
        socket.emit('error', { message: 'Cannot change config while game is in progress' });
        return;
      }

      // 設定を更新
      if (data.smallBlind !== undefined) {
        room.config.smallBlind = data.smallBlind;
      }
      if (data.bigBlind !== undefined) {
        room.config.bigBlind = data.bigBlind;
      }
      if (data.buyInMin !== undefined) {
        room.config.buyInMin = data.buyInMin;
      }
      if (data.buyInMax !== undefined) {
        room.config.buyInMax = data.buyInMax;
      }
      if (data.timeLimit !== undefined) {
        room.config.timeLimit = data.timeLimit;
      }
      if (data.studAnte !== undefined) {
        room.config.studAnte = data.studAnte;
      }

      console.log(`⚙️ Room ${roomId} config updated: SB=${room.config.smallBlind}, BB=${room.config.bigBlind}, Ante=${room.config.studAnte}`);

      // 全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);
      io.to(`room:${roomId}`).emit('config-updated', { config: room.config });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // メタゲームトグル (7-2ゲーム, Stand Up)
  socket.on('toggle-meta-game', (data: { game: 'sevenDeuce' | 'standUp'; enabled: boolean }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // metaGameが未初期化の場合は初期化
      if (!room.metaGame) {
        room.metaGame = {
          standUp: { isActive: false, remainingPlayers: [] },
          sevenDeuce: false
        };
      }

      if (data.game === 'sevenDeuce') {
        room.metaGame.sevenDeuce = data.enabled;
        console.log(`🎲 Room ${roomId}: 7-2 game ${data.enabled ? 'enabled' : 'disabled'}`);
      } else if (data.game === 'standUp') {
        room.metaGame.standUp.isActive = data.enabled;
        if (data.enabled) {
          // Stand Up開始時、全プレイヤーをremainingPlayersに追加
          room.metaGame.standUp.remainingPlayers = room.players
            .filter(p => p !== null)
            .map(p => p!.socketId);
        }
        console.log(`🏆 Room ${roomId}: Stand Up game ${data.enabled ? 'enabled' : 'disabled'}`);
      }

      // 全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);
      io.to(`room:${roomId}`).emit('meta-game-updated', { metaGame: room.metaGame });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ゲームローテーション設定
  socket.on('set-rotation', (data: {
    enabled: boolean;
    gamesList?: string[];
    handsPerGame?: number;
  }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // ローテーション設定を更新
      room.rotation.enabled = data.enabled;

      if (data.gamesList !== undefined && data.gamesList.length > 0) {
        room.rotation.gamesList = data.gamesList;
        room.rotation.currentGameIndex = 0;
        // 最初のゲームを設定
        room.gameState.gameVariant = data.gamesList[0];
      }

      if (data.handsPerGame !== undefined) {
        room.rotation.handsPerGame = data.handsPerGame;
        rotationManager.setHandsPerGame(data.handsPerGame);
      }

      const gamesStr = room.rotation.gamesList.join(' → ');
      console.log(`🔄 Room ${roomId}: Rotation ${data.enabled ? 'enabled' : 'disabled'} [${gamesStr}]`);

      // 全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);
      io.to(`room:${roomId}`).emit('rotation-updated', { rotation: room.rotation });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ゲームバリアント即時変更（ローテーション外）
  socket.on('set-game-variant', (data: { variant: string }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // ゲーム中は変更不可
      if (room.gameState.status !== 'WAITING') {
        socket.emit('error', { message: 'Cannot change game while hand is in progress' });
        return;
      }

      // 有効なバリアントかチェック
      const validVariants = ['NLH', 'PLO', 'PLO8', '7CS', '7CS8', 'RAZZ', '2-7_TD', 'BADUGI'];
      if (!validVariants.includes(data.variant)) {
        socket.emit('error', { message: `Invalid variant: ${data.variant}` });
        return;
      }

      room.gameState.gameVariant = data.variant;
      console.log(`🎮 Room ${roomId}: Game variant changed to ${data.variant}`);

      // 全員に更新を通知
      io.to(`room:${roomId}`).emit('room-state-update', room);
      io.to(`room:${roomId}`).emit('game-variant-changed', { variant: data.variant });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // デバッグ用: 次ゲームへ強制切替
  socket.on('force-next-game', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.gameState.status !== 'WAITING') {
        socket.emit('error', { message: 'Cannot change game while hand is in progress' });
        return;
      }

      if (room.rotation.gamesList.length <= 1) {
        socket.emit('error', { message: 'Rotation is not enabled' });
        return;
      }

      const nextIndex = (room.rotation.currentGameIndex + 1) % room.rotation.gamesList.length;
      const nextGame = room.rotation.gamesList[nextIndex];
      room.rotation.currentGameIndex = nextIndex;
      room.gameState.gameVariant = nextGame;

      if (nextIndex === 0) {
        room.rotation.orbitCount = (room.rotation.orbitCount || 0) + 1;
      }

      io.to(`room:${roomId}`).emit('next-game', {
        nextGame,
        gamesList: room.rotation.gamesList
      });
      io.to(`room:${roomId}`).emit('room-state-update', room);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 離席
  socket.on('leave-seat', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      roomManager.standUp(roomId, socket.id);

      const room = roomManager.getRoomById(roomId);
      if (room) {
        // 部屋内の全員に更新を通知
        io.to(`room:${roomId}`).emit('room-state-update', room);
      }

      // ロビーに部屋リスト更新を通知
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // シットアウト切替
  socket.on('sit-out', (data: { enabled: boolean }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const player = room.players.find(p => p?.socketId === socket.id);
      if (!player) {
        socket.emit('error', { message: 'You are not seated' });
        return;
      }

      if (data.enabled) {
        if (room.gameState.status === 'WAITING') {
          player.status = 'SIT_OUT';
          player.pendingJoin = false;
        } else {
          player.pendingSitOut = true;
        }
        console.log(`🪑 ${player.name} set to sit out`);
        logEvent('sit_out', { roomId, playerName: player.name });
        incrementMetric('sit_out');
      } else {
        player.pendingSitOut = false;
        if (room.gameState.status === 'WAITING') {
          player.status = 'ACTIVE';
          player.pendingJoin = false;
          player.waitingForBB = false;
        } else {
          player.pendingJoin = true;
        }
        console.log(`🪑 ${player.name} set to sit in`);
        logEvent('sit_in', { roomId, playerName: player.name });
        incrementMetric('sit_in');
      }

      io.to(`room:${roomId}`).emit('room-state-update', room);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 切断した時（既存のハンドラを拡張）
  socket.on('disconnect', () => {
    console.log('👋 Player disconnected:', socket.id);
    logEvent('disconnect', { playerId: socket.id });
    incrementMetric('disconnect');
    clearPlayerTimer(socket.id);
    actionTokens.delete(socket.id);
    actionInFlight.delete(socket.id);
    invalidActionCounts.delete(socket.id);
    actionRateLimit.delete(socket.id);

    // Phase 3-A: すべての部屋から離席させる
    const roomIds = Array.from(socket.rooms).filter(r => r.startsWith('room:')).map(r => r.slice(5));

    for (const roomId of roomIds) {
      try {
        const room = roomManager.getRoomById(roomId);
        if (room) {
          // F-03: アクティブプレイヤーが切断した場合、自動Fold
          const playerSeatIndex = room.players.findIndex(p => p?.socketId === socket.id);
          const isActivePlayer = playerSeatIndex !== -1 &&
            room.activePlayerIndex === playerSeatIndex &&
            room.gameState.status !== 'WAITING';

          if (isActivePlayer) {
            const engine = gameEngines.get(roomId);
            if (engine) {
              console.log(`⚠️ Active player disconnected! Auto-folding seat ${playerSeatIndex}`);

              // 自動Foldを処理
              const result = engine.processAction(room, {
                playerId: socket.id,
                type: 'FOLD' as ActionType,
                timestamp: Date.now()
              });

              if (result.success) {
                console.log(`✅ Auto-fold completed for seat ${playerSeatIndex}`);

                // ショーダウンチェック
                if (room.gameState.status === 'SHOWDOWN') {
                  const activePlayers = room.players.filter(p =>
                    p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
                  );

                  let showdownResult;
                  if (activePlayers.length === 1) {
                    showdownResult = showdownManager.awardToLastPlayer(room);
                  } else {
                    const calculatedPots = potManager.calculatePots(room.players);
                    room.gameState.pot = calculatedPots;
                    showdownResult = showdownManager.executeShowdown(room);
                  }

                  io.to(`room:${roomId}`).emit('showdown-result', showdownResult);
                  room.gameState.status = 'WAITING' as any;
                }

                // 次のアクティブプレイヤーに行動を促す
                if (room.activePlayerIndex !== -1) {
                  const nextPlayer = room.players[room.activePlayerIndex];
                  if (nextPlayer) {
                    emitYourTurn(roomId, room, engine, io, nextPlayer);
                  }
                }
              }
            }
          }

          if (playerSeatIndex !== -1) {
            const player = room.players[playerSeatIndex];
            if (player) {
              player.disconnected = true;
              if (room.gameState.status === 'WAITING') {
                player.status = 'SIT_OUT';
                player.pendingJoin = false;
              }
              console.log(`🔌 ${player.name} marked disconnected in room ${roomId}`);
              logEvent('player_disconnected', { roomId, playerName: player.name, seatIndex: playerSeatIndex });
              incrementMetric('player_disconnected');
            }
            io.to(`room:${roomId}`).emit('room-state-update', room);
          }
        }
      } catch (error) {
        // エラーは無視（すでに離席済みの可能性）
      }
    }

    // ロビーに部屋リスト更新を通知
    io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
});
