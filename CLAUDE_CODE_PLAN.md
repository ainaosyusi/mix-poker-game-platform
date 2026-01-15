# Mix Poker Platform - Claude Code 作業指示書

**作成日:** 2026-01-16  
**目的:** デザイン改善とコードリファクタリング

---

## 📋 現状サマリー

### 完了済み
- ✅ Node.js + Socket.IO サーバー構築済み
- ✅ ゲームエンジン（FSM、8種類バリアント対応）
- ✅ RoomManager、PotManager、ShowdownManager実装済み
- ✅ 基本的なReactクライアント動作確認済み
- ✅ **UIの初期改善**（本日実施）:
  - `index.css`にモダンスタイル追加（グラデーション、アニメーション）
  - `Table.tsx`を円形テーブルレイアウトに変更
  - クイックベットボタン（1/3, 1/2, 3/4 POT）追加
  - SB/BBマーカー追加

---

## 🎯 残りタスク

### 1. UI/UXの更なる改善 (優先度: 高)

#### 1.1 テーブルレイアウト調整
- 6人席の円形配置の微調整（レスポンシブ対応）
- プレイヤー座席のデザイン改善
- ベット表示位置の最適化

#### 1.2 アニメーション追加
- カード配布アニメーション
- チップ移動アニメーション（プレイヤー → ポット）
- ショーダウン時のカード公開アニメーション

#### 1.3 追加UI機能
- サウンドエフェクト（オプション）
- ゲームログ/ハンド履歴表示

---

### 2. サイドゲーム機能強化 (優先度: 中)

#### 2.1 7-2ゲーム
- 有効/無効のトグルUI
- ボーナス獲得時のアニメーション/通知
- ボーナス額のカスタマイズ機能

#### 2.2 スタンドアップゲーム
- 残りプレイヤー表示UI
- 勝利時の「座る」エフェクト
- 最終敗者への通知

**関連ファイル:**
- `/server/MetaGameManager.ts`
- `/client/src/Table.tsx`

---

### 3. ゲームバリアント追加 (優先度: 中)

#### 追加予定バリアント
1. **PLO Ocean** - Ocean Cardを使用
2. **PLO Double Board** - 2つのボード
3. **Dramaha** - Flop + Draw複合
4. **A-5 Triple Draw**
5. **NL 2-7 Single Draw**

**関連ファイル:**
- `/server/gameVariants.ts` - バリアント定義
- `/server/GameEngine.ts` - 進行ロジック
- `/server/Dealer.ts` - カード配布
- `/server/ShowdownManager.ts` - 役判定

---

### 4. AWSデプロイ (優先度: 低 - 最後に実施)

**既存ドキュメント:**
- `/docs/AWS_AMPLIFY_DEPLOY.md`
- `/docs/AWS_ELASTIC_BEANSTALK_DEPLOY.md`
- `/docs/AWS_ACCOUNT_SETUP.md`

**手順:**
1. 環境変数の設定
2. プロダクションビルド
3. サーバー → Elastic Beanstalk
4. クライアント → Amplify

---

## 📁 主要ファイル構成

```
mix-poker-app/
├── client/
│   └── src/
│       ├── App.tsx        # ルーティング
│       ├── Table.tsx      # メインゲームUI ★改善対象
│       ├── Lobby.tsx      # ロビー画面
│       └── index.css      # スタイル ★改善済み
├── server/
│   ├── index.ts           # Socket.IOサーバー
│   ├── GameEngine.ts      # FSMゲームループ
│   ├── gameVariants.ts    # バリアント定義 ★拡張対象
│   ├── MetaGameManager.ts # サイドゲーム ★拡張対象
│   ├── PotManager.ts      # ポット計算
│   └── ShowdownManager.ts # 役判定
└── docs/
    └── AWS_*.md           # デプロイ手順
```

---

## 🔧 開発コマンド

```bash
# サーバー起動
cd /Users/naoai/Desktop/mix-poker-app/server
npm run dev

# クライアント起動
cd /Users/naoai/Desktop/mix-poker-app/client
npm run dev

# ビルド確認
cd /Users/naoai/Desktop/mix-poker-app/client
npm run build

# 既存テスト実行
cd /Users/naoai/Desktop/mix-poker-app/server
npx tsx test-phase3a.ts
```

---

## ✅ 完了チェックリスト

- [ ] UI/UXの更なる改善
- [ ] サイドゲーム機能強化
- [ ] ゲームバリアント追加
- [ ] 動作確認（ローカル）
- [ ] AWSデプロイ

---

**備考:** 各タスクは順番に実施する必要はなく、並行して進めてOK。ただしAWSデプロイは各機能の完成後に最後に実施すること。
