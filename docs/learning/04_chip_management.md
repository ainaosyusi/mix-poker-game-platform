# 学習ノート 04: チップ管理システムの実装

## 背景
ポーカーの核心である「ベット」を実装しました。
プレイヤーがチップを持ち、ベット・コール・フォールドのアクションを行いながらターン制で進行するシステムです。

## 実装のポイント

### 1. サーバー側：ゲームステートの一元管理
ゲーム全体の状態をサーバーで管理し、クライアントには「見せてよい情報だけ」を送信します。

```typescript
interface GameState {
  players: Player[];
  pot: number;
  currentTurn: number; // 誰のターンか
  currentBet: number; // コールするために必要な額
}
```

各プレイヤーのアクション（ベット、コール、フォールド）を受け取るたびに、ゲームステートを更新し、全員にブロードキャストします。

### 2. ターン管理
`currentTurn` でターンを管理し、アクションが実行されるたびに `nextTurn()` 関数で次のプレイヤーに移ります。

```typescript
const nextTurn = () => {
  do {
    gameState.currentTurn = (gameState.currentTurn + 1) % gameState.players.length;
  } while (gameState.players[gameState.currentTurn].status !== 'active');
};
```

フォールドしたプレイヤーはスキップされます。

### 3. クライアント側：動的UI
自分のターンかどうかで、ボタンの有効/無効を切り替えます。

```typescript
const isMyTurn = gameState && gameState.players[gameState.currentTurn]?.id === myId;
```

自分のターンの時だけ、ベット・コール・フォールドボタンが表示されます。

## 検証手順（手動）

ブラウザを2つ開いて、以下の手順で動作確認できます：

1. **ブラウザ1**: `http://localhost:5173` を開く
2. "Connect to Server" → 名前入力（例: Player1）→ "Join Game"
3. **ブラウザ2**: 新しいタブで `http://localhost:5173` を開く
4. "Connect to Server" → 名前入力（例: Player2）→ "Join Game"
5. **ブラウザ1**（Player1のターン）: ベット額を入力して "Bet" ボタンをクリック
6. **ブラウザ2**（Player2のターン）: "Call" ボタンをクリック
7. ポットに両プレイヤーのベット額が反映されることを確認

## 学び
- **ステート管理**: サーバーが「唯一の真実の源（Single Source of Truth）」となることで、クライアント間の同期問題を回避できる。
- **イベント駆動**: Socket.io の `emit` と `on` でリアルタイムにゲームステートを同期できる。
- **条件付きUI**: React の三項演算子 `{isMyTurn ? ... : ...}` で、状態に応じたUIを簡潔に記述できる。
