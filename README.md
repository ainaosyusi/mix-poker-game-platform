# Mix Poker Game Platform (MGP)

ミックスポーカーのWebアプリケーション。複数のポーカーバリアントに対応したリアルタイム対戦プラットフォーム。

## 対応ゲーム
- **NLH** - No-Limit Hold'em
- **PLO** - Pot-Limit Omaha
- **PLO8** - Pot-Limit Omaha Hi-Lo
- **7CS** - 7-Card Stud
- **7CS8** - 7-Card Stud Hi-Lo
- **RAZZ** - Razz (Stud Lowball)
- **2-7_TD** - 2-7 Triple Draw
- **BADUGI** - Badugi

## 主な機能
- 6人/8人テーブル対応
- ゲームローテーション（ミックスゲームモード）
- リアルタイム通信（Socket.IO）
- タイマーシステム（30秒/アクション）
- タイムバンク（5チップ、各30秒）
- 自動フォールド/チェック（切断時）
- カードディールアニメーション

## セットアップ

### 必要な環境
- Node.js 18以上
- npm

### サーバー起動
```bash
cd server
npm install
npm run dev
# → http://localhost:3000
```

### クライアント起動
```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

## 開発進捗

### v0.4.0 (2026-01-20) - UI大幅改善
#### 新機能
- タイマーシステム実装（サーバーサイド管理）
- タイムバンク機能追加
- カードディールアニメーション（フロップ/ターン/リバー）
- 3Dチップスタック表示

#### UI改善
- プレイヤーカード表示を名前タグ上部に移動
- チップ位置をテーブル中央寄りに調整
- ディーラーボタンをテーブル面上に配置
- ショーダウン表示を簡素化（青いパネル廃止）
- 上部プレイヤーのカード位置調整（ヘッダーとの重なり回避）
- ハンドランク表示を名前タグ下部に追加

#### バグ修正
- タイマー切れ時の「Not your turn」エラー修正
- 7-Card Stud初期配布修正（2ダウン+1アップ）
- CSSクラス競合によるスタイル崩れ修正（インラインCSS化）

### v0.3.x - 基本機能実装
- ゲームエンジン実装
- 全8種類のポーカーバリアント対応
- ハンド評価ロジック
- ポット計算・分配
- ショーダウン処理

## プロジェクト構造
```
mix-poker-app/
├── server/                    # バックエンド
│   ├── index.ts               # メインエントリ、Socket.IOハンドラ
│   ├── GameEngine.ts          # ゲームステートマシン
│   ├── Dealer.ts              # カード配布ロジック
│   ├── handEvaluator.ts       # ハンド評価
│   └── ShowdownManager.ts     # ショーダウン処理
│
└── client/                    # フロントエンド
    └── src/
        ├── Table.tsx          # メインテーブルページ
        ├── components/
        │   ├── table/         # テーブルコンポーネント
        │   ├── player/        # プレイヤー表示
        │   ├── cards/         # カードコンポーネント
        │   ├── chips/         # チップ表示
        │   ├── action/        # アクションパネル
        │   └── log/           # ゲームログ
        └── hooks/             # カスタムフック
```

## デプロイ
詳細は `docs/DEPLOYMENT.md` を参照してください。

## 学習用ドキュメント
`docs/learning/` ディレクトリに実装の詳細をまとめた学習ノートがあります。

## ライセンス
MIT
