# Step 3: Elastic Beanstalk でバックエンドデプロイ

## 所要時間: 15-20分

## フロントエンドURL（メモ）
`https://main.d7kdvjnb6y0vk.amplifyapp.com`

---

## Phase 1: サーバーコードの準備

### Step 1: package.json にエンジンとスクリプトを確認

`server/package.json` を開いて、以下が含まれていることを確認：

```json
{
  "scripts": {
    "dev": "ts-node index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "engines": {
    "node": "18.x"
  }
}
```

すでに設定済みのはずです✅

### Step 2: ZIPファイルを作成

ターミナルで以下のコマンドを実行：

```bash
cd /Users/naoai/Desktop/mix-poker-app/server
zip -r ../mgp-server.zip . -x "node_modules/*" -x "dist/*" -x ".DS_Store"
```

これで`mgp-server.zip`が作成されます。

---

## Phase 2: Elastic Beanstalk でデプロイ

### Step 3: Elastic Beanstalk コンソールを開く

1. AWSマネジメントコンソールの検索バー（上部中央）に `Elastic Beanstalk` と入力
2. 「Elastic Beanstalk」を選択
3. **「環境を作成」** または **「Create Application」** をクリック

### Step 4: アプリケーション情報

- **アプリケーション名**: `mgp-server`
- **アプリケーションタグ**: そのままでOK

「次へ」または下にスクロール

### Step 5: 環境情報

- **環境名**: `mgp-production`
- **ドメイン**: `mgp-production` （自動で `.elasticbeanstalk.com` が付く）
  - 使用可能かチェック
  - 使用不可の場合: `mgp-prod-123` など変更

### Step 6: プラットフォーム

- **プラットフォーム**: `Node.js` を選択
- **プラットフォームブランチ**: `Node.js 18 running on 64bit Amazon Linux 2023` （最新）
- **プラットフォームバージョン**: 推奨バージョン

### Step 7: アプリケーションコード

- **「コードをアップロード」** を選択
- **「ローカルファイル」** を選択
- **「ファイルを選択」** をクリック
- 先ほど作成した `mgp-server.zip` を選択
- **バージョンラベル**: `v1.0.0` など

### Step 8: プリセット

- **「単一インスタンス（無料利用枠の対象）」** を選択
  - これで無料枠が使えます

「次へ」をクリック

### Step 9: サービスアクセスの設定

- **サービスロール**: 「新しいサービスロールを作成して使用」
- **EC2 キーペア**: なし（SSH不要）
- **EC2 インスタンスプロファイル**: 新規作成

「次へ」をクリック

### Step 10: ネットワーク、データベース、タグの設定

- すべてデフォルトのままでOK
- 「次へ」をクリック

### Step 11: インスタンストラフィックとスケーリング

- **インスタンスタイプ**: `t3.micro` または `t2.micro` （無料枠）
- その他はデフォルト

「次へ」をクリック

### Step 12: 更新、モニタリング、ロギング

- すべてデフォルトのままでOK
- 「次へ」をクリック

### Step 13: 確認

- 設定内容を確認
- **「送信」** をクリック

---

## Phase 3: デプロイの進行

### 待機時間: 5-10分

以下のステップが自動的に実行されます：

1. ✅ **環境を作成中**
2. ✅ **リソースをプロビジョニング中**
3. ✅ **EC2インスタンスを起動中**
4. ✅ **アプリケーションをデプロイ中**
5. ✅ **ヘルスチェック実行中**

**画面上部のステータスバーで進捗を確認できます。**

---

## Phase 4: 環境変数の設定

### Step 14: デプロイ完了後、環境変数を設定

デプロイが完了したら（ステータスが「正常」になったら）：

1. 左メニュー → **「設定」**
2. **「ソフトウェア」** セクションの **「編集」** をクリック
3. **「環境プロパティ」** セクションまでスクロール
4. 以下の環境変数を追加：

| 名前 | 値 |
|------|-----|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `CLIENT_URL` | `https://main.d7kdvjnb6y0vk.amplifyapp.com` |

5. **「適用」** をクリック
6. 環境が更新されるまで2-3分待つ

---

## Phase 5: フロントエンドの環境変数を更新

### Step 15: Amplify に戻ってサーバーURLを設定

デプロイされたURLを確認：
- Elastic Beanstalk コンソールの上部に表示
- 例: `http://mgp-production.xxxxx.elasticbeanstalk.com`

1. AWS Amplify コンソールに戻る
2. アプリ `mix-poker-game-platform` を選択
3. 左メニュー → **「ホスティング」** → **「環境変数」**
4. **「変数を管理」** をクリック
5. 新しい変数を追加：
   - **変数**: `VITE_SERVER_URL`
   - **値**: `http://mgp-production.xxxxx.elasticbeanstalk.com` （あなたのURL）
6. **「保存」** をクリック
7. 自動的に再デプロイが始まります（3-5分）

---

## Phase 6: 動作確認

### Step 16: 完全な動作テスト

1. **Amplify の URL にアクセス**
   - `https://main.d7kdvjnb6y0vk.amplifyapp.com`

2. **「Connect」ボタンをクリック**
   - ✅ 接続成功のメッセージが表示される

3. **プレイヤー名を入力**
   - 「Join Game」をクリック

4. **「Deal Cards」をクリック**
   - ✅ カードが表示される

5. **ゲーム機能をテスト**
   - ベット
   - カード交換（5-Card Drawモード）
   - ショーダウン

**すべて動作すれば完了です！** 🎉

---

## トラブルシューティング

### ビルドエラー

**症状**: Elastic Beanstalk のログに `Build failed`

**解決策**:
1. ログを確認（「ログ」→「最新の100行をリクエスト」）
2. `package.json` に `build` スクリプトがあるか確認
3. ローカルで `npm run build` が成功するか確認

### 接続エラー

**症状**: フロントエンドから接続できない

**解決策**:
1. Elastic Beanstalk の環境変数 `CLIENT_URL` が正しいか確認
2. Amplify の環境変数 `VITE_SERVER_URL` が正しいか確認
3. 両方の環境変数を確認後、Amplifyを再デプロイ

### タイムアウトエラー

**症状**: ヘルスチェックが失敗

**解決策**:
1. サーバーコードが PORT 8080 でリッスンしているか確認
2. `server/index.ts` で `const PORT = process.env.PORT || 3000;` になっているか確認

---

## 完了チェックリスト

- [ ] ZIPファイル作成完了
- [ ] Elastic Beanstalk でデプロイ完了
- [ ] ステータスが「正常」
- [ ] 環境変数設定完了（サーバー側）
- [ ] 環境変数設定完了（フロントエンド側）
- [ ] Amplify 再デプロイ完了
- [ ] 動作確認完了（接続→カード配布→ゲームプレイ）

---

## 🎉 デプロイ完全完了！

おめでとうございます！Mix Poker Game Platform が AWS で本番稼働しています！

**公開URL**: `https://main.d7kdvjnb6y0vk.amplifyapp.com`

友達とシェアして遊べます！
