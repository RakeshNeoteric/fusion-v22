import { type Page, expect } from '@playwright/test';
import { POPUP, Report, WIDEST, closePopup, settle, test } from './kit';

/**
 * Case Details at every size: the page, each of its tabs and its popups.
 *
 * Opening a case nobody has open makes the signed-in user its holder on the server, so only a
 * case that is already open by the signed-in user is used: loading it changes nothing. Any other
 * case is stopped from loading, and writes are blocked as in every check (kit.ts). Popups are
 * closed with ✕ or Cancel; Yes, Save and Send are never pressed.
 */

interface CaseRow {
  readonly CaseDetailId: number;
  readonly CaseOpenedBy: string | null;
}

/** The case open by the signed-in user, from the Cases list the app loads. */
async function myOpenCase(page: Page): Promise<number | null> {
  const email = (process.env['E2E_EMAIL'] ?? '').toLowerCase();
  const list = page.waitForResponse(
    (response) =>
      /\/CaseDetails$/i.test(new URL(response.url()).pathname) &&
      response.request().method() === 'GET',
  );
  await page.goto('/cases');
  const rows = (await (await list).json()) as CaseRow[];
  const mine = rows.find((row) => row.CaseOpenedBy?.toLowerCase() === email);
  return mine?.CaseDetailId ?? null;
}

test('Case Details', async ({ page }) => {
  await page.setViewportSize(WIDEST);
  const id = await myOpenCase(page);
  test.skip(id === null, 'No case is open by the signed-in user: opening one would change it.');

  // Only that case may load: loading any other could make the user its holder.
  await page.route(/\/CaseDetails\/\d+/i, async (route) => {
    const asked = Number(/\/CaseDetails\/(\d+)/i.exec(route.request().url())?.[1]);
    if (asked === id) await route.fallback();
    else await route.abort('blockedbyclient');
  });

  const report = new Report(page, 'Case Details');
  await page.goto(`/cases/case-details?id=${id}`);
  await expect(page.locator('app-folder-tabs [role="tab"]').first()).toBeVisible({
    timeout: 60_000,
  });
  await settle(page);
  await report.sweep('page', false);

  /** Opens a popup, checks it at every size and closes it; notes it when not offered. */
  async function popup(name: string, open: () => Promise<boolean>): Promise<void> {
    try {
      if (!(await open())) {
        report.notes.push({ size: '-', where: name, text: 'not offered on this case' });
        return;
      }
      await page.locator(POPUP).first().waitFor({ timeout: 20_000 });
      await settle(page);
      await report.sweep(name, true);
      await closePopup(page);
    } catch (error) {
      report.problems.push({ size: '-', where: name, text: `could not check: ${String(error)}` });
      await page.keyboard.press('Escape');
    }
  }

  /** A visible, enabled button; clicked when there is one. */
  async function press(page: Page, name: RegExp | string, scope = page.locator('body')) {
    const button = scope.getByRole('button', { name }).first();
    if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled())) {
      return false;
    }
    await button.click();
    return true;
  }

  // Every tab (switching saves a tab only when it was changed; nothing is changed here).
  const tabs = page.locator('app-folder-tabs [role="tab"]');
  const tabPopups = new Set<string>();
  for (let index = 0; index < (await tabs.count()); index++) {
    const tab = tabs.nth(index);
    const name = ((await tab.textContent()) ?? `Tab ${index + 1}`).trim();
    await tab.click();
    await settle(page);
    await report.sweep(`tab ${name}`, false);

    // Popups opened from inside tabs, once each.
    for (const [label, button] of [
      ['Fetch Policy', /Fetch Policy Details/i],
      ['Transport Checklist', /Transport Operator CheckList/i],
      ['Email Documents', /^Email$/],
    ] as const) {
      if (tabPopups.has(label)) continue;
      const panel = page.locator('[role="tabpanel"]');
      if (await panel.getByRole('button', { name: button }).first().isVisible()) {
        tabPopups.add(label);
        await popup(label, () => press(page, button, panel));
      }
    }
  }

  // The "View More" menu.
  for (const item of [
    'Contact History',
    'Case Rating',
    'Additional Cost',
    'Phase Costing',
    'SMS / Email',
    'Re-Assign',
  ]) {
    await popup(item, async () => {
      if (!(await press(page, 'View More'))) return false;
      const entry = page.getByRole('menuitem', { name: item });
      if (!(await entry.isVisible().catch(() => false))) {
        await page.keyboard.press('Escape');
        return false;
      }
      await entry.click();
      return true;
    });
  }

  // The header's Abort and Exit: their popups only; the case is not let go.
  await popup('Abort', () => press(page, 'Abort'));
  await popup('Exit', () => press(page, 'Exit'));

  report.finish();
});
