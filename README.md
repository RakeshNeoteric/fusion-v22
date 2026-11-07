# Fusion Edge (Angular 22)

Frontend for Fusion Edge Services (funeral / repatriation case management). This is the Angular 22
rewrite of `fusion-edge-v21`, migrated feature by feature with behaviour parity.

## Documentation

| Document                                           | Read it for                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| This README                                        | Setup, scripts, architecture, conventions, how to add a screen                                      |
| [docs/FUNCTIONALITY.md](docs/FUNCTIONALITY.md)     | What every screen does, its business rules and backend calls; permissions; backend quirks           |
| [docs/MIGRATION.md](docs/MIGRATION.md)             | v21 vs v22, what each phase built, v21 bugs not copied, release fixes, backend issues, open items   |
| [docs/WHY-WE-MIGRATED.md](docs/WHY-WE-MIGRATED.md) | Why we moved to Angular 22, what it gained, and what signals, zoneless and standalone mean (tables) |

Keep them up to date: a change in behaviour goes in FUNCTIONALITY.md, a decision or difference from
v21 in MIGRATION.md.

## Getting started

```bash
npm ci
npm start            # https://localhost:4200 (https is required by the Azure AD redirect URI)
```

The dev server uses a self-signed certificate; accept it in the browser the first time.

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm start`             | Dev server with `environment.development.ts`            |
| `npm run build`         | Production build (`environment.ts`)                     |
| `npm run lint`          | ESLint (TypeScript + templates, type-aware)             |
| `npm run test:ci`       | Unit tests once (Vitest)                                |
| `npm run test:coverage` | Unit tests with coverage                                |
| `npm run format`        | Prettier                                                |
| `npm run verify`        | Format check + lint + tests + build. Run before pushing |

## Deployment

The app is **client-side only** (no SSR, no Node server; see
[docs/WHY-WE-MIGRATED.md](docs/WHY-WE-MIGRATED.md)). `npm run build` writes static files to
`dist/fusion-edge/browser`; copy that folder to any web server (IIS, Azure Static Web Apps,
Nginx, a storage bucket).

**Required server setting (SPA fallback):** any URL that is not a file must return `index.html`,
so the app's router can open it. Without it, refreshing or opening a link such as
`/cases/case-details?id=123` gives a 404.

| Server                | Setting                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| IIS                   | URL Rewrite rule: if not a file or folder, rewrite to `/index.html`                  |
| Nginx                 | `try_files $uri $uri/ /index.html;`                                                  |
| Azure Static Web Apps | `staticwebapp.config.json` with `"navigationFallback": { "rewrite": "/index.html" }` |

The production settings are in `src/environments/environment.ts`: the API address
(`apiBaseUrl`) and the Azure AD sign-in (`clientId`, `authority`, `redirectUri`). `redirectUri`
is where Microsoft sends the user back after sign-in (today
`https://fusionedge-dev.runasp.net/home`). **When the site moves to another address, change
`redirectUri` and add the new address to the Azure AD app registration's redirect URIs**, or
sign-in fails.

## Architecture

```
src/app/
├── core/       App-wide singletons: config, auth, http, permissions, session, layout
├── api/        Backend contract: DTOs/enums + one typed client per backend controller
├── shared/     Reusable, feature-agnostic UI (grid, dialogs, form controls), pipes, utils
└── features/   One folder per business area, each lazy-loaded through its own *.routes.ts
```

Dependencies point inward: **features → shared / core → api**. ESLint enforces this:
`core`, `shared` and `api` cannot import from `features`.

Path aliases: `@core/*`, `@shared/*`, `@api/*`, `@features/*`.

### Configuration

Runtime settings (API URL, Azure AD, AG Grid licence key) are typed by `AppConfig` and injected with
`inject(APP_CONFIG)`. Only `core/config` may import from `src/environments`; ESLint blocks it
everywhere else.

| File                                          | Used by                   |
| --------------------------------------------- | ------------------------- |
| `src/environments/environment.ts`             | Production build          |
| `src/environments/environment.development.ts` | `ng serve` and unit tests |

### Backend contract

- JSON property names are **PascalCase** (the API disables camelCase), so DTOs use PascalCase too.
- Enums are sent as **strings**; model them as string-literal unions.
- No component injects `HttpClient`; it goes through a typed client in `api/`.
- API clients use **relative URLs** (`'Client'`). `core/http` adds the API base URL and the bearer
  token. The token is only sent to the API host.

### Sign-in and startup

Before the first route is chosen, `SessionService.start()` (the app initializer) runs:

1. MSAL completes the Microsoft redirect, or restores the cached account.
2. `GET App/UserValidation` checks that the account is a registered, active Fusion user.
3. `GET App/AppInit` loads menus, the user's roles and permissions, and users by role.

The result is the session state: `signed-out`, `ready`, `denied` (with the reason, shown on the login
page) or `error` (retryable). `signedInGuard` protects the app shell, and `signedOutGuard` protects
the login page.

### HTTP errors

Every failed request becomes an `ApiError` with a user-safe `message`. `errorInterceptor` shows that
message as a notification. Pass `{ context: silentErrors() }` when the screen shows the error itself.
Server text from 5xx responses is never shown to users.

### Adding a screen

1. Use the same path as v21: the sidebar links to `'/' + MenuViewName.toLowerCase()`.
2. Protect it with `canMatch: [canAccess('<MENU_CODE>')]`. v21 only hid the menu item, so any URL
   could be opened directly.
3. Set `data: { breadcrumb: 'Section / Name' }` for the page title bar.
4. Inside the screen, use `PermissionService` (`canCreate`, `canEdit`, `canDelete`, `isReadOnly`).

### Configuration screens (`EntityGrid`)

Simple record lists (Branches, Vehicles, Body Locations and so on) need no screen code of their
own. `shared/grid/entity-grid` handles loading (newest first, as in v21), sort, filter, paging,
add, inline edit, saving each row, soft delete with confirmation, and permissions. To add one:

1. In `api/config/`, add the model and a class extending `ConfigCrudApi`, giving its path and id
   field (see `body-location.api.ts`).
2. In the feature, add a page that passes an `EntityGridConfig`: columns (`text`, `number`,
   `toggle` or `select`), validation, defaults for a new row, and the permission code (see
   `body-locations-page.ts`).
3. Add the route with `canDeactivate: [unsavedChangesGuard]`.

Optional config, used by Vehicles and Transport Operators (see `transport-operators-page.ts`):

- `display` columns show read-only text worked out from the record, e.g. the branch's Province.
- `loadLookups` loads data the columns need (e.g. `BranchLookup`) together with the rows.
- Select options marked `selectable: false` are still shown on old records but cannot be picked.
- `validate` adds a screen-specific check (it also gets the other saved records, e.g. for a
  "must be unique" rule); `beforeSave` makes a last change, e.g. phone formatting.
- `rowLink` adds an eye button on saved rows that leads to another page (Roles → Permissions).
- `titleActions` adds buttons beside "+ New" for users who may create (Clients: Clone); when
  one resolves `true` the list is loaded again.

### Building blocks

The behaviour of each screen is described in [docs/FUNCTIONALITY.md](docs/FUNCTIONALITY.md). The
pieces they are built from:

| Piece                                                 | Where                                        | Use it for                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecordDialog`, `RecordDialogFrame`, `RecordDialogs`  | `shared/forms/record-dialog`                 | Popup forms: save rules, read-only mode, ✖/Cancel asking before losing changes (`canClose`). `RecordDialogs.open(Form, record, permission, injector, width?)`; `show()` for custom data. Screens with popups pass an `editor` to `EntityGrid` instead of `newEntity`. |
| `RecordLookup`                                        | `shared/reference/record-lookup.ts`          | A list a screen picks from (branches, service types). One record per key, the live one first; inactive/deleted shown as "(Inactive)"/"(Deleted)", not selectable. Provide it on the page.                                                                             |
| `DialogFiles`                                         | `shared/forms/record-dialog/dialog-files.ts` | Files chosen in a popup. A new file is uploaded when chosen; uploads not kept are deleted on Save or Cancel; a stored file is never deleted (a cloned record may share it).                                                                                           |
| `FileStorageApi`, `FileViewer`                        | `api/files`, `shared/files`                  | Upload (unique names), preview and download of stored files.                                                                                                                                                                                                          |
| `app-image-picker`                                    | `shared/ui/image-picker`                     | Logo and photo pickers (`size`, `round`).                                                                                                                                                                                                                             |
| `app-phone-field`                                     | `shared/forms/phone-field`                   | Phone numbers in E.164 with flag and searchable dial code. Rules in `shared/reference/phone.ts`.                                                                                                                                                                      |
| `app-folder-tabs`, `app-link-table`                   | `shared/ui`                                  | v21's slanted tabs (Client popup) and linked-record tables (`<ng-template appLinkCell>`).                                                                                                                                                                             |
| `CaseWorkspace`, `CaseLifecycle`, `CaseCommunication` | `features/cases/case-details`                | The open case, its read-only rule and saves; exit/abort/re-open/re-assign; history, SMS and email. Provided by the case page.                                                                                                                                         |
| `CaseTabForm`                                         | `features/cases/case-details/tabs`           | A case tab with a form (`hasChanges`, `save`). Tab specs drive the real page through `tabs/testing/case-tab-harness.ts`; `testing/` folders are left out of the build.                                                                                                |
| `PdfRenderer`                                         | `shared/pdf`                                 | pdfmake loaded on first use, Poppins fonts, `pdf-parts.ts` blocks, `letterhead.ts`.                                                                                                                                                                                   |
| `ExcelDownload`, `excel-sheet.ts`                     | `shared/excel`                               | ExcelJS loaded on first use; v21 sheet look; numbers with a number format.                                                                                                                                                                                            |
| `Chart`                                               | `shared/chart`                               | ECharts loaded on first use; tests provide a fake `CHART_ENGINE`.                                                                                                                                                                                                     |
| `ComingSoon`                                          | `shared/ui/coming-soon`                      | Placeholder for screens not built yet.                                                                                                                                                                                                                                |
| `PageTitle`, `PageActions`                            | `core/layout`                                | A title bar that needs data (`show()`/`hide()`); buttons in the title bar.                                                                                                                                                                                            |
| `useLazyStylesheet`                                   | `shared/forms/lazy-stylesheet.ts`            | Large third-party CSS built as a separate bundle (`"inject": false` in `angular.json`) and added on first use (Quill).                                                                                                                                                |
| `provideAppIcons`                                     | `core/icons/app-icons.ts`                    | Icons as inline SVG (v21's Font Awesome shapes). Add an icon there; use `<mat-icon svgIcon="name" />`.                                                                                                                                                                |

Forms share the v21 look from `src/form-styles.css` (`class="app-form"` on the container,
`app-button` on buttons). Grid features are added module by module in `shared/grid/grid-setup.ts`;
in development AG Grid logs a console error when a feature's module is missing.

### Assets

| Folder                                   | Content                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `public/icons/menu`                      | Sidebar icons. The database's `MenuConfiguration.Icon` names these files: never rename them. A missing one shows `default.png`. |
| `public/icons/case`                      | v21's case header images (Vehicle Tracker, View More, Phase Costing, SMS / Email) and the Vehicle Tracker map                   |
| `public/icons/services`, `public/images` | Other v21 images (login background, logo, profile placeholder)                                                                  |
| `public/fonts`                           | Poppins, used in PDFs                                                                                                           |

## Conventions

- Standalone components, `ChangeDetectionStrategy.OnPush`, zoneless change detection.
- Signals for state: `input()`, `output()`, `model()`, `signal()`, `computed()`. Use `inject()`, not
  constructor injection.
- Built-in control flow (`@if`, `@for`, `@switch`).
- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`) and `strictTemplates`. `any` is a lint error.
- File naming follows the Angular style guide: `case-list.ts`, `case-list.html`, `case-list.spec.ts`.
- Add an abstraction only when at least two real screens need it.

## Testing

Unit tests use Vitest via `ng test` (`npx ng test --watch=false --include src/app/features/cases`
runs one area). Test business rules, mappers, guards and interceptors, and drive screens through
their real templates. Fakes of the backend must reply the way the backend really does (e.g. echoed
empty lists), or a test can pass while the app breaks.

## Git

- Run `npm run verify` before pushing.
- Commit messages follow `type(scope): summary` (`feat(phase-9a): …`, `fix(…): …`).
- Commits and pull requests carry **no AI-assistant attribution** (no `Co-Authored-By` lines).
