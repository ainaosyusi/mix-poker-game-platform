# Mix Poker App - ドキュメント

このフォルダには、Mix Poker Appの開発に関連するすべてのドキュメントが整理されています。

## 📁 フォルダ構造

### `/specs` - 仕様・アーキテクチャ

プロジェクトの仕様書、アーキテクチャ設計、開発ガイドライン

| ファイル | 説明 |
|---------|------|
| [ARCHITECTURE.md](specs/ARCHITECTURE.md) | システムアーキテクチャ全体像 |
| [SPEC.md](specs/SPEC.md) | 機能仕様書（実装済み・予定機能） |
| [SYSTEM_OVERVIEW.md](specs/SYSTEM_OVERVIEW.md) | システム概要・技術スタック |
| [CLAUDE.md](specs/CLAUDE.md) | Claude Code用プロジェクト指示書 |
| [進行の流れ.md](specs/進行の流れ.md) | 開発フロー（初期版） |
| [進行の流れ2.md](specs/進行の流れ2.md) | 開発フロー（改訂版） |

### `/reports` - 開発レポート

Phase 2-5の完了報告書と複雑度削減レポート

| ファイル | 説明 |
|---------|------|
| [COMPLEXITY_REPORT.md](reports/COMPLEXITY_REPORT.md) | **総合レポート**: Phase 2-5の複雑度削減結果 |
| [PHASE2_COMPLETE_REPORT.md](reports/PHASE2_COMPLETE_REPORT.md) | Phase 2: processAction分割（複雑度32→0） |
| [PHASE2_UNIT_TESTS_COMPLETE.md](reports/PHASE2_UNIT_TESTS_COMPLETE.md) | Phase 2: ユニットテスト追加 |
| [PHASE3_COMPLETE.md](reports/PHASE3_COMPLETE.md) | Phase 3 Option 1: 高複雑度関数4つ分割 |
| [PHASE3_OPTION2_COMPLETE.md](reports/PHASE3_OPTION2_COMPLETE.md) | Phase 3 Option 2: ハンドラーユニットテスト25個追加 |
| [PHASE4_COMPLETE.md](reports/PHASE4_COMPLETE.md) | Phase 4: 中複雑度関数4つ分割（GameEngine.ts 0 warnings達成） |
| [PHASE5_COMPLETE.md](reports/PHASE5_COMPLETE.md) | Phase 5: 統合テスト+クライアントリファクタリング |

**Phase 2-5 成果サマリー:**
- 複雑度警告: 53+ → 12 (-77%)
- GameEngine.ts: 0 warnings (-100%)
- ユニットテスト: 169/169 (100%)
- 統合テスト: 16/18 (89%)

### `/development` - 開発中ドキュメント

バグトラッキング、テスト報告、リファクタリング課題

| ファイル | 説明 |
|---------|------|
| [BUGS.md](development/BUGS.md) | 既知のバグ一覧と修正状況 |
| [REFACTORING_TEST_ISSUES.md](development/REFACTORING_TEST_ISSUES.md) | リファクタリング中のテスト問題 |
| [TEST_REPORT.md](development/TEST_REPORT.md) | テストレポート（Phase 1時点） |

### `/archive` - アーカイブ

過去の計画書やバージョン情報

| ファイル | 説明 |
|---------|------|
| [CLAUDE_CODE_PLAN.md](archive/CLAUDE_CODE_PLAN.md) | 初期のClaude Code計画（Phase 1-5） |
| [VERSION.md](archive/VERSION.md) | バージョン履歴 |
| [SUMMARY_20260114.md](archive/SUMMARY_20260114.md) | 2026年1月14日時点のプロジェクトサマリー |

---

## 🎯 主要ドキュメントへのショートカット

### プロジェクトを理解する
1. [SPEC.md](specs/SPEC.md) - 機能仕様を知りたい
2. [ARCHITECTURE.md](specs/ARCHITECTURE.md) - システム構成を知りたい
3. [CLAUDE.md](specs/CLAUDE.md) - AI開発の指示書を見たい

### 開発成果を確認する
1. [COMPLEXITY_REPORT.md](reports/COMPLEXITY_REPORT.md) - Phase 2-5の総合成果
2. [PHASE4_COMPLETE.md](reports/PHASE4_COMPLETE.md) - GameEngine.ts 0 warnings達成の詳細
3. [PHASE5_COMPLETE.md](reports/PHASE5_COMPLETE.md) - 統合テスト+クライアント改善

### 開発を継続する
1. [BUGS.md](development/BUGS.md) - 修正すべきバグ一覧
2. [TEST_REPORT.md](development/TEST_REPORT.md) - テスト状況確認

---

**最終更新**: 2026-01-29
**作成者**: Claude Code
**状態**: Phase 2-5 完了、本番デプロイ済み
