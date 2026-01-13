# 最終ステップ: フロントエンドとバックエンドの統合

## Phase 1: Elastic Beanstalk の確認（2-3分）

### Step 1: 環境の更新を待つ

環境変数を設定したので、Elastic Beanstalkが自動的に環境を更新します。

**画面の確認**:
1. Elastic Beanstalk コンソールの `mgp-production` 環境ページに戻る
2. 画面上部の「環境の概要」セクションを確認
3. **ヘルス** のステータスをチェック：
   - 🔄 更新中: 「Updating」や「Processing」
   - ✅ 完了: 「Ok」（緑色）
   - ❌ エラー: 「Degraded」（赤色）のまま

**2-3分待ってください。** 自動的に更新されます。

### Step 2: サーバーURLを確認

ヘルスが「Ok」（緑色）になったら：

1. 「環境の概要」セクションの **「ドメイン」** を確認
2. URLが表示されています（例: `mgp-production.ap-northeast-1.elasticbeanstalk.com`）
3. **このURLをコピー**してください

**完全なURL**: `http://mgp-production.ap-northeast-1.elasticbeanstalk.com`
（`http://` から始まることに注意！）

---

## Phase 2: Amplify の環境変数を設定

### Step 3: AWS Amplify コンソールに移動

1. AWSマネジメントコンソールで **「Amplify」** を検索
2. アプリ **「mix-poker-game-platform」** をクリック

### Step 4: 環境変数を追加

1. 左メニュー → **「ホスティング」** → **「環境変数」**
2. **「変数を管理」** をクリック
3. **「変数を追加」** をクリック
4. 以下を入力：
   - **変数**: `VITE_SERVER_URL`
   - **値**: `http://mgp-production.ap-northeast-1.elasticbeanstalk.com`
     （あなたのElastic BeanstalkのURL）
5. **「保存」** をクリック

### Step 5: 再デプロイを待つ

- 保存すると、自動的に再デプロイが始まります
- 所要時間: 3-5分
- 「デプロイ」タブでステータスを確認できます

---

## Phase 3: 完全な動作確認 🎉

### Step 6: アクセスしてテスト

再デプロイが完了したら：

1. **Amplify の URL にアクセス**
   - `https://main.d7kdvjnb6y0vk.amplifyapp.com`

2. **接続テスト**
   - 「Connect」ボタンをクリック
   - ✅ 「Connected」と表示される

3. **ゲーム参加**
   - プレイヤー名を入力
   - 「Join Game」をクリック

4. **カード配布**
   - 「Deal Cards」をクリック
   - ✅ カードが5枚表示される

5. **ゲームモード変更**
   - ドロップダウンで「7-Card Stud」を選択
   - 「Deal Cards」をクリック
   - ✅ カードが7枚表示される

6. **カード交換（5-Card Draw）**
   - モードを「5-Card Draw」に変更
   - カードを選択（クリック）
   - 「Exchange X Cards」をクリック
   - ✅ 新しいカードに交換される

7. **ベットアクション**
   - 「Bet」をクリック
   - ✅ チップが減る

8. **ショーダウン**
   - 「Showdown」をクリック
   - ✅ 役が表示される

---

## トラブルシューティング

### 接続できない

**症状**: 「Connect」をクリックしても接続できない

**確認事項**:
1. Amplifyの環境変数 `VITE_SERVER_URL` が正しいか
2. Elastic Beanstalkのヘルスが「Ok」か
3. Elastic Beanstalkの環境変数が正しく設定されているか

**解決方法**:
- ブラウザのコンソール（F12）でエラーを確認
- Amplifyを再デプロイ

### Elastic Beanstalk が「Degraded」のまま

**症状**: ヘルスステータスが緑色にならない

**確認事項**:
1. ログを確認: 「ログ」→「最新の100行をリクエスト」
2. `npm: command not found` エラーがないか
3. ポート 8080 でリッスンしているか

**解決方法**:
- 環境変数 `PORT` が `8080` に設定されているか確認
- サーバーコードが `process.env.PORT` を使用しているか確認

---

## 🎉 完了！

すべてのテストが成功したら、**デプロイ完了**です！

### 公開URL
`https://main.d7kdvjnb6y0vk.amplifyapp.com`

### 次のステップ（オプション）

1. **カスタムドメイン設定**
   - Route 53 や お名前.com でドメイン購入
   - Amplifyでカスタムドメイン設定

2. **データベース追加**
   - RDS (PostgreSQL) を作成
   - プレイヤーデータを永続化

3. **モニタリング設定**
   - CloudWatch でログ監視
   - アラート設定

4. **セキュリティ強化**
   - HTTPS化（Elastic Beanstalk）
   - 認証機能追加

---

## まとめ

おめでとうございます！🎉

Mix Poker Game Platform が AWS で本番稼働しています！

- ✅ フロントエンド: AWS Amplify (CDN付き)
- ✅ バックエンド: Elastic Beanstalk (Node.js)
- ✅ 自動デプロイ: GitHubプッシュで自動更新
- ✅ 無料枠: 12ヶ月間ほぼ無料

**AWS実務経験をゲット！** 履歴書に書けます👍
