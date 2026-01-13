# Learning Note 08: AWS環境構築とデプロイ

## 目標
Mix Poker Game PlatformをAWS上にデプロイし、本番環境で動作させる。

## 学んだこと

### AWSサービスの選定

#### フロントエンド: AWS Amplify
**選んだ理由**:
- GitHubと連携して自動デプロイ
- ビルドとホスティングが統合されている
- HTTPSが標準で有効
- 無料枠が十分

**設定内容**:
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

#### バックエンド: AWS Elastic Beanstalk
**選んだ理由**:
- Node.jsアプリを簡単にデプロイ
- オートスケーリング対応
- ログ管理とモニタリング
- 学習教材として有用

**設定内容**:
- プラットフォーム: Node.js 18
- 環境タイプ: 単一インスタンス（無料枠対応）
- 環境変数: `PORT`, `CLIENT_URL`, `NODE_ENV`

### デプロイで直面した課題と解決

#### 課題1: ポート設定
**問題**: サーバーがハードコードされたポート3000で起動

**原因**: 
```typescript
const PORT = 3000; // ハードコード
```

**解決**:
```typescript
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

**学び**: クラウド環境では動的にポートが割り当てられるため、環境変数から読み込む必要がある。

#### 課題2: CORS設定
**問題**: ローカル開発用のCORS設定（`localhost:5173`のみ）

**原因**:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // 固定
    methods: ["GET", "POST"]
  }
});
```

**解決**:
```typescript
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

**学び**: 環境ごとに異なる設定を環境変数で管理することで、同じコードを複数の環境で使える。

#### 課題3: ビルド出力
**問題**: TypeScriptビルド時に`dist/`フォルダが作成されない

**原因**: `tsconfig.json`に`outDir`が指定されていなかった

**解決**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",  // 追加
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

**学び**: TypeScriptの設定ファイルを正しく構成することの重要性。

#### 課題4: デプロイパッケージ
**問題**: 初回のZIPファイルに`dist/`が含まれていなかった

**原因**: ビルドせずにZIPを作成していた

**解決**:
```bash
cd server
npm run build  # TypeScriptをコンパイル
zip -r server-package.zip dist/ package.json package-lock.json Procfile handEvaluator.js .env.example
```

**学び**: デプロイ前に必ずビルドを実行し、成果物を確認する。

#### 課題5: クライアント側のサーバーURL
**問題**: クライアントコードが`localhost:3000`にハードコード

**原因**:
```typescript
const socket = io('http://localhost:3000');
```

**解決**:
```typescript
const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
console.log('Connecting to server:', serverUrl);
const socket = io(serverUrl);
```

**学び**: フロントエンドでも環境変数を使って動的にサーバーURLを設定する。

#### 課題6: Mixed Content エラー ⚠️
**問題**: AmplifyはHTTPS、Elastic BeanstalkはHTTPのため、ブラウザが接続をブロック

**エラーメッセージ**:
```
[blocked] The page at https://main.d7kdvjnb6y0vk.amplifyapp.com/ 
requested insecure content from 
http://mgp-production.ap-northeast-1.elasticbeanstalk.com/
```

**原因**: HTTPSページからHTTPリソースにアクセスすることは、セキュリティ上ブロックされる

**暫定対応**: ローカル環境（両方HTTP）で動作確認

**本番対応（今後）**: 
1. Application Load Balancer (ALB)を追加
2. AWS Certificate Manager (ACM)でSSL証明書を取得
3. Elastic BeanstalkをHTTPS化

### 環境変数管理

#### Elastic Beanstalk（バックエンド）
```bash
PORT=8080
CLIENT_URL=https://main.d7kdvjnb6y0vk.amplifyapp.com
NODE_ENV=production
```

#### AWS Amplify（フロントエンド）
```bash
VITE_SERVER_URL=http://mgp-production.ap-northeast-1.elasticbeanstalk.com
```

### ログの活用

Elastic Beanstalkでは複数のログファイルで問題を診断：

1. **`/var/log/web.stdout.log`**: アプリケーションの標準出力
   - サーバーの起動メッセージ
   - エラーメッセージ

2. **`/var/log/nginx/access.log`**: Nginxのアクセスログ
   - HTTPステータスコード（200, 404, 502など）
   - リクエスト元

3. **`/var/log/nginx/error.log`**: Nginxのエラーログ
   - アップストリーム接続エラー
   - CORSエラー

4. **`/var/log/eb-engine.log`**: Elastic Beanstalkのデプロイログ
   - デプロイの成功/失敗
   - 環境変数の読み込み

### デバッグのワークフロー

1. **ヘルスチェック確認**
   - Elastic Beanstalkのダッシュボードで環境の健全性を確認
   - 緑色（Ok）になるまで待つ

2. **ログ確認**
   - 「ログをリクエスト」→「最新の100行」
   - エラーメッセージを検索

3. **ポート確認**
   - `web.stdout.log`で起動ポートを確認
   - `Server is running on http://localhost:8080` が正しい

4. **接続テスト**
   - ブラウザでElastic BeanstalkのURLにアクセス
   - ヘルスチェックのJSONが返ればOK

## 成果物

### デプロイされたURL
- **フロントエンド**: `https://main.d7kdvjnb6y0vk.amplifyapp.com`
- **バックエンド**: `http://mgp-production.ap-northeast-1.elasticbeanstalk.com`

### 作成したドキュメント
- `docs/AWS_ACCOUNT_SETUP.md`
- `docs/AWS_AMPLIFY_DEPLOY.md`
- `docs/AWS_ELASTIC_BEANSTALK_DEPLOY.md`
- `docs/AWS_FINAL_STEPS.md`
- `docs/CLOUD_COMPARISON.md`

## 今後の改善

### 優先度: 高
- [ ] Elastic BeanstalkをHTTPS化
  - Application Load Balancer追加
  - SSL証明書取得（AWS Certificate Manager）
  - 環境変数の更新（`https://`に変更）

### 優先度: 中
- [ ] カスタムドメイン設定
- [ ] CI/CDパイプライン構築
- [ ] モニタリング・アラート設定

## まとめ

AWS環境へのデプロイを通じて、以下を学びました：

1. **インフラストラクチャ**: クラウドサービスの選定と設定
2. **環境設定**: 環境変数による柔軟な設定管理
3. **セキュリティ**: CORS、HTTPS、Mixed Contentの理解
4. **デバッグ**: ログを活用した問題解決
5. **DevOps**: ビルド、デプロイ、モニタリングの一連の流れ

ローカル開発からクラウドデプロイまで、フルスタック開発の全体像を体験できました。
