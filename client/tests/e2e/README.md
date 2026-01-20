# E2E テスト実行手順

前提:
- サーバー起動: `cd server && npm run dev`
- クライアント起動: `cd client && npm run dev`

実行:
```
E2E_RUN=1 E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

注意:
- Playwright のブラウザバイナリは別途 `npx playwright install` が必要。
