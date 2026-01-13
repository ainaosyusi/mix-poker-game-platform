# 学習ノート 02: Socket.io による手動接続の実装

## 背景
通常、`socket.io-client` はインポート時に自動接続されますが、アプリの設計（ロードマップ）に合わせて「ユーザーがボタンを押した時に接続する」仕組みを構築しました。

## 実装のポイント

### 1. 手動接続への変更
`useRef` を使ってソケットのインスタンスを保持し、関数内で `io()` を呼び出すことで接続を制御します。

```typescript
const socketRef = useRef<Socket | null>(null);

const connectToServer = () => {
  if (socketRef.current?.connected) return;
  const socket = io('http://localhost:3000');
  socketRef.current = socket;
  ...
};
```

### 2. 状態管理（ステート）
接続中（Connected）か切断中（Disconnected）かを `useState` で管理し、画面表示（🟢/🔴）を切り替えます。

### 3. クリーンアップ
コンポーネントが破棄される時に、忘れずに `socket.disconnect()` を呼ぶことで、ゾンビ接続（不要な通信）を防ぎます。

## 動作確認結果

### 接続・切断のデモ
![接続確認](/docs/learning/media/verify_manual_connection_success_1768285735092.webp)

### 接続成功時のUI
![接続成功](/docs/learning/media/connected_ui_1768285943163.png)

## 学び
- `useRef` は画面の再描画に影響しない値を保持するのに便利（ソケットのインスタンスなど）。
- `useEffect` の戻り値（クリーンアップ関数）で接続を切るのが React のお作法。
- ユーザー体験（UX）向上のため、接続状態を視覚的に伝えることが重要。
