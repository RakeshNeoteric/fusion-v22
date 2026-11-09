import { expect } from '@playwright/test';
import { POPUP, Report, SIZES, WIDEST, closePopup, settle, test } from './kit';

/**
 * Every screen at the desktop sizes in RESPONSIVE.md. Each screen is loaded once and the window
 * resized through the sizes. Looks only: writes to the server are blocked (kit.ts).
 *
 * Fails when, at any size:
 *  - the page scrolls sideways (tables may scroll inside themselves, the page may not);
 *  - something sticks out past the right edge of the window;
 *  - a popup is bigger than the window or scrolls sideways.
 * Saves a screenshot of each screen at each size. Case Details has its own check.
 */

interface Screen {
  readonly name: string;
  readonly path: string;
  /** Opens the screen's "+ New" popup (empty form, closed without saving) and checks it too. */
  readonly newPopup?: boolean;
}

/** Permissions needs a role id: it has its own check below. */
const SCREENS: readonly Screen[] = [
  { name: 'Home', path: '/home' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Cases', path: '/cases', newPopup: true },
  { name: 'Clients', path: '/client/client', newPopup: true },
  { name: 'Client Group', path: '/client/client-group' },
  { name: 'Services', path: '/services/services', newPopup: true },
  { name: 'Service Types', path: '/services/service-types' },
  { name: 'Service Providers', path: '/services/service-providers', newPopup: true },
  { name: 'Claim Centres', path: '/claim-centre', newPopup: true },
  { name: 'Body Locations', path: '/body-location' },
  { name: 'Branches', path: '/branches' },
  { name: 'Documents', path: '/documents/documents' },
  { name: 'Vehicles', path: '/vehicle/vehicle' },
  { name: 'Transport Operators', path: '/transport-operator/transport' },
  { name: 'Company Details', path: '/company-details' },
  { name: 'Rating Questions', path: '/list/list' },
  { name: 'Rating Question Options', path: '/options/options' },
  { name: 'Rating Question Types', path: '/types/types' },
  { name: 'Users', path: '/users', newPopup: true },
  { name: 'Roles', path: '/roles' },
  { name: 'User Roles', path: '/userrolemap' },
  { name: 'Voucher Approval', path: '/voucherapproval' },
  { name: 'Client Reports', path: '/reports/clientreports' },
  { name: 'Internal Reports', path: '/reports/internalreports' },
];

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    const report = new Report(page, screen.name);
    await page.setViewportSize(WIDEST);
    await page.goto(screen.path);
    await expect(page.locator('app-shell')).toBeVisible();
    await settle(page);
    await report.sweep('page', false);

    if (screen.newPopup) {
      const newButton = page.getByRole('button', { name: /^(\+ ?)?New\b/ }).first();
      if (await newButton.isVisible().catch(() => false)) {
        await newButton.click();
        await page.locator(POPUP).waitFor({ timeout: 20_000 });
        await settle(page);
        await report.sweep('popup', true);
        await closePopup(page);
      }
    }
    report.finish();
  });
}

interface RoleRow {
  readonly RoleId: number;
  readonly RoleName: string | null;
  readonly IsDeleted?: boolean | null;
}

/** Permissions for a role (Claim Manager when there is one), reached as from Roles. */
test('Permissions', async ({ page }) => {
  await page.setViewportSize(WIDEST);
  const list = page.waitForResponse((response) =>
    /\/Permission\/GetRoles$/i.test(new URL(response.url()).pathname),
  );
  await page.goto('/roles');
  const roles = ((await (await list).json()) as RoleRow[]).filter((role) => !role.IsDeleted);
  const role = roles.find((row) => /claim manager/i.test(row.RoleName ?? '')) ?? roles[0];
  test.skip(!role, 'No role to open.');

  const report = new Report(page, 'Permissions');
  await page.goto(`/permissions/${role?.RoleId}`);
  await expect(page.locator('.pm-fields').first()).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await report.sweep('page', false);

  // The "+" (add field) and every field's controls are in view at every size, without
  // scrolling sideways (the panel would hide them, so the general check would not see it).
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const hidden = await page.evaluate(() => {
      const panel = document.querySelector('.pm-columns')?.getBoundingClientRect();
      if (!panel) return ['the permissions panel is missing'];
      const out: string[] = [];
      for (const part of document.querySelectorAll('.pm-add, .pm-field-row > *')) {
        const by = Math.round(part.getBoundingClientRect().right - panel.right);
        if (by > 0)
          out.push(
            `${part.matches('.pm-add') ? 'the + (add field)' : 'a field column'} is ${by}px out of view`,
          );
      }
      return [...new Set(out)];
    });
    report.problems.push(
      ...hidden.map((text) => ({ size: `${size.width}x${size.height}`, where: 'page', text })),
    );
  }
  await page.setViewportSize(WIDEST);
  report.finish();
});
