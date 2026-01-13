# Level 4: リシャッフル規則（Pattern C）

## 実装日
2026-01-13

## 目的
デッキのカードが不足した時に、捨て札を再利用する仕組みを実装する。

## 従来の問題点
```typescript
// 問題のあるコード（従来）
socket.on('draw-cards', () => {
  const deck = createDeck();  // 毎回新しいデッキを作成
  const shuffledDeck = shuffle(deck);
  const hand = shuffledDeck.slice(0, 5);
  // ...
});
```

**問題**:
- 各プレイヤーがカードを引くたびに新しいデッキ（52枚）を作成
- 同じカードが複数のプレイヤーに配られる可能性がある
- 本物のポーカーとは異なる動作

## 解決策：グローバルデッキ管理

### 1. DeckStateの定義
```typescript
interface DeckState {
  cards: Card[];      // 残りのカード
  discarded: Card[];  // 捨てられたカード
}

let deckState: DeckState = {
  cards: [],
  discarded: []
};
```

### 2. デッキ初期化
```typescript
const initializeDeck = () => {
  const deck = createDeck();
  deckState.cards = shuffle(deck);
  deckState.discarded = [];
  console.log(`🎴 Deck initialized: ${deckState.cards.length} cards`);
};
```

**呼び出しタイミング**:
- 最初のプレイヤーが参加した時
- 新しいラウンドが開始された時

### 3. 自動リシャッフル機能付きカード引き
```typescript
const drawCardsFromDeck = (count: number): Card[] => {
  // 不足している場合
  if (deckState.cards.length < count) {
    console.log(`⚠️ Deck insufficient. Reshuffling...`);
    
    // Pattern C: 捨て札とスタブを混ぜてリシャッフル
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
```

**動作**:
1. デッキに十分なカードがあるか確認
2. 不足している場合、捨て札とスタブを混ぜてシャッフル
3. 必要な枚数を引いてデッキから削除

### 4. 捨て札管理
```typescript
const discardCardsToDeck = (cards: Card[]) => {
  deckState.discarded.push(...cards);
  console.log(`🗑️ Discarded ${cards.length} cards. Total discarded: ${deckState.discarded.length}`);
};
```

## 実際の使用例

### draw-cardsイベント
```typescript
socket.on('draw-cards', () => {
  const player = gameState.players.find(p => p.id === socket.id);
  if (!player) return;

  // グローバルデッキから引く（リシャッフル機能付き）
  const hand = drawCardsFromDeck(currentSettings.handSize);
  
  const cardsWithVisibility: Card[] = hand.map((card, idx) => ({
    ...card,
    faceUp: idx < currentSettings.visibleCards
  }));

  player.hand = cardsWithVisibility;
  socket.emit('cards-dealt', { hand: cardsWithVisibility });
});
```

### exchange-cardsイベント（理想形）
```typescript
socket.on('exchange-cards', (data: { discardIndexes: number[] }) => {
  const player = gameState.players.find(p => p.id === socket.id);
  
  // 古いカードを収集
  const oldCards: Card[] = [];
  for (const idx of data.discardIndexes) {
    if (player.hand && player.hand[idx]) {
      oldCards.push(player.hand[idx]);
    }
  }
  
  // 捨て札に追加
  discardCardsToDeck(oldCards);
  
  // 新しいカードを引く
  const newCards = drawCardsFromDeck(data.discardIndexes.length);
  
  // 手札を更新
  data.discardIndexes.forEach((idx, i) => {
    if (player.hand) {
      player.hand[idx] = newCards[i];
    }
  });
  
  socket.emit('cards-dealt', { hand: player.hand });
});
```

## Pattern A/B/Cについて

進行の流れ.mdでは3つのパターンが定義されています：

- **Pattern A**: バーン1枚＋スタブ底1枚を除いて配れる場合（通常）
- **Pattern B**: スタブ不足でバーンを利用する場合
- **Pattern C**: 完全不足時のリシャッフル ← **今回実装**

Pattern Cは最もシンプルで、Drawゲームやカジュアルプレイには十分です。

## 動作確認の例

```
🎴 Deck initialized: 52 cards
🃏 Drew 5 cards. Remaining: 47
🃏 Drew 5 cards. Remaining: 42
🗑️ Discarded 3 cards. Total discarded: 3
🃏 Drew 3 cards. Remaining: 39
...
⚠️ Deck insufficient (2 < 5). Reshuffling 15 discarded cards...
✅ Deck reshuffled. New deck size: 17
🃏 Drew 5 cards. Remaining: 12
```

## 学んだこと

### グローバル状態管理
- 複数のプレイヤー間で共有されるリソース（デッキ）はグローバル変数で管理
- リシャッフルのタイミングを自動化することで、ロジックがシンプルになる

### splice() vs slice()
- **splice()**: 配列を変更し、削除した要素を返す（破壊的）
- **slice()**: 配列をコピーして返す（非破壊的）

デッキからカードを「引く」動作はsplice()を使うのが適切。

### スプレッド構文の活用
```typescript
const combined = [...deckState.cards, ...deckState.discarded];
```
複数の配列を簡単に結合できる。

## 今後の拡張案

1. **Pattern A/Bの実装**
   - バーンカード管理
   - スタブ底1枚の保護

2. **Exposed Cardsの除外**
   - フォールド時に表向きになったカードは再利用しない

3. **統計情報の追加**
   - リシャッフル回数のカウント
   - デッキ残量の表示

## まとめ
グローバルデッキ管理とPattern Cリシャッフルを実装することで、本物のポーカーに近い動作を実現できました。自動リシャッフル機能により、プレイ中にデッキ切れを心配する必要がなくなりました。
