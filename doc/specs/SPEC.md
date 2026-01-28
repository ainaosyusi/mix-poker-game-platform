# Mix Poker App - 機能仕様書

> 最終更新: 2026-01-28
> バージョン: v0.5.0 (データ駆動ゲームエンジン + Show/Muck + Stud/Draw 完全対応)

---

## 1. システム概要

Mix Poker は、複数のポーカーバリアントをローテーションで遊べるマルチプレイヤー Web アプリ。
ユーザー認証 → メインメニュー → ルーム選択 → テーブル のフローで動作する。

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 18 + TypeScript + Vite |
| バックエンド | Node.js + Express + Socket.IO |
| DB | PostgreSQL (Prisma ORM v6) |
| 認証 | JWT (jsonwebtoken) + bcryptjs |
| デプロイ | Railway (nixpacks) |

---

## 2. 画面遷移フロー

```
[認証画面] ──認証成功──> [メインメニュー] ──キャッシュゲーム──> [ルーム選択] ──参加──> [テーブル]
  AuthScreen                MainMenu                      RoomSelect              Table
     │                        │  ↑                            ↑                    │
     │                        │  └──ログアウト─────────────────┘                    │
     │                        │                                                     │
     └──自動ログイン(JWT有効)──┘                     ←──退室──────────────────────────┘
```

### 2.1 認証画面 (`AuthScreen.tsx`)

- **ログイン**: ユーザー名 + パスワード → JWT 取得
- **新規登録**: ユーザー名 + パスワード + 表示名 → アカウント作成 + JWT 取得
- 自動ログイン: localStorage に有効な JWT があれば `/api/auth/me` で検証 → 成功時メインメニューへ

### 2.2 メインメニュー (`MainMenu.tsx`)

- ユーザー情報表示（アバター + 表示名）
- **アカウント設定**: 表示名変更、アバターアイコン選択（12種類のプリセット絵文字）
- **キャッシュゲーム**: ルーム選択画面へ遷移
- トーナメント: Coming Soon（グレーアウト）
- プライベートルーム: Coming Soon（グレーアウト）
- ログアウト: JWT 削除 + Socket 切断 → 認証画面へ

### 2.3 ルーム選択 (`RoomSelect.tsx`)

- 2カテゴリ表示: **NLH** / **Mix**
- 各ルームをカード形式で表示（プレイヤー数リアルタイム更新）
- サーバーから `buyInMin` / `buyInMax` を受信し、バイインダイアログの範囲に使用
- カードクリック → **バイインダイアログ**:
  - スライダー: min ～ max（サーバーの `buyInMin`/`buyInMax` 優先、フォールバック: BB×20 ～ BB×100）
  - クイック選択ボタン: Min / Mid / Max
  - 「参加」ボタン → `quick-join` ソケットイベント発行
- `room-list-update` イベントでリアルタイム更新

### 2.4 テーブル (`Table.tsx`)

- ゲームプレイ画面（詳細は後述）
- 退室ボタン → `leave-room` 発行 → メインメニューへ戻る

---

## 3. 認証システム

### 3.1 データベーススキーマ (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  username     String   @unique
  passwordHash String
  displayName  String
  avatarIcon   String   @default("default")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 3.2 REST API

| エンドポイント | メソッド | 認証 | リクエスト | レスポンス |
|-------------|---------|------|----------|----------|
| `/api/auth/register` | POST | 不要 | `{ username, password, displayName }` | `{ token, user }` |
| `/api/auth/login` | POST | 不要 | `{ username, password }` | `{ token, user }` |
| `/api/auth/me` | GET | 必要 | - | `{ user }` |
| `/api/auth/profile` | PUT | 必要 | `{ displayName?, avatarIcon? }` | `{ token, user }` |

- **JWT**: 有効期限 7 日、ペイロード `{ userId, username, displayName, avatarIcon }`
- **パスワード**: bcryptjs (salt rounds: 10)
- **認証ミドルウェア**: `Authorization: Bearer <token>` ヘッダー検証

### 3.3 Socket.IO 認証

```typescript
io(serverUrl, { auth: { token: jwtToken } })
```

サーバー側ミドルウェア:
- トークン検証成功 → `socket.data.user` にユーザー情報格納
- トークンなし/無効 → ゲスト扱い (`socket.data.user = null`)、接続は許可

### 3.4 アバターアイコン

12 種類のプリセット:
`default`, `cat`, `dog`, `fox`, `bear`, `penguin`, `ghost`, `alien`, `robot`, `star`, `fire`, `diamond`

---

## 4. ルームシステム

### 4.1 プリセットルーム

サーバー起動時に自動作成される 7 室。空でも削除されない。

| ID | 表示名 | カテゴリ | SB/BB | Buy-in | ゲーム |
|----|--------|---------|-------|--------|--------|
| `nlh-1-2` | NLH 1/2 | nlh | 1/2 | 40-200 | NLH |
| `nlh-2-5` | NLH 2/5 | nlh | 2/5 | 100-500 | NLH |
| `nlh-5-10` | NLH 5/10 | nlh | 5/10 | 200-1000 | NLH |
| `mix-plo` | PLO Mix | mix | 2/5 | 100-500 | PLO, PLO8 |
| `mix-8game` | 8-Game Mix | mix | 2/5 | 100-500 | 2-7TD, NLH, PLO, RAZZ, 7CS, 7CS8, PLO8, BADUGI |
| `mix-10game` | 10-Game Mix | mix | 2/5 | 100-500 | 上記 + NLH, PLO |
| `mix-10game-plus` | 10-Game+ Mix | mix | 2/5 | 100-500 | 全8種ローテーション |

### 4.2 ルーム構造 (`Room` 型)

```typescript
interface Room {
  id: string;                        // ルームID
  hostId?: string;                   // Private卓のホスト (Open/プリセットはundefined)
  config: RoomConfig;                // SB/BB/maxPlayers/buyIn等
  gameState: GameState;              // ゲーム進行状態
  players: (Player | null)[];        // 6席の配列 (nullは空席)
  dealerBtnIndex: number;            // ディーラーボタン位置
  activePlayerIndex: number;         // アクション待ちプレイヤー (-1=なし)
  streetStarterIndex: number;        // ストリート開始プレイヤー
  lastAggressorIndex: number;        // 最後にレイズしたプレイヤー
  rotation: RotationState;           // ゲームローテーション状態
  metaGame: MetaGameState;           // サイドゲーム状態
  isPreset?: boolean;                // プリセットルームか
  displayName?: string;              // 表示名
  category?: 'nlh' | 'mix';         // カテゴリ
}
```

### 4.3 RoomListItem (ロビー向けルーム情報)

```typescript
interface RoomListItem {
  id: string;
  playerCount: number;
  maxPlayers: number;
  gameVariant: string;
  blinds: string;            // "2/5" 形式
  isPrivate: boolean;
  buyInMin?: number;          // サーバーから直接送信
  buyInMax?: number;          // サーバーから直接送信
  displayName?: string;
  category?: 'nlh' | 'mix';
  rotationGames?: string[];   // ローテーション対象ゲーム一覧
}
```

### 4.4 自動着席 (`autoSeating.ts`)

`quick-join` 時にランダムな空席を自動選択。プレイヤーが席を選ぶ UI はない。

### 4.5 自動ゲーム開始 (`scheduleNextHand`)

- ゲーム状態が `WAITING` かつ 2 人以上の `ACTIVE` プレイヤーがいる場合
- **2 秒後**にゲームを自動開始
- `pendingStarts` Map で二重開始防止
- 手動のゲーム開始ボタンは存在しない

---

## 5. ゲームエンジン アーキテクチャ

### 5.1 データ駆動設計

ゲームエンジンは `GameVariantConfig` による**データ駆動アーキテクチャ**を採用。
各バリアントの挙動はコンフィグで定義し、エンジン側は Flop / Stud / Draw の3カテゴリを統一的に処理する。

```
gameVariants.ts (設定定義)
    ↓ getVariantConfig(gameVariant)
GameEngine.ts (統一フロー制御)
    ├─ communityCardType === 'flop'  → nextFlopStreet()
    ├─ communityCardType === 'stud'  → nextStudStreet()
    └─ hasDrawPhase === true         → nextDrawStreet()
```

### 5.2 GameVariantConfig フィールド

**必須フィールド:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | バリアントID ("NLH", "PLO" 等) |
| `name` | `string` | 表示名 |
| `holeCardCount` | `number` | ホールカード枚数 |
| `communityCardType` | `'flop' \| 'stud' \| 'none'` | コミュニティカードの種類 |
| `betStructure` | `'no-limit' \| 'pot-limit' \| 'fixed'` | ベッティング構造 |
| `hasButton` | `boolean` | ディーラーボタンを使うか (Studはfalse) |
| `hasDrawPhase` | `boolean` | ドローフェーズがあるか |
| `handEvaluation` | `HandEvaluation` | ショーダウン評価方式 |
| `streets` | `string[]` | ストリート名の配列 |

**拡張フィールド (オプショナル):**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `boardPattern` | `number[]` | コミュニティカード配布パターン (例: `[3,1,1]`) |
| `drawRounds` | `number` | ドロー交換回数 (1/3) |
| `holeCardsForSelection` | `number` | PLO系: 手札から選出する枚数 (2) |
| `boardCount` | `number` | ボード面数 (1=標準, 2=ダブルボード) |
| `hasOceanCard` | `boolean` | 6枚目のOceanカード有無 |
| `isDramaha` | `boolean` | Dramaha (フロップ+ドロー混合) |
| `dramahaDrawEval` | `HandEvaluation` | Dramaha ドロー部の評価方式 |
| `anteType` | `'blind' \| 'ante' \| 'button-ante'` | アンティ方式 |
| `isBringInHigh` | `boolean` | Stud: Bring-Inが最高カードか |
| `vanishCards` | `number` | "Cry Me a River": カード消失数 |

### 5.3 HandEvaluation 方式 (12種類)

| 値 | 説明 | 対応バリアント |
|----|------|--------------|
| `'high'` | 標準ハイハンド | NLH, PLO, 7CS |
| `'highlow'` | ハイロースプリット | PLO8, 7CS8 |
| `'razz'` | A-5ローボール | RAZZ |
| `'badugi'` | バドゥーギ | BADUGI |
| `'2-7'` | 2-7ローボール | 2-7_TD |
| `'a5'` | A-5ロー (ドロー用) | FL_A5_TD |
| `'hidugi'` | ハイバドゥーギ | FL_HIDUGI |
| `'baduecey'` | Badugi + 2-7 スプリット | FL_BADUECEY |
| `'badacey'` | Badugi + A-5 スプリット | FL_BADACEY |
| `'archie'` | A-5 + 2-7 スプリット | FL_ARCHIE |
| `'razzdugi'` | Razz + Badugi スプリット | FL_STUD_RAZZDUGI |
| `'stud27'` | スタッド 2-7 | FL_STUD_27 |

---

## 6. ゲームバリアント

### 6.1 実装済みバリアント (8種類)

| ID | 名前 | カテゴリ | ホールカード | ベット構造 | 評価方法 | boardPattern |
|----|------|---------|------------|----------|---------|-------------|
| `NLH` | No-Limit Hold'em | Flop | 2枚 | No-Limit | high | `[3,1,1]` |
| `PLO` | Pot-Limit Omaha | Flop | 4枚 (必ず2枚使用) | Pot-Limit | high | `[3,1,1]` |
| `PLO8` | PLO Hi-Lo | Flop | 4枚 (必ず2枚使用) | Pot-Limit | highlow | `[3,1,1]` |
| `7CS` | 7-Card Stud | Stud | 7枚 (2down+1up+3up+1down) | Fixed | high | - |
| `7CS8` | 7-Card Stud Hi-Lo | Stud | 7枚 | Fixed | highlow | - |
| `RAZZ` | Razz | Stud | 7枚 | Fixed | razz | - |
| `2-7_TD` | 2-7 Triple Draw | Draw | 5枚 (3回交換) | Fixed | 2-7 | - |
| `BADUGI` | Badugi | Draw | 4枚 (3回交換) | Fixed | badugi | - |

### 6.2 ゲームカテゴリ別のストリート

**Flop ゲーム** (NLH, PLO, PLO8):
```
PREFLOP → FLOP (boardPattern[0]枚) → TURN (boardPattern[1]枚) → RIVER (boardPattern[2]枚) → SHOWDOWN
```
- `boardPattern` でコミュニティカード配布枚数を動的に制御
- 標準: `[3,1,1]`、Ocean系: `[3,1,1,1]` (6枚目あり)

**Stud ゲーム** (7CS, 7CS8, RAZZ):
```
3RD_STREET → 4TH_STREET → 5TH_STREET → 6TH_STREET → 7TH_STREET → SHOWDOWN
```
- ディーラーボタンなし (`hasButton: false`)
- 3rd Street: 2枚 down + 1枚 up
- 4th-6th Street: 1枚 up
- 7th Street: 1枚 down
- ブリングイン: 最低ドアカード (RAZZ は最高 = `isBringInHigh: true`)
- 4th Street 以降: 最高/最低ボードのプレイヤーがファーストアクション

**Draw ゲーム** (2-7_TD, BADUGI):
```
PREDRAW → FIRST_DRAW → SECOND_DRAW → THIRD_DRAW → SHOWDOWN
```
- `drawRounds` パラメータでドロー回数を制御 (デフォルト: 3)
- 各ドロー後にベッティングラウンド
- 交換枚数: 0～全手札枚数
- デッキ不足時: 捨てカード (discardPile) からリシャッフル

### 6.3 ベッティング構造

| 構造 | ルール |
|------|--------|
| No-Limit | 最小レイズ = 前回レイズ額、最大 = 全スタック |
| Pot-Limit | 最大ベット = ポットサイズ |
| Fixed-Limit | ベット/レイズは固定額 (Small Bet / Big Bet)、キャップあり |

**Fixed-Limit 詳細:**

| 項目 | 値 |
|------|-----|
| Small Bet | = Big Blind |
| Big Bet | = Big Blind × 2 |
| レイズキャップ | デフォルト 5-bet (Heads-Up時は無制限) |
| Stud: Big Bet開始 | 5th Street以降 |
| Draw: Big Bet開始 | 後半ストリート (drawRoundsの半分以降) |
| Flop: Big Bet開始 | Street 2以降 (TURN, RIVER) |

### 6.4 ローテーション

Mix ルームでは `handsPerGame` ハンドごとにゲームが切り替わる (デフォルト: 8ハンド)。
ディーラーボタンが 1 周するとカウントが進む。

**プリセットローテーション:**
| 名前 | ゲーム順 |
|------|---------|
| HORSE | NLH, PLO8, 7CS, 7CS8, RAZZ |
| 8-Game | 2-7TD, NLH, PLO, RAZZ, 7CS, 7CS8, PLO8, BADUGI |
| Mixed Hold'em/Omaha | NLH, PLO, PLO8 |

---

## 7. ゲーム進行

### 7.1 ハンドの流れ (Hold'em/Omaha)

1. **ディーラーボタン移動** (前ハンドの次の ACTIVE プレイヤー)
2. **ブラインド投稿** (SB=ボタン+1, BB=ボタン+2)
3. **ホールカード配布** (`holeCardCount` 枚を各プレイヤーに)
4. **プリフロップ** (UTGからアクション、BBが最後)
5. **フロップ** (`boardPattern[0]`枚のコミュニティカード → SBからアクション)
6. **ターン** (`boardPattern[1]`枚追加)
7. **リバー** (`boardPattern[2]`枚追加)
8. **ショーダウン** (勝者決定、ポット分配)
9. WAITING → 2 秒後に次のハンド自動開始

### 7.2 ハンドの流れ (Stud)

1. **アンティ徴収** (全員から強制ベット)
2. **3rd Street配布** (2枚 down + 1枚 up)
3. **ブリングイン** (最弱/最強ドアカードのプレイヤー)
4. **4th-6th Street** (各1枚 up → 最強/最弱ボードからアクション)
5. **7th Street** (1枚 down → ベッティング)
6. **ショーダウン**

### 7.3 ハンドの流れ (Draw)

1. **ブラインド投稿**
2. **ホールカード配布** (`holeCardCount`枚)
3. **プリドロー** (ベッティングラウンド)
4. **ドロー交換** (0～全枚数を交換) × `drawRounds`回
5. **各ドロー後のベッティングラウンド**
6. **ショーダウン**

### 7.4 プレイヤーアクション

| アクション | 条件 |
|----------|------|
| FOLD | いつでも |
| CHECK | 現在のベット = 自分のベット |
| CALL | 他プレイヤーのベットにマッチ |
| BET | まだ誰もベットしていない |
| RAISE | 既存ベットを上回るベット |
| ALL_IN | スタック全額 |

### 7.5 タイマーシステム

- **アクション時間**: 30 秒
- **タイムバンク**: 初期 5 チップ (各 30 秒追加)
- タイムアウト → auto-fold (チェック可能ならauto-check)
- 切断プレイヤー → auto-fold

### 7.6 ポット管理

- **メインポット**: 全プレイヤーが参加できるポット
- **サイドポット**: オールインプレイヤーがいる場合に自動計算
  - `sidePot.eligiblePlayers` で各サイドポットの参加資格者を管理
  - メインポットから順に勝者決定 → 各サイドポットの参加資格者内で勝者決定
- ハイロー分割: Hi 50% / Lo 50% (Lo 該当なしなら全額 Hi)

### 7.7 オールインランアウト

全アクティブプレイヤーがオールイン → 残りのコミュニティカードを自動配布。
ランアウト中はベッティングなし。

---

## 8. ショーダウンシステム

### 8.1 バリアント別の評価メソッド

| メソッド | 対応バリアント | 説明 |
|---------|--------------|------|
| `executeHighShowdown()` | NLH, PLO, 7CS | ハイハンド評価 |
| `executeHiLoShowdown()` | PLO8, 7CS8 | Hi-Lo スプリット |
| `executeRazzShowdown()` | RAZZ | 最低ハンド評価 |
| `executeBadugiShowdown()` | BADUGI | バドゥーギ評価 |
| `executeDeuce7Showdown()` | 2-7_TD | 2-7ローボール評価 |

### 8.2 ハンド選出ロジック

| バリアント | 選出方法 |
|-----------|---------|
| NLH | 手札2枚 + ボード5枚 → ベスト5枚 |
| PLO/PLO8 | 手札から**必ず2枚** + ボードから**必ず3枚** → ベスト5枚 |
| 7CS/7CS8/RAZZ | 手札7枚 → ベスト5枚 |
| 2-7_TD | 手札5枚そのまま |
| BADUGI | 手札4枚 (スート重複除外) |

### 8.3 Show/Muck ルール

**ショーダウン順序**: ラストアグレッサー → ボタン左回り

1. **1番手**: 必ず Show (手札公開)
2. **2番手以降**:
   - 現在のベストハンドに勝つ/タイ → **Show**
   - 現在のベストハンドに負ける → **Muck** (手札非公開、`hand: null`)
3. **ALL_IN 時**: 全員**強制オープン** (共謀防止)

### 8.4 ShowdownResult 型

```typescript
interface ShowdownResult {
  winners: {
    playerId: string;
    playerName: string;
    hand: string[];
    handRank: string;
    amount: number;
  }[];
  allHands: {
    playerId: string;
    playerName: string;
    hand: string[] | null;  // null = Muck
    handRank: string;
    isMucked: boolean;
  }[];
}
```

---

## 9. Dealer (カード配布)

### 9.1 共通メソッド

| メソッド | 説明 |
|---------|------|
| `createDeck()` | 52枚シャッフル |
| `dealHoleCards(deck, players, count)` | ホールカード配布 |
| `dealBoardCards(deck, count)` | コミュニティカード配布 (boardPattern対応) |
| `moveButton(room)` | ディーラーボタン移動 |
| `collectBlinds(room)` | ブラインド徴収 |
| `clearHands(room)` | ハンドクリア |

### 9.2 Stud 固有メソッド

| メソッド | 説明 |
|---------|------|
| `dealStudInitial(deck, players)` | 3rd Street (2 down + 1 up) |
| `dealStudStreet(deck, players, isLastStreet)` | 4th-7th Street (up/down カード) |
| `determineBringIn(players, isRazz)` | Bring-In 対象者判定 |
| `collectBringIn(room, index, amount)` | Bring-In 徴収 |
| `getStudActionStartIndex(room, isRazz)` | アクション開始位置 (最強/最弱ボード) |

### 9.3 Draw 固有メソッド

| メソッド | 説明 |
|---------|------|
| `exchangeDrawCards(deck, player, discardIndexes)` | カード交換 |
| `reshuffleIfNeeded(deck, discardPile, required)` | デッキ不足時リシャッフル |

---

## 10. Socket.IO イベント

### 10.1 クライアント → サーバー

| イベント | ペイロード | 説明 |
|---------|----------|------|
| `get-room-list` | なし | ロビーのルームリスト取得 + lobbyルーム参加 |
| `join-room` | `{ roomId, playerName, resumeToken? }` | ルーム参加 (観戦のみ、着席しない) |
| `quick-join` | `{ roomId, buyIn }` | ルーム参加 + 自動着席 + 着席を1アクションで |
| `leave-room` | なし | ルーム退室 (ハンド中なら pendingLeave) |
| `sit-down` | `{ seatIndex, buyIn, resumeToken? }` | 指定席に着席 |
| `player-action` | `{ type, amount?, actionToken? }` | ベットアクション |
| `draw-exchange` | `{ discardIndices }` | ドロー交換 |
| `use-timebank` | なし | タイムバンクチップ使用 |
| `rebuy` | `{ amount }` | リバイ (チップ追加) |
| `request-room-state` | なし | ルーム状態の再取得 |
| `change-variant` | `{ variant }` | ゲームバリアント変更 |

### 10.2 サーバー → クライアント

| イベント | ペイロード | 説明 |
|---------|----------|------|
| `room-list-update` | `RoomListItem[]` | ルームリスト更新 (buyInMin/buyInMax含む) |
| `room-joined` | `{ room, yourSocketId, yourHand }` | ルーム参加成功 |
| `room-state-update` | `Room` | ルーム状態更新 |
| `game-started` | `{ room, yourHand }` | ゲーム開始 |
| `your-turn` | `{ validActions, minBet, maxBet, ... }` | アクション促し |
| `showdown-result` | `ShowdownResult` | ショーダウン結果 |
| `timer-update` | `{ seconds }` | タイマー更新 |
| `timebank-update` | `{ chips }` | タイムバンク残数 |
| `sit-down-success` | `{ seatIndex }` | 着席成功 |
| `action-invalid` | `{ reason }` | アクション無効通知 |
| `draw-complete` | `{ newHand }` | ドロー交換完了 |
| `player-drew` | `{ playerId, playerName, cardCount }` | 他プレイヤーのドロー通知 |
| `rebuy-success` | `{ amount, newStack }` | リバイ成功 |
| `runout-started` | `{ runoutPhase, fullBoard }` | ランアウト開始 |
| `runout-board` | `{ board, phase }` | ランアウト中のボード更新 |
| `error` | `{ message }` | エラー通知 |

---

## 11. 退出・切断処理

### 11.1 退室ボタン (`leave-room`)

- ハンド外 → 即座に席から立ち、ルームから退出
- ハンド中 → `pendingLeave = true` + auto-fold → ハンド終了後に退出

### 11.2 切断 (`disconnect`)

- `handleRoomExit()` に委譲（退室と同じロジック）
- ハンド中のアクティブプレイヤー → auto-fold
- ハンド終了後に `cleanupPendingLeavers()` で削除

### 11.3 プリセットルーム

全員離脱しても削除されない (`isPreset = true`)。

---

## 12. サーバー内部アーキテクチャ

### 12.1 モジュール構成

| モジュール | 役割 |
|-----------|------|
| `GameEngine` | ゲーム状態マシン (FSM)。`startHand`, `processAction`, `nextStreet`, `endHand` |
| `Dealer` | カード配布・シャッフル。Flop/Stud/Draw 各系統に対応 |
| `ShowdownManager` | ショーダウン・Show/Muck・勝者決定・ポット分配 |
| `ActionValidator` | プレイヤーアクションの妥当性検証 |
| `PotManager` | メインポット + サイドポット計算 |
| `RoomManager` | マルチルーム管理。プリセットルーム初期化 |
| `RotationManager` | Mix ゲームローテーション制御 |
| `MetaGameManager` | サイドゲーム (7-2ゲーム等) |

### 12.2 GameEngine 公開メソッド

| メソッド | 説明 |
|---------|------|
| `startHand(room)` | ハンド開始 (ボタン移動、ブラインド、カード配布) |
| `processAction(room, action)` | プレイヤーアクション処理 |
| `nextStreet(room)` | 次のストリートへ進行 |
| `endHand(room)` | ハンド終了処理 |
| `getValidActions(room, playerId)` | 有効アクション一覧取得 |
| `getBettingInfo(room, playerId)` | minBet/maxBet/betStructure 取得 |
| `checkDrawPhaseComplete(room)` | ドロー交換完了判定 |
| `markDrawComplete(room, playerId)` | プレイヤーのドロー完了記録 |
| `getSeatedPlayers(room)` | 着席プレイヤー一覧 |

### 12.3 同時実行制御

| 機構 | 説明 |
|------|------|
| `actionInFlight: Set<playerId>` | プレイヤー単位の二重実行防止 |
| `roomActionInFlight: Set<roomId>` | ルーム単位のロック |
| `actionTokens: Map<playerId, token>` | アクショントークンによる順序保証 |
| `actionRateLimit: Map<playerId, {...}>` | レートリミット |
| `pendingStarts: Map<roomId, timeout>` | 自動開始の二重防止 |

---

## 13. ファイル構成

```
mix-poker-app/
├── railway.toml                    # Railway デプロイ設定
├── SPEC.md                        # 本ドキュメント (機能仕様書)
├── CLAUDE.md                      # AI アシスタント向けプロジェクト情報
│
├── server/
│   ├── index.ts                    # Express + Socket.IO メインサーバー
│   ├── types.ts                    # 全型定義 (65バリアント, Player, Room, GameState等)
│   ├── GameEngine.ts               # データ駆動ゲームエンジン (Flop/Stud/Draw統一処理)
│   ├── Dealer.ts                   # カード配布 (Stud配布/Draw交換/リシャッフル)
│   ├── handEvaluator.ts            # ハンド評価 (全バリアント対応)
│   ├── ShowdownManager.ts          # ショーダウン (Show/Muck, Hi-Lo分割, サイドポット)
│   ├── ActionValidator.ts          # アクション検証
│   ├── RoomManager.ts              # マルチルーム管理 + プリセットルーム
│   ├── RotationManager.ts          # ゲームローテーション
│   ├── MetaGameManager.ts          # サイドゲーム (7-2等)
│   ├── PotManager.ts               # ポット計算 (メイン + サイドポット)
│   ├── gameVariants.ts             # GameVariantConfig定義 (boardPattern, drawRounds等)
│   ├── autoSeating.ts              # 自動着席ロジック
│   ├── roomDefinitions.ts          # プリセットルーム定義 (7室)
│   ├── logger.ts                   # JSONL ロギング
│   ├── auth/
│   │   ├── authService.ts          # 認証ロジック (register/login/JWT)
│   │   ├── authMiddleware.ts       # Express JWT ミドルウェア
│   │   └── authRoutes.ts           # 認証 REST API
│   └── prisma/
│       └── schema.prisma           # DB スキーマ (User)
│
└── client/
    └── src/
        ├── App.tsx                 # ルーティング (auth→mainMenu→roomSelect→table)
        ├── Table.tsx               # テーブルビュー (ゲームプレイ全体)
        ├── api.ts                  # REST API ヘルパー (JWT 付き fetch)
        ├── main.tsx                # React エントリーポイント
        ├── handEvaluator.ts        # クライアント側ハンド評価
        ├── index.css               # グローバル CSS
        ├── screens/
        │   ├── AuthScreen.tsx      # ログイン/登録
        │   ├── MainMenu.tsx        # メインメニュー + アカウント設定
        │   └── RoomSelect.tsx      # ルーム選択 + バイインダイアログ
        ├── components/
        │   ├── table/
        │   │   ├── PokerTable.tsx   # テーブル描画 + コミュニティカード
        │   │   └── PotDisplay.tsx   # ポット表示
        │   ├── player/
        │   │   └── PlayerSeat.tsx   # プレイヤー席 (カード・チップ・タイマー)
        │   ├── cards/
        │   │   └── Card.tsx         # カードコンポーネント
        │   ├── chips/
        │   │   └── ChipStack.tsx    # 3D チップスタック
        │   ├── action/
        │   │   └── ActionPanel.tsx   # ベットアクションボタン
        │   └── log/
        │       └── GameLog.tsx      # ゲームログ
        ├── hooks/
        │   └── useTableLayout.ts   # 席位置計算
        └── types/
            └── table.ts            # クライアント型定義
```

---

## 14. 開発・デプロイ

### 14.1 ローカル開発

```bash
# サーバー起動 (port 3000)
cd server && npm run dev

# クライアント起動 (port 5173)
cd client && npm run dev
```

必要な環境変数 (`server/.env`):
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

### 14.2 Railway デプロイ

`railway.toml` の設定:
1. **ビルド**: クライアント npm build → サーバー Prisma generate + migrate + build
2. **起動**: `cd server && npm run start`
3. **ヘルスチェック**: `/api/health`

Railway 管理画面で必要:
- PostgreSQL プラグイン追加 → `DATABASE_URL` 自動設定
- `JWT_SECRET` 環境変数設定

---

## 15. 削除済み機能 (v0.3.x → v0.4.0)

| 機能 | 理由 |
|------|------|
| 名前入力画面 | アカウント認証に置き換え |
| ロビー画面 (`Lobby.tsx`) | メインメニュー + ルーム選択に分離 |
| 手動席選択 UI | 自動着席 (`quick-join`) に置き換え |
| ゲーム開始ボタン | 自動開始 (`scheduleNextHand`) に置き換え |
| Sit Out トグル | 退室ボタンのみに簡素化 |
| `create-room` ソケットイベント | プリセットルームのみ運用 |
| `start-game` ソケットイベント | 自動開始に置き換え |
| `sit-out` ソケットイベント | 機能削除 |

---

## 16. 未実装 / Coming Soon

- **トーナメントモード**: メインメニューにボタンあり (グレーアウト)
- **プライベートルーム**: ユーザー作成ルーム (Coming Soon)
- **β版ゲームバリアント** (型定義済み、`GameVariantConfig` 拡張フィールド準備済み):
  - **Flop系**: BIG_O (5-Card PLO), PLO Ocean/DB, Dramaha (Hi/2-7/Badugi/Hidugi/49/0/Pick'em), Cry Me a River
  - **Stud系**: Stud 2-7, Razzdugi, Super Stud (Hi/Razz/Hi-Lo8/Hi-Lo/2-7/Razzdugi)
  - **Draw系**: NL 2-7 Single Draw, A-5 Triple Draw, Hidugi, Baduecey, Badacey, Archie, NL 5-Hi SD, PL Badugi
- **再接続復帰**: `resumeToken` による席復帰 (部分実装)
- **チャット機能**: 未実装
- **ハンド履歴**: `HandHistory` 型定義のみ
- **GameVariant型に65種類定義済み** (実装済みは8種類)
