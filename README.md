# Mix Poker Game Platform (MGP)

ミックスポーカーのWebアプリケーション。複数のポーカーバリアントに対応したリアルタイム対戦プラットフォーム。

## 機能
- 複数のポーカーバリアント（5-Card Draw, Texas Hold'em, Omaha, 7-Card Stud）
- リアルタイム通信（Socket.io）
- チップ管理
- カード交換
- ショーダウンと勝者判定
- 自動リシャッフル

## セットアップ

### 必要な環境
- Node.js 18以上
- npm

### サーバー側
```bash
cd server
npm install
npm run dev
```

### クライアント側
```bash
cd client
npm install
npm run dev
```

## デプロイ

詳細は `docs/DEPLOYMENT.md` を参照してください。

## 学習用ドキュメント

`docs/learning/` ディレクトリに実装の詳細をまとめた学習ノートがあります。

## ライセンス
MIT
