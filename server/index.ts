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

// Phase 3-B: ゲームエンジンインスタンス（部屋ごとに管理）
const gameEngines: Map<string, GameEngine> = new Map();
const showdownManager = new ShowdownManager();
const actionValidator = new ActionValidator();

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: CLIENT_URL,
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
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// カードの型の定義
interface Card {
  suit: string;
  rank: string;
  faceUp?: boolean; // 表向きかどうか（省略時はfalse）
}

// プレイヤーの型の定義
interface Player {
  id: string;
  name: string;
  chips: number;
  bet: number;
  status: 'active' | 'folded' | 'waiting';
  hand?: Card[]; // プレイヤーの手札
}

// ゲームステート
interface GameState {
  players: Player[];
  pot: number;
  currentTurn: number; // プレイヤー配列のインデックス
  currentBet: number; // コールするために必要な額
}

// グローバルなゲームステート
let gameState: GameState = {
  players: [],
  pot: 0,
  currentTurn: 0,
  currentBet: 0
};

// ゲーム設定の型定義
interface GameSettings {
  handSize: number;        // 手札枚数（2〜7）
  allowRedraw: boolean;    // カード交換を許可するか
  gameMode: string;        // ゲームモード名
  visibleCards: number;    // 表向きにするカードの枚数
}

// プリセット設定
const GAME_PRESETS: Record<string, GameSettings> = {
  '5-card-draw': { handSize: 5, allowRedraw: true, gameMode: '5-Card Draw', visibleCards: 0 },
  'texas-holdem': { handSize: 2, allowRedraw: false, gameMode: 'Texas Hold\'em', visibleCards: 0 },
  'omaha': { handSize: 4, allowRedraw: false, gameMode: 'Omaha', visibleCards: 0 },
  '7-card-stud': { handSize: 7, allowRedraw: false, gameMode: '7-Card Stud', visibleCards: 4 }
};

// デフォルト設定
const defaultSettings: GameSettings = {
  handSize: 5,
  allowRedraw: false,
  gameMode: '5-Card Draw',
  visibleCards: 0
};

// 現在の設定
let currentSettings: GameSettings = { ...defaultSettings };

// デッキ状態（リシャッフル管理）
interface DeckState {
  cards: Card[];      // 残りのカード
  discarded: Card[];  // 捨てられたカード
}

let deckState: DeckState = {
  cards: [],
  discarded: []
};

// デッキ（山札）を作る関数
const createDeck = (): Card[] => {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

// シャッフルする関数 (Fisher-Yates Shuffle)
const shuffle = (deck: Card[]): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// デッキを初期化（新しいラウンド開始時）
const initializeDeck = () => {
  const deck = createDeck();
  deckState.cards = shuffle(deck);
  deckState.discarded = [];
  console.log(`🎴 Deck initialized: ${deckState.cards.length} cards`);
};

// デッキからカードを引く（不足時は自動リシャッフル）
const drawCardsFromDeck = (count: number): Card[] => {
  // 不足している場合
  if (deckState.cards.length < count) {
    console.log(`⚠️ Deck insufficient (${deckState.cards.length} < ${count}). Reshuffling ${deckState.discarded.length} discarded cards...`);

    // 捨て札とスタブを混ぜてリシャッフル (Pattern C)
    const combined = [...deckState.cards, ...deckState.discarded];
    deckState.cards = shuffle(combined);
    deckState.discarded = [];

    console.log(`✅ Deck reshuffled. New deck size: ${deckState.cards.length}`);
  }

  // カードを引く
  const drawnCards = deckState.cards.splice(0, count);
  console.log(`🃏 Drew ${drawnCards.length} cards. Remaining: ${deckState.cards.length}`);
  return drawnCards;
};

// カードを捨て札に追加
const discardCardsToDeck = (cards: Card[]) => {
  deckState.discarded.push(...cards);
  console.log(`🗑️ Discarded ${cards.length} cards. Total discarded: ${deckState.discarded.length}`);
};

// ゲームステートをブロードキャスト
const broadcastGameState = () => {
  io.emit('game-state-update', gameState);
};

// 次のプレイヤーにターンを移す
const nextTurn = () => {
  const activePlayers = gameState.players.filter(p => p.status === 'active');
  if (activePlayers.length <= 1) {
    // ゲーム終了（1人しか残っていない）
    return;
  }

  do {
    gameState.currentTurn = (gameState.currentTurn + 1) % gameState.players.length;
  } while (gameState.players[gameState.currentTurn].status !== 'active');
};

// プレイヤーが接続してきた時の処理
io.on('connection', (socket) => {
  console.log('🔥 Player connected! ID:', socket.id);

  // 接続した人に挨拶を送る
  socket.emit('welcome', {
    message: 'Server is Online!',
    id: socket.id
  });

  // プレイヤー参加
  socket.on('player-join', (data: { name: string }) => {
    const newPlayer: Player = {
      id: socket.id,
      name: data.name || `Player${gameState.players.length + 1}`,
      chips: 100, // 初期チップ
      bet: 0,
      status: 'active'
    };

    gameState.players.push(newPlayer);
    console.log(`✅ ${newPlayer.name} joined the game with 100 chips`);

    // 最初のプレイヤーが参加した時にデッキを初期化
    if (gameState.players.length === 1) {
      initializeDeck();
    }

    broadcastGameState();
  });

  // 設定変更
  socket.on('change-settings', (data: { preset?: string; handSize?: number }) => {
    if (data.preset && GAME_PRESETS[data.preset]) {
      currentSettings = { ...GAME_PRESETS[data.preset] };
      console.log(`🎮 Game mode changed to: ${currentSettings.gameMode}`);
    } else if (data.handSize && data.handSize >= 2 && data.handSize <= 5) {
      currentSettings.handSize = data.handSize;
      currentSettings.gameMode = `Custom (${data.handSize} cards)`;
      console.log(`🎮 Hand size changed to: ${currentSettings.handSize}`);
    }

    // 設定変更を全プレイヤーに通知
    io.emit('settings-update', currentSettings);

    // 手札をリセット
    gameState.players.forEach(p => p.hand = undefined);
    broadcastGameState();
  });

  // ベットアクション
  socket.on('player-bet', (data: { amount: number }) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.status !== 'active') return;

    const betAmount = Math.min(data.amount, player.chips);
    player.chips -= betAmount;
    player.bet += betAmount;
    gameState.pot += betAmount;
    gameState.currentBet = Math.max(gameState.currentBet, player.bet);

    console.log(`💰 ${player.name} bet ${betAmount} chips`);

    nextTurn();
    broadcastGameState();
  });

  // コールアクション
  socket.on('player-call', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.status !== 'active') return;

    const callAmount = Math.min(gameState.currentBet - player.bet, player.chips);
    player.chips -= callAmount;
    player.bet += callAmount;
    gameState.pot += callAmount;

    console.log(`📞 ${player.name} called ${callAmount} chips`);

    nextTurn();
    broadcastGameState();
  });

  // フォールドアクション
  socket.on('player-fold', () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.status !== 'active') return;

    player.status = 'folded';
    console.log(`🚫 ${player.name} folded`);

    nextTurn();
    broadcastGameState();
  });

  // 「カードを引く」リクエストが来た時の処理
  socket.on('draw-cards', () => {
    console.log(`🃏 Player ${socket.id} is drawing cards...`);
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;

    // グローバルデッキからカードを引く（リシャッフル機能付き）
    const hand = drawCardsFromDeck(currentSettings.handSize);

    // visibleCardsの枚数だけ表向きにする
    const cardsWithVisibility: Card[] = hand.map((card, idx) => ({
      ...card,
      faceUp: idx < currentSettings.visibleCards
    }));

    // プレイヤーの手札を保存
    player.hand = cardsWithVisibility;

    // 自分には全てのカードを送信
    socket.emit('cards-dealt', { hand: cardsWithVisibility });

    // 他のプレイヤーには表向きのカードのみ送信
    socket.broadcast.emit('opponent-cards-update', {
      playerId: socket.id,
      playerName: player.name,
      visibleCards: cardsWithVisibility.filter(c => c.faceUp),
      totalCards: cardsWithVisibility.length
    });
  });

  // カード交換（Drawゲーム用）
  socket.on('exchange-cards', (data: { discardIndexes: number[] }) => {
    // 現在の設定でallowRedrawがtrueの時のみ有効
    if (!currentSettings.allowRedraw) {
      socket.emit('error', { message: 'Card exchange not allowed in this mode' });
      return;
    }

    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || !player.hand) {
      console.log('⚠️ Player or hand not found for exchange');
      return;
    }

    console.log(`🔄 ${player.name} exchanging ${data.discardIndexes.length} cards`);

    // 捨てるカードのインデックスを受け取る
    const discardCount = data.discardIndexes.length;

    // デッキから新しいカードを引く
    const deck = createDeck();
    const shuffledDeck = shuffle(deck);
    const newCards = shuffledDeck.slice(0, discardCount);

    // 捨てたカードを新しいカードに置き換える
    data.discardIndexes.sort((a, b) => a - b); // インデックスをソート
    data.discardIndexes.forEach((idx, i) => {
      if (player.hand && idx >= 0 && idx < player.hand.length) {
        player.hand[idx] = newCards[i];
      }
    });

    // 更新された手札をクライアントに送信
    socket.emit('cards-dealt', { hand: player.hand });
    console.log(`✅ ${player.name} received ${data.discardIndexes.length} new cards`);
  });

  // ショーダウン
  socket.on('showdown', () => {
    console.log('🎰 Showdown initiated!');

    // アクティブなプレイヤー（手札を持っている）を集める
    const activePlayers = gameState.players.filter(p =>
      p.status === 'active' && p.hand && p.hand.length === 5
    );

    if (activePlayers.length === 0) {
      console.log('⚠️ No players with hands for showdown');
      return;
    }

    // 各プレイヤーの役を評価
    const results = activePlayers.map(player => ({
      player,
      handRank: evaluateHand(player.hand!)
    }));

    // 最も強い役を見つける
    let winner = results[0];
    for (let i = 1; i < results.length; i++) {
      if (compareHands(results[i].player.hand!, winner.player.hand!) > 0) {
        winner = results[i];
      }
    }

    // 勝者にポットを配分
    winner.player.chips += gameState.pot;
    console.log(`🏆 ${winner.player.name} wins ${gameState.pot} chips with ${winner.handRank.name}!`);

    // ショーダウン結果をブロードキャスト
    io.emit('showdown-result', {
      winner: {
        id: winner.player.id,
        name: winner.player.name,
        hand: winner.player.hand,
        handRank: winner.handRank.name,
        wonChips: gameState.pot
      },
      allHands: results.map(r => ({
        playerId: r.player.id,
        playerName: r.player.name,
        hand: r.player.hand,
        handRank: r.handRank.name
      }))
    });

    // ゲームステートをリセット（新ラウンド準備）
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.players.forEach(p => {
      p.bet = 0;
      p.hand = undefined;
      if (p.status !== 'folded') {
        p.status = 'active';
      }
    });

    broadcastGameState();
  });

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
        const showdownResult = showdownManager.executeShowdown(room);
        io.to(`room:${roomId}`).emit('showdown-result', showdownResult);
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

    // 既存のロジック（プレイヤーをゲームから削除）
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    broadcastGameState();
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
});