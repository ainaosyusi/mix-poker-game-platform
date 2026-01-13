# 学習ノート 01: サーバーの ES Modules 化

## 背景
TypeScript で `import` 構文（ES Modules）を使用している場合、Node.js のデフォルト設定（CommonJS）では実行時にエラーが発生することがあります。

## 発生したエラー
```text
TSError: ⨯ Unable to compile TypeScript:
index.ts:1:8 - error TS1295: ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'.
```

## 解決策
プロジェクト全体を ES Modules として扱うように設定を変更しました。

### 1. package.json の修正
`"type": "module"` を追加し、Node.js にこのプロジェクトが ESM であることを伝えます。

```json
{
  "name": "server",
  "type": "module",
  ...
}
```

### 2. tsconfig.json の修正
TypeScript のコンパイル設定を ESM 対応に変更しました。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "ts-node": {
    "esm": true
  }
}
```
`NodeNext` を指定することで、最新の Node.js のモジュール解決ルールに従うようになります。

## 学び
- Node.js には「古い書き方（CommonJS）」と「新しい書き方（ES Modules）」がある。
- `import` を使うなら `package.json` の `"type": "module"` が必須。
- `ts-node` で実行する場合も `"esm": true` の設定が必要。
