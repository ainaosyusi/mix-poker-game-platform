# Mix Poker App - アーキテクチャ設計書

> 作成日: 2026-01-28
> 目的: リファクタリング前のシステム全体像の整理

---

## 1. システム概要

### 1.1 アーキテクチャパターン

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ AuthScreen  │→ │  MainMenu    │→ │ RoomSelect   │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│                                            ↓                  │
│                    ┌────────────────────────────────┐        │
│                    │      Table (Game Screen)       │        │
│                    │  - PokerTable                  │        │
│                    │  - PlayerSeat × 6              │        │
│                    │  - ActionPanel                 │        │
│                    │  - GameLog                     │        │
│                    └────────────────────────────────┘        │
│                              ↕ Socket.IO                      │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket + REST API
┌─────────────────────────────────────────────────────────────┐
│                      Server (Node.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Express      │  │ Socket.IO    │  │ Prisma ORM   │      │
│  │ - Auth API   │  │ - Events     │  │ - User model │      │
│  │ - Health     │  │ - Rooms      │  └──────────────┘      │
│  │ - Static     │  │ - Game       │         ↓               │
│  └──────────────┘  └──────────────┘  ┌──────────────┐      │
│                           ↓           │ PostgreSQL   │      │
│  ┌─────────────────────────────────┐ └──────────────┘      │
│  │      Core Game Modules          │                        │
│  │  - RoomManager                  │                        │
│  │  - GameEngine (per room)        │                        │
│  │  - Dealer                       │                        │
│  │  - ShowdownManager              │                        │
│  │  - ActionValidator              │                        │
│  │  - PotManager                   │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 主要コンポーネント

| コンポーネント | 役割 | ライフサイクル |
|-------------|------|-------------|
| **RoomManager** | 全ルームの管理、プリセットルーム初期化 | サーバー起動時に生成、プロセス終了まで存続 |
| **GameEngine** | 1ルームのゲーム進行制御 | ルーム作成時に生成、ルーム削除時に破棄 |
| **Dealer** | カード配布、デッキ管理 | GameEngineの一部として存在 |
| **ShowdownManager** | ショーダウン処理（共有） | サーバー起動時に1インスタンス生成 |
| **Socket** | クライアント接続 | クライアント接続時に生成、切断時に破棄 |

---

## 2. データフロー

### 2.1 認証フロー

```
Client                          Server                      Database
  │                               │                            │
  │ POST /api/auth/register       │                            │
  ├──────────────────────────────>│                            │
  │                               │ INSERT INTO User           │
  │                               ├───────────────────────────>│
  │                               │<───────────────────────────┤
  │                               │ bcrypt.hash(password)      │
  │                               │ jwt.sign({userId, ...})    │
  │<──────────────────────────────┤                            │
  │ { token, user }               │                            │
  │                               │                            │
  │ localStorage.setItem(token)   │                            │
  │                               │                            │
  │ io(url, { auth: { token }})   │                            │
  ├──────────────────────────────>│                            │
  │                               │ jwt.verify(token)          │
  │                               │ socket.data.user = {...}   │
  │<──────────────────────────────┤                            │
  │ 'connect' event               │                            │
```

### 2.2 ルーム参加フロー（quick-join）

```
Client                          Server (index.ts)           RoomManager
  │                               │                            │
  │ emit('quick-join',            │                            │
  │   {roomId, buyIn})            │                            │
  ├──────────────────────────────>│                            │
  │                               │ getRoomById(roomId)        │
  │                               ├───────────────────────────>│
  │                               │<───────────────────────────┤
  │                               │ room                       │
  │                               │                            │
  │                               │ ❌ 既存セッションチェック    │
  │                               │ (userId/socketIdで検索)     │
  │                               │ → 既存プレイヤー削除        │
  │                               │                            │
  │                               │ findRandomEmptySeat()      │
  │                               │ → seatIndex                │
  │                               │                            │
  │                               │ room.players[seatIndex] =  │
  │                               │   new Player(...)          │
  │                               │                            │
  │                               │ socket.join(`room:${id}`)  │
  │                               │                            │
  │<──────────────────────────────┤                            │
  │ emit('room-joined',           │                            │
  │   {room, yourSocketId})       │                            │
  │                               │                            │
  │<──────────────────────────────┤                            │
  │ emit('sit-down-success')      │                            │
  │                               │                            │
  │                               │ io.to('room:id').emit(     │
  │                               │   'room-state-update', room│
  │                               │ )                          │
```

### 2.3 ゲーム開始フロー（自動開始）

```
Server (index.ts)              GameEngine                 Dealer
  │                               │                         │
  │ scheduleNextHand(roomId)      │                         │
  ├──────────────────────────────>│                         │
  │                               │                         │
  │ (2秒後)                        │                         │
  │                               │                         │
  │ gameEngine.startHand(room)    │                         │
  ├──────────────────────────────>│                         │
  │                               │ dealer.moveButton(room) │
  │                               ├────────────────────────>│
  │                               │ dealer.collectBlinds()  │
  │                               ├────────────────────────>│
  │                               │ dealer.dealHoleCards()  │
  │                               ├────────────────────────>│
  │                               │<────────────────────────┤
  │                               │ deck, hands             │
  │                               │                         │
  │                               │ room.gameState.status = │
  │                               │   'PREFLOP'             │
  │                               │                         │
  │<──────────────────────────────┤                         │
  │ { room }                      │                         │
  │                               │                         │
  │ io.to('room:id').emit(        │                         │
  │   'game-started', {room}      │                         │
  │ )                             │                         │
  │                               │                         │
  │ players.forEach(p =>          │                         │
  │   socket.to(p.socketId).emit( │                         │
  │     'game-started',           │                         │
  │     {room, yourHand: p.hand}  │                         │
  │   )                           │                         │
  │ )                             │                         │
```

---

## 3. 状態管理

### 3.1 サーバー側の状態

| 状態 | スコープ | 保存場所 | 説明 |
|------|---------|---------|------|
| **rooms** | グローバル | `RoomManager.rooms: Map<roomId, Room>` | 全ルームの状態 |
| **gameEngines** | グローバル | `gameEngines: Map<roomId, GameEngine>` | ルームごとのゲームエンジン |
| **socket.data.user** | ソケット | Socket.IO内部 | 接続中のユーザー情報 |
| **socket.rooms** | ソケット | Socket.IO内部 | 参加中のルーム一覧 |
| **activeTimers** | グローバル | `Map<playerId, Timer>` | アクションタイマー |

### 3.2 クライアント側の状態（Table.tsx）

| 状態 | 型 | 更新タイミング | 説明 |
|------|-----|-------------|------|
| `room` | `Room \| null` | `room-state-update` | ルーム全体の状態 |
| `yourHand` | `string[]` | `game-started`, `draw-complete` | 自分の手札 |
| `yourSocketId` | `string` | props（App.tsxから） | 自分のSocket ID |
| `isYourTurn` | `boolean` | `your-turn` | 自分のターンか |
| `validActions` | `ActionType[]` | `your-turn` | 実行可能なアクション |
| `showdownResult` | `ShowdownResult \| null` | `showdown-result` | ショーダウン結果 |
| `actionToken` | `string \| null` | `your-turn` | アクショントークン |

---

## 4. Socket.IOイベント

### 4.1 クライアント → サーバー

| イベント | ペイロード | 処理フロー |
|---------|----------|----------|
| `quick-join` | `{roomId, buyIn}` | 既存セッション削除 → 空席検索 → プレイヤー作成 → ルーム参加 |
| `leave-room` | なし | `handleRoomExit()` 呼び出し |
| `player-action` | `{type, amount?, actionToken?}` | `gameEngine.processAction()` → `processPostAction()` |
| `draw-exchange` | `{discardIndices}` | カード交換 → `gameEngine.checkDrawPhaseComplete()` |

### 4.2 サーバー → クライアント

| イベント | ペイロード | 送信タイミング | 受信側の処理 |
|---------|----------|-------------|------------|
| `room-joined` | `{room, yourSocketId, yourHand?}` | `quick-join`成功時 | ルーム状態を初期化 |
| `room-state-update` | `Room` | プレイヤー着席/退出/アクション後 | `setRoom()` |
| `game-started` | `{room, yourHand}` | ハンド開始時 | ハンド開始、`showdownResult`クリア |
| `your-turn` | `{validActions, ...}` | プレイヤーのターン時 | アクションパネル表示 |
| `showdown-result` | `ShowdownResult` | ショーダウン完了時 | 結果表示 |

---

## 5. プレイヤーライフサイクル

### 5.1 状態遷移図

```
[未接続]
   ↓ Socket.IO接続
[接続済み（ロビー）]
   ↓ quick-join
[着席（WAITING）]
   ↓ ゲーム開始
[ACTIVE（ハンド中）]
   ↓ フォールド/オールイン
[FOLDED / ALL_IN]
   ↓ ハンド終了
[WAITING]
   ↓ leave-room / disconnect
[退出処理中]
   ↓ cleanupPendingLeavers()
[削除完了]
```

### 5.2 Player型の状態フラグ

| フラグ | 型 | 説明 | 設定タイミング |
|-------|-----|------|-------------|
| `status` | `PlayerStatus` | プレイヤーの状態 | ゲーム進行中に変化 |
| `pendingLeave` | `boolean` | 退出待ち | ハンド中に`leave-room` |
| `disconnected` | `boolean` | 切断中 | `disconnect`イベント |
| `pendingJoin` | `boolean` | 参加待ち | BB待ち時 |
| `waitingForBB` | `boolean` | BB待ち | ハンド途中参加時 |

---

## 6. ゲーム進行ロジック

### 6.1 GameEngine.processAction()

```
processAction(room, action)
  │
  ├─ actionValidator.validate(room, action)
  │    ↓ ❌ 無効
  │    return { success: false }
  │
  ├─ player.bet += amount
  ├─ room.gameState.pot += amount
  ├─ player.status = 'FOLDED' | 'ACTIVE' | 'ALL_IN'
  │
  ├─ 次のプレイヤーを決定
  │    getNextActivePlayer(room, currentIndex)
  │
  ├─ ベッティングラウンド完了判定
  │    ↓ 全員アクション完了
  │    nextStreet(room)
  │       ├─ communityCardType === 'flop' → nextFlopStreet()
  │       ├─ communityCardType === 'stud' → nextStudStreet()
  │       └─ hasDrawPhase === true → nextDrawStreet()
  │
  └─ return { success: true, room }
```

### 6.2 nextStreet() の分岐

```
nextStreet(room)
  │
  ├─ variantConfig = getVariantConfig(room.gameState.gameVariant)
  │
  ├─ if (variantConfig.communityCardType === 'stud')
  │    └─ nextStudStreet(room)
  │         ├─ dealer.dealStudStreet(deck, players, isLastStreet)
  │         ├─ room.gameState.phase = FOURTH_STREET | ... | SEVENTH_STREET
  │         └─ getStudActionStartIndex(room) → 最強/最弱ボード
  │
  ├─ else if (variantConfig.hasDrawPhase)
  │    └─ nextDrawStreet(room)
  │         ├─ room.gameState.phase = FIRST_DRAW | SECOND_DRAW | THIRD_DRAW
  │         ├─ drawCompletionStatus = {} (プレイヤーごとのドロー完了状態)
  │         └─ 全員ドロー完了後にベッティングラウンド
  │
  └─ else
       └─ nextFlopStreet(room)
            ├─ boardPattern = variantConfig.boardPattern (例: [3,1,1])
            ├─ dealer.dealBoardCards(deck, boardPattern[streetIndex])
            └─ room.gameState.phase = FLOP | TURN | RIVER
```

---

## 7. 既知のバグと原因

### 7.1 ゴーストプレイヤー問題

**症状**: ブラウザバック後、過去の自分が残り続ける

**原因**:
1. `leave-room`が送信されない（解決済み）
2. `quick-join`時に同一ユーザーの古いセッションを検出できない
3. `userId`による重複チェックが不完全

**現在の対策コード** (`server/index.ts:724-752`):
```typescript
const existingPlayerIndex = room.players.findIndex(p => {
  if (!p) return false;
  if (p.socketId === socket.id) return true;
  if (user?.userId && p.userId === user.userId) return true;
  return false;
});

if (existingPlayerIndex !== -1) {
  // 既存プレイヤーを削除（古いセッション）
  room.players[existingPlayerIndex] = null;
}
```

**問題点**: タイミングによって古いセッションが完全に削除される前に新しいセッションが作成される

---

### 7.2 プレイヤー消失バグ（重大）

**症状**:
- 2人プレイ時、ハンドが配られた瞬間に一方が消える
- 消えた側の画面が残った側のプレイヤー画面に切り替わる
- 勝敗が一瞬で決まる

**推測される原因**:
1. **useEffect依存配列の問題**:
   - `actionToken`更新時にクリーンアップ関数が実行される（解決済み）
   - しかし別の箇所でも同様の問題がある可能性

2. **Socket IDの混同**:
   - `yourSocketId`が誤って他プレイヤーのIDに更新される
   - `room-state-update`時に`yourSocketId`が変更される？

3. **二重接続**:
   - 同じユーザーが2つのSocket接続を持っている
   - 片方の接続でイベントを受信している

4. **sanitizeRoomForViewer()の問題**:
   - 他プレイヤーの手札が見えてしまう
   - `yourSocketId`の判定が誤っている

**デバッグに必要な情報**:
- クライアント側のSocket ID (`socket.id`)
- サーバー側が認識しているSocket ID
- `room-state-update`イベントの送信先
- 各プレイヤーの`socket.rooms`の内容

---

### 7.3 leave-roomのタイミング問題

**症状**: `actionToken`更新時に`leave-room`が送信される

**原因**: useEffectのクリーンアップ関数が依存配列更新時に実行される

**修正内容** (commit b3e7d90):
```typescript
// 修正前: actionToken更新時にもクリーンアップ実行
useEffect(() => {
  // ... イベントリスナー登録
  return () => {
    socket.emit('leave-room'); // ❌ actionToken更新時にも実行される
    socket.off(...);
  };
}, [socket, actionToken]);

// 修正後: 別のuseEffectでアンマウント時のみ実行
useEffect(() => {
  return () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room'); // ✅ アンマウント時のみ
    }
  };
}, []); // 空の依存配列
```

**残存問題**: まだプレイヤー消失が発生している → 別の原因がある

---

## 8. リファクタリング推奨事項

### 8.1 優先度：高

1. **Socket ID管理の一元化**
   - `yourSocketId`をAppレベルで管理
   - Propsで渡さず、Contextで共有
   - Socket IDの変更を検知してログ出力

2. **プレイヤーセッション管理の改善**
   - `userId`ベースのセッション管理
   - 古いセッションの強制切断
   - 再接続時の座席復帰ロジック

3. **イベントハンドラーのクリーンアップ**
   - useEffectの依存配列を最小限に
   - イベントリスナーの登録/解除を分離
   - クリーンアップ関数の実行タイミングを明確化

### 8.2 優先度：中

4. **状態管理の改善**
   - Zustandまたはjotai導入
   - グローバル状態（socket, user, room）をContextから移行
   - ローカル状態（UI関連）を分離

5. **エラーハンドリング強化**
   - Socket切断時の自動再接続
   - タイムアウト処理の改善
   - エラーバウンダリーの追加

### 8.3 優先度：低

6. **テストの追加**
   - Socket.IOイベントのユニットテスト
   - GameEngineのロジックテスト
   - E2Eテスト（Playwright）

7. **パフォーマンス改善**
   - `room-state-update`の送信頻度削減
   - 差分更新の実装
   - メモ化の活用

---

## 9. デバッグ手順

### 9.1 現在のバグを特定するための手順

1. **ログ追加**:
   ```typescript
   // client/src/App.tsx
   socket.on('connect', () => {
     console.log('[Client] Socket connected:', socket.id);
   });

   // client/src/Table.tsx
   useEffect(() => {
     console.log('[Table] Mounted, yourSocketId:', yourSocketId);
     console.log('[Table] socket.id:', socket?.id);
     return () => {
       console.log('[Table] Unmounting, emitting leave-room');
     };
   }, []);

   socket.on('room-state-update', (room) => {
     console.log('[Table] room-state-update, yourSocketId:', yourSocketId);
     console.log('[Table] socket.id:', socket.id);
   });
   ```

2. **サーバー側ログ追加**:
   ```typescript
   // server/index.ts
   socket.on('quick-join', (data) => {
     console.log('[Server] quick-join:', {
       socketId: socket.id,
       userId: socket.data?.user?.userId,
       roomId: data.roomId
     });
   });

   io.to(`room:${roomId}`).emit('room-state-update', room);
   console.log('[Server] room-state-update sent to room:', roomId);
   console.log('[Server] Sockets in room:',
     await io.in(`room:${roomId}`).fetchSockets()
       .then(s => s.map(x => x.id))
   );
   ```

3. **ブラウザ開発者ツール**:
   - Console タブでSocket IDを追跡
   - Network タブでSocket.IO通信を確認
   - Application タブでlocalStorageのトークン確認

---

## 10. 次のステップ

### 10.1 即座に実施すべきこと

1. ✅ このドキュメント作成
2. ⏳ デバッグログ追加（上記9.1の手順）
3. ⏳ 2人プレイでログ収集
4. ⏳ 根本原因の特定
5. ⏳ 修正とテスト

### 10.2 リファクタリング計画

1. バグ修正完了後、設計書ベースでリファクタリング
2. 段階的な改善（一度に全てを変更しない）
3. 各段階でテスト実施
4. ドキュメントの更新

---

**END OF ARCHITECTURE.md**
