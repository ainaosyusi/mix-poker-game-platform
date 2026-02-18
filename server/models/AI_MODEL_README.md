# OFC AI Model - Phase 10 FL Stay (150M steps)

**Updated**: 2026-02-19
**Source**: OFC NN プロジェクト (`/Users/naoai/試作品一覧/OFC NN`)

---

## モデル概要

| 項目 | 値 |
|:-----|:---|
| ファイル | `ofc_ai.onnx` |
| サイズ | 2.47 MB |
| 学習Phase | Phase 10 FL Stay |
| 学習ステップ | 150,000,000 |
| アルゴリズム | MaskablePPO (Stable-Baselines3) |
| 出力形式 | **logits** (masked) |

## 性能指標 (500ゲーム評価)

| 指標 | 値 |
|:-----|:---|
| Foul Rate | 18.0% |
| Mean Score | +36.08 |
| Mean Royalty | +6.10 |
| FL Entry Rate | 33.6% |
| FL Stay Rate | 15.8% |
| FL Stay/Entry | 47.0% |
| Win Rate | 55.2% |

## ONNX入出力仕様

### 入力

| 名前 | 型 | Shape | 説明 |
|:-----|:---|:------|:-----|
| `observation` | float32 | `[1, 881]` | 観測ベクトル |
| `action_mask` | float32 | `[1, 243]` | アクションマスク (1=有効, 0=無効) |

### 出力

| 名前 | 型 | Shape | 説明 |
|:-----|:---|:------|:-----|
| `logits` | float32 | `[1, 243]` | マスク適用済みlogits |

- 無効アクションのlogitsは `-1e8`
- `argmax(logits)` で最良アクションを取得
- 確率分布が必要な場合は `softmax(logits)` を適用

## アクション空間 (243)

```
アクション = slot_index (0-12) × カード選択パターン

Initial Deal (5枚配置):
  アクション 0-12: 各スロットに配置

Pineapple Turn (3枚から2枚選択+1枚捨て):
  アクション 0-80: (slot1, slot2, discard) の組み合わせ

Fantasy Land (14-17枚一括配置):
  アクション 0: ソルバーが最適配置を決定
```

## 観測空間 (881次元)

```
[0-12]    自分のボード (top 3 + mid 5 + bot 5) × カードインデックス
[13-25]   対戦相手1のボード
[26-38]   対戦相手2のボード
[39-92]   自分の手札 (one-hot, 54枚)
[93-146]  捨て札/見えたカード
[147-...]  FL状態、ゲームフェーズ、ロイヤリティ情報等
```

## OFCBot.ts との対応

`OFCBot.ts` は以下のフローでAI推論を実行:

1. ゲーム状態 → `buildObservation()` で881次元に変換
2. 有効アクション → `buildActionMask()` で243次元マスク生成
3. ONNX推論 → `runInferenceLogits()` でlogits取得
4. `argmax` or `rankActionsByLogit()` でアクション選択
5. ファウル防止レイヤーで検証

## バージョン履歴

| バージョン | モデル | 日付 |
|:----------|:-------|:-----|
| v2.0.0 | Phase 10 FL Stay (150M) | 2026-02-19 |
| v1.5.0 | Phase 10 FL Stay (18M) | 2026-02-13 |
| v1.0.0 | Phase 9 FL Mastery (250M) | 2026-02-10 |

## 再エクスポート手順

Phase 10モデルから再度ONNXを生成する場合:

```bash
cd "/Users/naoai/試作品一覧/OFC NN"
source .venv/bin/activate
python scripts/export_onnx.py \
  --model models/phase10_gcp/p10_fl_stay_150000000.zip \
  --output models/onnx/ofc_ai_v2.onnx \
  --mode logits \
  --verify
```

## 注意事項

- OFC NNは54枚デッキ（Joker 2枚含む）、mix-poker-appは52枚対応が必要
- OFC NNは3人対戦で学習、mix-poker-appは2人対戦 → 3番目のプレイヤーはダミー
- 推論速度: 10-50ms/手 (CPU)
