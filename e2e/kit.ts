import { mkdirSync, writeFileSync } from 'node:fs';
import { type Page, test as base, expect } from '@playwright/test';

/** The desktop sizes in RESPONSIVE.md. */
export const SIZES = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

/** A screen is loaded at the widest size first, so everything has room while it renders. */
export const WIDEST = { width: 2560, height: 1440 };

export const OUT = `${process.env['E2E_STATE_DIR'] ?? '.e2e'}/responsive`;

/** The API the app talks to: only reads may reach it during a check. */
const API = /fusionedge\.runasp\.net/;
/** Reads that change data: `CaseExit` lets go of (and may close) a case. */
const CHANGES_ON_READ = /\/CaseExit\//i;

/**
 * A page that cannot change anything on the server: every request to the API other than a read
 * is stopped, and the test fails naming it. The checks only look; this makes sure of it.
 */
export const test = base.extend<{ blockedWrites: string[] }>({
  blockedWrites: [
    async ({ page }, use) => {
      const blocked: string[] = [];
      await page.route(API, async (route) => {
        const method = route.request().method();
        const reads = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
        if (reads && !CHANGES_ON_READ.test(route.request().url())) {
          await route.fallback();
          return;
        }
        blocked.push(`${method} ${route.request().url()}`);
        await route.abort('blockedbyclient');
      });
      await use(blocked);
      expect(blocked, 'the check tried to change data on the server').toEqual([]);
    },
    // On for every test, whether it asks for the list or not.
    { auto: true },
  ],
});

export interface Finding {
  readonly size: string;
  readonly where: string;
  readonly text: string;
}

/** What one measurement found: problems fail the check; notes are allowed but reported. */
interface Measured {
  readonly problems: string[];
  readonly notes: string[];
}

/** Waits for the screen's data: requests settle and no loading placeholders remain. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page
    .locator('app-skeleton, app-skeleton-table, app-skeleton-fields')
    .first()
    .waitFor({ state: 'detached', timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

/** The open popup (the top one when popups are stacked). */
export const POPUP = '.cdk-overlay-container .mat-mdc-dialog-surface';

/**
 * Measures, in the browser, what sticks out past the right edge of the popup (the window when
 * `popup` is false). Anything clipped by a scrolling or hidden-overflow box inside the limit is
 * fine: e.g. a table's columns that scroll inside the table.
 */
function measure(page: Page, popup: boolean): Promise<Measured> {
  return page.evaluate(
    ({ popup, selector }) => {
      const problems: string[] = [];
      const notes: string[] = [];
      const surfaces = document.querySelectorAll<HTMLElement>(selector);
      const box = popup ? (surfaces[surfaces.length - 1] ?? null) : null;
      if (popup && !box) return { problems: ['popup did not open'], notes };
      const root = box ?? document.body;

      // The window itself never scrolls: only the app's content area does (RESPONSIVE.md).
      const page = document.documentElement;
      if (page.scrollHeight - page.clientHeight > 1) {
        problems.push(
          `page is taller than the window by ${page.scrollHeight - page.clientHeight}px`,
        );
      }
      window.scrollTo(0, page.scrollHeight);
      if (window.scrollY > 0) {
        problems.push(
          `the window scrolls (moved ${Math.round(window.scrollY)}px): header and menu move away`,
        );
        window.scrollTo(0, 0);
      }
      const right = box ? box.getBoundingClientRect().right : document.documentElement.clientWidth;

      if (!box) {
        const html = document.documentElement;
        if (html.scrollWidth - html.clientWidth > 1) {
          problems.push(`page scrolls sideways by ${html.scrollWidth - html.clientWidth}px`);
        }
        const main = document.querySelector<HTMLElement>('app-shell .main');
        if (main && main.scrollWidth - main.clientWidth > 1) {
          problems.push(
            `content area scrolls sideways by ${main.scrollWidth - main.clientWidth}px`,
          );
        }
      } else {
        const outer = box.getBoundingClientRect();
        if (outer.left < 0 || outer.right > window.innerWidth + 1) {
          problems.push('popup is wider than the window');
        }
        if (outer.top < 0 || outer.bottom > window.innerHeight + 1) {
          problems.push('popup is taller than the window');
        }
        if (box.scrollWidth - box.clientWidth > 1) {
          problems.push(`popup scrolls sideways by ${box.scrollWidth - box.clientWidth}px`);
        }
      }

      const over = (element: Element): number => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.right > right + 1 ? rect.right - right : 0;
      };
      /** Hidden by an ancestor that clips its overflow and itself fits. */
      const clipped = (element: Element): boolean => {
        for (
          let parent = element.parentElement;
          parent && parent !== root;
          parent = parent.parentElement
        ) {
          if (getComputedStyle(parent).overflowX !== 'visible' && !over(parent)) return true;
        }
        return false;
      };
      const name = (element: Element): string => {
        const classes = [...element.classList]
          .slice(0, 2)
          .map((value) => `.${value}`)
          .join('');
        const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
        return `${element.tagName.toLowerCase()}${classes}${text ? ` "${text}"` : ''}`;
      };
      for (const element of root.querySelectorAll('*')) {
        // Popups and menus are measured on their own.
        if (!box && element.closest('.cdk-overlay-container')) continue;
        const by = over(element);
        if (!by || clipped(element)) continue;
        // Only the outermost element that sticks out: its children follow it.
        if (
          element.parentElement &&
          element.parentElement !== root &&
          over(element.parentElement)
        ) {
          continue;
        }
        problems.push(`sticks out ${Math.round(by)}px: ${name(element)}`);
      }

      for (const scroller of root.querySelectorAll('.ag-body-horizontal-scroll-viewport')) {
        const extra = scroller.scrollWidth - scroller.clientWidth;
        if (extra > 1) notes.push(`a table scrolls sideways inside itself by ${extra}px`);
      }
      return { problems: problems.slice(0, 8), notes };
    },
    { popup, selector: POPUP },
  );
}

/** Collects one screen's findings and screenshots. */
export class Report {
  readonly problems: Finding[] = [];
  readonly notes: Finding[] = [];
  readonly dir: string;

  constructor(
    private readonly page: Page,
    readonly screen: string,
  ) {
    this.dir = `${OUT}/${screen.toLowerCase().replace(/\W+/g, '-')}`;
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Resizes the window through every size, measuring and saving a screenshot at each.
   * `part` names what is shown ('page', 'popup', a tab or a popup's name); it starts the file
   * names, except for the page itself.
   */
  async sweep(part: string, popup: boolean): Promise<void> {
    const prefix = part === 'page' ? '' : `${part.toLowerCase().replace(/\W+/g, '-')}--`;
    for (const size of SIZES) {
      const label = `${size.width}x${size.height}`;
      await this.page.setViewportSize(size);
      await this.page.waitForTimeout(500);
      const measured = await measure(this.page, popup);
      this.problems.push(...measured.problems.map((text) => ({ size: label, where: part, text })));
      this.notes.push(...measured.notes.map((text) => ({ size: label, where: part, text })));
      await this.page.screenshot({ path: `${this.dir}/${prefix}${label}.png` });
    }
    await this.page.setViewportSize(WIDEST);
  }

  /** Saves the findings (per screen, so a failing screen does not lose the others'). */
  finish(): void {
    writeFileSync(
      `${this.dir}/findings.json`,
      JSON.stringify({ screen: this.screen, problems: this.problems, notes: this.notes }, null, 2),
    );
    expect
      .soft(this.problems, this.problems.map((f) => `${f.size} ${f.where}: ${f.text}`).join('\n'))
      .toEqual([]);
  }
}

/**
 * Closes the open popup without saving: its ✕, else Cancel, else Escape. Waits until it has
 * gone. Never presses Save, Yes or OK.
 */
export async function closePopup(page: Page): Promise<void> {
  const count = await page.locator(POPUP).count();
  const top = page.locator(POPUP).last();
  for (const name of [/^(close|×|✕)$/i, /^cancel$/i]) {
    const button = top.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      break;
    }
  }
  if ((await page.locator(POPUP).count()) >= count) await page.keyboard.press('Escape');
  await expect(page.locator(POPUP)).toHaveCount(count - 1, { timeout: 10_000 });
}
