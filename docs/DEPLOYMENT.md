# GitHub & Render.com デプロイガイド

## ✅ GitHub リポジトリ作成完了

**リポジトリURL**: https://github.com/ainaosyusi/mix-poker-game-platform

**プッシュ結果**:
- ✅ 72ファイル
- ✅ 3.04 MB
- ✅ ブランチ: main

---

## 次のステップ: Render.comへのデプロイ

### 準備するもの
- Render.comアカウント (https://render.com/)
- GitHubアカウント（すでに接続済み）

### デプロイ手順

## 1. サーバー側のデプロイ（Web Service）

### Step 1: Render.comでWeb Service作成
1. Render.comにログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続
4. 「mix-poker-game-platform」を選択

### Step 2: 設定を入力
- **Name**: `mgp-server` (任意の名前)
- **Region**: `Singapore` (最も近い地域)
- **Branch**: `main`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: `Free`

### Step 3: 環境変数を設定
- `NODE_ENV`: `production`
- `PORT`: `10000` (Renderのデフォルト)

### Step 4: デプロイ実行
「Create Web Service」をクリック

---

## 2. クライアント側のデプロイ（Static Site）

### Step 1: Render.comでStatic Site作成
1. Render.comに戻る
2. 「New +」→「Static Site」を選択
3. 同じGitHubリポジトリを選択

### Step 2: 設定を入力
- **Name**: `mgp-client` (任意の名前)
- **Branch**: `main`
- **Root Directory**: `client`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### Step 3: 環境変数を設定
- `VITE_SERVER_URL`: `https://mgp-server.onrender.com` (Step 1で作成したサーバーのURL)

### Step 4: デプロイ実行
「Create Static Site」をクリック

---

## 3. デプロイ後の確認

### サーバー側
- Render.comのログで起動を確認
- `🚀 Server is running on http://localhost:10000` が表示されればOK

### クライアント側
- デプロイ完了後、URLにアクセス
- 接続ボタンが表示されることを確認

### 動作確認
1. クライアントのURLにアクセス
2. 「Connect」ボタンをクリック
3. プレイヤー名を入力して「Join Game」
4. カードを引いて動作確認

---

## トラブルシューティング

### サーバーが起動しない
- ログを確認: `npm install`が成功しているか
- 環境変数が正しく設定されているか
- `package.json`の`start`スクリプトが正しいか

### クライアントが接続できない
- `VITE_SERVER_URL`が正しいサーバーURLになっているか
- サーバーが起動しているか
- CORSエラーが出ていないか（サーバーログ確認）

### ビルドが失敗する
- ローカルで`npm run build`が成功するか確認
- Node.jsのバージョンが合っているか（18以上）

---

## 無料プランの制限

### Render.com Free Tier
- **Web Service**:
  - 15分間アクセスがないと自動的にスリープ
  - 再起動に30秒〜1分程度かかる
  - 月750時間まで無料

- **Static Site**:
  - 常時稼働
  - 100GB/月の帯域幅

### 注意点
- 初回アクセス時は起動に時間がかかる
- 本番環境として使う場合は有料プランを検討

---

## GitHubへの今後の更新

コードを変更した後：

```bash
git add .
git commit -m "変更内容の説明"
git push
```

Render.comは自動的に検知して再デプロイします（Auto-Deploy有効の場合）。

---

## 完了チェックリスト

- [ ] Render.comアカウント作成
- [ ] サーバー側デプロイ完了
- [ ] クライアント側デプロイ完了
- [ ] 環境変数設定完了
- [ ] 動作確認完了
- [ ] URLをREADME.mdに追記
