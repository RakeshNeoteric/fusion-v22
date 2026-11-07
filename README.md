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
a closed or aborted case only look, as do users without edit access to Cases (`CASES_PERMISSION`;
the header says "View only"). All of these rules live in `CaseWorkspace.readOnly`, which every tab,
popup and header action follows. The holder lets go with `CaseExit` on Exit, and also when
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
The client's service providers are loaded once per open case (`CaseWorkspace.loadProviders`).

Phase tabs (`tabs/phase`) are one component for Phase 1–4. "+" on the tab strip adds the first
phase the case lacks (up to the number its service type allows) once the open phase has its
provider; Collect From is worked out from the case: the body location for Phase 1, otherwise
where the phase before removed the deceased to. A phase saves when the mouse leaves it (quietly,
as in v21) as well as before another tab opens. Its saves send the whole row, so Phase Costing's
values are kept; the Transport Operator Check List is saved inside its phase.

Phase Costing and Additional Cost (`case-details/costing`) open from the case header. A phase's
total is fixed + rate × km + additional, rounded to cents (`costing-rules.ts`). An internal
provider's phase takes the provider's rate and the Transport distance, and only its fixed cost is
entered; an external provider's phase takes a rate and distance, not a fixed cost. Authorising a
phase stamps the date and authoriser and locks it, keeping the rate it was authorised at. Additional
costs are added and deleted (kept, marked deleted), not edited. Only authorised phases and
non-deleted additional costs count toward the case's `PhaseTotal`, `AdditionalCostTotal` and
`TotalCost`, which `CaseWorkspace.saveTotals` saves with the whole case record whenever they
change. The vehicle dispatch time is stored in UTC and shown in local time.

Complaints (`tabs/complaints`) are logged in a popup by the signed-in user and then only viewed,
as in v21. Documents (`tabs/documents`) has a row for each document the client asks for (its
Documents links): the client's template, and the file uploaded for it on this case. An upload is
one form post with the file; uploading again replaces the case's file (after asking), and the
backend deletes the old one. Moments the backend stores in UTC are shown in local time with
`shared/reference/date-time.ts`.

Voucher/SMS (`tabs/voucher`) requests vouchers through `api/vouchers/voucher.api.ts`. The
provider and the limits (amount and number of vouchers) come from the client's link to the case's
own service; a limit that is not set means no limit. `voucher-rules.ts` checks an allocation
against the provider's stock and the limits, counting the vouchers the case holds (reserved,
approved or redeemed). After a request, the tab shows the stock the backend returns and reloads
the case's vouchers, whose status the transport managers change. Sent SMS cannot be listed: the
backend keeps them without their case.

What happens to the case as a whole lives in `case-details/lifecycle`: `CaseLifecycle` (provided
by the page next to `CaseWorkspace`) and the popups that collect what it needs. Exit asks whether
the call is complete: No lets go of the case as it is; Yes closes it once the main caller has
answered every rating question, opening Case Rating first when some are not. Abort and Re-Open
need a reason, which goes in the case history; the backend sets the status from the history note
(`CaseAbort` → Aborted, `CaseReopen` / `CaseReAssign` → Active), then `CaseExit` lets the case go
and stamps who closed it. `CaseExit` answers 200 even when someone else holds the case, so its
text is checked (`CaseHeldElsewhereError`). Re-Assign saves the whole case with the new controller
and rebuilds the open tab, so no form keeps the old one. Case Rating offers the options set up for
each question's type (Configuration / Rating Question Options) and saves the caller's name and
number with the answers. Phase Costing, Additional Cost, Case Rating, Re-Open and Re-Assign are in
the header's View More menu, as in v21.

Contact History, SMS / Email and notes live in `case-details/communication` (`CaseCommunication`,
provided by the page). Contact History reloads the case's history when it opens (others, and the
backend, add to it), lists it newest first and filters it by type; New Note adds an Admin,
Inbound or Outbound note (`Note` would also text the caller). SMS and email go through the
backend's case `Operation`, which logs them in the history; the SMS goes to the main caller's
number and the email to the callers' addresses by default. The backend sends email from its own
address, copying the signed-in user, and does not attach files, so the Documents tab's Email
names the client's documents in the message. Case Stages and Vehicle Tracker drop down under the
header; v21 showed fixed pictures there, and the backend has no data for them yet.

Voucher Approval (`features/voucher-approval`, menu code `VchApprvl`) lists the vouchers reserved
for cases. Approving (after a confirmation, since the caller is then texted) or rejecting (with a
reason of at least 5 characters) needs edit access; the decided voucher leaves the list. The
backend logs each decision against the voucher's id, which `GetReservedVouchers` leaves out, so it
is looked up by code in the voucher event log (`GetVoucherByCode`). v21 loaded the case instead,
which opened the case for the approver and added a "Case Opened" history note.

PDFs are built in the browser with pdfmake (`shared/pdf`). `PdfRenderer` loads pdfmake on first
use (a lazy chunk), sets the documents in Poppins (`public/fonts`) and opens the PDF in a new tab,
opened during the click so pop-up blockers allow it. Fonts and images are given as URLs under the
base href, which pdfmake fetches. `pdf-parts.ts` holds the v21 building blocks (labelled values,
section titles, rounded boxes, outlined tables) and `letterhead.ts` the company's header from its
addresses (Security / Company Details, sent with `CaseInit`); v21 printed made-up company details
when none were set up. Each document is a function from what it prints to a pdfmake definition,
next to its screen: Additional Cost's "Additional Cost PO" (`costing/additional-cost-po.ts`) prints
a block per cost and the total, dated today, while the case can be changed (as in v21).

Phase Costing prints a phase's removal documents from the phase as saved
(`costing/removal-order.ts` gathers what they print, `removal-order-pdf.ts` lays it out). The
Removal Order needs the phase authorised; it goes to the phase's collecting provider: an internal
provider's order names the company's driver and vehicle and has the driver's notes, mileage and
signature boxes, another provider's order names the provider and bills the phase (fixed cost +
rate × km, plus its additional cost). Removal Order Instructions, for other providers only, is
their order without the billing. Remove From and Take To are the phase's Collect From and Remove
To, as on the Transport Operator Check List (v21's order had them the other way round). pdfmake
cannot round a table's corners, so panels are drawn behind their content at a height worked out
from their text (`estimateLines`).

Claims is not migrated: v21's Claims screen (`/claims/claims`) was an empty placeholder, the
backend has no claims endpoints, and no menu entry links to it. The backend's claimant import
(`ClaimantManagement`) never had a screen. Claim Centre (Configuration) is a separate screen.

Reports / Client Reports (`features/reports/client-reports`) shows one client's cases created in
a period (default last month), for some or all of its active services (`GET
Client/ClientCaseDetails`). View shows a Dashboard tab, a tab of all the client's cases, and a tab
per chosen service (all of them when none is chosen) with that service type's columns
(`report-columns.ts`): Funeral adds the deceased's details, AVS and FINF the policy holder's, and a
voucher service a row per voucher with its code, amount, month issued and status. Tables are
`ReportTable` (`features/reports/report-table.ts`): sorting and text filters, ten rows a page.
v21 also let a column be dragged to group rows, which needs AG Grid Enterprise. The backend only
looks at cases created this calendar year, so a period in an earlier year comes back empty.

The Client Reports dashboard (`client-reports/dashboard`) is built in two steps: plain
functions turn the backend's `DashBoard` into cards (a chart spec and its table), then
`chart-options.ts` turns a chart spec into ECharts options. Nedgroup and Capitec have
dashboards of their own, picked by what the client's name contains; every other client gets
FNB's. Service tiles, status and province totals cover the period asked for; the monthly charts
cover every month of the current year, as the backend counts them. Year-to-date lines are running
totals of the months. Colours follow what a line or slice is about (a service, province or voucher
type), from a palette checked for colour-blind separation. Charts are drawn by `shared/chart`
(`Chart`), which loads ECharts on first use; tests provide a fake `CHART_ENGINE`.

Excel files are built in the browser with ExcelJS (`shared/excel`): `NEW_WORKBOOK` loads it on
first use (a lazy chunk), `excel-sheet.ts` has the v21 look (teal title bar, orange headers,
zebra rows, filter and frozen headers) and makes sheet names Excel accepts (31 characters, unique),
and `saveFile` downloads the result. Client Reports' Export Excel (on the Dashboard tab) exports
the report as last viewed (`client-reports/export`): a summary (Nedgroup: its services in the
period's first month; others: the year's cases by month and service), the dashboard's cards with
the charts as drawn on screen and their tables (Nedgroup: a services sheet and a vouchers sheet),
a sheet per report tab, and the redeemed vouchers. v21's empty "Call Centre Stats" sheet is left
out.

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
