# Fusion Edge: migration from v21 to v22

The record of moving the Fusion Edge web app from Angular 21 (`fusion-edge-v21`) to Angular 22
(`fusion-edge-v22`, this repository): what v21 was, what v22 is, what was built in each phase,
which v21 bugs were deliberately not copied, what the parity review fixed, the backend issues found
on the way, and what is still open.

For what each screen does today, see [FUNCTIONALITY.md](FUNCTIONALITY.md). For setup and code
structure, see the [README](../README.md).

| Repository | Path                                                     |
| ---------- | -------------------------------------------------------- |
| v22 (this) | `fusion-edge-v22` · github.com/RakeshNeoteric/fusion-v22 |
| v21        | `fusion-edge-v21/Fusion-Edge`                            |
| Backend    | `fusion-backend/Fusion-Edge-Services` (not changed)      |

---

## Contents

1. [Goals and rules](#1-goals-and-rules)
2. [v21 compared with v22](#2-v21-compared-with-v22)
3. [Phases](#3-phases)
4. [v21 bugs not carried over](#4-v21-bugs-not-carried-over)
5. [Parity review and release fixes (Phase 9)](#5-parity-review-and-release-fixes-phase-9)
6. [Deliberate differences from v21](#6-deliberate-differences-from-v21)
7. [Backend issues for the backend team](#7-backend-issues-for-the-backend-team)
8. [Still open](#8-still-open)
9. [Numbers](#9-numbers)

---

## 1. Goals and rules

- **Same business behaviour as v21**, rebuilt cleanly. v21 code was read, not copied.
- **Don't port v21 bugs.** Each one found is fixed and listed in [§4](#4-v21-bugs-not-carried-over).
- **The backend is not touched.** v22 calls the same endpoints with the same PascalCase JSON and
  string enums. Backend quirks are worked around in the frontend and listed for the backend team.
- **Same URLs as v21**, so bookmarks and the database menu configuration keep working.
- **One phase at a time**, each with a parity checklist against v21, its tests, and a report.
- **Strict and modern**: Angular 22 standalone, signals, zoneless, OnPush; strict TypeScript;
  no `any`; abstractions only when two real screens need them.
- **Commits carry no AI attribution** (the team's rule).

---

## 2. v21 compared with v22

### Technology

| Area          | v21                                                            | v22                                                                                |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Angular       | 21.2, NgModules, zone.js, SSR packages                         | 22.2, standalone only, **zoneless**, OnPush everywhere, signals                    |
| Rendering     | **SSR**: Express server (`src/server.ts`), Node.js hosting     | **Client-side only (CSR)**: static files, any web host (see WHY-WE-MIGRATED.md §3) |
| TypeScript    | 5.9, loose                                                     | 6.0, `strict`, `noUncheckedIndexedAccess`, `strictTemplates`, no `any`             |
| State         | NGXS store, services with subjects                             | Signals (`signal`, `computed`), page-provided services                             |
| Sign-in       | `@azure/msal-angular` + msal-browser                           | `@azure/msal-browser` only, with a small zoneless auth service                     |
| UI kits       | Bootstrap, ngx-bootstrap, PrimeNG, Angular Material, ng-select | Angular Material 22 only, plus the app's own form styles                           |
| Icons         | Font Awesome font, Bootstrap Icons, PrimeIcons, Boxicons (CDN) | v21's Font Awesome shapes as inline SVG; v21's PNG images                          |
| Grid          | AG Grid 33 **Enterprise** (row grouping)                       | AG Grid 36 **Community**, only the modules used; grouping rebuilt                  |
| Charts        | ngx-echarts + ECharts 5                                        | ECharts 5.6 directly, loaded on first use                                          |
| Excel         | ExcelJS + xlsx (SheetJS) + file-saver                          | ExcelJS only, loaded on first use                                                  |
| PDF           | pdfmake 0.2                                                    | pdfmake 0.3, loaded on first use                                                   |
| Phone input   | ngx-intl-tel-input, intl-tel-input, google-libphonenumber      | Own phone field on libphonenumber-js + flag-icons                                  |
| Dates         | moment                                                         | Native `Date` / `Intl`                                                             |
| Rich text     | ngx-quill 30                                                   | ngx-quill 31, Quill pinned to 2.0.2 (security advisory)                            |
| Notifications | ngx-toastr                                                     | Material snackbar                                                                  |
| Tests         | Karma + Jasmine (180 tests, mostly generated)                  | Vitest, 665 tests                                                                  |
| Lint          | none enforced                                                  | angular-eslint 22 with type-aware rules and architecture boundaries                |

### Structure

| v21                                                                       | v22                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `features/…/pages/…/x.component.ts`, services next to pages, mixed naming | `api/` (backend calls and types), `core/` (app-wide), `shared/` (reusable), `features/` (one folder per screen) |
| Components call `HttpClient` directly                                     | Only typed clients in `api/` call the backend                                                                   |
| ~12 copied list screens                                                   | One `EntityGrid` driven by a config per screen                                                                  |
| Menu items hidden, routes open                                            | Every route guarded by its permission code                                                                      |
| Assets in `src/assets`                                                    | Assets in `public/` (`icons/menu`, `icons/case`, `images`, `fonts`)                                             |

### Size of the first download

|                | v21                         | v22                             |
| -------------- | --------------------------- | ------------------------------- |
| Initial bundle | 8.5 MB (1.8 MB transferred) | **831 kB (198 kB transferred)** |
| Budget         | 10 MB warning               | 850 kB warning, 1 MB error      |

Large libraries load only when a screen needs them: grid 255 kB, PDF 251 kB, Excel 218 kB, charts
148 kB, text editor 51 kB (transferred sizes). Microsoft sign-in (about 336 kB) is needed at startup.

---

## 3. Phases

| Phase | Commit                          | What was built                                                                                                                                                                                                                                         |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | `eef08ce`                       | Foundation: strict TypeScript, ESLint with architecture boundaries, typed config (`APP_CONFIG`), path aliases, https dev server, scripts                                                                                                               |
| 1     | `2ea43f2`                       | Sign-in (msal-browser), startup (UserValidation, AppInit), permissions with route guards, HTTP layer (base URL, token only to the API host, one error shape), app shell (header, sidebar, breadcrumb), login, forbidden and not-found pages            |
| 2     | `e13a750`                       | AG Grid Community setup, `EntityGrid`, unsaved-changes guard, `ConfigCrudApi`, Body Locations                                                                                                                                                          |
| 3     | `8d7d362`, `6dc66db`, `8c796e8` | Configuration screens: Branches, Documents, Vehicles, Transport Operators, Rating Question Types / Questions / Options, Claim Centres, Client Groups, Service Types, Services, Company Details; `RecordDialog`, `RecordLookup`, phone field with flags |
| 4     | `c3dc075`                       | Security: Users (photo), Roles, Permissions matrix, User Roles Mapping; image picker                                                                                                                                                                   |
| 5     | `a169b6a`                       | Service Providers; v21 look for the security screens; `DialogFiles`, `PageTitle`                                                                                                                                                                       |
| 6     | `cde6ce0`                       | Clients: details, services, rating questions, documents and service provider tabs; clone                                                                                                                                                               |
| 7a    | `5a15f58`                       | Case list grouped by client, service and status; new case popup; case details shell with tabs per service type                                                                                                                                         |
| 7b    | `ad02476`                       | Caller, Policy Details and Validation tabs; save on tab change and exit                                                                                                                                                                                |
| 7c    | `5a75264`                       | Deceased Info, Cause Of Death, Final Funeral tabs                                                                                                                                                                                                      |
| 7d    | `23b5def`, `5f7d6a6`            | Phase 1–4 tabs, add phase, Transport Operator Check List; Phase Costing, Transport and Additional Cost                                                                                                                                                 |
| 7e    | `244d659`, `75adc99`            | Complaints and Documents tabs, view-only case access; Voucher/SMS tab                                                                                                                                                                                  |
| 7f    | `4425d23`, `e1def11`            | Case lifecycle (exit, abort, re-open, re-assign, case rating); Contact History, notes, SMS / Email, header panels                                                                                                                                      |
| 8a    | `15eee41`                       | Voucher Approval                                                                                                                                                                                                                                       |
| 8c    | `be01581`, `07e60ea`, `3918408` | PDFs (Additional Cost PO, Removal Orders); Client Reports with dashboards and Excel export; Internal Reports placeholder                                                                                                                               |
| 8d    | `527711e`                       | Dashboard "coming soon"; shared `ComingSoon`                                                                                                                                                                                                           |
| 9a    | `83041b0`                       | My Profile in the header; text filters on every case list column (both were in v21 and missing)                                                                                                                                                        |
| 9b    | `76bda80`                       | Release fixes from the parity review ([§5](#5-parity-review-and-release-fixes-phase-9)); v21 icons and images                                                                                                                                          |

---

## 4. v21 bugs not carried over

Found while rebuilding each screen. v22 does the right thing; the comment in the code says what v21
did.

### Security and access

- v21 only **hid menu items**: typing a URL opened any screen. v22 guards every route.
- v21's "API override" popup could send the user's **token to another host**. v22 sends the token
  only to the configured API.
- v21 Voucher Approval **opened the case** to find the voucher, which locked the case to the
  approver and added a "Case Opened" history note. v22 looks the voucher up by code.

### Data

- v21 **overwrote the policy holder's validation** row; v22 adds a new row once a row has a
  validation method.
- v21's Permissions screen **saved silently whenever another menu was picked**; v22 keeps every
  change until Save and asks before leaving with unsaved changes.
- v21 popups could drop fields they did not show when updating a record; v22 keeps them.
- v21's phone formatting looked countries up **by label**, so the US and UK never matched and got
  `+27`; v22 matches by ISO code.
- v21 printed **made-up company details** on PDFs when none were set up, and a made-up
  "Designation No" (GMN23); v22 prints only real data.
- v21's Removal Order had **Remove From and Take To the other way round**.
- v21 showed a **made-up sample SMS row** on the Voucher/SMS tab.
- v21's Nedgroup year-to-date voucher budget took **only the last voucher type's** figure, so it
  disagreed with the monthly chart.
- v21's Client Reports Excel had an **empty "Call Centre Stats" sheet**.

- v21 Clients did not check required fields before saving Details, saved Details on every tab
  change even with nothing changed, and saved for read-only users too; v22 saves only real
  changes, after checking them, and never for read-only users.
- v21 sent an empty Transfer Number on a client's service link, which the backend refuses; v22
  requires it.
- v21 never re-dated a service provider's rate authorisation once a date existed (the backend's
  `0001-01-01` counted as a date), so an old provider could never get one; v22 stamps today
  whenever Authorised By is picked and clears the date when it is cleared.
- v21's Service Provider "Can Edit Address" toggle was never loaded or saved; v22 leaves it out.

### Behaviour kept on purpose

- Delete needs full (create) access, as in v21, which ignored `CanDeleted`.
- A role with only `IsVisible` can read, as in v21 (the backend wants `CanRead`; see P3 below).

---

## 5. Parity review and release fixes (Phase 9)

Phase 9 compared v21 and v22 screen by screen, checked the build budget, smoke-tested the
production build, and listed the backend issues. These were found and fixed (`76bda80`) or added
(`83041b0`):

### Must fix (would hurt users or damage data)

| #   | Problem                                                                                                  | Fix                                                                         |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Saving a case tab wiped the other tabs (the backend echoes empty lists)                                  | Keep the lists already loaded; take only plain fields from the reply        |
| 2   | Leaving a Closed or Aborted case re-stamped its closed date                                              | A finished case is only released (`CaseOpenedBy` cleared)                   |
| 3   | Creating a Service or Client Group failed (id `0` sent)                                                  | No id sent on create                                                        |
| 4   | Roboto never loaded: text showed in Times on machines without it                                         | Roboto loaded from Google Fonts, fallbacks for every Material font token    |
| 5   | After sign-in the user landed on the wrong page (query string dropped; mid-session sign-in went to Home) | Return URL keeps the query; the Microsoft redirect carries the current page |

### Should fix

| Problem                                                                               | Fix                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A case stayed locked to someone who only looked (a reload hands it to the reader)     | The page notices and releases it on leaving         |
| Same-name uploads replaced each other; replacing a file deleted another record's file | Unique upload names; stored files are never deleted |
| ✖ on the Client popup lost edits without asking                                       | Asks "Unsaved changes" first                        |
| Raw database errors reached users                                                     | Translated into plain messages                      |

### Small

| Problem                                                      | Fix                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| Report Amount sorted as text and exported to Excel as text   | Sorted by value; exported as a number (`R 1,250.00`) |
| Nedgroup YTD voucher budget disagreed with the monthly chart | Running total of the monthly budgets                 |
| A service type code reused after deletion showed "(Deleted)" | Lookups prefer the live record (all lookups)         |
| A blank Transport Operator phone was saved as "+27"          | Stays blank                                          |
| Some v21 menu icons were missing (broken image)              | All v21 menu icons added; `default.png` fallback     |

### Missing from v22, added

- **My Profile**: v21 let users edit their own name, phone and photo from the header.
- **Case list column filters**: v21 had a filter on every column.

### Icons and images

v22 uses v21's own icons: the Font Awesome 6.7.2 shapes (bars, sign-out, plus, clone, ban,
timeline, clock-rotate-left, star, coins, rotate-left, person-walking-arrow, …) built in as SVG,
and v21's PNGs for Vehicle Tracker, View More, Phase Costing and SMS / Email
(`public/icons/case`, scaled from up to 8192 px down to 96 px). The login envelope uses Font
Awesome's envelope (v21's Boxicons came only from a CDN).

---

## 6. Deliberate differences from v21

Worth knowing; each was a choice, not an accident.

| v21                                                          | v22                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Header SMS / Email called `Messaging/SendSMS` and `SendMail` | Calls `Operation/{id}` (`SMS` / `EMail`), which also logs it in the case history |
| Final Funeral listed all active providers                    | Lists the client's own parlours                                                  |
| Policy Number shown as required, not enforced                | Enforced                                                                         |
| Mobile Number optional for users                             | Required (existing users without one need it added before saving)                |
| Searchable dropdowns (ng-select) for client, service, agent  | Plain dropdowns                                                                  |
| Case list grouping by AG Grid Enterprise                     | Own grouping on Community (same result)                                          |
| Report tables: drag a column to group                        | Not available (needs Enterprise)                                                 |
| Claims screen (empty placeholder)                            | Not migrated                                                                     |
| `cases/new` URL                                              | Not migrated (nothing linked to it)                                              |
| Dashboard said "dashboard works"                             | "Coming soon" page                                                               |
| Service Provider BEE certificate: View and Download only     | Also Remove (takes effect on Save; the stored file is kept)                      |
| Client Data Policy File was a read-only dropdown             | A read-only text field (same value, cannot be changed)                           |

---

## 7. Backend issues for the backend team

Found by reading `Fusion-Edge-Services` during the migration; the backend was not changed.
**Critical 6 · High 14 · Medium 22 · Low 11.** Paths are relative to
`FusionEdgeServices/FusionEdgeServices/`. Items marked "check at runtime" were not confirmed against
a running server. Once fixed, nothing needs a frontend change except C1 and C2, where an open /
release endpoint would let the app drop its workarounds.

### Security (fix first)

| #   | Sev      | Problem                                                                                                                                                              | Where                                                          |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| S1  | Critical | Secrets committed to git (SendGrid key, Twilio token, JWT secret, connection strings). Rotate and move to a secret store.                                            | `appsettings.Development.json`                                 |
| S2  | Critical | 17 of 28 controllers have no `[Authorize]` and there is no fallback policy (all `Config/*`, Service, ServiceProvider, ClientGroup, CompanyDetails, Report, WhatsApp) | `Controllers/Configurations/*.cs`; `Program.cs:67-70, 206-207` |
| S3  | Critical | Any signed-in user can give themselves any role (`Permission/UserRoles`, `Roles`, `RolesPermissions` check sign-in only)                                             | `Controllers/PermissionController.cs:72, 95, 119`              |
| S4  | Critical | `GET /Users` returns `PasswordHash` and `SecurityStamp`                                                                                                              | `Controllers/UserManagementController.cs`                      |
| S5  | High     | Hard-coded admin/admin login, password in the URL; hidden from Swagger but routable                                                                                  | `Controllers/AuthController.cs`                                |
| S6  | High     | Client reports have no permission check (commented out); any user can fetch any client's report                                                                      | `Controllers/ClientController.cs:72`                           |
| S7  | High     | Raw exception and SQL messages sent to the browser (422 and 500)                                                                                                     | `Helpers/GlobalExceptionMIddileware.cs:44-52, 77-80`           |
| S8  | Medium   | `App/UserValidation` needs no sign-in: anyone can check whether an email is registered                                                                               | `Controllers/AppController.cs:79-80`                           |

### Sign-in and permissions

| #   | Sev    | Problem                                                                                                                              | Where                                                                                  |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| P1  | High   | AppInit fails (500) when the email's casing differs; the app cannot start for that user                                              | `Controllers/AppController.cs:32-52`                                                   |
| P2  | High   | Users with several roles can get 403: the filter takes the first matching permission row (deleted roles included), not the strongest | `Filters/PermissionFilter.cs:51-61`                                                    |
| P3  | Medium | Read access needs `CanRead`, but the web app (and v21) treat `IsVisible` as read                                                     | `Filters/PermissionFilter.cs:97`                                                       |
| P4  | Medium | `requireCreate` is never checked                                                                                                     | `Services/Authorization/PermissionEvaluator.cs:62-86`                                  |
| P5  | Medium | `PUT Users` needs Create, so edit-only users are refused                                                                             | `Controllers/UserManagementController.cs`                                              |
| P6  | Medium | The "no roles" check counts deleted roles; such a user gets an empty app                                                             | `Controllers/AppController.cs:95`                                                      |
| P7  | Medium | The same role can be assigned twice (no check, no unique index)                                                                      | `Controllers/PermissionController.cs:83`; `Models/Configurations/Permissions.cs:23-25` |
| P8  | Low    | Saving permissions resets `CanDeleted`                                                                                               | `Controllers/PermissionController.cs:127`                                              |
| P9  | Low    | Field permissions can't be deleted, only hidden; only for menus in `MenuCodes`                                                       | `Controllers/PermissionController.cs`                                                  |
| P10 | Low    | Throws when the token has no Name claim                                                                                              | `Filters/PermissionFilter.cs:105`                                                      |
| P11 | Low    | The 401 body is lost on non-GET requests                                                                                             | `Services/AuditLoggingMiddleware.cs:85`                                                |
| P12 | Medium | No "my profile" endpoint: users can't edit their own profile without administering Users. Add `GET/PUT Users/Me`                     | `Controllers/UserManagementController.cs:24, 47`                                       |
| P13 | Low    | `LastLoginDateTime` is never set (always year 0001)                                                                                  | `Models/AspNetUsers.cs:23`; `Controllers/AppController.cs`                             |

### Cases

| #   | Sev      | Problem                                                                                                                                                                                                                                                               | Where                                                   |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| C1  | Critical | Reading a case changes it: `GET CaseDetails/{id}` gives it to the reader (view-only users and closed cases too) and resets `CaseOpenDate`; `CaseExit` then re-stamps the closed date. Proposal: side-effect-free GET plus `POST CaseDetails/{id}/open` and `/release` | `Controllers/CaseDetailsController.cs:96-108, 171-175`  |
| C2  | High     | A case can't be released when the browser tab closes (`CaseExit` is a GET needing a token; `sendBeacon` sends neither). Cases stay locked                                                                                                                             | `Controllers/CaseDetailsController.cs:159`              |
| C3  | High     | Sent SMS and emails never reach Contact History (`SaveChangesAsync` missing)                                                                                                                                                                                          | `Controllers/CaseDetailsController.cs:546-554, 559-566` |
| C4  | High     | SMS to South African mobiles refused (12 digits required; SA has 11)                                                                                                                                                                                                  | Messaging / SendSMS validation                          |
| C5  | High     | No paging: `GET CaseDetails` returns every case with its records                                                                                                                                                                                                      | `Controllers/CaseDetailsController.cs`                  |
| C6  | Medium   | A new case gets no agent (`AgentId < 1` is false for null)                                                                                                                                                                                                            | `Controllers/CaseDetailsController.cs:120`              |
| C7  | Medium   | Abort via history only changes the status (no closed date, no release)                                                                                                                                                                                                | `Controllers/CaseDetailsController.cs:443-445`          |
| C8  | Medium   | Unknown case id returns 500 instead of 404                                                                                                                                                                                                                            | `Controllers/CaseDetailsController.cs:94`               |
| C9  | Medium   | Empty text may be rejected on non-nullable columns (phase Collect From, Manager's Name, Remove To; VAT Number, Company Reg. No.). Check at runtime                                                                                                                    | Models                                                  |
| C10 | Low      | Saving an empty ratings list throws                                                                                                                                                                                                                                   | `Controllers/CaseDetailsController.cs:501`              |
| C11 | Low      | Transport notification email names "Noma Mbele" as requester for everyone                                                                                                                                                                                             | `Controllers/CaseDetailsController.cs:537`              |

### Vouchers

| #   | Sev    | Problem                                                                    | Where                                      |
| --- | ------ | -------------------------------------------------------------------------- | ------------------------------------------ |
| V1  | High   | Approval SMS uses the wrong id, so the caller is likely not texted         | `Controllers/VoucherController.cs:121-122` |
| V2  | High   | Rejection email goes to the wrong people (user id passed as role id)       | `Controllers/VoucherController.cs:112`     |
| V3  | Medium | Approval throws when the case has no caller; approving twice sends two SMS | `Controllers/VoucherController.cs:128`     |
| V4  | Low    | "Awaiting approval" email sent even when nothing was reserved              | `Controllers/VoucherController.cs`         |

### Reports and menus

| #   | Sev    | Problem                                                                             | Where                                 |
| --- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------- |
| R1  | High   | Client reports only cover the current calendar year                                 | `Controllers/ClientController.cs`     |
| R2  | Medium | "Last month" drops days (month-end clamp, exclusive bounds)                         | `Controllers/ClientController.cs:88`  |
| R3  | Medium | Budgets hard-coded (4 cases, 40 vouchers a month)                                   | `Controllers/ClientController.cs`     |
| R4  | Medium | No endpoints for Internal Reports, Dashboard, Area Codes                            | —                                     |
| R5  | Medium | Menu seed duplicates rows after an admin edit; no Reports menus in a fresh database | `Data/SeedMenuConfiguration.cs:13-99` |

### Clients, configuration and files

| #   | Sev      | Problem                                                                          | Where                                                                                   |
| --- | -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| F1  | Critical | Uploads with the same name overwrite each other (the app now sends unique names) | `Controllers/FileController.cs:24-33`; `Services/LocalFileStorageService.cs:42-48, 120` |
| F2  | High     | A cloned client shares the original's files                                      | `Controllers/ClientController.cs:397-426`                                               |
| F3  | High     | Deleted rows are returned (soft-delete filter commented out)                     | `Data/AppDbContext`                                                                     |
| F4  | Medium   | Only one rating question per question type (one-to-one mapping)                  | `Models/Configurations/RatingQuestion.cs`                                               |
| F5  | Medium   | Option names must be unique across all question types                            | `Controllers/Configurations/RatingQuestionOptionController.cs:38, 54`                   |
| F6  | Medium   | Link → unlink → link → unlink of a client document fails (500)                   | `Controllers/ClientController.cs:310-314`; `Models/Client.cs:73`                        |
| F7  | Medium   | An empty array crashes the client batch endpoints                                | `Controllers/ClientController.cs:212, 240, 268, 341, 369`                               |
| F8  | Medium   | Renaming a service type code orphans its services and providers                  | `Controllers/Configurations/ServiceTypesController.cs:51-55`                            |
| F9  | Medium   | Empty optional text may be rejected (non-nullable strings). Check at runtime     | `Models/Configurations/ClaimCentre.cs:15-20`; `Models/Client.cs:171-172`                |
| F10 | Low      | A logo sent with a client update is never saved                                  | `Controllers/ClientController.cs:197-204`                                               |

### Platform

| #   | Sev | Problem                                                                | Where                                |
| --- | --- | ---------------------------------------------------------------------- | ------------------------------------ |
| X1  | Low | `DateTimeConfig.Now` calls itself when `UseUtc` is on (stack overflow) | `Helpers/DateTimeConfig.cs`          |
| X2  | Low | AppInit loads every user with all roles to find one                    | `Controllers/AppController.cs:32-51` |

---

## 8. Still open

| Item                         | Notes                                                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home page                    | Blank; left as is for now                                                                                                                                                                                                                       |
| Dashboard, Internal Reports  | "Coming soon" until the backend has data (R4)                                                                                                                                                                                                   |
| Case Stages, Vehicle Tracker | v21's look with fixed content (stage 1 current, map picture); needs backend data to become real                                                                                                                                                 |
| Release on tab close         | Needs backend C2                                                                                                                                                                                                                                |
| My Profile for everyone      | Needs backend P12                                                                                                                                                                                                                               |
| Startup                      | Blank white page until the app loads; a loading screen would help                                                                                                                                                                               |
| Searchable dropdowns         | Long client / agent lists would benefit from search                                                                                                                                                                                             |
| End-to-end check by hand     | Sign in, open a case, edit Caller and switch tabs, add a cost, run a Client Report and export it, create a Service and a Client Group                                                                                                           |
| Code tidy-up (when agreed)   | Move the data shapes out of `api/cases/case.api.ts` (725 lines) into `case.models.ts`; optionally drop the `.service.ts` suffix from the five older `core/` files. Do **not** rename `public/icons/menu/*.png`: the database stores those names |

---

## 9. Numbers

At commit `d4f5952`:

|                          |                                               |
| ------------------------ | --------------------------------------------- |
| Source files (`src/app`) | 384 (218 TypeScript, 106 test files)          |
| Unit tests               | 665, all passing                              |
| Lint / format            | clean                                         |
| Initial bundle           | 830.8 kB (197.7 kB transferred)               |
| Check before pushing     | `npm run verify` (format, lint, tests, build) |
