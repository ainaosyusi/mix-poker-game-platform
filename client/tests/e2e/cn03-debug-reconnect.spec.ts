import { test, expect } from '@playwright/test';
import { ensureLobby, requireE2EReady } from './utils';

test('CN-03: 接続リセット後もルームに復帰できる', async ({ browser }) => {
  requireE2EReady();

  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
  const context = await browser.newContext({ baseURL });
  const roomId = String(Math.floor(100000 + Math.random() * 900000));
  const page = await context.newPage();

  await page.goto(baseURL);
  await ensureLobby(page, 'Tester');
  await page.getByRole('button', { name: '＋ 新しい部屋を作成' }).click();
  await page.getByRole('checkbox', { name: 'プライベート卓（招待制）' }).check();
  await page.getByPlaceholder('123456').fill(roomId);
  await page.getByRole('button', { name: '部屋を作成' }).click();
  await expect(page.getByRole('button', { name: 'ロビーに戻る' })).toBeVisible({ timeout: 15000 });

  await page.getByText(/^空席 1$/).click();
  await page.getByRole('button', { name: '着席' }).click();

  await page.getByRole('button', { name: '⚙️ 設定' }).click();
  await page.getByRole('button', { name: '接続リセット' }).click();

  await expect(page.getByText('(you)')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'ロビーに戻る' })).toBeVisible({ timeout: 15000 });

  await context.close();
});
