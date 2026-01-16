import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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

// Phase 3-B: ゲームエンジンインスタンス（部屋ごとに管理）
const gameEngines: Map<string, GameEngine> = new Map();
const showdownManager = new ShowdownManager();
const actionValidator = new ActionValidator();
const metaGameManager = new MetaGameManager();
const rotationManager = new RotationManager();
const potManager = new PotManager();

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
// 開発環境では複数のポートを許可
const ALLOWED_ORIGINS: string[] = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.CLIENT_URL
].filter((url): url is string => Boolean(url));

app.use(cors({
  origin: (origin, callback) => {
    // originがない場合（同一オリジンリクエスト）または許可リストに含まれる場合は許可
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Mix Poker Game Server is running' });
});

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

      // プレイヤー名をsocket.dataに保存（sit-down時に使用）
      (socket.data as any).playerName = data.playerName;

      // Socket.IOのルームに参加
      socket.join(`room:${data.roomId}`);

      socket.emit('room-joined', {
        room,
        yourSocketId: socket.id
      });

      console.log(`🚪 ${data.playerName} joined room ${data.roomId}`);
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

      // 着席するプレイヤー情報を作成
      const player: RoomPlayer = {
        socketId: socket.id,
        name: playerName,
        stack: data.buyIn,
        bet: 0,
        totalBet: 0,
        status: 'SIT_OUT' as PlayerStatus,
        hand: null
      };

      roomManager.sitDown(roomId, data.seatIndex, player);

      console.log(`✅ ${playerName} sat down at seat ${data.seatIndex}`);

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
        const validActions = engine.getValidActions(room, activePlayer.socketId);
        const bettingInfo = engine.getBettingInfo(room, activePlayer.socketId);
        io.to(activePlayer.socketId).emit('your-turn', {
          validActions,
          currentBet: room.gameState.currentBet,
          minRaise: bettingInfo.minBet,
          maxBet: bettingInfo.maxBet,
          betStructure: bettingInfo.betStructure,
          isCapped: bettingInfo.isCapped,
          raisesRemaining: bettingInfo.raisesRemaining,
          fixedBetSize: bettingInfo.fixedBetSize,
          timeout: 30000
        });
      }

      console.log(`🎮 Game started in room ${roomId}`);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // プレイヤーアクション
  socket.on('player-action', (data: { type: ActionType; amount?: number }) => {
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

      // アクションを処理
      const result = engine.processAction(room, {
        playerId: socket.id,
        type: data.type,
        amount: data.amount,
        timestamp: Date.now()
      });

      if (!result.success) {
        socket.emit('action-invalid', { reason: result.error });
        return;
      }

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
          const validActions = engine.getValidActions(room, nextPlayer.socketId);
          const bettingInfo = engine.getBettingInfo(room, nextPlayer.socketId);
          io.to(nextPlayer.socketId).emit('your-turn', {
            validActions,
            currentBet: room.gameState.currentBet,
            minRaise: bettingInfo.minBet,
            maxBet: bettingInfo.maxBet,
            betStructure: bettingInfo.betStructure,
            isCapped: bettingInfo.isCapped,
            raisesRemaining: bettingInfo.raisesRemaining,
            fixedBetSize: bettingInfo.fixedBetSize,
            timeout: 30000
          });
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

      // カード交換を実行
      const deck = engine.getDeck();
      const dealer = new Dealer();
      dealer.exchangeDrawCards(deck, player, data.discardIndexes);

      // 交換枚数を記録
      player.drawDiscards = data.discardIndexes.length;

      // ドロー完了をマーク
      engine.markDrawComplete(room, socket.id);

      console.log(`🔄 ${player.name} drew ${data.discardIndexes.length} cards`);

      // プレイヤーに新しい手札を送信
      io.to(socket.id).emit('draw-complete', {
        newHand: player.hand
      });

      // 全プレイヤーに交換枚数を通知（手札は見せない）
      io.to(`room:${roomId}`).emit('player-drew', {
        playerId: socket.id,
        playerName: player.name,
        cardCount: data.discardIndexes.length
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

  // 切断した時（既存のハンドラを拡張）
  socket.on('disconnect', () => {
    console.log('👋 Player disconnected:', socket.id);

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
                    const validActions = engine.getValidActions(room, nextPlayer.socketId);
                    const bettingInfo = engine.getBettingInfo(room, nextPlayer.socketId);
                    io.to(nextPlayer.socketId).emit('your-turn', {
                      validActions,
                      currentBet: room.gameState.currentBet,
                      minRaise: bettingInfo.minBet,
                      maxBet: bettingInfo.maxBet,
                      betStructure: bettingInfo.betStructure,
                      isCapped: bettingInfo.isCapped,
                      raisesRemaining: bettingInfo.raisesRemaining,
                      fixedBetSize: bettingInfo.fixedBetSize,
                      timeout: 30000
                    });
                  }
                }
              }
            }
          }

          // プレイヤーを離席させる
          roomManager.standUp(roomId, socket.id);
          io.to(`room:${roomId}`).emit('room-state-update', room);
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