import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { evaluateHand, compareHands } from './handEvaluator.js';
import { roomManager } from './RoomManager.js';
import { GameEngine } from './GameEngine.js';
import { ShowdownManager } from './ShowdownManager.js';
import { ActionValidator } from './ActionValidator.js';
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

// Phase 3-B: ゲームエンジンインスタンス（部屋ごとに管理）
const gameEngines: Map<string, GameEngine> = new Map();
const showdownManager = new ShowdownManager();
const actionValidator = new ActionValidator();

const app = express();
// 開発環境では複数のポートを許可
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.CLIENT_URL
].filter(Boolean);

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

  // 着席
  socket.on('sit-down', (data: SitDownRequest) => {
    try {
      // 現在参加している部屋を特定（Socket.IOルームから）
      const roomId = Array.from(socket.rooms).find(r => r.startsWith('room:'))?.slice(5);

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
      const roomId = Array.from(socket.rooms).find(r => r.startsWith('room:'))?.slice(5);
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
        io.to(activePlayer.socketId).emit('your-turn', {
          validActions,
          currentBet: room.gameState.currentBet,
          minRaise: room.gameState.minRaise,
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
      const roomId = Array.from(socket.rooms).find(r => r.startsWith('room:'))?.slice(5);
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

        let showdownResult;
        if (activePlayers.length === 1) {
          // 1人しか残っていない（他全員フォールド）
          showdownResult = showdownManager.awardToLastPlayer(room);
        } else {
          // ショーダウン実行
          showdownResult = showdownManager.executeShowdown(room);
        }

        io.to(`room:${roomId}`).emit('showdown-result', showdownResult);

        // 7-2ゲームボーナスチェック
        const metaGameMgr = new MetaGameManager();
        if (showdownResult.winners.length > 0) {
          for (const winner of showdownResult.winners) {
            const bonus = metaGameMgr.checkSevenDeuce(room, winner.playerId, winner.hand);
            if (bonus) {
              io.to(`room:${roomId}`).emit('seven-deuce-bonus', bonus);
              console.log(`🎲 7-2 BONUS: ${winner.playerName} wins ${bonus.amount}`);
            }
          }
        }

        // ローテーションチェック
        const rotationMgr = new RotationManager();
        const rotation = rotationMgr.checkRotation(room);
        if (rotation.changed) {
          console.log(`🔄 Next game: ${rotation.nextGame}`);
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
          const validActions = engine.getValidActions(room, nextPlayer.socketId);
          io.to(nextPlayer.socketId).emit('your-turn', {
            validActions,
            currentBet: room.gameState.currentBet,
            minRaise: room.gameState.minRaise,
            timeout: 30000
          });
        }
      }

    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // 離席
  socket.on('leave-seat', () => {
    try {
      // 現在参加している部屋を特定
      const roomId = Array.from(socket.rooms).find(r => r.startsWith('room:'))?.slice(5);

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
        roomManager.standUp(roomId, socket.id);
        const room = roomManager.getRoomById(roomId);
        if (room) {
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