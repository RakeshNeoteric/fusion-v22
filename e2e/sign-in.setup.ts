import { expect, test as setup } from '@playwright/test';

const stateDir = process.env['E2E_STATE_DIR'] ?? '.e2e';

/** Signs in once through Microsoft and keeps the session for the checks. */
setup('sign in', async ({ page }) => {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];
  if (!email || !password) throw new Error('Set E2E_EMAIL and E2E_PASSWORD.');

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Microsoft's sign-in page.
  await page.waitForURL(/login\.microsoftonline\.com/);
  const passwordBox = page.locator('input[name="passwd"]');
  await passwordBox.waitFor();
  await passwordBox.fill(password);
  await page.locator('#idSIButton9').click();

  // "Stay signed in?" may follow; either answer works.
  const stay = page.locator('#idBtn_Back');
  await Promise.race([
    page.waitForURL(/localhost:4200\/(home|dashboard)/, { timeout: 60_000 }),
    stay.waitFor({ timeout: 60_000 }).then(() => stay.click()),
  ]);
  await page.waitForURL(/localhost:4200\/(home|dashboard)/, { timeout: 60_000 });
  await expect(page.locator('app-header')).toBeVisible();
  await page.context().storageState({ path: `${stateDir}/session.json` });
});
