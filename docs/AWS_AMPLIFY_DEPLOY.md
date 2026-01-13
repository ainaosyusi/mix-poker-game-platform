# Step 2: AWS Amplify でフロントエンドデプロイ

## 所要時間: 10-15分

## 事前確認

### リージョンを東京に設定
1. AWSマネジメントコンソール右上のリージョン名をクリック
2. 「アジアパシフィック（東京）ap-northeast-1」を選択
3. ✅ 右上に「東京」と表示されていることを確認

---

## デプロイ手順

### Step 1: AWS Amplify コンソールを開く

1. AWSマネジメントコンソールの検索バー（上部中央）に `Amplify` と入力
2. 「AWS Amplify」を選択
3. 画面が開いたら、**「Get started」** または **「新しいアプリ」** をクリック

### Step 2: ホスティングオプションを選択

- **「Amplify Hosting」** セクションを探す
- **「Host web app」** または **「Get started」** をクリック

### Step 3: Gitプロバイダーを選択

- **「GitHub」** を選択
- 「Continue」をクリック

### Step 4: GitHub認証

1. GitHubのログイン画面が表示される（すでにログイン済みの場合はスキップ）
2. **「Authorize AWS Amplify」** をクリック
   - AWS AmplifyがGitHubリポジトリにアクセスする権限を付与
3. パスワード確認を求められたら入力

### Step 5: リポジトリとブランチを選択

- **Repository**: `ainaosyusi/mix-poker-game-platform` を選択
- **Branch**: `main` を選択
- 「Next」をクリック

### Step 6: ビルド設定

#### アプリ名の設定
- **App name**: `mgp-client` (任意の名前)

#### ビルド設定の編集

画面に表示されているビルド設定（amplify.yml）を以下に**置き換え**:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd client
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: client/dist
    files:
      - '**/*'
  cache:
    paths:
      - client/node_modules/**/*
```

**重要ポイント**:
- `client`ディレクトリに移動してからビルド
- `npm ci`で依存関係をインストール（`npm install`より高速）
- ビルド成果物は`client/dist`に出力

#### 環境変数の設定（後で追加）
- 今はスキップ（バックエンドURL確定後に設定）

### Step 7: 詳細設定（オプション）

- **Service role**: 自動作成を選択（初回のみ）
- その他の設定はデフォルトのままでOK
- 「Next」をクリック

### Step 8: 最終確認

- 設定内容を確認
- 問題なければ **「Save and deploy」** をクリック

---

## デプロイの進行状況

### フェーズ1: Provision (プロビジョニング)
- 所要時間: 1-2分
- リソースの準備

### フェーズ2: Build (ビルド)
- 所要時間: 3-5分
- `npm install` と `npm run build` を実行
- エラーが出る可能性: ログを確認

### フェーズ3: Deploy (デプロイ)
- 所要時間: 1-2分
- ビルド成果物をCDNに配信

### フェーズ4: 完了 ✅
- 画面に **デプロイ完了** と表示される
- URLが発行される（例: `https://main.xxxxx.amplifyapp.com`）

---

## デプロイ完了後の確認

### ✅ Step 9: URLにアクセス

1. Amplifyコンソールに表示されているURLをクリック
2. Mix Poker Game Platformの画面が表示されることを確認
3. **URLをメモしておく**（後でバックエンドの環境変数に使用）

### ⚠️ 現時点での動作

- ✅ 画面は表示される
- ❌ 「Connect」ボタンをクリックしても接続できない
  - 理由: バックエンドがまだデプロイされていない
  - **正常です！次のステップでバックエンドをデプロイします**

---

## トラブルシューティング

### ビルドエラーが発生した場合

#### エラー: `npm: command not found`
- ビルド設定の`preBuild`に`npm ci`があるか確認

#### エラー: `No such file or directory: client`
- ビルド設定で`cd client`が実行されているか確認

#### エラー: `Build failed`
- Build logsを確認
- ローカルで`cd client && npm run build`が成功するか確認

### GitHub接続エラー

- GitHub認証をやり直す
- リポジトリが正しく選択されているか確認

---

## 完了チェックリスト

- [ ] Amplifyコンソールでデプロイ完了
- [ ] デプロイされたURL（`https://main.xxxxx.amplifyapp.com`）にアクセス可能
- [ ] URLをメモした
- [ ] 画面が表示される（接続はまだできなくてOK）

---

## 次のステップ

✅ フロントエンドデプロイ完了！

次は **バックエンドのデプロイ（Elastic Beanstalk）** です。
準備ができたら教えてください！
