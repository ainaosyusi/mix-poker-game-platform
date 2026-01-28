# Mix Poker App - 既知のバグと問題分析

> 作成日: 2026-01-28
> 目的: 現在発生している全てのバグの原因分析と修正方針

---

## 🔴 Critical Bugs（重大なバグ）

### ✅ Bug #1: プレイヤー消失とSocket ID混同【修正済み】

**症状**:
- 2人プレイ時、ハンドが配られた直後に一方のプレイヤーが消える
- 消えたプレイヤーの画面が、残ったプレイヤーの操作画面に切り替わる
- 勝敗が一瞬で決まり、不戦勝になる

**再現手順**:
1. 端末A（ainao2）でログイン → NLH 1/2に参加
2. 端末B（Sumaho）でログイン → 同じルームに参加
3. 2秒後にゲームが自動開始
4. ハンドが配られる
5. **一方が消えて、もう一方の不戦勝になる**

**ログ出力**:
```
🎴 Starting new hand #4
💰 Blinds collected: SB=1 (seat 3), BB=2 (seat 0)
✅ Hand started. Active player: seat 3
🎮 Auto-started game in room nlh-1-2
🎯 Sumaho -> FOLD  ← ❌ 実際にはアクションしていない
🏁 Hand #4 ended
🏆 ainao2 wins 3 (others folded)
👋 Player disconnected: utG7uVLWOylH8_LjAAAT  ← ❌ 切断していない
```

**推測される原因**:

#### 原因A: `yourSocketId` Propsの不整合

```typescript
// App.tsx
const [myId, setMyId] = useState('');

socket.on('connect', () => {
  setMyId(socket.id || '');  // ← Socket接続時に更新
});

// Table.tsx に渡される
<Table
  socket={socketRef.current}
  yourSocketId={myId}  // ← この値が古い可能性
  ...
/>
```

**問題点**:
- Socket再接続時に`socket.id`が変わる
- `setMyId()`の更新タイミングとTableコンポーネントのレンダリングタイミングのズレ
- Tableコンポーネントが古い`yourSocketId`を使い続ける

**検証方法**:
```typescript
// Table.tsx内で追加
useEffect(() => {
  console.log('[Table] yourSocketId (props):', yourSocketId);
  console.log('[Table] socket.id (actual):', socket?.id);
  if (yourSocketId !== socket?.id) {
    console.error('❌ Socket ID mismatch!');
  }
}, [yourSocketId, socket?.id]);
```

---

#### 原因B: `room-state-update`のブロードキャスト範囲

```typescript
// server/index.ts
io.to(`room:${roomId}`).emit('room-state-update', sanitizeRoomForViewer(room, socket.id));
```

**問題点**:
- `sanitizeRoomForViewer(room, socket.id)`が**発信元のsocket.id**を使っている
- しかし`io.to('room:...')`は**全員に送信**している
- 結果：全員が同じ`yourSocketId`で sanitize されたルームを受信

**正しい実装**:
```typescript
// 各プレイヤーに個別に送信すべき
const socketsInRoom = await io.in(`room:${roomId}`).fetchSockets();
for (const playerSocket of socketsInRoom) {
  playerSocket.emit('room-state-update',
    sanitizeRoomForViewer(room, playerSocket.id)
  );
}
```

---

#### 原因C: useEffect cleanup の誤発火（部分的に解決済み）

**過去の問題**:
```typescript
// 修正前
useEffect(() => {
  // イベントリスナー登録
  return () => {
    socket.emit('leave-room'); // ❌ actionToken更新時にも実行
  };
}, [socket, actionToken]); // actionToken更新でクリーンアップ実行
```

**現在の状態** (commit b3e7d90で修正):
```typescript
// イベントリスナー用useEffect
useEffect(() => {
  // イベントリスナー登録
  return () => {
    socket.off(...); // イベントリスナーのみ解除
  };
}, [socket, actionToken]);

// leave-room用の別useEffect
useEffect(() => {
  return () => {
    socketRef.current?.emit('leave-room'); // ✅ アンマウント時のみ
  };
}, []); // 空の依存配列
```

**残存問題**:
- 他のuseEffectでも同様の問題がある可能性
- 依存配列に`room`や`yourHand`を含むuseEffectが複数ある

---

#### 原因D: 古いセッションの削除タイミング

```typescript
// server/index.ts (quick-join)
const existingPlayerIndex = room.players.findIndex(p => {
  if (!p) return false;
  if (p.socketId === socket.id) return true;
  if (user?.userId && p.userId === user.userId) return true;
  return false;
});

if (existingPlayerIndex !== -1) {
  // ❌ 問題: 削除が同期的だが、ハンド中の場合はFOLD処理が非同期
  const oldPlayer = room.players[existingPlayerIndex]!;

  if (room.gameState.status !== 'WAITING') {
    const engine = gameEngines.get(data.roomId);
    if (engine && room.activePlayerIndex === existingPlayerIndex) {
      engine.processAction(room, { // ← 非同期処理
        playerId: oldPlayer.socketId,
        type: 'FOLD',
        timestamp: Date.now()
      });
    }
  }

  room.players[existingPlayerIndex] = null; // ← 即座に削除
}
```

**問題点**:
- FOLD処理中に`players[index] = null`で削除
- `processAction()`内で`room.players[index]`を参照している可能性
- レースコンディション発生

---

**✅ 修正完了（2026-01-28）**:
- `broadcastRoomState()` 関数を実装し、各プレイヤーに個別のサニタイズされたビューを送信
- `io.in().fetchSockets()` で全ソケットを取得し、ループで個別に `emit()` を実行
- 統合テスト（INT-05）で検証済み：全プレイヤーが正しくサニタイズされた `room-state-update` を受信

---

### 修正方針（旧）

#### 短期（即座に実施）:

1. **`room-state-update`の送信方法を修正**:
   ```typescript
   const socketsInRoom = await io.in(`room:${roomId}`).fetchSockets();
   for (const sock of socketsInRoom) {
     sock.emit('room-state-update', sanitizeRoomForViewer(room, sock.id));
   }
   ```

2. **デバッグログ追加**:
   - クライアント側: `yourSocketId` vs `socket.id`
   - サーバー側: `room-state-update`送信先
   - `quick-join`時の既存セッション検出ログ

3. **古いセッション削除ロジックの修正**:
   ```typescript
   if (existingPlayerIndex !== -1) {
     const oldPlayer = room.players[existingPlayerIndex]!;
     oldPlayer.pendingLeave = true; // まず退出フラグを立てる

     if (room.gameState.status !== 'WAITING') {
       oldPlayer.disconnected = true;
       // handleRoomExitに委譲
       handleRoomExit(oldSocket, roomId, io, { leaveRoom: true });
     } else {
       room.players[existingPlayerIndex] = null; // WAITINGなら即削除
     }
   }
   ```

#### 中期（リファクタリング）:

4. **Socket ID管理をContextに移行**:
   ```typescript
   // SocketContext.tsx
   const SocketContext = createContext<{
     socket: Socket | null;
     socketId: string;
   }>({ socket: null, socketId: '' });

   // Propsで渡さない
   ```

5. **セッション管理の一元化**:
   - `userId`ベースのセッションストア
   - 古いSocket接続の強制切断
   - 再接続時の座席復帰

---

## 🟡 Medium Bugs（中程度のバグ）

### ✅ Bug #2: ブラウザバック時のゴーストプレイヤー【修正済み】

**症状**:
- ブラウザバックまたはURL直接変更
- 過去の自分が1ハンドだけ残る
- 過去の自分が自動フォールド → ブラインド分獲得

**原因**:
- `leave-room`送信済み（修正済み）
- しかし`handleRoomExit()`が`pendingLeave`フラグを立てるだけ
- `cleanupPendingLeavers()`がハンド終了まで待つ

**✅ 修正完了（2026-01-28）**:
- `handleRoomExit()` が WAITING状態では `roomManager.standUp()` で即座にプレイヤーを削除
- ハンド中は `pendingLeave=true` + `disconnected=true` を設定し、`cleanupPendingLeavers()` で次ハンド前に削除
- `socket.data.roomId` を保存し、切断時に確実にルームを特定できるよう改善
- 統合テスト（INT-03, INT-04）で検証済み

**修正方針（旧）**:
- WAITING状態なら即座に削除
- ハンド中なら`pendingLeave`で次ハンド開始前に削除

---

### Bug #3: タイムアウト時の自動フォールド遅延

**症状**:
- タイマーが0になっても即座にフォールドしない
- 数秒遅れてフォールド処理

**原因**:
```typescript
// server/index.ts
activeTimers.set(playerId, setTimeout(() => {
  handleTimerTimeout(roomId, playerId, io);
}, MAX_TIMER_SECONDS * 1000));
```

`setTimeout`の精度問題 + サーバー負荷

**修正方針**:
- タイマー精度向上（1秒ごとにチェック）
- タイムアウト直前に警告送信

---

## 🟢 Minor Issues（軽微な問題）

### Issue #1: エラーメッセージが日本語と英語混在

**修正方針**: 全て英語に統一、またはi18n導入

### Issue #2: ログ出力が多すぎる

**修正方針**: ログレベル導入（DEBUG, INFO, WARN, ERROR）

---

## デバッグ用コード追加案

### client/src/Table.tsx

```typescript
// Socket ID検証用useEffect
useEffect(() => {
  const interval = setInterval(() => {
    if (socket && yourSocketId !== socket.id) {
      console.error('❌ Socket ID mismatch detected!', {
        propValue: yourSocketId,
        actualValue: socket.id,
        timestamp: new Date().toISOString()
      });
    }
  }, 1000);

  return () => clearInterval(interval);
}, [socket, yourSocketId]);

// room-state-update受信時のログ
socket.on('room-state-update', (room: Room) => {
  console.log('[DEBUG] room-state-update received', {
    yourSocketId,
    socketId: socket.id,
    playersInRoom: room.players.filter(p => p !== null).map(p => ({
      name: p.name,
      socketId: p.socketId,
      isYou: p.socketId === yourSocketId
    }))
  });
  setRoom(room);
});
```

### server/index.ts

```typescript
// room-state-update送信時のログ
function broadcastRoomState(roomId: string, room: Room, io: Server) {
  console.log('[DEBUG] Broadcasting room-state-update', {
    roomId,
    playerCount: room.players.filter(p => p !== null).length,
    players: room.players.filter(p => p !== null).map(p => ({
      name: p.name,
      socketId: p.socketId
    }))
  });

  io.to(`room:${roomId}`).emit('room-state-update',
    sanitizeRoomForViewer(room, '???') // ← ❌ 誰のSocket IDを使う？
  );
}
```

---

## 📊 修正サマリー

### 修正済み（2026-01-28）

| バグID | 説明 | 修正内容 | テスト |
|--------|------|----------|--------|
| Bug #1 | プレイヤー消失とSocket ID混同 | `broadcastRoomState()` で個別送信に変更 | INT-05 ✅ |
| Bug #2 | ゴーストプレイヤー | `socket.data.roomId` 保存 + 即座削除ロジック改善 | INT-03, INT-04 ✅ |

### 統合テスト結果（v036）

**Total: 16 / Passed: 16 / Failed: 0** ✅

- INT-00: Socket.IO Integration - Full game flow ✅
- INT-01: Uncontested Win Flow ✅
- INT-02: Quick-Join Flow ✅
- INT-03: Leave-Room During Hand ✅
- INT-04: Disconnect Cleanup ✅
- INT-05: Multi-Player Room State ✅

### 残存バグ

- Bug #3: タイムアウト時の自動フォールド遅延（軽微）

---

**END OF BUGS.md**
