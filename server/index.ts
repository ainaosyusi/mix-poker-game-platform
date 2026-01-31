/**
 * Mix Poker Server - Main Entry Point
 * Handles Socket.IO connections, game logic, and room management
 */
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
  JoinRoomRequest,
  SitDownRequest,
  Player as RoomPlayer,
  PlayerStatus,
  ActionType,
  RoomConfig
} from './types.js';
import { RotationManager } from './RotationManager.js';
import { MetaGameManager } from './MetaGameManager.js';
import { PotManager } from './PotManager.js';
import { getVariantConfig } from './gameVariants.js';
import { logEvent, incrementMetric } from './logger.js';
import authRoutes from './auth/authRoutes.js';
import statsRoutes from './stats/statsRoutes.js';
import { verifyToken } from './auth/authService.js';
import { findRandomEmptySeat } from './autoSeating.js';
import {
  startSession, recordAddOn, endSession,
  recordHandResult, migrateSession, hasActiveSession
} from './stats/sessionTracker.js';
import { OFCGameEngine } from './OFCGameEngine.js';
import type { OFCPlacement } from './types.js';
import { botPlaceInitial, botPlacePineapple, botPlaceFantasyland } from './OFCBot.js';

// Phase 3-B: ゲームエンジンインスタンス（部屋ごとに管理）
const gameEngines: Map<string, GameEngine> = new Map();
const ofcEngines: Map<string, OFCGameEngine> = new Map();
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
const consecutiveTimeouts: Map<string, number> = new Map(); // playerId -> timeout count

const PREFLOP_TIMER_SECONDS = 15;
const POSTFLOP_TIMER_SECONDS = 30;
const INITIAL_TIMEBANK_CHIPS = 5;
const MAX_CONSECUTIVE_TIMEOUTS = 3; // 3回連続タイムアウトでSIT_OUT
const HAND_END_DELAY_MS = 2000;
const AUTO_START_DELAY_MS = 2000;
const ACTION_TOKEN_TTL_MS = 35000;
const ACTION_RATE_LIMIT_WINDOW_MS = 2000;
const ACTION_RATE_LIMIT_MAX = 6;

// 自動ゲーム開始管理
const pendingStarts: Map<string, NodeJS.Timeout> = new Map();

function cleanupSocketSession(socketId: string) {
  clearPlayerTimer(socketId);
  actionTokens.delete(socketId);
  actionInFlight.delete(socketId);
  invalidActionCounts.delete(socketId);
  actionRateLimit.delete(socketId);
  playerTimeBanks.delete(socketId);
}

function cleanupPendingLeavers(roomId: string, io: Server): boolean {
  const room = roomManager.getRoomById(roomId);
  if (!room) return true;

  let removed = false;
  room.players.forEach((player, index) => {
    if (player?.pendingLeave) {
      cleanupSocketSession(player.socketId);
      room.players[index] = null;
      removed = true;
    }
  });

  if (removed) {
    const allEmpty = room.players.every(p => p === null);
    if (allEmpty && !room.isPreset) {
      roomManager.deleteRoom(roomId);
      gameEngines.delete(roomId);
      roomActionInFlight.delete(roomId);
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
      return true;
    }
    io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
  }

  return false;
}

// フェーズに応じたタイマー秒数を返す
function getTimerSeconds(room: any): number {
  // プリフロップ（PLAYING状態でboard.length === 0）は15秒
  if (room && room.gameState.board.length === 0) {
    return PREFLOP_TIMER_SECONDS;
  }
  return POSTFLOP_TIMER_SECONDS;
}

// タイマー開始関数
function startPlayerTimer(roomId: string, playerId: string, io: Server) {
  // 既存のタイマーをクリア
  clearPlayerTimer(playerId);

  // タイムバンク初期化（初回のみ）
  if (!playerTimeBanks.has(playerId)) {
    playerTimeBanks.set(playerId, INITIAL_TIMEBANK_CHIPS);
  }

  const room = roomManager.getRoomById(roomId);
  const timerSeconds = getTimerSeconds(room);

  const timer: PlayerTimer = {
    roomId,
    playerId,
    seconds: timerSeconds,
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

  // 連続タイムアウトをカウント
  const timeoutCount = (consecutiveTimeouts.get(playerId) || 0) + 1;
  consecutiveTimeouts.set(playerId, timeoutCount);

  console.log(`⏰ Timer timeout for ${player.name} - Count: ${timeoutCount}/${MAX_CONSECUTIVE_TIMEOUTS}`);

  // 3回連続タイムアウトでSIT_OUTに設定
  if (timeoutCount >= MAX_CONSECUTIVE_TIMEOUTS) {
    console.log(`🚫 ${player.name} auto sit-out due to ${timeoutCount} consecutive timeouts`);
    player.pendingSitOut = true;
    // ハンド後にSIT_OUTになる（現在のハンドは最後まで処理する）
  }

  // チェック可能ならチェック、そうでなければフォールド
  const validActions = engine.getValidActions(room, playerId);
  const actionType: ActionType = validActions.includes('CHECK') ? 'CHECK' : 'FOLD';

  console.log(`⏰ Auto ${actionType} for ${player.name}`);

  const result = engine.processAction(room, {
    playerId,
    type: actionType,
    timestamp: Date.now()
  });

  if (!result.success) {
    console.error(`❌ Auto-action failed for ${player.name}: ${result.error}`);
    broadcastRoomState(roomId, room, io);
    return;
  }

  // player-actionハンドラーと同じフローを使用
  // 1. 全員に更新を送信
  broadcastRoomState(roomId, room, io);

  // 2. ショーダウンチェック
  if (maybeHandleShowdown(roomId, room, io)) {
    return;
  }

  // 3. 次のアクティブプレイヤーに行動を促す
  if (room.activePlayerIndex !== -1) {
    const nextPlayer = room.players[room.activePlayerIndex];
    if (nextPlayer) {
      emitYourTurn(roomId, room, engine, io, nextPlayer);
    }
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
    timeout: getTimerSeconds(room) * 1000,
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

    // 全員に最終状態を送信
    broadcastRoomState(roomId, room, io);

    // ショーダウン後の遅延（2.5秒）
    setTimeout(() => {
      if (cleanupPendingLeavers(roomId, io)) {
        return;
      }
      // 次のハンドを自動開始
      scheduleNextHand(roomId, io);
    }, 2500);
    return;
  }

  // 全員に更新を送信
  broadcastRoomState(roomId, room, io);

  // 次のアクティブプレイヤーに行動を促す
  if (room.activePlayerIndex !== -1) {
    const nextPlayer = room.players[room.activePlayerIndex];
    if (nextPlayer) {
      emitYourTurn(roomId, room, engine, io, nextPlayer);
    }
  }
}

/**
 * 自動ゲーム開始スケジューラー
 * 2人以上のACTIVEプレイヤーがいてWAITING状態なら、自動でハンドを開始
 */
function scheduleNextHand(roomId: string, io: Server) {
  // 既存のスケジュールをキャンセル
  const existing = pendingStarts.get(roomId);
  if (existing) {
    clearTimeout(existing);
    pendingStarts.delete(roomId);
  }

  const room = roomManager.getRoomById(roomId);
  if (!room) return;

  // WAITING状態でなければ何もしない
  if (room.gameState.status !== 'WAITING') {
    console.log(`⚠️  scheduleNextHand: room status is ${room.gameState.status}, not WAITING`);
    return;
  }

  // OFC初回は手動開始（Add Bot / Start Game ボタン）
  // 2ハンド目以降（ofcState存在時）は自動開始
  if (room.gameState.gameVariant === 'OFC' && !room.ofcState) {
    console.log('⏳ OFC: Waiting for manual start (use Start Game button)');
    return;
  }

  // ACTIVEプレイヤー + pendingJoin(BB待ちでない)SIT_OUTプレイヤーを確認
  // pendingJoin && !waitingForBB のSIT_OUTプレイヤーはresetPlayersForNewHandでACTIVEになるのでカウントする
  const activePlayers = room.players.filter(p =>
    p !== null && p.stack > 0 && !p.pendingSitOut && !p.pendingLeave &&
    (p.status !== 'SIT_OUT' || (p.pendingJoin && !p.waitingForBB))
  );

  console.log(`🎲 scheduleNextHand called for room ${roomId}`);
  console.log(`   Status: ${room.gameState.status}`);
  console.log(`   Active players found: ${activePlayers.length}`);
  console.log(`   Player details:`);
  room.players.forEach((p, i) => {
    if (p) {
      console.log(`     [${i}] ${p.name}: stack=${p.stack}, status=${p.status}, flags={join:${p.pendingJoin}, sitOut:${p.pendingSitOut}, leave:${p.pendingLeave}}`);
    } else {
      console.log(`     [${i}] (empty seat)`);
    }
  });

  if (activePlayers.length < 2) {
    console.log('⚠️  scheduleNextHand: NOT ENOUGH PLAYERS (< 2) - game cannot start');
    console.log('   → Waiting for more players or rebuy...');
    return;
  }

  console.log(`✅ scheduleNextHand: ${activePlayers.length} players ready, scheduling game start in 2 seconds...`);

  const timeout = setTimeout(() => {
    pendingStarts.delete(roomId);

    const currentRoom = roomManager.getRoomById(roomId);
    if (!currentRoom || currentRoom.gameState.status !== 'WAITING') return;

    // 再度プレイヤー数をチェック（pendingJoin && !waitingForBBのSIT_OUTも含む）
    const readyPlayers = currentRoom.players.filter(p =>
      p !== null && p.stack > 0 && !p.pendingSitOut && !p.pendingLeave &&
      (p.status !== 'SIT_OUT' || (p.pendingJoin && !p.waitingForBB))
    );
    if (readyPlayers.length < 2) return;

    // GameEngineを取得または作成
    let engine = gameEngines.get(roomId);
    if (!engine) {
      engine = new GameEngine();
      gameEngines.set(roomId, engine);
    }

    // 保留設定を適用（次ハンド開始前）
    if (currentRoom.pendingConfig) {
      const applied = roomManager.applyPendingConfig(roomId);
      if (applied) {
        currentRoom.gameState.minRaise = currentRoom.config.bigBlind;
        io.to(`room:${roomId}`).emit('config-applied', {
          config: currentRoom.config,
          rotation: currentRoom.rotation,
          gameVariant: currentRoom.gameState.gameVariant,
        });
      }
    }

    // OFC分岐: OFCゲームの場合は専用エンジンで開始
    if (currentRoom.gameState.gameVariant === 'OFC') {
      startOFCHand(roomId, currentRoom, io);
      console.log(`🎮 Auto-started OFC game in room ${roomId}`);
      logEvent('auto_start', { roomId, playerCount: readyPlayers.length, variant: 'OFC' });
      incrementMetric('auto_start');
      return;
    }

    // ハンドを開始
    console.log(`🚀 Starting new hand for room ${roomId}...`);
    const success = engine.startHand(currentRoom);
    if (!success) {
      console.log(`❌ Failed to start hand for room ${roomId}`);
      return;
    }
    console.log(`✅ Hand started successfully for room ${roomId}`);

    // 全員にゲーム状態と自分のハンドを送信
    for (const player of currentRoom.players) {
      if (player) {
        io.to(player.socketId).emit('game-started', {
          room: sanitizeRoomForViewer(currentRoom, player.socketId),
          yourHand: player.hand
        });
      }
    }

    // アクティブプレイヤーに行動を促す
    const activePlayer = currentRoom.players[currentRoom.activePlayerIndex];
    if (activePlayer) {
      emitYourTurn(roomId, currentRoom, engine, io, activePlayer);
    }

    console.log(`🎮 Auto-started game in room ${roomId}`);
    logEvent('auto_start', { roomId, playerCount: readyPlayers.length });
    incrementMetric('auto_start');
  }, AUTO_START_DELAY_MS);

  pendingStarts.set(roomId, timeout);
}

/**
 * ルームデータをサニタイズ（他プレイヤーのhandを隠す）
 * @param room ルームオブジェクト
 * @param viewerSocketId 閲覧者のsocketId（この人には自分の手札が見える）
 */
function sanitizeRoomForViewer(room: any, viewerSocketId?: string): any {
  // パスワードをホスト以外に送信しない
  const sanitizedConfig = { ...room.config };
  if (room.hostId !== viewerSocketId) {
    delete sanitizedConfig.password;
  }

  // OFC公開状態を生成
  let ofcPublicState = undefined;
  if (room.ofcState) {
    const ofcEngine = ofcEngines.get(room.id);
    ofcPublicState = ofcEngine
      ? ofcEngine.getPublicState(room, viewerSocketId)
      : room.ofcState;
  }

  return {
    ...room,
    config: sanitizedConfig,
    ofcState: ofcPublicState,
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

function broadcastRoomState(roomId: string, room: any, io: Server) {
  void io.in(`room:${roomId}`).fetchSockets()
    .then(sockets => {
      for (const sock of sockets) {
        sock.emit('room-state-update', sanitizeRoomForViewer(room, sock.id));
      }
    })
    .catch(error => {
      console.error('❌ Failed to broadcast room-state-update', {
        roomId,
        error: error instanceof Error ? error.message : error
      });
    });
}

// ヘルパー関数: socketからroomIdを取得
function getRoomIdFromSocket(socket: any): string | null {
  const rooms = Array.from(socket.rooms) as string[];
  const roomEntry = rooms.find((r: string) => r.startsWith('room:'));
  return roomEntry ? roomEntry.slice(5) : null;
}

// ========================================
// OFC (Open Face Chinese) Helper Functions
// ========================================

function getOFCEngine(roomId: string): OFCGameEngine {
  let engine = ofcEngines.get(roomId);
  if (!engine) {
    engine = new OFCGameEngine();
    ofcEngines.set(roomId, engine);
  }
  return engine;
}

/**
 * OFCハンドを開始
 * - BOTで空席を埋める
 * - エンジンでカードを配布
 * - 各プレイヤーに手札を送信
 * - BOTは自動配置
 */
function startOFCHand(roomId: string, room: any, io: Server) {
  const engine = getOFCEngine(roomId);

  // BOTで空席を埋める（最大3人）
  fillOFCBots(room);

  // ハンド開始
  const events = engine.startHand(room);

  // イベント処理
  for (const event of events) {
    if (event.type === 'error') {
      console.log(`❌ OFC start error: ${event.data.reason}`);
      return;
    }

    if (event.type === 'deal') {
      // 各プレイヤーに自分のカードを送信
      const ofc = room.ofcState;
      if (ofc) {
        for (const p of ofc.players) {
          const cards = engine.getPlayerCards(room, p.socketId);
          if (!p.isBot) {
            io.to(p.socketId).emit('ofc-deal', {
              round: ofc.round,
              yourCards: cards,
              ofcState: engine.getPublicState(room, p.socketId),
            });
          }
        }
      }

      // 全員にルーム状態更新
      broadcastRoomState(roomId, room, io);

      // BOTの自動配置をスケジュール
      scheduleOFCBotActions(roomId, room, io, engine);
    }
  }
}

/**
 * BOTで空席を埋める（OFCは最大3人）
 */
function fillOFCBots(room: any) {
  const humanCount = room.players.filter((p: any) => p && !p.disconnected).length;
  if (humanCount === 0) return;

  const maxPlayers = Math.min(room.config.maxPlayers || 3, 3);
  let botIndex = 1;

  for (let i = 0; i < maxPlayers; i++) {
    if (!room.players[i]) {
      room.players[i] = {
        socketId: `bot-${room.id}-${i}`,
        name: `Bot ${botIndex}`,
        stack: room.config.buyInMax || 400,
        bet: 0,
        totalBet: 0,
        status: 'ACTIVE' as PlayerStatus,
        hand: null,
        disconnected: false,
      };
      botIndex++;
    }
  }
}

/**
 * BOTの自動配置をスケジュール（初期ラウンド用 - 同時配置）
 */
function scheduleOFCBotActions(roomId: string, room: any, io: Server, engine: OFCGameEngine) {
  const ofc = room.ofcState;
  if (!ofc) return;

  // 初期ラウンド: 全BOT同時配置
  if (ofc.phase === 'OFC_INITIAL_PLACING') {
    for (const player of ofc.players) {
      if (!player.isBot || player.hasPlaced) continue;

      const delay = 500 + Math.random() * 1000;
      setTimeout(() => {
        const currentRoom = roomManager.getRoomById(roomId);
        if (!currentRoom || !currentRoom.ofcState) return;
        const cp = currentRoom.ofcState.players.find((p: any) => p.socketId === player.socketId);
        if (!cp || cp.hasPlaced) return;

        let events;
        if (cp.isFantasyland && cp.fantasyCandidateCards) {
          const { placements, discard } = botPlaceFantasyland(cp.fantasyCandidateCards);
          events = engine.placeInitialCards(currentRoom, player.socketId, placements, discard);
        } else {
          const placements = botPlaceInitial(cp.currentCards);
          events = engine.placeInitialCards(currentRoom, player.socketId, placements);
        }
        if (events) processOFCEvents(roomId, currentRoom, io, engine, events);
      }, delay);
    }
  } else {
    // Pineappleラウンド: 現在ターンのBOTのみスケジュール
    scheduleCurrentTurnBot(roomId, room, io, engine);
  }
}

/**
 * Pineappleラウンド: 現在ターンがBOTならスケジュール
 */
function scheduleCurrentTurnBot(roomId: string, room: any, io: Server, engine: OFCGameEngine) {
  const ofc = room.ofcState;
  if (!ofc || ofc.currentTurnIndex < 0) return;

  const currentPlayer = ofc.players[ofc.currentTurnIndex];
  if (!currentPlayer || !currentPlayer.isBot || currentPlayer.hasPlaced) return;

  const delay = 500 + Math.random() * 1000;
  setTimeout(() => {
    const currentRoom = roomManager.getRoomById(roomId);
    if (!currentRoom || !currentRoom.ofcState) return;
    const cp = currentRoom.ofcState.players[currentRoom.ofcState.currentTurnIndex];
    if (!cp || !cp.isBot || cp.hasPlaced) return;

    let events;
    if (currentRoom.ofcState.phase === 'OFC_PINEAPPLE_PLACING') {
      const { placements, discard } = botPlacePineapple(cp.currentCards, cp.board);
      events = engine.placePineappleCards(currentRoom, cp.socketId, placements, discard);
    }
    if (events) processOFCEvents(roomId, currentRoom, io, engine, events);
  }, delay);
}

/**
 * OFCルームから人間が退出時: BOTを全削除・ofcStateリセット
 */
function cleanupOFCRoom(room: any) {
  for (let i = 0; i < room.players.length; i++) {
    if (room.players[i]?.socketId.startsWith('bot-')) {
      room.players[i] = null;
    }
  }
  room.ofcState = undefined;
  room.gameState.status = 'WAITING';
}

/**
 * OFCエンジンイベントを処理してソケットに送信
 */
function processOFCEvents(roomId: string, room: any, io: Server, engine: OFCGameEngine, events: any[]) {
  for (const event of events) {
    switch (event.type) {
      case 'placement-accepted':
        broadcastRoomState(roomId, room, io);
        // Pineappleラウンドで次のターンがBOTならスケジュール
        if (room.ofcState?.phase === 'OFC_PINEAPPLE_PLACING') {
          scheduleCurrentTurnBot(roomId, room, io, engine);
        }
        break;

      case 'round-complete':
        // 各プレイヤーにボード状態を送信
        io.to(`room:${roomId}`).emit('ofc-round-complete', event.data);
        break;

      case 'deal': {
        // 新ラウンドのカードを各プレイヤーに送信
        const ofc = room.ofcState;
        if (ofc) {
          for (const p of ofc.players) {
            if (!p.isBot) {
              const cards = engine.getPlayerCards(room, p.socketId);
              io.to(p.socketId).emit('ofc-deal', {
                round: ofc.round,
                yourCards: cards,
                ofcState: engine.getPublicState(room, p.socketId),
              });
            }
          }
        }
        broadcastRoomState(roomId, room, io);
        // 新ラウンドのBOTアクションをスケジュール
        scheduleOFCBotActions(roomId, room, io, engine);
        break;
      }

      case 'scoring':
        io.to(`room:${roomId}`).emit('ofc-scoring', event.data);
        break;

      case 'hand-complete':
        broadcastRoomState(roomId, room, io);
        // 次のハンドをスケジュール
        setTimeout(() => {
          scheduleNextHand(roomId, io);
        }, HAND_END_DELAY_MS + 3000); // スコア表示のための追加遅延
        break;

      case 'error':
        console.warn(`OFC error: ${event.data.reason}`);
        break;
    }
  }
}

function shouldAutoFold(
  engine: GameEngine | undefined,
  isActivePlayer: boolean,
  player: RoomPlayer
): boolean {
  return Boolean(engine && isActivePlayer && player.status === 'ACTIVE');
}

function handleInGameExit(
  socket: any,
  roomId: string,
  room: any,
  seatIndex: number,
  leaveRoom: boolean,
  io: Server
) {
  const player = room.players[seatIndex]!;

  // セッション追跡: キャッシュアウト記録（ハンド中退出は現在のスタックで記録）
  if (hasActiveSession(socket.id)) {
    endSession(socket.id, player.stack);
  }

  // OFCゲーム中の退出: BOT全削除・即座にリセット
  if (room.gameState.gameVariant === 'OFC') {
    room.players[seatIndex] = null;
    cleanupOFCRoom(room);
    if (leaveRoom) socket.leave(`room:${roomId}`);
    broadcastRoomState(roomId, room, io);
    io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
    return;
  }

  player.pendingLeave = true;
  player.pendingSitOut = true;
  player.pendingJoin = false;
  player.waitingForBB = false;
  player.disconnected = true;

  const engine = gameEngines.get(roomId);
  const isActivePlayer = room.activePlayerIndex === seatIndex;
  let actionProcessed = false;

  if (shouldAutoFold(engine, isActivePlayer, player)) {
    const result = engine!.processAction(room, {
      playerId: socket.id,
      type: 'FOLD' as ActionType,
      timestamp: Date.now()
    });

    if (result.success) {
      processPostAction(roomId, room, engine!, io);
      actionProcessed = true;
    } else {
      player.status = 'FOLDED';
    }
  } else if (player.status === 'ACTIVE') {
    player.status = 'FOLDED';
  }

  if (leaveRoom) {
    socket.leave(`room:${roomId}`);
  }

  if (!actionProcessed) {
    broadcastRoomState(roomId, room, io);
    io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
  }
}

function handleWaitingExit(
  socket: any,
  roomId: string,
  leaveRoom: boolean,
  io: Server
) {
  // セッション追跡: キャッシュアウト記録
  const exitRoom = roomManager.getRoomById(roomId);
  if (exitRoom) {
    const exitPlayer = exitRoom.players.find(p => p?.socketId === socket.id);
    if (exitPlayer && hasActiveSession(socket.id)) {
      endSession(socket.id, exitPlayer.stack);
    }
  }

  // OFCルーム: 人間退出でBOT全削除
  if (exitRoom && exitRoom.gameState.gameVariant === 'OFC') {
    cleanupOFCRoom(exitRoom);
  }

  roomManager.standUp(roomId, socket.id);
  if (leaveRoom) {
    socket.leave(`room:${roomId}`);
  }

  const roomStillExists = roomManager.getRoomById(roomId);
  if (roomStillExists) {
    broadcastRoomState(roomId, roomStillExists, io);
  } else {
    gameEngines.delete(roomId);
    roomActionInFlight.delete(roomId);
    if (!leaveRoom) {
      socket.leave(`room:${roomId}`);
    }
  }

  io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
}

function handleRoomExit(
  socket: any,
  roomId: string,
  io: Server,
  options: { leaveRoom?: boolean } = {}
) {
  const room = roomManager.getRoomById(roomId);
  cleanupSocketSession(socket.id);
  const leaveRoom = options.leaveRoom !== false;

  if (!room) {
    if (leaveRoom) {
      socket.leave(`room:${roomId}`);
    }
    return;
  }

  const seatIndex = room.players.findIndex(p => p?.socketId === socket.id);
  if (seatIndex === -1) {
    if (leaveRoom) {
      socket.leave(`room:${roomId}`);
    }
    return;
  }

  // ホスト離脱時: 次のプレイヤーにホスト権限を移譲
  if (room.hostId && room.hostId === socket.id) {
    const nextHost = room.players.find((p: any) => p !== null && p.socketId !== socket.id);
    if (nextHost) {
      room.hostId = nextHost.socketId;
      io.to(`room:${roomId}`).emit('host-changed', { newHostId: nextHost.socketId });
      console.log(`👑 Host transferred to ${nextHost.name} in room ${roomId}`);
    } else {
      // 最後のプレイヤー → ルームは削除される
      room.hostId = undefined;
    }
  }

  const isInHand = room.gameState.status !== 'WAITING';

  if (isInHand) {
    handleInGameExit(socket, roomId, room, seatIndex, leaveRoom, io);
    return;
  }

  handleWaitingExit(socket, roomId, leaveRoom, io);
}

function getRoomIdOrError(socket: any): string | null {
  const roomId = getRoomIdFromSocket(socket);
  if (!roomId) {
    socket.emit('error', { message: 'You are not in any room' });
    return null;
  }
  return roomId;
}

function getRoomOrError(roomId: string, socket: any) {
  const room = roomManager.getRoomById(roomId);
  if (!room) {
    socket.emit('error', { message: 'Room not found' });
    return null;
  }
  return room;
}

function getEngineOrError(roomId: string, socket: any) {
  const engine = gameEngines.get(roomId);
  if (!engine) {
    socket.emit('error', { message: 'Game not started' });
    return null;
  }
  return engine;
}

function checkActionRateLimit(socket: any, roomId: string, now: number): boolean {
  const rate = actionRateLimit.get(socket.id);
  if (!rate || now - rate.windowStart > ACTION_RATE_LIMIT_WINDOW_MS) {
    actionRateLimit.set(socket.id, { count: 1, windowStart: now });
    return true;
  }

  rate.count += 1;
  if (rate.count > ACTION_RATE_LIMIT_MAX) {
    const ip = socket.handshake.address;
    console.warn(`⚠️ Rate limit: ${socket.id} (${ip}) ${rate.count}/${ACTION_RATE_LIMIT_WINDOW_MS}ms`);
    socket.emit('action-invalid', { reason: 'Too many actions' });
    logEvent('rate_limited', { roomId, playerId: socket.id, ip, count: rate.count });
    incrementMetric('rate_limited');
    return false;
  }

  return true;
}

function validateActionToken(socket: any, roomId: string, token: string | undefined, now: number): boolean {
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
    return false;
  }

  if (now - expectedToken.issuedAt > ACTION_TOKEN_TTL_MS) {
    actionTokens.delete(socket.id);
    socket.emit('action-invalid', { reason: 'Action token expired' });
    logEvent('action_invalid', { roomId, playerId: socket.id, reason: 'Action token expired' });
    incrementMetric('action_invalid', { reason: 'token_expired' });
    return false;
  }

  return true;
}

function validatePlayerActionRequest(
  socket: any,
  data: { type: ActionType; amount?: number; actionToken?: string }
): { roomId: string; room: any; engine: GameEngine } | null {
  const roomId = getRoomIdOrError(socket);
  if (!roomId) return null;
  const room = getRoomOrError(roomId, socket);
  if (!room) return null;
  const engine = getEngineOrError(roomId, socket);
  if (!engine) return null;

  if (roomActionInFlight.has(roomId)) {
    socket.emit('action-invalid', { reason: 'Room is processing another action' });
    return null;
  }

  if (room.gameState.isDrawPhase) {
    socket.emit('action-invalid', { reason: 'Draw phase in progress' });
    logEvent('action_invalid', { roomId, playerId: socket.id, reason: 'Draw phase in progress' });
    incrementMetric('action_invalid', { reason: 'draw_phase' });
    return null;
  }

  const now = Date.now();
  if (!checkActionRateLimit(socket, roomId, now)) {
    return null;
  }
  if (!validateActionToken(socket, roomId, data.actionToken, now)) {
    return null;
  }

  if (actionInFlight.has(socket.id)) {
    socket.emit('action-invalid', { reason: 'Action already in progress' });
    return null;
  }

  return { roomId, room, engine };
}

function handleAllInRunout(roomId: string, room: any, io: Server) {
  const runoutPhase = room.gameState.runoutPhase || 'PREFLOP';
  const board = room.gameState.board;
  const DELAY = 1500; // 1.5秒

  console.log(`🎬 Starting all-in runout from ${runoutPhase}`);

  // オールインプレイヤーのハンドを収集
  const allInPlayers = room.players.filter(p =>
    p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN') && p.hand && p.hand.length > 0
  );
  const revealedHands = allInPlayers.map(p => ({
    playerId: p!.socketId,
    playerName: p!.name,
    hand: p!.hand
  }));

  console.log(`🃏 Revealing hands for ${revealedHands.length} players:`, revealedHands.map(r => `${r.playerName}: ${r.hand.join(',')}`).join(' | '));

  // ランアウト開始前にボードをクリアして、段階的に表示する
  const fullBoard = [...board]; // 完全なボードを保存
  room.gameState.board = []; // ボードをクリア

  // ランアウト開始前に状態を送信（チップをポットに集める）
  broadcastRoomState(roomId, room, io);

  // ハンド開示を送信
  io.to(`room:${roomId}`).emit('runout-started', {
    runoutPhase,
    fullBoard: [], // 空配列を送信（段階的に表示するため）
    revealedHands  // 全プレイヤーのハンドを開示
  });

  const scheduleRunout = async () => {
    try {
      if (runoutPhase === 'PREFLOP') {
        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 3);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 3), phase: 'FLOP' });

        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 4);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 4), phase: 'TURN' });

        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 5);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 5), phase: 'RIVER' });

      } else if (runoutPhase === 'FLOP') {
        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 4);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 4), phase: 'TURN' });

        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 5);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 5), phase: 'RIVER' });

      } else if (runoutPhase === 'TURN') {
        await new Promise(r => setTimeout(r, DELAY));
        room.gameState.board = fullBoard.slice(0, 5);
        io.to(`room:${roomId}`).emit('runout-board', { board: fullBoard.slice(0, 5), phase: 'RIVER' });
      }

      await new Promise(r => setTimeout(r, DELAY));

      const calculatedPots = potManager.calculatePots(room.players);
      room.gameState.pot = calculatedPots;
      console.log(`💰 Pots calculated: Main=${calculatedPots.main}, Sides=${calculatedPots.side.map(s => s.amount).join(',')}`);

      console.log('🎯 Executing showdown...');
      console.log(`   Pot before showdown: Main=${room.gameState.pot.main}, Sides=${room.gameState.pot.side.map((s: any) => s.amount).join(',')}`);

      const showdownResult = showdownManager.executeShowdown(room);

      console.log(`🏆 Showdown complete. Winners: ${showdownResult.winners.map(w => w.playerName).join(', ')}`);
      if (showdownResult.winners && showdownResult.winners.length > 0) {
        console.log(`💰 Chip distribution:`);
        showdownResult.winners.forEach((winner: any) => {
          const player = room.players.find((p: any) => p?.socketId === winner.playerId);
          console.log(`   ${winner.playerName}: +${winner.amount} (new stack: ${player?.stack || '?'})`);
        });
      }

      io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

      // セッション追跡: ハンド結果記録（オールインランアウト）
      {
        const allPlayerIds = room.players
          .filter((p: any) => p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN' || p.status === 'FOLDED'))
          .map((p: any) => p.socketId);
        const winnerIds = showdownResult.winners.map((w: any) => w.playerId);
        recordHandResult(winnerIds, allPlayerIds);
      }

      if (showdownResult.winners.length > 0) {
        for (const winner of showdownResult.winners) {
          const bonus = metaGameManager.checkSevenDeuce(room, winner.playerId, winner.hand);
          if (bonus) {
            io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
            console.log(`🎲 7-2 BONUS: ${winner.playerName} wins ${bonus.amount}`);
          }
        }
      }

      const rotation = rotationManager.checkRotation(room);
      if (rotation.changed) {
        console.log(`🔄 Next game: ${rotation.nextGame}`);
        io.to(`room:${roomId}`).emit('next-game', {
          nextGame: rotation.nextGame,
          gamesList: room.rotation.gamesList
        });
      }

      room.gameState.isRunout = false;
      room.gameState.runoutPhase = undefined;
      room.gameState.status = 'WAITING' as any;

      // ショーダウン後、プレイヤーのstatusをリセット
      room.players.forEach((p) => {
        if (p) {
          if (p.status === 'ALL_IN') {
            // オールインから生還したプレイヤーは ACTIVE に戻す
            // stack=0の場合もACTIVEに戻す（リバイ可能にするため）
            p.status = 'ACTIVE';
            if (p.stack <= 0) {
              console.log(`  💰 ${p.name} needs rebuy (stack: 0)`);
            } else {
              console.log(`  ✅ ${p.name} returned to ACTIVE from ALL_IN (stack: ${p.stack})`);
            }
          }
        }
      });

      console.log('🔄 After all-in showdown, player states:');
      room.players.forEach((p, i) => {
        if (p) {
          console.log(`  [${i}] ${p.name}: stack=${p.stack}, status=${p.status}, pendingLeave=${p.pendingLeave}`);
        }
      });

      broadcastRoomState(roomId, room, io);

      setTimeout(() => {
        console.log('⏱️  Attempting to schedule next hand after all-in...');
        if (cleanupPendingLeavers(roomId, io)) {
          console.log('⚠️  cleanupPendingLeavers returned true, stopping game');
          return;
        }
        scheduleNextHand(roomId, io);
      }, 2500);
    } catch (error) {
      console.error('❌ Error in scheduleRunout:', error);
      // エラーが発生してもゲームを続行できるように
      room.gameState.status = 'WAITING' as any;
      broadcastRoomState(roomId, room, io);
      setTimeout(() => scheduleNextHand(roomId, io), 2500);
    }
  };

  scheduleRunout().catch((error) => {
    console.error('❌ Unhandled error in scheduleRunout:', error);
  });
}

function handleNormalShowdown(roomId: string, room: any, io: Server) {
  let showdownResult;
  const activePlayers = room.players.filter(p =>
    p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
  );

  if (activePlayers.length === 1) {
    showdownResult = showdownManager.awardToLastPlayer(room);
  } else {
    const calculatedPots = potManager.calculatePots(room.players);
    room.gameState.pot = calculatedPots;
    console.log(`💰 Pots calculated: Main=${calculatedPots.main}, Sides=${calculatedPots.side.map(s => s.amount).join(',')}`);
    showdownResult = showdownManager.executeShowdown(room);
  }

  io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

  // セッション追跡: ハンド結果記録
  {
    const allPlayerIds = room.players
      .filter((p: any) => p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN' || p.status === 'FOLDED'))
      .map((p: any) => p.socketId);
    const winnerIds = showdownResult.winners.map((w: any) => w.playerId);
    recordHandResult(winnerIds, allPlayerIds);
  }

  if (showdownResult.winners.length > 0) {
    for (const winner of showdownResult.winners) {
      const bonus = metaGameManager.checkSevenDeuce(room, winner.playerId, winner.hand);
      if (bonus) {
        io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
        console.log(`🎲 7-2 BONUS: ${winner.playerName} wins ${bonus.amount}`);
      }
    }
  }

  const rotation = rotationManager.checkRotation(room);
  if (rotation.changed) {
    console.log(`🔄 Next game: ${rotation.nextGame}`);
    io.to(`room:${roomId}`).emit('next-game', {
      nextGame: rotation.nextGame,
      gamesList: room.rotation.gamesList
    });
  }

  // ショーダウン後、プレイヤーのstatusをリセット
  room.players.forEach((p) => {
    if (p) {
      if (p.status === 'ALL_IN') {
        // オールインから生還したプレイヤーは ACTIVE に戻す
        // stack=0の場合もACTIVEに戻す（リバイ可能にするため）
        p.status = 'ACTIVE';
        if (p.stack <= 0) {
          console.log(`  💰 ${p.name} needs rebuy (stack: 0)`);
        } else {
          console.log(`  ✅ ${p.name} returned to ACTIVE from ALL_IN (stack: ${p.stack})`);
        }
      }
    }
  });

  room.gameState.status = 'WAITING' as any;

  console.log('🔄 After normal showdown, player states:');
  room.players.forEach((p, i) => {
    if (p) {
      console.log(`  [${i}] ${p.name}: stack=${p.stack}, status=${p.status}, pendingLeave=${p.pendingLeave}`);
    }
  });

  // クライアントに最終状態を送信
  broadcastRoomState(roomId, room, io);

  setTimeout(() => {
    if (cleanupPendingLeavers(roomId, io)) {
      return;
    }
    scheduleNextHand(roomId, io);
  }, 2500);
}

function maybeHandleShowdown(roomId: string, room: any, io: Server): boolean {
  if (room.gameState.status !== 'SHOWDOWN') {
    return false;
  }

  const activePlayers = room.players.filter(p =>
    p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
  );

  if (room.gameState.isRunout && activePlayers.length >= 2) {
    handleAllInRunout(roomId, room, io);
    return true;
  }

  handleNormalShowdown(roomId, room, io);
  return false;
}

function validateDrawExchangeRequest(
  socket: any,
  data: { discardIndexes: number[] }
): { roomId: string; room: any; engine: GameEngine; player: RoomPlayer; discardIndexes: number[] } | null {
  const roomId = getRoomIdOrError(socket);
  if (!roomId) return null;
  const room = getRoomOrError(roomId, socket);
  if (!room) return null;
  const engine = getEngineOrError(roomId, socket);
  if (!engine) return null;

  const player = getDrawPlayer(room, socket);
  if (!player) return null;

  if (!validateDrawPhase(room, socket)) return null;
  if (!validateDrawEligibility(player, socket)) return null;
  if (!validateDrawNotCompleted(room, socket)) return null;

  const variantConfig = getVariantConfig(room.gameState.gameVariant);
  const maxDrawCount = variantConfig.maxDrawCount ?? player.hand?.length ?? 0;
  const discardIndexes = parseDiscardIndexes(data, player, maxDrawCount, socket);
  if (!discardIndexes) return null;

  return { roomId, room, engine, player, discardIndexes };
}

function getDrawPlayer(room: any, socket: any): RoomPlayer | null {
  const player = room.players.find((p: any) => p?.socketId === socket.id);
  if (!player) {
    socket.emit('error', { message: 'Player not found' });
    return null;
  }
  return player;
}

function validateDrawPhase(room: any, socket: any): boolean {
  const status = room.gameState.status;
  const isDrawPhase = room.gameState.isDrawPhase;
  if (!isDrawPhase || (status !== 'FIRST_DRAW' && status !== 'SECOND_DRAW' && status !== 'THIRD_DRAW')) {
    socket.emit('error', { message: 'Not in draw exchange phase' });
    return false;
  }
  return true;
}

function validateDrawEligibility(player: RoomPlayer, socket: any): boolean {
  if (player.status !== 'ACTIVE' && player.status !== 'ALL_IN') {
    socket.emit('error', { message: 'You cannot draw' });
    return false;
  }
  return true;
}

function validateDrawNotCompleted(room: any, socket: any): boolean {
  const completedDraw = room.gameState.playersCompletedDraw || [];
  if (completedDraw.includes(socket.id)) {
    socket.emit('error', { message: 'You have already drawn this round' });
    return false;
  }
  return true;
}

function parseDiscardIndexes(
  data: { discardIndexes: number[] },
  player: RoomPlayer,
  maxDrawCount: number,
  socket: any
): number[] | null {
  const discardIndexes = Array.isArray(data.discardIndexes) ? data.discardIndexes : [];
  const uniqueIndexes = new Set<number>();
  for (const idx of discardIndexes) {
    if (!Number.isInteger(idx)) {
      socket.emit('error', { message: 'Invalid discard index' });
      return null;
    }
    uniqueIndexes.add(idx);
  }
  if (discardIndexes.length !== uniqueIndexes.size) {
    socket.emit('error', { message: 'Duplicate discard indexes' });
    return null;
  }
  if (discardIndexes.length > maxDrawCount) {
    socket.emit('error', { message: `Too many cards to discard (max ${maxDrawCount})` });
    return null;
  }
  if (!player.hand || discardIndexes.some(idx => idx < 0 || idx >= player.hand.length)) {
    socket.emit('error', { message: 'Discard index out of range' });
    return null;
  }
  return discardIndexes;
}

function validateQuickJoinBuyIn(room: any, buyIn: number, socket: any): boolean {
  const minBuyIn = room.config.buyInMin || room.config.bigBlind * 50;
  const maxBuyIn = room.config.buyInMax || room.config.bigBlind * 200;
  if (buyIn < minBuyIn || buyIn > maxBuyIn) {
    socket.emit('error', { message: `Buy-in must be between ${minBuyIn} and ${maxBuyIn}` });
    return false;
  }
  return true;
}

function removeExistingPlayerSession(room: any, socket: any, user: any, roomId: string) {
  const existingPlayerIndex = room.players.findIndex(p => {
    if (!p) return false;
    if (p.socketId === socket.id) return true;
    if (user?.userId && p.userId === user.userId) return true;
    return false;
  });

  if (existingPlayerIndex === -1) return;

  const oldPlayer = room.players[existingPlayerIndex]!;
  console.log(`🔄 Removing old session for ${oldPlayer.name} (old: ${oldPlayer.socketId}, new: ${socket.id})`);

  if (room.gameState.status !== 'WAITING') {
    const engine = gameEngines.get(roomId);
    if (engine && room.activePlayerIndex === existingPlayerIndex && oldPlayer.status === 'ACTIVE') {
      engine.processAction(room, {
        playerId: oldPlayer.socketId,
        type: 'FOLD' as ActionType,
        timestamp: Date.now()
      });
    }
  }

  room.players[existingPlayerIndex] = null;
}

function createQuickJoinPlayer(socket: any, user: any, room: any, buyIn: number): RoomPlayer {
  const variantConfig = getVariantConfig(room.gameState.gameVariant);
  const isWaiting = room.gameState.status === 'WAITING';
  return {
    socketId: socket.id,
    name: user?.displayName || 'Guest',
    stack: buyIn,
    bet: 0,
    totalBet: 0,
    status: (isWaiting ? 'ACTIVE' : 'SIT_OUT') as PlayerStatus,
    hand: null,
    pendingJoin: !isWaiting,
    waitingForBB: !isWaiting && variantConfig.hasButton,
    disconnected: false,
    userId: user?.userId,
    avatarIcon: user?.avatarIcon
  };
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

// JSON bodyパーサー
app.use(express.json());

// 認証APIルート
app.use('/api/auth', authRoutes);

// 統計APIルート
app.use('/api/stats', statsRoutes);

// ヘルスチェック用エンドポイント（全環境共通）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Mix Poker Game Server is running' });
});

// 本番環境: 静的ファイル配信
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // API以外のリクエストはindex.htmlを返す（SPA対応）
  // Express 5ではワイルドカードに名前付きパラメータが必要
  app.get('/{*splat}', (req, res, next) => {
    // Socket.IOやAPIリクエストは除外
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
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

// Socket.IO認証ミドルウェア
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const user = verifyToken(token);
    if (user) {
      socket.data.user = user;
      return next();
    }
  }
  // 認証なしでも接続を許可（ゲスト対応の余地）
  // ただしuser情報はnull
  socket.data.user = null;
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`🔥 Player connected! ID: ${socket.id}, User: ${user?.displayName || 'Guest'}`);

  // ========== Room Management Events ==========

  // 部屋参加
  socket.on('join-room', (data: JoinRoomRequest) => {
    try {
      const existingRoomId = getRoomIdFromSocket(socket);
      if (existingRoomId && existingRoomId !== data.roomId) {
        handleRoomExit(socket, existingRoomId, io);
      }

      const room = roomManager.getRoomById(data.roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (data.resumeToken) {
        const existingPlayer = room.players.find(p => p?.resumeToken === data.resumeToken);
        if (existingPlayer) {
          const previousSocketId = existingPlayer.socketId;
          if (previousSocketId !== socket.id) {
            cleanupSocketSession(previousSocketId);
            const oldSocket = io.sockets.sockets.get(previousSocketId);
            if (oldSocket) {
              oldSocket.leave(`room:${data.roomId}`);
              oldSocket.emit('error', { message: 'Session replaced by reconnection' });
              oldSocket.disconnect(true);
            }
          }

          // セッション追跡: socketId移行
          migrateSession(previousSocketId, socket.id);

          existingPlayer.socketId = socket.id;
          existingPlayer.disconnected = false;
          (socket.data as any).playerName = existingPlayer.name;
          if (room.gameState.status === 'WAITING' && existingPlayer.status === 'SIT_OUT' && !existingPlayer.pendingSitOut) {
            existingPlayer.status = 'ACTIVE';
          } else if (room.gameState.status !== 'WAITING') {
            existingPlayer.pendingJoin = true;
          }

          socket.join(`room:${data.roomId}`);
          (socket.data as any).roomId = data.roomId;
          socket.emit('room-joined', {
            room: sanitizeRoomForViewer(room, socket.id),
            yourSocketId: socket.id,
            yourHand: existingPlayer.hand || null
          });
          logEvent('room_resumed', { roomId: data.roomId, playerName: existingPlayer.name });
          incrementMetric('room_resumed');
          broadcastRoomState(data.roomId, room, io);
          return;
        }
      }

      // プレイヤー名をsocket.dataに保存（sit-down時に使用）
      (socket.data as any).playerName = data.playerName;

      // Socket.IOのルームに参加
      socket.join(`room:${data.roomId}`);
      (socket.data as any).roomId = data.roomId;
      (socket.data as any).roomId = data.roomId;

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
      handleRoomExit(socket, roomId, io, { leaveRoom: true });
      if ((socket.data as any).roomId === roomId) {
        delete (socket.data as any).roomId;
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
      broadcastRoomState(roomId, room, io);

      // ロビーに部屋リスト更新を通知
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());

    } catch (error: any) {
      console.error(`❌ Sit-down failed: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // クイック参加（join-room + 自動着席を1アクションで）
  socket.on('quick-join', (data: { roomId: string; buyIn: number }) => {
    try {
      // 既に別の部屋にいる場合は退出
      const existingRoomId = getRoomIdFromSocket(socket);
      if (existingRoomId && existingRoomId !== data.roomId) {
        handleRoomExit(socket, existingRoomId, io);
      }

      const room = roomManager.getRoomById(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // バイイン額チェック
      if (!validateQuickJoinBuyIn(room, data.buyIn, socket)) {
        return;
      }

      // ユーザー情報を取得
      const user = socket.data?.user;
      const playerName = user?.displayName || 'Guest';

      removeExistingPlayerSession(room, socket, user, data.roomId);

      // 空席を探す
      const seatIndex = findRandomEmptySeat(room.players);
      if (seatIndex === null) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // socket.dataにplayerNameを保存
      (socket.data as any).playerName = playerName;

      // Socket.IOのルームに参加
      socket.join(`room:${data.roomId}`);
      (socket.data as any).roomId = data.roomId;
      // ロビーから離脱
      socket.leave('lobby');

      const player = createQuickJoinPlayer(socket, user, room, data.buyIn);

      roomManager.sitDown(data.roomId, seatIndex, player);

      console.log(`⚡ ${playerName} quick-joined room ${data.roomId} at seat ${seatIndex}`);
      logEvent('quick_join', { roomId: data.roomId, playerName, seatIndex, buyIn: data.buyIn });
      incrementMetric('quick_join');

      // セッション追跡開始
      if (user?.userId) {
        startSession(socket.id, user.userId, data.roomId, room.gameState.gameVariant, data.buyIn);
      }

      // 参加成功を通知（本人）
      socket.emit('room-joined', {
        room: sanitizeRoomForViewer(room, socket.id),
        yourSocketId: socket.id,
        yourHand: null
      });
      socket.emit('sit-down-success', { seatIndex });

      // 部屋内の全員に更新を通知
      broadcastRoomState(data.roomId, room, io);

      // ロビーに部屋リスト更新を通知
      io.to('lobby').emit('room-list-update', roomManager.getAllRooms());

      // 自動ゲーム開始チェック
      scheduleNextHand(data.roomId, io);

    } catch (error: any) {
      console.error(`❌ Quick-join failed: ${error.message}`);
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

      // セッション追跡: アドオン記録
      recordAddOn(socket.id, data.amount);

      // ステータスをACTIVEに戻す（SIT_OUTやその他の状態から復帰）
      if (player.status !== 'ACTIVE') {
        console.log(`   → Changing ${player.name} status from ${player.status} to ACTIVE`);
        player.status = 'ACTIVE';
      }

      // リバイ成功を通知
      socket.emit('rebuy-success', { amount: data.amount, newStack });

      // 部屋内の全員に更新を通知
      broadcastRoomState(roomId, room, io);

      // ゲーム開始チェック（リバイ後に人数が揃った場合）
      console.log(`💰 After rebuy, checking if game can start...`);
      scheduleNextHand(roomId, io);

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // I'm Back（仮離席から復帰）
  socket.on('im-back', () => {
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

      // SIT_OUTまたはpendingSitOutでない場合は何もしない
      if (player.status !== 'SIT_OUT' && !player.pendingSitOut) {
        console.log(`⚠️  ${player.name} tried to return but is not sitting out (status: ${player.status}, pendingSitOut: ${player.pendingSitOut})`);
        return;
      }

      console.log(`👋 ${player.name} pressed Im Back (status: ${player.status}, pendingSitOut: ${player.pendingSitOut}, roomStatus: ${room.gameState.status})`);

      // フラグをクリア
      player.pendingSitOut = false;
      consecutiveTimeouts.delete(socket.id);

      if (room.gameState.status === 'WAITING') {
        // 待機中なら即座に復帰してゲーム開始チェック
        player.status = 'ACTIVE';
        player.pendingJoin = false;
        console.log(`👋 ${player.name} returned to ACTIVE (room is WAITING)`);
        socket.emit('im-back-success');
        broadcastRoomState(roomId, room, io);
        scheduleNextHand(roomId, io);
      } else if (player.status === 'SIT_OUT') {
        // ゲーム中 + 既にSIT_OUT → 次のハンドから参加
        player.pendingJoin = true;
        console.log(`👋 ${player.name} will join next hand (game in progress)`);
        socket.emit('im-back-success');
        broadcastRoomState(roomId, room, io);
      } else {
        // ゲーム中 + pendingSitOutキャンセル（まだFOLDED/ACTIVEなのでそのまま続行）
        console.log(`👋 ${player.name} cancelled pending sit-out (still in hand as ${player.status})`);
        socket.emit('im-back-success');
        broadcastRoomState(roomId, room, io);
      }

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ========== Phase 3-B: Game Engine Events ==========

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
      const context = validatePlayerActionRequest(socket, data);
      if (!context) return;
      const { roomId, room, engine } = context;

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

      // アクション成功時は連続タイムアウトカウンターをリセット
      consecutiveTimeouts.delete(socket.id);

      // 全員に更新を送信（ショーダウン前に必ず送信してチップを表示）
      broadcastRoomState(roomId, room, io);

      // ショーダウンチェック
      if (maybeHandleShowdown(roomId, room, io)) {
        return;
      }

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
      const context = validateDrawExchangeRequest(socket, data);
      if (!context) return;
      const { roomId, room, engine, player, discardIndexes } = context;

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

        // 全員に更新を送信
        broadcastRoomState(roomId, room, io);

        // アクティブプレイヤーに行動を促す
        if (room.activePlayerIndex !== -1) {
          const nextPlayer = room.players[room.activePlayerIndex];
          if (nextPlayer) {
            emitYourTurn(roomId, room, engine, io, nextPlayer);
          }
        }
      } else {
        // まだ全員完了していない場合のみ状態送信
        broadcastRoomState(roomId, room, io);
      }

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

  // ========== OFC (Open Face Chinese) ==========

  // OFCカード配置
  socket.on('ofc-place-cards', (data: {
    placements: OFCPlacement[];
    discardCard?: string;
  }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) {
        socket.emit('error', { message: 'You are not in any room' });
        return;
      }
      const room = roomManager.getRoomById(roomId);
      if (!room || !room.ofcState) {
        socket.emit('error', { message: 'No active OFC game' });
        return;
      }

      const engine = getOFCEngine(roomId);
      let events;

      if (room.ofcState.phase === 'OFC_INITIAL_PLACING') {
        events = engine.placeInitialCards(room, socket.id, data.placements, data.discardCard);
      } else if (room.ofcState.phase === 'OFC_PINEAPPLE_PLACING') {
        if (!data.discardCard) {
          socket.emit('ofc-error', { reason: 'Must specify discard card for pineapple round' });
          return;
        }
        events = engine.placePineappleCards(room, socket.id, data.placements, data.discardCard);
      } else {
        socket.emit('ofc-error', { reason: 'Not in a placing phase' });
        return;
      }

      // エラーチェック
      const errorEvent = events.find((e: any) => e.type === 'error');
      if (errorEvent) {
        socket.emit('ofc-error', errorEvent.data);
        return;
      }

      processOFCEvents(roomId, room, io, engine, events);

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // OFC Bot追加（手動）
  socket.on('ofc-add-bot', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) return;
      const room = roomManager.getRoomById(roomId);
      if (!room || room.gameState.gameVariant !== 'OFC') return;
      if (room.gameState.status !== 'WAITING') {
        socket.emit('ofc-error', { reason: 'Cannot add bot during game' });
        return;
      }

      const maxPlayers = Math.min(room.config.maxPlayers || 3, 3);
      let added = false;
      for (let i = 0; i < maxPlayers; i++) {
        if (!room.players[i]) {
          const botNum = room.players.filter((p: any) => p && p.socketId.startsWith('bot-')).length + 1;
          room.players[i] = {
            socketId: `bot-${room.id}-${i}`,
            name: `Bot ${botNum}`,
            stack: room.config.buyInMax || 400,
            bet: 0,
            totalBet: 0,
            status: 'ACTIVE' as PlayerStatus,
            hand: null,
            disconnected: false,
          };
          added = true;
          break;
        }
      }

      if (added) {
        broadcastRoomState(roomId, room, io);
      } else {
        socket.emit('ofc-error', { reason: 'No empty seats' });
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // OFC Bot削除（手動）
  socket.on('ofc-remove-bot', (data: { seatIndex: number }) => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) return;
      const room = roomManager.getRoomById(roomId);
      if (!room || room.gameState.gameVariant !== 'OFC') return;
      if (room.gameState.status !== 'WAITING') {
        socket.emit('ofc-error', { reason: 'Cannot remove bot during game' });
        return;
      }

      const seat = data.seatIndex;
      if (seat >= 0 && seat < room.players.length &&
          room.players[seat]?.socketId.startsWith('bot-')) {
        room.players[seat] = null;
        broadcastRoomState(roomId, room, io);
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // OFC手動ゲーム開始
  socket.on('ofc-start-game', () => {
    try {
      const roomId = getRoomIdFromSocket(socket);
      if (!roomId) return;
      const room = roomManager.getRoomById(roomId);
      if (!room || room.gameState.gameVariant !== 'OFC') return;
      if (room.gameState.status !== 'WAITING') {
        socket.emit('ofc-error', { reason: 'Game already in progress' });
        return;
      }

      const playerCount = room.players.filter((p: any) => p !== null).length;
      if (playerCount < 2) {
        socket.emit('ofc-error', { reason: 'Need at least 2 players' });
        return;
      }

      startOFCHand(roomId, room, io);
      console.log(`🎮 OFC game manually started in room ${roomId}`);
      logEvent('ofc_manual_start', { roomId, playerCount });
      incrementMetric('ofc_manual_start');
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
      broadcastRoomState(roomId, room, io);
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
      broadcastRoomState(roomId, room, io);
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
      broadcastRoomState(roomId, room, io);
      io.to(`room:${roomId}`).emit('rotation-updated', { rotation: room.rotation });

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ゲームバリアント即時変更（ローテーション外）
  const applyGameVariantChange = (variant: string) => {
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

    const validVariants = ['NLH', 'PLO', 'PLO8', '7CS', '7CS8', 'RAZZ', '2-7_TD', 'BADUGI'];
    if (!validVariants.includes(variant)) {
      socket.emit('error', { message: `Invalid variant: ${variant}` });
      return;
    }

    room.gameState.gameVariant = variant;
    console.log(`🎮 Room ${roomId}: Game variant changed to ${variant}`);

    broadcastRoomState(roomId, room, io);
    io.to(`room:${roomId}`).emit('game-variant-changed', { variant });
  };

  socket.on('set-game-variant', (data: { variant: string }) => {
    try {
      applyGameVariantChange(data.variant);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('change-variant', (data: { variant: string }) => {
    try {
      applyGameVariantChange(data.variant);
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
      broadcastRoomState(roomId, room, io);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // ========== プライベートルーム機能 ==========

  // プライベートルーム作成
  socket.on('create-private-room', (data: {
    config: {
      maxPlayers?: number;
      smallBlind?: number;
      bigBlind?: number;
      buyInMin?: number;
      buyInMax?: number;
      allowedGames?: string[];
      timeLimit?: number;
      studAnte?: number;
    };
    password?: string;
    customRoomId?: string;
  }) => {
    try {
      const user = socket.data?.user;
      if (!user) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      // 既に別の部屋にいる場合は退出
      const existingRoomId = getRoomIdFromSocket(socket);
      if (existingRoomId) {
        handleRoomExit(socket, existingRoomId, io);
      }

      const sb = data.config.smallBlind || 1;
      const bb = data.config.bigBlind || 2;

      const config: RoomConfig = {
        maxPlayers: data.config.maxPlayers || 6,
        smallBlind: sb,
        bigBlind: bb,
        buyInMin: data.config.buyInMin || bb * 50,
        buyInMax: data.config.buyInMax || bb * 200,
        allowedGames: data.config.allowedGames || ['NLH'],
        timeLimit: data.config.timeLimit,
        studAnte: data.config.studAnte,
        password: data.password || undefined,
      };

      const room = roomManager.createRoom(socket.id, config, data.customRoomId);

      // Socket.IOのルームに参加
      socket.join(`room:${room.id}`);
      (socket.data as any).roomId = room.id;
      (socket.data as any).playerName = user.displayName;
      socket.leave('lobby');

      socket.emit('private-room-created', {
        roomId: room.id,
        room: sanitizeRoomForViewer(room, socket.id),
        yourSocketId: socket.id,
      });

      console.log(`🔒 Private room created: ${room.id} by ${user.displayName}`);
      logEvent('private_room_created', { roomId: room.id, playerName: user.displayName });

    } catch (error: any) {
      console.error(`❌ Create private room failed: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // プライベートルーム参加
  socket.on('join-private-room', (data: {
    roomId: string;
    password?: string;
    buyIn: number;
  }) => {
    try {
      const room = roomManager.getRoomById(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // パスワード検証
      if (!roomManager.validatePassword(data.roomId, data.password)) {
        socket.emit('error', { message: 'Incorrect password' });
        return;
      }

      // バイイン額チェック
      if (!validateQuickJoinBuyIn(room, data.buyIn, socket)) {
        return;
      }

      // 既に別の部屋にいる場合は退出
      const existingRoomId = getRoomIdFromSocket(socket);
      if (existingRoomId && existingRoomId !== data.roomId) {
        handleRoomExit(socket, existingRoomId, io);
      }

      const user = socket.data?.user;
      const playerName = user?.displayName || 'Guest';

      removeExistingPlayerSession(room, socket, user, data.roomId);

      // 空席を探す
      const seatIndex = findRandomEmptySeat(room.players);
      if (seatIndex === null) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      (socket.data as any).playerName = playerName;
      socket.join(`room:${data.roomId}`);
      (socket.data as any).roomId = data.roomId;
      socket.leave('lobby');

      const player = createQuickJoinPlayer(socket, user, room, data.buyIn);
      roomManager.sitDown(data.roomId, seatIndex, player);

      console.log(`🔒 ${playerName} joined private room ${data.roomId} at seat ${seatIndex}`);
      logEvent('private_room_join', { roomId: data.roomId, playerName, seatIndex, buyIn: data.buyIn });

      // セッション追跡開始
      if (user?.userId) {
        startSession(socket.id, user.userId, data.roomId, room.gameState.gameVariant, data.buyIn);
      }

      socket.emit('room-joined', {
        room: sanitizeRoomForViewer(room, socket.id),
        yourSocketId: socket.id,
        yourHand: null,
      });
      socket.emit('sit-down-success', { seatIndex });

      broadcastRoomState(data.roomId, room, io);
      scheduleNextHand(data.roomId, io);

    } catch (error: any) {
      console.error(`❌ Join private room failed: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // プライベートルーム設定変更（遅延適用）
  socket.on('update-private-room-config', (data: {
    smallBlind?: number;
    bigBlind?: number;
    buyInMin?: number;
    buyInMax?: number;
    timeLimit?: number;
    studAnte?: number;
    gameVariant?: string;
    rotation?: {
      enabled?: boolean;
      gamesList?: string[];
      handsPerGame?: number;
    };
    password?: string;
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

      // ホストのみ変更可能
      if (room.hostId !== socket.id) {
        socket.emit('error', { message: 'Only the room host can change settings' });
        return;
      }

      // パスワード変更は即座に適用（ゲームプレイに影響しない）
      if (data.password !== undefined) {
        room.config.password = data.password || undefined;
      }

      // ゲームが WAITING 状態なら即座に適用
      if (room.gameState.status === 'WAITING') {
        if (data.smallBlind !== undefined) room.config.smallBlind = data.smallBlind;
        if (data.bigBlind !== undefined) room.config.bigBlind = data.bigBlind;
        if (data.buyInMin !== undefined) room.config.buyInMin = data.buyInMin;
        if (data.buyInMax !== undefined) room.config.buyInMax = data.buyInMax;
        if (data.timeLimit !== undefined) room.config.timeLimit = data.timeLimit;
        if (data.studAnte !== undefined) room.config.studAnte = data.studAnte;
        if (data.gameVariant) {
          room.gameState.gameVariant = data.gameVariant;
          room.gameState.minRaise = room.config.bigBlind;
        }
        if (data.rotation) {
          if (data.rotation.enabled !== undefined) room.rotation.enabled = data.rotation.enabled;
          if (data.rotation.gamesList) {
            room.rotation.gamesList = data.rotation.gamesList;
            room.rotation.currentGameIndex = 0;
            room.gameState.gameVariant = data.rotation.gamesList[0];
          }
          if (data.rotation.handsPerGame !== undefined) {
            room.rotation.handsPerGame = data.rotation.handsPerGame;
          }
        }
        room.pendingConfig = undefined;

        broadcastRoomState(roomId, room, io);
        io.to(`room:${roomId}`).emit('config-applied', {
          config: room.config,
          rotation: room.rotation,
          gameVariant: room.gameState.gameVariant,
        });
        console.log(`⚙️  Room ${roomId}: Config updated immediately (WAITING state)`);
        return;
      }

      // ゲーム中: 保留設定として保存
      const pendingConfigChanges: Partial<RoomConfig> = {};
      if (data.smallBlind !== undefined) pendingConfigChanges.smallBlind = data.smallBlind;
      if (data.bigBlind !== undefined) pendingConfigChanges.bigBlind = data.bigBlind;
      if (data.buyInMin !== undefined) pendingConfigChanges.buyInMin = data.buyInMin;
      if (data.buyInMax !== undefined) pendingConfigChanges.buyInMax = data.buyInMax;
      if (data.timeLimit !== undefined) pendingConfigChanges.timeLimit = data.timeLimit;
      if (data.studAnte !== undefined) pendingConfigChanges.studAnte = data.studAnte;

      room.pendingConfig = {
        config: Object.keys(pendingConfigChanges).length > 0 ? pendingConfigChanges : undefined,
        rotation: data.rotation,
        gameVariant: data.gameVariant,
        requestedBy: socket.id,
        requestedAt: Date.now(),
      };

      io.to(`room:${roomId}`).emit('config-pending', {
        pendingConfig: room.pendingConfig,
        message: 'Settings will change after this hand',
      });
      console.log(`⏳ Room ${roomId}: Config change pending (game in progress)`);

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
      handleRoomExit(socket, roomId, io, { leaveRoom: false });
      if ((socket.data as any).roomId === roomId) {
        delete (socket.data as any).roomId;
      }

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 切断した時
  socket.on('disconnect', () => {
    const roomId = (socket.data as any).roomId || getRoomIdFromSocket(socket);
    if (!roomId) {
      console.log('👋 Player disconnected (not in any room):', socket.id);
      return;
    }
    console.log(`👋 Player disconnected: ${socket.id} from room ${roomId}`);
    logEvent('disconnect', { playerId: socket.id });
    incrementMetric('disconnect');

    try {
      handleRoomExit(socket, roomId, io);
      delete (socket.data as any).roomId;
    } catch (error) {
      // エラーは無視（すでに離席済みの可能性）
    }

    io.to('lobby').emit('room-list-update', roomManager.getAllRooms());
  });
});

// Phase 2: ヘルパー関数をエクスポート（テスト用）
export {
  getRoomIdOrError,
  getRoomOrError,
  getEngineOrError,
  checkActionRateLimit,
  validateActionToken,
  validatePlayerActionRequest,
  handleAllInRunout,
  handleNormalShowdown,
  maybeHandleShowdown,
  validateDrawExchangeRequest,
  validateQuickJoinBuyIn,
  removeExistingPlayerSession,
  createQuickJoinPlayer,
  getRoomIdFromSocket,
  broadcastRoomState,
  cleanupPendingLeavers,
  scheduleNextHand
};

// テスト用: 状態にアクセスするヘルパー関数
export const __testing__ = {
  getGameEngine: (roomId: string) => gameEngines.get(roomId),
  setGameEngine: (roomId: string, engine: GameEngine) => gameEngines.set(roomId, engine),
  getActionToken: (socketId: string) => actionTokens.get(socketId),
  setActionToken: (socketId: string, token: string, issuedAt: number) =>
    actionTokens.set(socketId, { token, issuedAt }),
  getActionRateLimit: (socketId: string) => actionRateLimit.get(socketId),
  setActionRateLimit: (socketId: string, count: number, windowStart: number) =>
    actionRateLimit.set(socketId, { count, windowStart }),
  clearActionTokens: () => actionTokens.clear(),
  clearActionRateLimit: () => actionRateLimit.clear(),
  clearInvalidActionCounts: () => invalidActionCounts.clear(),
  ACTION_TOKEN_TTL_MS,
  ACTION_RATE_LIMIT_WINDOW_MS,
  ACTION_RATE_LIMIT_MAX
};

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// テスト環境では httpServer.listen() をスキップ（EPERM エラー回避）
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  httpServer.listen(Number(PORT), HOST, () => {
    console.log(`\n🚀 Server is running on http://${HOST}:${PORT}`);

    // プリセットルームを初期化
    roomManager.initializePresetRooms();
  });
}
