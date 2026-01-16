# Mix Poker App - システム概要と現状

## 1. プロジェクト概要

Mix Pokerは、複数のポーカーバリアントをローテーションでプレイできるマルチプレイヤーポーカーアプリケーションです。

### 技術スタック
- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Node.js + Express + Socket.IO
- **リアルタイム通信**: Socket.IO

### 起動方法
```bash
# サーバー起動 (port 3000)
cd server
npm run dev

# クライアント起動 (port 5173)
cd client
npm run dev
```

---

## 2. サポートされているゲームバリアント

| ID | ゲーム名 | ホールカード | タイプ | 評価方式 |
|----|---------|-------------|--------|---------|
| NLH | No-Limit Hold'em | 2枚 | Flop | High |
| PLO | Pot-Limit Omaha | 4枚 | Flop | High |
| PLO8 | Pot-Limit Omaha Hi-Lo | 4枚 | Flop | Hi-Lo |
| 7CS | 7-Card Stud | 7枚 | Stud | High |
| 7CS8 | 7-Card Stud Hi-Lo | 7枚 | Stud | Hi-Lo |
| RAZZ | Razz | 7枚 | Stud | Razz Low |
| 2-7_TD | 2-7 Triple Draw | 5枚 | Draw | 2-7 Low |
| BADUGI | Badugi | 4枚 | Draw | Badugi |

### ローテーションプリセット
- **HORSE**: NLH → PLO8 → 7CS → 7CS8 → RAZZ
- **8-Game**: 2-7_TD → NLH → PLO → RAZZ → 7CS → 7CS8 → PLO8 → BADUGI
- **Mixed Hold'em/Omaha**: NLH → PLO → PLO8
- **Hold'em Only**: NLH

---

## 3. サーバーサイド構成

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `index.ts` | Socket.IOイベントハンドラ、メインエントリー |
| `RoomManager.ts` | 部屋の作成・管理・削除 |
| `GameEngine.ts` | FSM（状態遷移マシン）、ゲームループ管理 |
| `Dealer.ts` | カード配布、ブラインド徴収、ボタン管理 |
| `ShowdownManager.ts` | ショーダウン時の勝者判定とポット分配 |
| `handEvaluator.ts` | ハンド評価ロジック（全バリアント対応） |
| `gameVariants.ts` | ゲームバリアント設定 |
| `RotationManager.ts` | ゲームローテーション管理 |
| `types.ts` | TypeScript型定義 |

### ゲームフェーズ

#### Flop系ゲーム (NLH, PLO, PLO8)
```
PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
```

#### Stud系ゲーム (7CS, 7CS8, RAZZ)
```
THIRD_STREET → FOURTH_STREET → FIFTH_STREET → SIXTH_STREET → SEVENTH_STREET → SHOWDOWN
```

#### Draw系ゲーム (2-7_TD, BADUGI)
```
PREDRAW → FIRST_DRAW → SECOND_DRAW → THIRD_DRAW → SHOWDOWN
```

---

## 4. Socket.IOイベント一覧

### クライアント → サーバー

| イベント名 | 説明 | パラメータ |
|-----------|------|-----------|
| `create-room` | 部屋作成 | `{ playerName, config, isPrivate, customRoomId? }` |
| `join-room` | 部屋参加 | `{ roomId, playerName }` |
| `get-room-list` | ロビー部屋リスト取得 | なし |
| `sit-down` | 着席 | `{ seatIndex, buyIn }` |
| `start-game` | ゲーム開始 | なし |
| `player-action` | アクション実行 | `{ type, amount? }` |
| `draw-exchange` | カード交換（Draw用） | `{ discardIndexes: number[] }` |
| `leave-seat` | 離席 | なし |

### サーバー → クライアント

| イベント名 | 説明 |
|-----------|------|
| `room-created` | 部屋作成完了 |
| `room-joined` | 部屋参加完了 |
| `room-list-update` | ロビー部屋リスト更新 |
| `room-state-update` | 部屋状態更新 |
| `game-started` | ゲーム開始 |
| `your-turn` | アクション要求 |
| `action-invalid` | 無効なアクション |
| `showdown-result` | ショーダウン結果 |
| `draw-complete` | カード交換完了 |
| `next-game` | ゲームローテーション通知 |
| `seven-deuce-bonus` | 7-2ボーナス |
| `error` | エラー |

---

## 5. アクションタイプ

| アクション | 説明 |
|-----------|------|
| `FOLD` | フォールド |
| `CHECK` | チェック（ベット額が0の場合のみ） |
| `CALL` | コール |
| `BET` | ベット（最初のベット） |
| `RAISE` | レイズ |
| `ALL_IN` | オールイン |

---

## 6. 部屋設定 (RoomConfig)

```typescript
interface RoomConfig {
  maxPlayers: 6 | 8;      // 最大プレイヤー数
  smallBlind: number;      // スモールブラインド
  bigBlind: number;        // ビッグブラインド
  buyInMin: number;        // 最小バイイン
  buyInMax: number;        // 最大バイイン
  allowedGames: string[];  // 許可されたゲームリスト
}
```

---

## 7. 現在の実装状態

### 完了済み機能

| 機能 | 状態 | 備考 |
|------|------|------|
| 部屋作成・参加 | ✅ 完了 | Private/Open部屋対応 |
| 着席・離席 | ✅ 完了 | 6人卓対応 |
| ブラインド徴収 | ✅ 完了 | ヘッズアップ対応 |
| プリフロップアクション | ✅ 完了 | |
| フロップ/ターン/リバー | ✅ 完了 | |
| ショーダウン | ✅ 完了 | 全バリアント対応 |
| ハンド評価 | ✅ 完了 | High, Hi-Lo, Razz, Badugi, 2-7 |
| ALL_IN処理 | ✅ 完了 | 相手のアクション待ち、ボード自動配布 |
| ゲームローテーション | ✅ 完了 | オービット単位で切り替え |
| ゲームバリアント表示UI | ✅ 完了 | ヘッダーに表示 |
| Stud ストリート進行 | ✅ 完了 | 3rd-7th Street |
| Draw ストリート進行 | ✅ 完了 | Pre-Draw〜3rd Draw |
| Draw カード交換 | ✅ 完了 | サーバーサイド実装済み |

### 未実装・改善が必要な機能

| 機能 | 状態 | 備考 |
|------|------|------|
| Draw カード交換UI | ⚠️ 未実装 | クライアント側UIが必要 |
| Stud アップカード表示 | ⚠️ 未実装 | 他プレイヤーのアップカード表示 |
| サイドポット計算 | ⚠️ 簡易実装 | 複雑なサイドポットは未対応 |
| タイマー機能 | ⚠️ 未実装 | アクションタイムアウト |
| 観戦モード | ⚠️ 未実装 | |
| ハンド履歴 | ⚠️ 未実装 | リプレイ機能 |

---

## 8. 既知の問題と修正履歴

### 修正済み

1. **ALL_IN即時終了バグ** (修正済み)
   - 問題: 片方がALL_INすると相手のアクションを待たずにハンド終了
   - 原因: `actionablePlayers.length <= 1` の条件が誤っていた
   - 修正: `actionablePlayers.length === 0` に変更
   - ファイル: `GameEngine.ts:225`

2. **"Invalid Hand"エラー** (修正済み)
   - 問題: ALL_IN時にボードが配られずにショーダウン
   - 原因: `dealToShowdown`が呼び出されていなかった
   - 修正: ALL_IN時の自動ボード配布ロジック追加
   - ファイル: `GameEngine.ts:231-236`

### 注意点

- ゲームバリアント切り替え時、クライアントのUIが適切に更新されることを確認
- Stud/Drawゲームは現在NLHと同じUIで表示（専用UIは未実装）

---

## 9. テスト手順

### 基本フロー
1. サーバーとクライアントを起動
2. ブラウザで `http://localhost:5173` を2つのウィンドウで開く
3. それぞれでプレイヤー名を入力し、部屋を作成/参加
4. 両プレイヤーが着席してゲーム開始

### ALL_INテスト
1. プレイヤーAがALL_IN
2. プレイヤーBにアクション選択が表示されることを確認
3. プレイヤーBがCALL/ALL_IN
4. ボード（Flop/Turn/River）が自動で配られることを確認
5. ショーダウン結果が正しく表示されることを確認

### ゲームローテーションテスト
1. 部屋作成時に複数ゲームを選択（例: NLH, PLO）
2. ハンドをプレイ
3. ボタンが一周したらゲームが切り替わることを確認
4. 画面上のゲーム名表示が更新されることを確認

### Hi-Loテスト (PLO8, 7CS8)
1. PLO8またはStud Hi-Loでプレイ
2. ショーダウン時にHigh勝者とLow勝者が表示されることを確認
3. ポットが正しく分配されることを確認

---

## 10. ファイル構造

```
mix-poker-app/
├── server/
│   ├── index.ts              # メインエントリー
│   ├── types.ts              # 型定義
│   ├── RoomManager.ts        # 部屋管理
│   ├── GameEngine.ts         # ゲームエンジン
│   ├── Dealer.ts             # ディーラー
│   ├── ShowdownManager.ts    # ショーダウン管理
│   ├── handEvaluator.ts      # ハンド評価
│   ├── gameVariants.ts       # ゲーム設定
│   ├── RotationManager.ts    # ローテーション管理
│   ├── ActionValidator.ts    # アクション検証
│   ├── PotManager.ts         # ポット管理
│   └── MetaGameManager.ts    # メタゲーム管理
│
└── client/
    └── src/
        ├── App.tsx           # メインアプリ
        ├── Lobby.tsx         # ロビー画面
        ├── Table.tsx         # テーブル画面
        ├── types/
        │   └── table.ts      # 型定義
        └── components/
            ├── table/
            │   ├── PokerTable.tsx
            │   └── PotDisplay.tsx
            ├── player/
            │   └── PlayerSeat.tsx
            ├── card/
            │   └── Card.tsx
            └── action/
                └── ActionPanel.tsx
```

---

## 11. 連絡事項

- バグ報告や機能リクエストは随時受け付けています
- テスト中に発見した問題は詳細なログと再現手順をお知らせください

---

*最終更新: 2026-01-16*
