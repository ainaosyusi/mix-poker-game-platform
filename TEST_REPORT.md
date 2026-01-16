# Mix Poker App - テスト準備レポート

テスト仕様書に基づき、現在の実装状況を分析しました。

---

## 実装状況サマリー

| カテゴリ | テスト可能 | 要修正 | 未実装 |
|---------|-----------|--------|--------|
| 基本フロー (B-01~B-06) | 6 | 0 | 0 |
| ベッティングロジック (L-01~L-06) | 4 | 2 | 0 |
| サイドポット (SP-01~SP-05) | 0 | 5 | 0 |
| Hold'em/Omaha (V-NLH~V-HILO) | 2 | 2 | 0 |
| Stud Games (V-ST1~V-RAZZ) | 2 | 2 | 0 |
| Draw Games (V-DR1~V-BAD) | 4 | 0 | 2 |
| ゲーム進行 (F-01~F-05) | 3 | 1 | 1 |
| エッジケース (E-01~E-04) | 2 | 1 | 1 |

---

## 1. 基本フロー (B-01~B-06) ✅ テスト可能

| ID | 状態 | 備考 |
|----|------|------|
| B-01 | ✅ | 部屋作成設定OK |
| B-02 | ✅ | 着席とバイインOK |
| B-03 | ✅ | 「Start Game」ボタンでゲーム開始 |
| B-04 | ✅ | ブラインド自動徴収OK (`Dealer.ts:collectBlinds`) |
| B-05 | ✅ | ボタン移動OK (`Dealer.ts:moveButton`) |
| B-06 | ✅ | ヘッズアップ時SB=Dealer対応済み (`Dealer.ts:172-175`) |

---

## 2. ベッティングロジック (L-01~L-06)

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| L-01 | ✅ | CHECKの可否判定OK (`GameEngine.ts:137-139`) |
| L-02 | ✅ | コール額計算OK (`GameEngine.ts:143-150`) |
| L-05 | ✅ | BBオプションOK |
| L-06 | ✅ | フォールド時のチップ処理OK |

### ⚠️ 要確認/修正
| ID | 状態 | 問題点 |
|----|------|--------|
| L-03 | ⚠️ | ミニマムレイズ計算に問題あり |
| L-04 | ⚠️ | リレイズ計算に問題あり |

**問題詳細 (L-03, L-04):**
```typescript
// GameEngine.ts:159-174
// 現在の実装:
if (betAmount < room.gameState.minRaise) { // betAmountは追加額
    return { success: false, error: `Minimum bet is ${room.gameState.minRaise}` };
}
const raiseSize = totalBet - room.gameState.currentBet;
room.gameState.minRaise = raiseSize;
```

**問題:** `minRaise`はレイズの「サイズ」を表すべきだが、ベット検証時の比較が不明確。
- テスト時: BB=10に対してレイズする場合、最低でも20へのレイズ（10上乗せ）が必要
- 現在の動作を確認する必要あり

---

## 3. サイドポット (SP-01~SP-05) ⚠️ 要修正

### 問題: PotManagerが統合されていない

**現状:**
- `PotManager.ts` にサイドポット計算ロジックは存在
- しかし `GameEngine.ts` や `index.ts` で使用されていない
- ポットは常に `room.gameState.pot.main` に加算されるのみ

**影響:**
- SP-01~SP-05 すべてのサイドポットテストが失敗する可能性

**修正方針:**
1. ハンド終了時に `PotManager.calculatePots()` を呼び出す
2. `ShowdownManager` でサイドポットを考慮した分配を行う

---

## 4. Hold'em/Omaha バリアント

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| V-NLH | ✅ | キッカー判定OK (`handEvaluator.ts:compareHands`) |
| V-HILO (Quartering) | ✅ | Quartering実装済み（Hi/Low別々に分配） |

### ⚠️ 要修正
| ID | 状態 | 問題点 |
|----|------|--------|
| V-PLO | ❌ **重大** | オマハの2枚使用ルールが未実装 |
| V-HILO (8orBetter) | ⚠️ | 現状は実装済みだが端数処理を確認必要 |

**問題詳細 (V-PLO):**
```typescript
// ShowdownManager.ts:247-248
const allCards = parseCards([...player.hand!, ...board]);
const bestFive = getBestFiveCards(allCards);
```

**問題:** PLOでは必ず手札から2枚、ボードから3枚を使用する必要がある。
現在の実装は7枚から任意の5枚を選択しており、PLOのルールに違反。

**修正方針:**
```typescript
// PLO専用のハンド評価関数が必要
function getBestPLOHand(holeCards: Card[], board: Card[]): Card[] {
    // 手札から2枚を選ぶ組み合わせ × ボードから3枚を選ぶ組み合わせ
    // 最強のハンドを返す
}
```

---

## 5. Stud Games (V-ST1~V-RAZZ)

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| V-ST2 | ✅ | 5回のベッティングラウンド実装済み |
| V-RAZZ (A=1) | ✅ | A=1扱い実装済み (`handEvaluator.ts:lowRankValue`) |
| V-RAZZ (フラッシュ/ストレート) | ✅ | Razzではカウントしない実装済み |

### ⚠️ 要修正
| ID | 状態 | 問題点 |
|----|------|--------|
| V-ST1 | ❌ | Bring-In未実装 |

**問題詳細 (V-ST1):**
現在のStud実装は単純に座席順でアクションを開始している。
実際のStudルールでは:
- 3rd Street: 最も弱いアップカード（Razz: 最も強い）の人がBring-In
- 4th Street以降: 最も強いボード（Razz: 最も弱い）の人から

**修正方針:**
1. `Dealer.ts` に `determineBringIn()` メソッド追加
2. `GameEngine.ts` の `startHand()` でStud時にBring-In決定

---

## 6. Draw Games (V-DR1~V-BAD)

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| V-DR2 | ✅ | ボタン判定OK |
| V-27 (A=High) | ✅ | 実装済み (`handEvaluator.ts:rankValue`) |
| V-27 (ストレート/フラッシュ) | ✅ | 弱い役として判定 (`handEvaluator.ts:evaluateDeuceSeven`) |
| V-BAD (スート重複) | ✅ | 実装済み (`handEvaluator.ts:evaluateBadugiHand`) |
| V-BAD (ペア重複) | ✅ | 実装済み |

### ⚠️ 未実装（クライアント側）
| ID | 状態 | 問題点 |
|----|------|--------|
| V-DR1 | ⚠️ | サーバー側実装済み、クライアントUIなし |

**状況:**
- `draw-exchange` ソケットイベントはサーバー側で実装済み
- クライアント側でカード選択UIが未実装
- テストはブラウザコンソールから手動でイベント発行可能

---

## 7. ゲーム進行 (F-01~F-05)

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| F-01 | ✅ | ゲームローテーション実装済み (`RotationManager.ts`) |
| F-04 | ✅ | ショーダウン表示OK |
| F-05 | ✅ | リセット処理OK |

### ⚠️ 要確認/未実装
| ID | 状態 | 問題点 |
|----|------|--------|
| F-02 | ⚠️ | 途中参加時の「Waiting」状態を確認必要 |
| F-03 | ❌ | 途中離席の自動Fold/Check未実装 |

---

## 8. エッジケース (E-01~E-04)

### ✅ テスト可能
| ID | 状態 | 備考 |
|----|------|------|
| E-01 | ✅ | 一人残し処理OK (`ShowdownManager.ts:awardToLastPlayer`) |
| E-02 | ⚠️ | リバイインプロンプト未実装（離席扱いはOK） |

### ⚠️ 要確認/未実装
| ID | 状態 | 問題点 |
|----|------|--------|
| E-03 | ⚠️ | デッキ切れ時のリシャッフル実装済みだが未テスト |
| E-04 | ⚠️ | 同時アクションの排他制御未確認 |

---

## 優先修正項目

### 高優先度（ゲーム性に直接影響）
1. **V-PLO: オマハ2枚使用ルール** - PLOが正しくプレイできない
2. **SP-01~SP-05: サイドポット統合** - 3人以上のALL_IN時に問題発生

### 中優先度
3. **V-ST1: Stud Bring-In** - Studゲームの正確性
4. **F-03: 途中離席処理** - ゲーム停止を防ぐ

### 低優先度
5. **V-DR1: Drawカード交換UI** - クライアント側UIのみ
6. **E-03: デッキリシャッフル検証** - レアケース

---

## テスト実行の推奨順序

1. **基本フロー (B-01~B-06)** - 全て実行可能
2. **ベッティングロジック (L-01~L-06)** - L-03, L-04を注意深く確認
3. **Hold'em (V-NLH)** - キッカー判定
4. **サイドポットなしのALL_IN** - 2人対戦でのALL_IN
5. **Hi-Lo (V-HILO)** - PLO8でのHigh/Low分配
6. **ゲームローテーション (F-01)** - 複数ゲーム選択時

---

*生成日時: 2026-01-16*
