import { test, expect } from '@playwright/test';
import { ensureLobby, requireE2EReady } from './utils';

test('EN-01: ハンド進行中の着席は次ハンド待機になる', async ({ browser }) => {
  requireE2EReady();

  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  const contextC = await browser.newContext({ baseURL });
  const roomId = String(Math.floor(100000 + Math.random() * 900000));
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

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

  await pageC.goto(baseURL);
  await ensureLobby(pageC, 'PlayerC');
  await pageC.getByRole('button', { name: '🔒 プライベート参加' }).click();
  await pageC.getByPlaceholder('123456').fill(roomId);
  await pageC.getByRole('button', { name: '参加', exact: true }).click();
  await pageC.getByText(/^空席 3$/).click();
  await pageC.getByRole('button', { name: '着席' }).click();

  await expect(pageC.getByText('BB待ちで次ハンド参加')).toBeVisible({ timeout: 15000 });

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
