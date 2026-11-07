# Fusion Edge (Angular 22)

Frontend for Fusion Edge Services (funeral / repatriation case management). This is the Angular 22
rewrite of `fusion-edge-v21`, migrated feature by feature with behaviour parity.

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

Screens edited in a popup form (v21: Claim Centre, Rating Questions, Rating Question Options) pass
an `editor` instead of `newEntity`. The grid is then read-only with a View/Edit button, and the form
saves. A form extends `RecordDialog` (`shared/forms/record-dialog`), which holds the save rules,
and is opened with `RecordDialogs.open(Form, record, permission, injector)`; read-only users get the
form disabled and no Save. Lookups shared by the grid and the form extend `RecordLookup` and are
provided on the page (see `claim-centres-page.ts`). Phone numbers use `app-phone-field` (E.164).
A form can override `afterSave` to tidy up once the record is stored. Files a form points at
(user photo, BEE certificate) go through `DialogFiles` (`shared/forms/record-dialog/dialog-files.ts`):
a new file is uploaded when chosen, the replaced one is deleted only after Save, and uploads are
deleted when the form is cancelled. Pictures kept in file storage (company logo, user photo) use
`app-image-picker` (`size`, `round`) with a `StoredImage` for the preview (`shared/ui/image-picker`).
`RecordDialogs.open` takes an optional width for long forms (Service Provider: 1150px).

The frame (`app-record-dialog-frame`) also takes `cancelable`, `savable`, `closeResult` and
content marked `rdFooterStart` (shown left of the buttons).

Workspace popups with several tabs (v21 Client) use `app-folder-tabs` (`shared/ui/folder-tabs`)
for the slanted v21 tabs; the page decides whether a chosen tab opens, so a new client is saved
before its link tabs. Each link tab (`features/clients/tabs`) extends `ClientLinkTab`, which saves
every link or unlink at once through `ClientLinksApi`; linked records are listed with
`app-link-table` (`shared/ui/link-table`, optional View and Delete, custom cells via
`<ng-template appLinkCell="Header">`). Link popups get their tab's data through the
`CLIENT_LINK_CONTEXT` token in the injector passed to `RecordDialogs.open`. Stored files are
previewed or downloaded with `FileViewer` (`shared/files`).

The case list (`features/cases/case-list`) groups by client, service and status like v21, without AG Grid
Enterprise: `case-grouping.ts` turns the cases into group headings and case rows, sorted within
their groups, and `app-case-group-bar` changes the grouping (drag, remove, add back). Opening a case
(`GET CaseDetails/{id}`) makes the user its holder (`CaseOpenedBy`); others and everyone on
a closed or aborted case only look. The holder lets go with `CaseExit` on Exit, and also when
leaving the page any other way. The tabs a case shows come from its service type's
`ServiceTypeBasedTabs` rule (`case-setup.ts`); phase tabs appear only once the case has them.

Case tabs (`features/cases/case-details/tabs`, one folder per tab with its template, popups and
spec) share the open case through `CaseWorkspace`, which the page
provides. A tab with a form extends `CaseTabForm` (`hasChanges`, `save`): the page saves it
before another tab opens and before Exit, and stays on the tab when the form has errors. The
backend replaces whole rows, so saves always send the full record with the tab's changes
(`CaseApi.update`, `tabs/case-records.ts`). Tab specs drive the real page through
`tabs/testing/case-tab-harness.ts`; `testing/` folders are left out of the app build. The policy holder lives on the newest `CaseValidation`
row; a row with a validation method is never changed, so later edits add a new row.
A case has at most one deceased, cause of death and final funeral record (the database refuses a
second), so their tabs update the loaded record and only create one when the case has none.
Final Funeral stores the parlour's **name** and copies its details when the user picks it; saved
details are shown as saved, and a parlour no longer linked to the client stays selectable.

A page whose title bar needs data (Permissions: "Security / {role} / Permissions") sets it with
`PageTitle.show()` and removes it with `hide()` when it is destroyed; otherwise the route's
`data.breadcrumb` is shown.

Forms share the v21 look from `src/form-styles.css` (put `class="app-form"` on the container,
`app-button` on buttons). Large third-party styles are built as separate bundles in
`angular.json` (`"inject": false`) and added on first use with `useLazyStylesheet`, as the
Services note editor does with Quill.

Grid features are added module by module in `shared/grid/grid-setup.ts`. In development, AG Grid
logs a console error when a feature's module is missing.

## Conventions

- Standalone components, `ChangeDetectionStrategy.OnPush`, zoneless change detection.
- Signals for state: `input()`, `output()`, `model()`, `signal()`, `computed()`. Use `inject()`, not
  constructor injection.
- Built-in control flow (`@if`, `@for`, `@switch`).
- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`) and `strictTemplates`. `any` is a lint error.
- File naming follows the Angular style guide: `case-list.ts`, `case-list.html`, `case-list.spec.ts`.
- Add an abstraction only when at least two real screens need it.

## Testing

Unit tests use Vitest via `ng test`. Test business rules, stores, mappers, guards and interceptors.
Each migrated feature also has a parity checklist against v21 in its phase report.
