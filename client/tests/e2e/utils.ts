import { test, Page, type Locator } from '@playwright/test';

export function requireE2EReady() {
  if (process.env.E2E_RUN !== '1') {
    test.skip(true, 'E2E_RUN=1 is required');
  }
}

export async function ensureLobby(page: Page, playerName: string) {
  const nameInput = page.getByPlaceholder('プレイヤー名を入力...');
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(playerName);
    const enterButton = page.getByRole('button', { name: 'ロビーに入る' });
    if (await enterButton.isVisible().catch(() => false)) {
      await enterButton.click({ timeout: 2000 }).catch(() => undefined);
    }
    await page.getByRole('button', { name: '＋ 新しい部屋を作成' }).waitFor({ state: 'visible' });
  }
}

export async function findEnabledActionButton(page: Page, timeoutMs: number = 15000): Promise<Locator> {
  const actionButtons = page.locator('button').filter({ hasText: /^(Check|Call|Bet|Raise|Fold)/ });
  await actionButtons.first().waitFor({ state: 'visible', timeout: timeoutMs });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await actionButtons.count();
    for (let i = 0; i < count; i++) {
      const button = actionButtons.nth(i);
      if (await button.isEnabled()) {
        return button;
      }
    }
    await page.waitForTimeout(200);
  }

  throw new Error('No enabled action button found');
}
