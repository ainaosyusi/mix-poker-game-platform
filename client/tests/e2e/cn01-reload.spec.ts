import { test, expect } from '@playwright/test';
import { ensureLobby, requireE2EReady } from './utils';

test('CN-01: リロード後もルームに復帰できる', async ({ page }) => {
  requireE2EReady();

  await page.goto('/');
  await ensureLobby(page, 'Tester');

  await page.getByRole('button', { name: '＋ 新しい部屋を作成' }).click();
  await page.getByRole('button', { name: '部屋を作成' }).click();

  await expect(page.getByRole('button', { name: 'ロビーに戻る' })).toBeVisible();

  await page.getByText('空席').first().click();
  await page.getByRole('button', { name: '着席' }).click();

  await page.reload();

  await expect(page.getByRole('button', { name: 'ロビーに戻る' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('(you)')).toBeVisible({ timeout: 15000 });
});
