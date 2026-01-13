import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { evaluateHand, compareHands } from './handEvaluator.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
// Socket.ioの設定 (CORS許可: どこからでも接続OKにする)
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // クライアントのURL
    methods: ["GET", "POST"]
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

  // 切断した時
  socket.on('disconnect', () => {
    console.log('👋 Player disconnected:', socket.id);

    // プレイヤーをゲームから削除
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    broadcastGameState();
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
});