# Mix Poker App - Railway デプロイガイド

## 概要
Mix PokerアプリをRailwayにデプロイする手順書です。
フロントエンド（React）とバックエンド（Node.js + Socket.IO）を1つのサービスとしてデプロイします。

---

## 事前準備（完了済み）

以下の設定は既にコードに反映されています：

- [x] `railway.toml` - Railway設定ファイル
- [x] ルートの `package.json` - ビルドスクリプト
- [x] サーバーの本番環境対応（静的ファイル配信、CORS設定）
- [x] クライアントの本番環境対応（同一オリジン接続）
- [x] GitHubへプッシュ済み

**リポジトリ**: https://github.com/ainaosyusi/mix-poker-game-platform

---

## デプロイ手順

### Step 1: Railwayアカウント作成

1. https://railway.app にアクセス
2. **「Login」** をクリック
3. **GitHubアカウントでログイン**（推奨）
   - GitHubと連携することで、リポジトリへのアクセスが簡単になります

### Step 2: 新規プロジェクト作成

1. ダッシュボードで **「+ New Project」** ボタンをクリック
2. **「Deploy from GitHub repo」** を選択
3. GitHubリポジトリ一覧から **`ainaosyusi/mix-poker-game-platform`** を選択
   - 見つからない場合は「Configure GitHub App」でリポジトリへのアクセスを許可
4. **「Deploy Now」** をクリック

### Step 3: 環境変数を設定

プロジェクト画面で以下を設定：

1. デプロイされたサービスをクリック
2. **「Variables」** タブを開く
3. **「+ New Variable」** で以下を追加：

| Variable | Value | 説明 |
|----------|-------|------|
| `NODE_ENV` | `production` | 本番環境モード |
| `PORT` | `3000` | サーバーポート（Railwayが自動設定する場合は不要） |

### Step 4: ドメイン（公開URL）を設定

1. **「Settings」** タブを開く
2. **「Networking」** セクションを見つける
3. **「Generate Domain」** ボタンをクリック
4. `your-app-name.up.railway.app` のようなURLが発行される

### Step 5: デプロイ完了を確認

1. **「Deployments」** タブを開く
2. 最新のデプロイメントをクリック
3. ビルドログを確認
4. ステータスが **緑色の「Success」** になれば完了
5. 発行されたURLにアクセスして動作確認

---

## トラブルシューティング

### ビルドエラーが発生した場合

1. **Deployments** タブでログを確認
2. よくある原因：
   - `npm install` の失敗 → package-lock.jsonの不整合
   - TypeScriptコンパイルエラー → ローカルで `npm run build` を確認
   - メモリ不足 → Railwayのプランをアップグレード

### Socket.IOが接続できない場合

1. ブラウザの開発者ツールでコンソールを確認
2. ネットワークタブでWebSocket接続を確認
3. CORSエラーが出ている場合は環境変数を確認

### アプリが起動しない場合

1. **Logs** タブでサーバーログを確認
2. `PORT` 環境変数が正しく設定されているか確認
3. `NODE_ENV=production` が設定されているか確認

---

## 費用について

### 無料枠（Trial Plan）
- **$5分のクレジット**が付与される
- クレジットカード登録不要で開始可能
- 小規模なテストには十分

### 有料プラン（Hobby Plan）
- **$5/月** から
- 使用量に応じた従量課金
- 本番運用向け

### 予想コスト（Mix Poker App）
- 軽い利用: **$5-7/月**
- 中程度の利用: **$10-15/月**
- 24時間稼働 + 複数ユーザー: **$15-25/月**

---

## カスタムドメイン設定（オプション）

独自ドメインを使用する場合：

1. **Settings** > **Networking** > **Custom Domain**
2. ドメイン名を入力（例: `poker.yourdomain.com`）
3. 表示されるDNSレコードをドメインのDNS設定に追加
4. SSL証明書は自動で発行される

---

## 更新・再デプロイ

コードを更新した場合：

1. 変更をコミット: `git add . && git commit -m "update"`
2. GitHubにプッシュ: `git push origin main`
3. Railwayが自動的に再デプロイを開始
4. **Deployments** タブで進行状況を確認

---

## ローカル開発との切り替え

### ローカル開発
```bash
# サーバー起動
cd server && npm run dev

# クライアント起動（別ターミナル）
cd client && npm run dev
```

### 本番ビルドテスト（ローカル）
```bash
# クライアントビルド
cd client && npm run build

# サーバービルド
cd server && npm run build

# 本番モードで起動
NODE_ENV=production node server/dist/index.js
```

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `/railway.toml` | Railwayビルド設定 |
| `/package.json` | ルートのビルドスクリプト |
| `/.env.example` | 環境変数サンプル |
| `/server/index.ts` | サーバーエントリーポイント（静的ファイル配信含む） |
| `/client/src/App.tsx` | Socket.IO接続設定 |

---

## サポート

- **Railway公式ドキュメント**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **プロジェクトのIssue**: https://github.com/ainaosyusi/mix-poker-game-platform/issues
