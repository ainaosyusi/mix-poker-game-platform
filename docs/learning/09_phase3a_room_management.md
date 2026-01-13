# Learning Note 09: Phase 3-A ルーム管理システムの実装

## 目標

複数の部屋（Open/Private）を管理し、ユーザーが着席・離席できるシステムを構築する。

## 実装した機能

### 1. 型定義システム（types.ts）

**新しい型定義ファイルを作成**:
- `Room`: 部屋全体の状態
- `Player`: プレイヤー情報
- `RoomConfig`: 部屋設定
- `Socket Event Payloads`: クライアント⇔サーバー通信の型

**重要な設計判断**:
- 最大6人（将来8人に拡張可能）
- 部屋IDは6桁の数字
- Open卓はランダムID、Private卓はカスタムID指定可能

### 2. RoomManagerクラス

**主要メソッド**:
```typescript
class RoomManager {
  createRoom(hostId, config, customRoomId?)  // 部屋作成
  getRoomById(roomId)                         // 部屋取得
  deleteRoom(roomId)                          // 部屋削除
  getAllRooms()                               // ロビー用リスト
  sitDown(roomId, seatIndex, player)          // 着席
  standUp(roomId, socketId)                   // 離席
}
```

### 3. Socket.IOイベント統合

サーバー側で以下のイベントを実装：
- `create-room` - 部屋作成
- `join-room` - 部屋参加
- `get-room-list` - ロビー用リスト取得
- `sit-down` - 着席
- `leave-seat` - 離席
- `disconnect` - 自動離席処理

### 4. クライアント実装

- **Lobby.tsx**: 部屋リスト、部屋作成フォーム
- **Table.tsx**: 6席テーブル、着席/離席UI
- **App.tsx**: 3画面ルーティング（名前入力→ロビー→テーブル）

## デバッグ経験

### 問題: 部屋作成ボタンで何も起こらない

**原因**: サーバーがTypeScriptビルドエラーで起動失敗
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'RoomManager.js'
```

**解決**:
1. `npm run build` でコンパイル
2. `node dist/index.js` でサーバー起動

**学び**: TypeScriptプロジェクトでは新ファイル追加時に必ずビルドが必要

## 学んだこと

1. **Socket.IOのルーム機能**: `socket.join('room:123')`でグループ通信
2. **TypeScriptビルド**: `.ts` → `.js`変換の重要性
3. **デバッグ技術**: console.logの戦略的配置
4. **状態管理**: サーバー⇔クライアント状態同期
5. **リアルタイム通信**: イベント駆動型アーキテクチャ

## 今後の改善

- テーブルUIのレイアウト調整（プレイヤー位置、サイズバランス）
- Phase 3-B: ゲームロジック実装（FSM、ベット処理、ポット計算）
