import { test, expect, type Locator } from '@playwright/test';
import { ensureLobby, requireE2EReady } from './utils';

test('CN-02: アクション連打でも二重実行されない', async ({ browser }) => {
  requireE2EReady();

  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  const roomId = String(Math.floor(100000 + Math.random() * 900000));
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto(baseURL);
  await ensureLobby(pageA, 'PlayerA');
  await pageA.getByRole('button', { name: '＋ 新しい部屋を作成' }).click();
  await pageA.getByRole('checkbox', { name: 'プライベート卓（招待制）' }).check();
  await pageA.getByPlaceholder('123456').fill(roomId);
  await pageA.getByRole('button', { name: '部屋を作成' }).click();
  await expect(pageA.getByRole('button', { name: 'ロビーに戻る' })).toBeVisible({ timeout: 15000 });

  await pageB.goto(baseURL);
  await ensureLobby(pageB, 'PlayerB');
  await pageB.getByRole('button', { name: '🔒 プライベート参加' }).click();
  await pageB.getByPlaceholder('123456').fill(roomId);
  await pageB.getByRole('button', { name: '参加', exact: true }).click();

  await pageA.getByText(/^空席 1$/).click();
  await pageA.getByRole('button', { name: '着席' }).click();
  await pageB.getByText(/^空席 2$/).click();
  await pageB.getByRole('button', { name: '着席' }).click();

  await pageA.getByRole('button', { name: '🎮 ゲーム開始' }).click();

  const actionButtonsA = pageA.locator('button').filter({ hasText: /^(Check|Call|Bet|Raise)/ });
  const actionButtonsB = pageB.locator('button').filter({ hasText: /^(Check|Call|Bet|Raise)/ });
  await expect(actionButtonsA.first()).toBeVisible({ timeout: 15000 });
  await expect(actionButtonsB.first()).toBeVisible({ timeout: 15000 });

  let enabledButton: Locator | null = null;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const countA = await actionButtonsA.count();
    for (let i = 0; i < countA; i++) {
      const button = actionButtonsA.nth(i);
      if (await button.isEnabled()) {
        enabledButton = button;
        break;
      }
    }
    if (!enabledButton) {
      const countB = await actionButtonsB.count();
      for (let i = 0; i < countB; i++) {
        const button = actionButtonsB.nth(i);
        if (await button.isEnabled()) {
          enabledButton = button;
          break;
        }
      }
    }
    if (enabledButton) break;
    await pageA.waitForTimeout(200);
  }

  expect(enabledButton).not.toBeNull();
  await enabledButton!.dblclick();
  await expect(enabledButton!).toBeDisabled({ timeout: 2000 });

  await contextA.close();
  await contextB.close();
});
