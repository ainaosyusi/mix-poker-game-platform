# デプロイ準備メモ

## 完了した機能

### Level 1-2: 基本機能 ✅
- Socket.io接続
- カード表示（デッキ作成とシャッフル）
- チップ管理（ベット、コール、フォールド）
- ターン管理
- ショーダウンと勝者判定

### Level 3: ゲーム設定の動的変更 ✅
- 設定オブジェクトによる管理
- プリセット（5-Card Draw, Texas Hold'em, Omaha, 7-Card Stud）
- 手札枚数の動的変更（2〜7枚）

### Level 4: ハウスルールとミックスゲーム ✅
- カード交換機能（Drawゲームの基礎） ✅
- 表向きカード（Studゲームの基礎、簡易版） ✅
- リシャッフル規則（Pattern C） ✅

## 現在のファイル構成

```
mix-poker-app/
├── server/
│   ├── index.ts           # メインサーバーロジック
│   ├── handEvaluator.ts   # 役判定ロジック
│   ├── package.json       # ES Modules対応
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   └── App.tsx       # メインクライアントUI
│   ├── package.json
│   └── vite.config.ts
└── docs/
    └── learning/
        ├── 01_server_setup.md
        ├── 02_client_connection.md
        ├── 03_card_display.md
        ├── 04_chip_management.md
        ├── 05_showdown.md
        ├── 06_game_settings_and_cards.md
        └── 07_reshuffle.md
```

## デプロイ前のチェックリスト

### 1. コードの整理
- [ ] 不要なコメントの削除
- [ ] コンソールログの整理（本番用に調整）
- [ ] 未使用のインポートやファイルの削除
- [ ] GameEngine.tsとgameVariants.ts（未使用）の削除

### 2. 環境変数の設定
- [ ] ポート番号の環境変数化
- [ ] CORS設定の本番用調整
- [ ] 環境変数ファイル(.env)の作成

### 3. 依存関係の確認
- [x] server/package.json の依存関係
- [x] client/package.json の依存関係
- [ ] セキュリティ脆弱性のチェック（npm audit）

### 4. ビルドとテスト
- [ ] サーバーのビルド確認
- [ ] クライアントのビルド確認（npm run build）
- [ ] ローカルでのE2Eテスト

## デプロイ先の選択肢

### オプション1: Render.com（推奨・初心者向け）
**メリット**:
- 無料プランあり
- 設定が簡単
- GitHubとの連携が容易

**必要な作業**:
1. Render.comアカウント作成
2. New Web Service作成
3. GitHubリポジトリ接続
4. ビルドコマンド設定
5. 環境変数設定

### オプション2: Railway
**メリット**:
- モダンなUI
- デプロイが高速
- PostgreSQL簡単設定

### オプション3: Heroku
**メリット**:
- 老舗で安定
- 豊富なアドオン

**デメリット**:
- 無料プランが廃止された

## デプロイ手順（Render.com想定）

### サーバー側

1. **package.jsonにビルドスクリプト追加**
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "ts-node index.ts"
  }
}
```

2. **Render.com設定**
- Build Command: `cd server && npm install && npm run build`
- Start Command: `cd server && npm start`
- Environment: Node

### クライアント側

1. **ビルド確認**
```bash
cd client
npm run build
```

2. **静的サイトとしてデプロイ**
- Build Command: `cd client && npm install && npm run build`
- Publish Directory: `client/dist`

### 環境変数設定例

**サーバー側**:
```
PORT=3000
NODE_ENV=production
CLIENT_URL=https://your-client-app.onrender.com
```

**クライアント側**:
```
VITE_SERVER_URL=https://your-server-app.onrender.com
```

## 現在の既知の問題

### 軽微な問題
1. **exchange-cardsハンドラー**: グローバルデッキ対応が不完全（動作には影響なし）
2. **対戦相手カード表示UI**: 未実装（将来の拡張）
3. **GameEngine.ts/gameVariants.ts**: 未使用ファイル（削除推奨）

### 対応不要の警告
- Node.js Deprecation Warning (fs.Stats): ライブラリ内部の問題で対応不要
- TypeScript lint errors (GameEngine.ts): 使用していないファイルなので削除予定

## 次のステップ

1. ✅ 学習ノート作成完了
2. 🔄 デプロイ前のコード整理
3. ⬜ GitHubリポジトリ作成・プッシュ
4. ⬜ Render.comでデプロイ
5. ⬜ 動作確認
6. ⬜ データベース連携（PostgreSQL）- 将来の拡張

## まとめ

現時点で基本的な機能はすべて実装済みです。デプロイに向けて、コードの整理とビルド確認を行えば、すぐにでもオンラインで遊べる状態になります。
