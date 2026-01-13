# Level 3 & 4: ゲーム設定の動的変更とカード表示機能

## 実装日
2026-01-13

## 実装した機能

### Level 3: ゲーム設定の動的変更（シンプル版）

#### 目的
複数のポーカーバリアント（5-Card Draw, Texas Hold'em, Omaha, 7-Card Stud）に対応できるよう、手札枚数やゲームルールを動的に変更できる仕組みを構築する。

#### 実装内容

**サーバー側 (`server/index.ts`)**:
```typescript
interface GameSettings {
  handSize: number;        // 手札枚数（2〜7）
  allowRedraw: boolean;    // カード交換を許可するか
  gameMode: string;        // ゲームモード名
  visibleCards: number;    // 表向きにするカードの枚数
}

const GAME_PRESETS: Record<string, GameSettings> = {
  '5-card-draw': { 
    handSize: 5, 
    allowRedraw: true, 
    gameMode: '5-Card Draw',
    visibleCards: 0
  },
  'texas-holdem': { 
    handSize: 2, 
    allowRedraw: false, 
    gameMode: 'Texas Hold\'em',
    visibleCards: 0
  },
  'omaha': { 
    handSize: 4, 
    allowRedraw: false, 
    gameMode: 'Omaha',
    visibleCards: 0
  },
  '7-card-stud': { 
    handSize: 7, 
    allowRedraw: false, 
    gameMode: '7-Card Stud',
    visibleCards: 4
  }
};
```

**change-settingsイベント**:
- クライアントからプリセット名を受け取る
- `currentSettings` を更新
- 全プレイヤーに `settings-update` をブロードキャスト

**クライアント側 (`client/src/App.tsx`)**:
- ゲームモード選択ドロップダウン
- 設定変更時に手札をクリア

### Level 4-1: カード交換機能（Drawゲームの基礎）

#### 目的
5-Card Drawで「カードを捨てて、新しいカードと交換する」機能を実装する。

#### 実装内容

**サーバー側**:
```typescript
socket.on('exchange-cards', (data: { discardIndexes: number[] }) => {
  if (!currentSettings.allowRedraw) {
    socket.emit('error', { message: 'Card exchange not allowed in this mode' });
    return;
  }

  const player = gameState.players.find(p => p.id === socket.id);
  if (!player || !player.hand) return;

  const discardCount = data.discardIndexes.length;
  const deck = createDeck();
  const shuffledDeck = shuffle(deck);
  const newCards = shuffledDeck.slice(0, discardCount);

  data.discardIndexes.forEach((idx, i) => {
    if (player.hand && idx >= 0 && idx < player.hand.length) {
      player.hand[idx] = newCards[i];
    }
  });

  socket.emit('cards-dealt', { hand: player.hand });
});
```

**クライアント側**:
- カードをクリックで選択/解除（`selectedCards` state）
- 選択されたカードは黄色い枠でハイライト表示
- 「Exchange X Cards」ボタン（`allowRedraw=true` の時のみ表示）

### Level 4-2: 表向きカード機能（Studゲームの基礎）

#### 目的
7-Card Studのように、一部のカードを表向き（他のプレイヤーにも見える）にする機能を実装する。

#### 実装内容

**データモデルの拡張**:
```typescript
interface Card {
  suit: string;
  rank: string;
  faceUp?: boolean;  // 表向きかどうか
}
```

**サーバー側のdraw-cards修正**:
```typescript
const cardsWithVisibility: Card[] = hand.map((card, idx) => ({
  ...card,
  faceUp: idx < currentSettings.visibleCards
}));

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
```

**クライアント側**:
- `opponent-cards-update` イベントを受信
- `opponentCards` state で対戦相手のカードを管理
- 表向きカードはスート・ランクを表示
- 裏向きカードは🂠で表示

## 学んだこと

### 設計パターン
1. **設定オブジェクトパターン**: 複雑なGameEngineを使わず、シンプルな設定オブジェクトで管理することで、ts-nodeのモジュール解決問題を回避できた
2. **プリセットパターン**: よく使う設定を事前定義することで、ユーザビリティが向上

### Socket.ioのイベント設計
1. **broadcast vs emit**:
   - `socket.emit()`: 送信者のみに送信
   - `socket.broadcast.emit()`: 送信者以外の全員に送信
   - `io.emit()`: 全員に送信

2. **情報の制限**: サーバー権限主義（Server-Authoritative）の実装
   - 各プレイヤーには「見てよい情報」のみを送信
   - 裏向きのカードは他のプレイヤーに送信しない

### UIの状態管理
1. **選択状態の管理**: `selectedCards` を配列で管理し、`includes()` でトグル
2. **条件付きレンダリング**: `allowRedraw` の値に応じてUIを動的に表示/非表示

## 課題と今後の改善点

### 現在の制限事項
1. **表向きカードの配置**: 現在は最初のN枚を表向きにするシンプルな実装
   - 実際の7-Card Studは配布順序が異なる（最初2枚裏、次4枚表、最後1枚裏）
2. **デッキの使い回し**: カード交換時に新しいデッキを作成している
   - 実際は1つのデッキから配り続ける必要がある
3. **対戦相手カード表示UI**: 実装が未完成

### 次のステップ
1. 対戦相手のカード表示UIの完成
2. リシャッフル規則（デッキが足りなくなった時の処理）
3. 複数回交換（Triple Draw対応）
4.  BTN Anteシステム

## まとめ
Level 3とLevel 4の前半を通じて、ゲームバリアントの切り替えとDrawゲーム・Studゲームの基礎機能を実装できました。特に、シンプルな設定オブジェクトを使うことで、複雑なアーキテクチャを避けながら柔軟性を保つことができました。
