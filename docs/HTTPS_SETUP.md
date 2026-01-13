# Elastic Beanstalk HTTPS化ガイド

## 現状の問題

- フロントエンド（Amplify）: `https://` ✅
- バックエンド（Elastic Beanstalk）: `http://` ❌

ブラウザのMixed Contentポリシーにより、HTTPSページからHTTPリソースへのアクセスがブロックされています。

## 解決方法: Application Load Balancer + SSL証明書

### 方法1: 環境を再作成（推奨）

単一インスタンス → ロードバランサー環境に変更

#### 手順

1. **新しい環境を作成**
   - Elastic Beanstalkコンソール → アプリケーション → 「環境を作成」
   - プリセット: **高可用性**（Application Load Balancer付き）
   - 同じアプリケーションバージョンを選択

2. **SSL証明書の取得**
   - AWS Certificate Manager（ACM）でSSL証明書をリクエスト
   - ドメインがない場合: Elastic Beanstalkのデフォルトドメインを使用

3. **ロードバランサーの設定**
   - リスナーを追加: HTTPS (443)
   - SSL証明書を選択
   - ターゲットグループ: エ8080

4. **環境変数の更新**
   - `CLIENT_URL`: `https://main.d7kdvjnb6y0vk.amplifyapp.com`

5. **Amplify環境変数の更新**
   - `VITE_SERVER_URL`: `https://新しいURL.elasticbeanstalk.com`

### 方法2: より簡単な代替案（無料）

**Cloudflare Tunnel** or **ngrok**を使ってHTTPSプロキシを作成

#### Cloudflare Tunnelの手順

1. Cloudflareアカウント作成（無料）
2. Cloudflare Tunnel作成
3. Elastic Beanstalk URLをトンネルに接続
4. HTTPSのURLが自動生成される
5. Amplifyの環境変数を更新

### 方法3: 最も簡単（推奨・学習用）

**ローカル環境で開発を続ける**

現時点では、以下の理由からローカル開発を推奨：

✅ すべての機能が動作する  
✅ コストがかからない  
✅ デバッグが簡単  
✅ デプロイの練習は完了

本番運用が必要になったら、HTTPS化を実施する。

## 今すぐできること

### オプションA: ローカルで開発を続ける（推奨）

```bash
# サーバー（すでに起動中）
cd server
npx ts-node index.ts

# クライアント（すでに起動中）
cd client  
npm run dev
```

→ `http://localhost:5173` でゲームをプレイ

### オプションB: HTTPS化に挑戦

Application Load Balancerを追加してSSL証明書を設定（有料の可能性あり）

## 結論

学習目的であれば、**ローカル環境**で十分です。

AWS環境へのデプロイ経験は既に得られているので、HTTPS化は本番運用が必要になったタイミングで実施することをお勧めします。
