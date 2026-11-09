# Responsive design

Fusion Edge is a desktop app. Every screen must work from a 1024px-wide browser window up to a
2560px monitor: nothing breaks, overlaps or makes the page scroll sideways.

Approach: plain modern CSS, Angular CDK where code must react, and AG Grid's own column sizing.
No layout library (Bootstrap, Tailwind, Flex-Layout) and no zooming the page.

## The 4 rules

1. **Flexbox** for things in a row: header, toolbars, button rows.
2. **CSS Grid** for page areas and forms, e.g. `repeat(auto-fit, minmax(240px, 1fr))`, so fields
   wrap by themselves.
3. **Shared settings, not typed-in numbers**: spacing, sizes and popup widths come from the
   settings below.
4. **A part adapts to the space it is given**: a part that can sit in a page, a popup or a tab
   uses `@container` on its own width, not `@media` on the window.

## Screen sizes

| Width         | Name                | Expectation                                                |
| ------------- | ------------------- | ---------------------------------------------------------- |
| < 1024px      | below desktop       | must not break                                             |
| 1024 – 1279px | compact desktop     | compact; the side menu opens over the page                 |
| 1280 – 1439px | standard desktop    | the main design target                                     |
| 1440 – 1919px | comfortable desktop |                                                            |
| 1920 – 2559px | large desktop       | v21's design size                                          |
| ≥ 2560px      | wide screen         | tables use the width; forms and text keep a readable width |

Breakpoints are written as plain numbers, only these, always as `@media (width < 1280px)`.
(CSS variables do not work inside `@media` or `@container`.)

## Settings (`src/styles.css`)

| Setting                           | Use                                                  |
| --------------------------------- | ---------------------------------------------------- |
| `--app-space-1` … `--app-space-8` | gaps and padding (4, 8, 12, 16, 20, 24, 32px)        |
| `--app-page-padding`              | page padding: 12px at 1280, 16px at 1920, up to 24px |
| `--app-form-max-width`            | most a full-page form may stretch to                 |
| `--app-text-max-width`            | most a block of text may stretch to                  |

## Popups (`src/app/shared/ui/dialog-size.ts`)

Every popup uses one of five widths, never its own pixel width:

| Size | Width  | For                                                       |
| ---- | ------ | --------------------------------------------------------- |
| `xs` | 420px  | confirmations, short pickers                              |
| `sm` | 640px  | one short form                                            |
| `md` | 800px  | a standard form (the default)                             |
| `lg` | 1000px | a form with a table, or two columns                       |
| `xl` | 1200px | big work popups (Client, Service Provider, Phase Costing) |

```ts
dialog.open(MyDialog, { ...dialogSize('md'), data });
recordDialogs.open(MyDialog, record, PERMISSION, injector, 'xl');
```

For all popups, set once in `app.config.ts`: never wider than 96% or taller than 92% of the
window; a popup taller than that scrolls inside. A full-height drawer down the right (Contact
Log) uses `SIDE_PANEL` from the same file instead.

## Tables (AG Grid)

Columns use `flex` with a `minWidth`: they fill the width, and when the window is too narrow
the table scrolls inside itself, never the page.

- **Minimums:** the smallest width the column can be read at, not how wide it looks on a big
  screen (`flex` handles that). Text: about 120–160px. Yes/no and number columns: the shared
  grid caps them at 120px whatever a screen asks.
- **Icon columns** (View, Save, Delete, Unlink): `width: ICON_COLUMN_WIDTH` (80px, `grid-setup.ts`).
- **Titles** wrap onto two lines when a column is narrow (`WITH_COLUMN_MENU`), never cut off.
- **Wide tables** pin the column that identifies the row: `pinned: 'left'` on the column (e.g.
  the name on Service Providers), so it stays in view while the rest scroll.

## Code that reacts to the screen

Use the CDK `BreakpointObserver` only when behaviour must change, never for styling:

```ts
readonly compact = toSignal(
  inject(BreakpointObserver).observe('(width < 1280px)').pipe(map((s) => s.matches)),
  { initialValue: false },
);
```

Today: the shell (`core/layout/shell.ts`) opens the side menu over the page on compact desktops.

## Parts that sit in different spaces: container queries

A part whose room depends on where it is (a case tab, a section of a popup) lays itself out by
its own width, not the window's. The case tab panel is a container, and a caller's row of five
boxes drops to three, then two, per row when the panel is narrow:

```css
.tab-panel {
  container: case-tab / inline-size;
}
@container case-tab (width < 960px) {
  .tab-caller {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

## Building a new screen: checklist

- [ ] Laid out with Grid or Flexbox; gaps from the `--app-space-*` settings.
- [ ] Rows of fields wrap (`auto-fit` / `minmax`), or use a container query.
- [ ] Popups: `dialogSize(...)`.
- [ ] Grid columns: `flex` and a readable `minWidth`; icon columns `ICON_COLUMN_WIDTH`; a wide
      table pins the column that names the row.
- [ ] Breakpoints, if any, only 1024 / 1280 / 1440 / 1920 / 2560, written `(width < 1280px)`.
- [ ] Added to `e2e/responsive.e2e.ts` and checked at 1024, 1280 and 1920.

## What stops it breaking again

| Check                                                                              | Runs                                          | Catches                                                  |
| ---------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| ESLint rule (`eslint.config.js`)                                                   | `npm run lint`, `verify`                      | a popup given its own `width: '…px'`                     |
| `scripts/check-responsive.mjs`                                                     | `npm run check:responsive`, `verify`          | `max-width:` media queries; breakpoints outside the five |
| Unit tests (`entity-grid-columns.spec.ts`, `dialog-size.spec.ts`, `shell.spec.ts`) | `npm test`, `verify`                          | the shared table, popup and side menu rules changing     |
| Browser check (`e2e/`)                                                             | `npm run e2e:responsive`, before each release | any screen or popup breaking at any of the 7 sizes       |

## The browser check (`e2e/`)

Opens every screen at 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080 and 2560×1440
against the dev API, with the "+ New" popups (closed without saving). Case Details gets its own
check (`case-details.e2e.ts`): the page, every tab and every popup it offers (View More items,
Fetch Policy, Transport Checklist, Abort, Exit), each closed with ✕ or Cancel. Permissions is
opened for a role (Claim Manager when there is one), and also fails if the "+" (add field) or any
field's controls are hidden off the side of its panel.

It fails when the page scrolls sideways, something sticks out of the window, or a popup is bigger
than the window, and saves a screenshot of each at each size. A table scrolling inside itself is
allowed and listed as a note.

```sh
E2E_EMAIL=you@company.com E2E_PASSWORD=... npm run e2e:responsive
```

**It cannot change data.** Every request to the API other than a read is blocked, as is the
`CaseExit` read (which lets go of a case); a blocked request fails the check. Loading a case
nobody has open would make the signed-in user its holder, so Case Details only uses a case
already open by that user, and is skipped when there is none.

The login is read from the environment only; use a read-only test account. The signed-in
session, screenshots and report go to `.e2e/` (git ignores it; `E2E_STATE_DIR` moves it).
