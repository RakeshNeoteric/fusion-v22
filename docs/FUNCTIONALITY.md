# Fusion Edge: what the app does and how it behaves

Fusion Edge is a call-centre and case-management system for **funeral and repatriation
services**. An insurer or bank (the _client_, e.g. FNB, Capitec, Nedgroup) sells policies that
include services such as a funeral, body repatriation or assistance vouchers. When a policy holder
calls, an agent opens a **case**: they record the caller and the deceased, check the policy, arrange
the removal of the body in up to four transport **phases** through **service providers**, cost and
authorise those phases, issue vouchers, log complaints and documents, and finally close the case.
Clients then get **reports** on their cases.

This document describes the behaviour of the Angular 22 web app (`fusion-edge-v22`). It is the
reference for what each screen does, which rules it applies and which backend calls it makes.
For how the app moved from v21, what was fixed and what is still open, see
[MIGRATION.md](MIGRATION.md). For setup and code structure, see the [README](../README.md).

Backend: `Fusion-Edge-Services` (ASP.NET Core). All URLs below are relative to the API base URL.

---

## Contents

1. [App-wide behaviour](#1-app-wide-behaviour)
2. [Call Centre: Cases](#2-call-centre-cases)
3. [Case Details](#3-case-details)
4. [Clients](#4-clients)
5. [Configuration screens](#5-configuration-screens)
6. [Services](#6-services)
7. [Security](#7-security)
8. [Voucher Approval](#8-voucher-approval)
9. [Reports](#9-reports)
10. [Documents the app prints (PDF)](#10-documents-the-app-prints-pdf)
11. [Home, Dashboard and screens not built](#11-home-dashboard-and-screens-not-built)
12. [Backend quirks the app works around](#12-backend-quirks-the-app-works-around)
13. [Screen and permission reference](#13-screen-and-permission-reference)

---

## 1. App-wide behaviour

### Sign-in

- Users sign in with their **Microsoft (Azure AD) account** through a redirect
  (`@azure/msal-browser`). The app needs `https://localhost:4200` in development because that is
  the registered redirect address.
- Before any page is shown, the app:
  1. finishes the Microsoft redirect, or restores the signed-in account;
  2. calls `GET App/UserValidation` to check the account is a registered, **active** Fusion user
     with at least one role;
  3. calls `GET App/AppInit` to load the menus, the user's roles and permissions, and the users
     grouped by role (used for agent and controller pickers).
- Outcome:
  - **Ready**: the app opens.
  - **Denied**: unregistered, inactive or role-less users are signed out and the login page says why.
  - **Error**: the backend could not be reached; the login page offers Retry.
- **Return to where you were.** If you open a link while signed out (e.g. a case link with
  `?id=123`), you are sent to `/login?returnUrl=…` and come back to that exact page, query string
  included, after signing in. If Microsoft asks you to sign in again in the middle of your work,
  you come back to the page you were on.
- **Session timeout.** There is no idle timer (v21 had none either). The Microsoft token is renewed
  silently; when that is no longer possible the user is redirected to sign in once and returned.

### App frame

- **Header:** menu button (pins the sidebar open), company logo, the page title (breadcrumb), the
  user's initials and name. The user menu has **My Profile** (see [7.5](#75-my-profile)) and
  **Logout**.
- **Sidebar:** built from the menus in `AppInit` (the `MenuConfiguration` table). Only active
  menus the user may see are shown, grouped into sections in a fixed order (Call Centre, Client,
  Configuration, Services, Security, Reports, …) and sorted by menu id. Each link goes to
  `/` + `MenuViewName` in lower case, the same URLs as v21. Each item's icon is the file named in
  the menu's `Icon` column, under `public/icons/menu/`. A missing icon shows `default.png`.
  The sidebar is collapsed and opens while hovered, unless pinned.
- **Page title bar:** the route's title (e.g. "Configuration / Branches"), with the page's
  "+ New" or other buttons on the right.
- **Font:** Roboto (loaded from Google Fonts) with Helvetica/Arial fallbacks.
- **Icons:** the Font Awesome shapes v21 used, built into the app (no icon font download).

### Permissions

Each screen has a **menu code** (e.g. `CASES`, `CLIENT`, `USR`). A role grants each menu flags; the
app turns them into one level, the same rules as v21:

| Flags on the role's permission | Level  | Means                                      |
| ------------------------------ | ------ | ------------------------------------------ |
| `IsVisible` off                | none   | Menu hidden, URL blocked ("Access denied") |
| `IsVisible` only               | read   | Can open and look, nothing can be changed  |
| `IsVisible` + `CanEdit`        | edit   | Can change existing records                |
| `IsVisible` + `CanCreate`      | create | Full access: create, edit **and delete**   |

- A user with several roles gets the **highest** level any role gives.
- Codes are compared ignoring case (the backend has both `VchApprvl` and `CLIENT`).
- `CanRead` and `CanDeleted` are not used (v21 ignored them too).
- **Every route is guarded.** v21 only hid the menu item, so typing a URL opened any screen; v22
  shows "Access denied".
- Inside screens, buttons the user may not use are hidden and forms open read-only.
- Field-level permissions (Security / Permissions) can hide or lock individual fields.

### Messages and errors

- Success, warning and error messages appear as short notifications (snackbar) at the top.
- Every failed backend call becomes one user-safe message:
  - Validation errors show the backend's field messages.
  - Database errors are translated: "This record already exists." (duplicate key), "This record is
    used elsewhere, so it cannot be changed or removed." (reference / foreign key), otherwise "The
    data could not be saved. Please check it and try again." Raw SQL text is never shown.
  - Server errors (5xx) show a general message; their text is never shown.
  - 401 sends the user to sign in; 403 says they have no access.
- Screens that show an error themselves (e.g. My Profile falling back to session data) suppress
  the notification.

### Unsaved changes

- Grids and forms track unsaved edits. Leaving the page, closing the browser tab or closing a
  popup with ✖ / Cancel asks **"Unsaved changes"** first.
- Case tabs save themselves before another tab opens and before Exit (see [3.2](#32-opening-holding-and-saving)).

### Phone numbers, IDs and dates

- **Phone fields** show the country flag and dial code, with a searchable country list, and store
  numbers in E.164 (`+27821234567`). South African numbers on clients are stored as v21 did: the
  national number only (`821234567`); others keep their country code.
- **Transport Operator phone** is written in international format (`+27 82 123 4567`) for its
  branch's country (ZA, IN, US, CA, GB; anything else as South Africa). A blank number stays blank.
- **South African ID numbers** fill in the date of birth and sex, and check the ID is valid.
- **Dates and times** the backend stores in UTC (e.g. vehicle dispatch time, history entries) are
  shown in the user's local time.

### Files

- Uploads go to `POST File/upload` and are stored under a **unique name** (`logo.png` becomes
  `logo-<random>.png`), so two uploads never replace each other.
- Files are previewed (`GET File/Preview`) or downloaded in the browser.
- A file uploaded in a popup that is then cancelled or replaced before saving is deleted again.
  A file that a saved record points at is **never deleted** by the app, because a cloned client
  may share it.

---

## 2. Call Centre: Cases

**Route** `/cases` · **Permission** `CASES` · **Backend** `GET CaseDetails`, `GET CaseInit`,
`POST CaseDetails`

### Case list

- Shows every case, **grouped** by Client → Service → Status (like v21's AG Grid Enterprise
  grouping, built here without Enterprise). Each group heading shows its count and can be
  expanded or collapsed.
- The group bar above the grid changes the grouping: drag to reorder, remove a level, add it back.
- Columns can be sorted (within their group) and **filtered**: every column has a text filter
  (contains, not contains, equals, not equal, starts with, ends with; two conditions with AND/OR).
  Filters apply before grouping, so group counts follow the filters and empty groups disappear.
- Clicking a case opens [Case Details](#3-case-details).

### New case

- "+ New Case" opens a popup: pick the **client** (active clients only), then one of its active
  **services**. The controller and agent are filled in on the Caller tab.
- Save calls `POST CaseDetails` with status `New`, then opens the new case.
- The tabs the case gets depend on its service type (see [3.1](#31-header-and-tabs)).

---

## 3. Case Details

**Route** `/cases/case-details?id=<CaseDetailId>` · **Permission** `CASES`

### 3.1 Header and tabs

- **Header:** case reference number, status (New, Active, Pending, Closed, Aborted), and "Already
  opened by …" when someone else holds the case, or "View only".
- **Header buttons** (v21 icons):

  | Button          | What it does                                                                                               |
  | --------------- | ---------------------------------------------------------------------------------------------------------- |
  | Vehicle Tracker | Opens or closes a card under the header with a route map (v21's fixed picture; no vehicle data yet)        |
  | Case Stages     | Opens or closes a card with the five stages, Case Initiation current (fixed, as in v21; no stage data yet) |
  | Abort           | Aborts the case with a reason (see [3.5](#35-case-lifecycle))                                              |
  | Exit            | Leaves the case (see [3.5](#35-case-lifecycle))                                                            |
  | View More       | Menu: Contact History, Case Rating, Additional Cost, Phase Costing, SMS / Email, Re-Open Case, Re-Assign   |

- **Case Stages and Vehicle Tracker** cards look like v21: they can be open together (Case Stages
  first) and each folds with its arrow. The stages are Case Initiation, Evaluation, Ongoing,
  On Hold and Resolution.
- **Tabs**, in this order: Caller, Policy Details, Deceased Info, Cause Of Death, Final Funeral,
  Validation, Voucher/SMS, Complaints, Documents, Phase 1–4.
- Which tabs a case shows comes from its **service type's rule** (`ServiceTypeBasedTabs` in
  `CaseInit`: a comma-separated list of tab names). A service type without a rule gets Caller,
  Complaints and Documents. Voucher services always get Voucher/SMS. Phase tabs appear only once
  the case has that phase.

### 3.2 Opening, holding and saving

- **Opening a case** calls `GET CaseDetails/{id}`. The backend then makes the reader the case's
  **holder** (`CaseOpenedBy`) and resets its open date (a backend issue, see
  [12](#12-backend-quirks-the-app-works-around)).
- **Who can change the case** (`CaseWorkspace.readOnly`, followed by every tab, popup and button):
  - only the holder,
  - only while the case is not Closed or Aborted,
  - only with edit access to `CASES`.
    Everyone else sees the case read-only.
- **Releasing the case:** Exit, or leaving the page any other way, calls `GET CaseExit/{id}` so
  others can open it. A Closed or Aborted case is only released (`CaseOpenedBy` cleared), so its
  closed date is never re-stamped.
- **Saving.** A tab with a form saves itself when another tab is chosen and before Exit. If the form
  has errors the tab stays open with a warning. The backend replaces whole rows, so each save sends
  the full record with the tab's changes (`POST CaseDetails/{id}` and the record's own endpoint).
  After a save, the page keeps the related lists it already has, because the backend's reply
  contains empty lists.

### 3.3 Tabs

| Tab            | What the user does / rules                                                                                                                                                                                                                                                                                                               | Backend                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Caller         | Callers' names, relationship, phone numbers and emails; one is the main caller (used for SMS and rating). Date opened, controller and agent.                                                                                                                                                                                             | `CaseDetails/{id}`                                                   |
| Policy Details | Policy holder's details. They live on the newest `CaseValidation` row; a row that already has a validation method is never changed, so later edits add a new row. The deceased's sex follows the ID number.                                                                                                                              | `CaseValidation/{id}`                                                |
| Validation     | Fetches the policy from the client's system (FNB lookup) and records how the policy was validated.                                                                                                                                                                                                                                       | `CaseValidation/FetchPolicyDetails/{caseId}`                         |
| Deceased Info  | Deceased's details. SA ID fills date of birth and sex; age at death is worked out; death cannot be before birth; provinces only for South Africa. Policy Number is required.                                                                                                                                                             | `CaseDeceasedInfo/{id}`                                              |
| Cause Of Death | Cause (COVID-19, Natural, Unknown, Unnatural) is required. An unnatural death needs the state mortuary; its details are cleared when the cause changes. Body weight up to 999.99.                                                                                                                                                        | `CaseCauseOfDeath/{id}`                                              |
| Final Funeral  | Funeral parlour picked by **name** from the client's active parlours; its details are copied only when picked. Saved details stay as saved; a parlour no longer linked to the client stays selectable.                                                                                                                                   | `CaseFinalFuneral/{id}`                                              |
| Voucher/SMS    | Requests vouchers. Provider and limits (amount and number) come from the client's link to the case's service; no limit set = no limit. The request is checked against the provider's stock and the vouchers the case already holds (reserved, approved, redeemed). After a request the tab shows the new stock and reloads the vouchers. | `Voucher/GetAvailableVouchersByProvider`, `Voucher/GenerateVouchers` |
| Complaints     | Logs a complaint (Internal, Customer, Client) in a popup as the signed-in user; complaints are then view-only. Print prints the tab (browser print), as v21 did.                                                                                                                                                                         | `Complaint`                                                          |
| Documents      | A row per document the client asks for: the client's template and the file uploaded for this case. Uploading again replaces the file (after asking). Email names the client's documents in the message (the backend sends no attachments).                                                                                               | `CaseDocument/{id}`                                                  |
| Phase 1–4      | See [3.4](#34-phases-and-costing).                                                                                                                                                                                                                                                                                                       | `CasePhaseDetails`                                                   |

At most one deceased, cause of death and final funeral record exists per case (the database refuses
a second), so these tabs update the loaded record and only create one when the case has none.

### 3.4 Phases and costing

- **Phase tabs** (one component for Phase 1–4): the collecting provider and the "remove to"
  provider with their details, family travelling along, and Notify (texts/emails the transport
  operator, `Operation/{id}?Operation=TransportNotify`).
- **Collect From** is worked out: the body location for Phase 1, otherwise where the previous phase
  removed the deceased to.
- **"+" on the tab strip** adds the first missing phase, up to the number the service type allows,
  once the open phase has its provider.
- A phase saves when the mouse leaves it (quietly, as in v21), on tab change and on Exit. The
  **Transport Operator Check List** is saved inside its phase.
- **Phase Costing** (View More): a phase's total = fixed cost + rate × km + additional, rounded to
  cents.
  - An **internal** provider (the company's own vehicle) takes the provider's rate and the
    Transport distance; only its fixed cost is entered.
  - An **external** provider takes a rate and distance, not a fixed cost.
  - **Authorising** a phase stamps the date and the authoriser and locks it at its rate.
  - Prints the Removal Order and Removal Order Instructions ([10](#10-documents-the-app-prints-pdf)).
- **Additional Cost** (View More): costs are added and deleted (kept, marked deleted), never edited.
  Prints the Additional Cost PO.
- **Case totals:** only authorised phases and non-deleted additional costs count toward
  `PhaseTotal`, `AdditionalCostTotal` and `TotalCost`, which are saved with the case whenever they
  change.
- The vehicle dispatch time is stored in UTC and shown in local time.

### 3.5 Case lifecycle

| Action       | Behaviour                                                                                                                                                                        | Backend                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Exit         | Asks "Is the call complete?" **No**: releases the case as it is. **Yes**: closes it, once the main caller has answered every rating question; otherwise Case Rating opens first. | `CaseExit/{id}`                              |
| Abort        | Needs a reason, written to the case history; the backend sets the status to Aborted from the history note, then the case is released and the closer stamped.                     | `CaseHistory` (`CaseAbort`), `CaseExit/{id}` |
| Re-Open Case | For Closed/Aborted cases. Needs a reason; status becomes Active.                                                                                                                 | `CaseHistory` (`CaseReopen`)                 |
| Re-Assign    | Picks a new controller. Saves the whole case and rebuilds the open tab, so no form keeps the old controller.                                                                     | `CaseDetails/{id}`, `CaseHistory`            |
| Case Rating  | Answers the client's rating questions; the options come from Configuration / Rating Question Options. Saves the caller's name and number with the answers.                       | `CaseDetails/{id}`                           |

`CaseExit` answers 200 even when someone else holds the case, so its text is checked and the user
is told the case is held elsewhere.

### 3.6 Communication

- **Contact History** (View More): reloads the case's history each time it opens (others and the
  backend add to it), newest first, filterable by type, with entry details. **New Note** adds an
  Admin, Inbound or Outbound note.
- **SMS / Email** (View More): SMS goes to the main caller's number and email to the callers'
  addresses by default; every address is checked. Both go through `Operation/{id}` (`SMS` /
  `EMail`), which logs them in the history. The backend sends email from its own address, copying
  the signed-in user.
- Sent SMS cannot be listed on the Voucher/SMS tab: the backend stores them without their case.

---

### 3.7 Where the Cases code lives

A plain-words map of the Cases code: which folder holds what, and what each file is for.

#### The big picture

```
Browser URL                    Page (screen)                         Talks to the backend through
/cases                    →    case-list/cases-page.ts          →    api/cases/case.api.ts
/cases/case-details?id=   →    case-details/case-details-page.ts →   api/cases/case.api.ts
```

- **`src/app/api/cases/case.api.ts`**: the only file that calls the backend for cases. It holds
  the **shape of every case record** (`CaseDetails`, `CasePhaseRecord`, `CaseComplaintRecord`, …)
  and the **calls** (load a case, save it, exit, history, phases, documents, SMS/email). Every
  screen goes through it; no screen calls the backend directly.
- **`src/app/app.routes.ts`**: connects the two URLs to the two pages, guarded by the `CASES`
  permission.
- **`src/app/features/cases/`**: everything the user sees, in three parts:

```
features/cases/
├── case-setup.ts       Rules shared by the list and the details (tabs, permission)
├── case-reference.ts   Fixed choice lists (relationships …)
├── case-list/          The /cases screen: the list and "New Case"
└── case-details/       The /cases/case-details screen: one open case
    ├── (page files)    The page, its header, and the open case's state
    ├── tabs/           One folder per tab
    ├── costing/        Phase Costing, Additional Cost, Transport and their PDFs
    ├── lifecycle/      Exit, Abort, Re-Open, Re-Assign, Case Rating
    └── communication/  Contact History, notes, SMS / Email
```

#### Shared files (`features/cases/`)

| File                | What it holds, in simple words                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `case-setup.ts`     | The list of all tabs and their order, **which tabs a service type gets**, the phase names, and the Cases permission code (`CASES`). |
| `case-reference.ts` | Fixed choices used in dropdowns, e.g. relationships (Aunt, Brother …) with the value stored for each.                               |

#### The case list (`case-list/`)

| File                  | What it does                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `cases-page.ts/.html` | The /cases screen: loads all cases, shows the grid, its columns, sorting, filters and the "+ New Case" button. |
| `case-grouping.ts`    | Turns the flat list of cases into **group headings** (Client → Service → Status) with their counts, sorted.    |
| `case-group-bar.ts`   | The bar above the grid where you drag, remove or add back a grouping level.                                    |
| `case-filters.ts`     | The column text filters (contains, equals, starts with …) applied before grouping.                             |
| `case-cells.ts`       | How a group heading cell looks and opens/closes its group.                                                     |
| `new-case-dialog.ts`  | The "Create a New Call" popup: pick a client, then one of its services; Next creates the case.                 |

#### The open case (`case-details/`)

| File                         | What it does                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case-details-page.ts/.html` | The Case Details screen: the header (reference, status, buttons, View More menu), the Case Stages and Vehicle Tracker cards, and the tab strip. Saves a tab before another opens; releases the case on leaving.                                                                     |
| `case-workspace.ts`          | **The heart of the screen.** Holds the open case in memory, decides if this user may change it (`readOnly`), saves changes to the backend, reloads parts the backend changes itself, and keeps the case totals up to date. Every tab and popup reads and saves the case through it. |
| `case-identity.ts`           | The small "Case Reference / Case Number" row shown at the top of case popups.                                                                                                                                                                                                       |
| `client-providers.ts`        | Loads the case client's service providers once, for the Final Funeral and Phase tabs.                                                                                                                                                                                               |

#### Tabs (`case-details/tabs/`)

One folder per tab; each has the tab's screen (`*-tab.ts` / `.html`) and, when needed, its rules
and popups.

| Folder / file      | What it holds                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `case-tab-form.ts` | The contract every tab with a form follows: "do you have changes?" and "save". The page uses it to save on tab change.                      |
| `case-records.ts`  | Helpers that build the full record to save from a tab's changes (the backend replaces whole rows), e.g. the policy holder's validation row. |
| `caller/`          | Caller tab: client and service, up to two callers, controller and agent, call questions.                                                    |
| `policy-details/`  | Policy Details tab: the policy and its holder, and who died.                                                                                |
| `validation/`      | Validation tab and the **Fetch Policy** popup (looks the policy up in the client's system).                                                 |
| `deceased-info/`   | Deceased Info tab; `age-at-death.ts` works out the age.                                                                                     |
| `cause-of-death/`  | Cause Of Death tab (unnatural-death details only for an unnatural death).                                                                   |
| `final-funeral/`   | Final Funeral tab; `funeral-parlours.ts` copies a chosen parlour's details.                                                                 |
| `voucher/`         | Voucher/SMS tab; `voucher-rules.ts` checks a request against stock and limits.                                                              |
| `complaints/`      | Complaints tab and the New Complaint popup.                                                                                                 |
| `documents/`       | Documents tab; `document-rows.ts` pairs each client document with the case's uploaded file.                                                 |
| `phase/`           | One tab for Phase 1–4; `phase-rules.ts` (which row, Collect From); the Transport Operator Check List popup.                                 |
| `testing/`         | Test helper only (`case-tab-harness.ts`): opens a fake case for tab tests. Not part of the app build.                                       |

#### Costing (`case-details/costing/`)

| File                                 | What it does                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `costing-rules.ts`                   | The money maths: phase total = fixed + rate × km + additional; case totals; rounding to cents. |
| `phase-costing-dialog.ts/.html`      | Phase Costing popup: cost each phase, authorise it, print removal documents.                   |
| `transport-dialog.ts`                | The phase's transport (vehicle, operator, dispatch time, distance).                            |
| `additional-costing-dialog.ts/.html` | Additional Cost popup: add and delete extra costs, print the PO.                               |
| `additional-cost-po.ts`              | Lays out the Additional Cost Purchase Order PDF.                                               |
| `removal-order.ts`                   | Gathers what a Removal Order prints and which kind (internal / external / instructions).       |
| `removal-order-pdf.ts`               | Lays out the Removal Order PDFs.                                                               |

#### Lifecycle (`case-details/lifecycle/`)

| File                     | What it does                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `case-lifecycle.ts`      | What happens to the case as a whole: exit, close, abort, re-open, re-assign, release. |
| `exit-dialog.ts`         | "Is the call complete?" popup.                                                        |
| `reason-dialog.ts`       | Reason popup for Abort and Re-Open.                                                   |
| `reassign-dialog.ts`     | Pick a new case controller.                                                           |
| `rating-dialog.ts/.html` | Case Rating popup; `rating-rules.ts` checks every question is answered.               |
| `open-case-dialog.ts`    | Small helper that opens a case popup so it can reach the open case.                   |

#### Communication (`case-details/communication/`)

| File                              | What it does                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `case-communication.ts`           | Sends notes, SMS and emails for the case and reloads its history.                                                      |
| `contact-history-dialog.ts/.html` | Contact History popup: the history list, filter by type, view an entry.                                                |
| `history-rows.ts`                 | Turns history records into the rows the list shows, newest first.                                                      |
| `note-dialog.ts`                  | New Note popup (Admin, Inbound, Outbound).                                                                             |
| `message-dialog.ts/.html`         | SMS / Email popup; `message-rules.ts` checks the email addresses typed and fills in the caller's mobile and addresses. |

#### Tests and styles

- Every `*.spec.ts` next to a file is its test (e.g. `case-workspace` is tested through
  `case-details-page.spec.ts` and the tab specs).
- `*.css` files hold each screen's look.

#### Following one action through the code

**"The user edits the Caller tab and clicks Policy Details":**

1. `case-details-page.ts` sees a tab change and asks the open tab (`caller-tab.ts`, through
   `case-tab-form.ts`) whether it has changes.
2. It has, so the tab builds the full record and calls `case-workspace.ts` to save.
3. `case-workspace.ts` calls `case.api.ts` → `POST CaseDetails/{id}`, then keeps its lists and
   takes the saved fields from the reply.
4. Only then does the page open Policy Details, which reads the case from `case-workspace.ts`.

**"The user clicks Exit":** `case-details-page.ts` → saves the open tab → `case-lifecycle.ts`
→ `exit-dialog.ts` asks "Is the call complete?" → (Yes) rating checked with `rating-rules.ts`,
case closed → `case.api.ts` `CaseExit/{id}` releases it → back to `/cases`.

## 4. Clients

**Route** `/client/client` · **Permission** `CLIENT` · **Backend** `Client`, `Client/*`

- **List:** all clients, newest first, with sort, filter and paging. Users who may create also get
  **Clone**, which copies a client (`GET Client/CloneClient`) under a new name.
- **Client popup** with v21's slanted folder tabs:

  | Tab              | Content                                                                                              |
  | ---------------- | ---------------------------------------------------------------------------------------------------- |
  | Details          | Company, claim and client data, custom labels, logo                                                  |
  | Services         | Services the client offers, with voucher provider, limits and SMS settings per service               |
  | Rating Questions | Questions asked when a case closes                                                                   |
  | Documents        | Document types the client needs per case, each with a note and optional template file (PDF or image) |
  | Service Provider | Providers (parlours, transport operators) linked to the client                                       |

- A **new client must be saved** before the link tabs open.
- Each link tab saves all its links and unlinks at once (`Client/ClientService`,
  `Client/ClientRatingQuestion`, `Client/ClientDocument`, `Client/ClientServiceProvider`).
  One link per document type.
- Closing the popup with unsaved changes asks first.

**Client Group** (`/client/client-group`, `CLIENT_GRP`): inline grid of groups (`ClientGroup`).

---

## 5. Configuration screens

Simple lists, all with the same behaviour (`EntityGrid`): newest first, sort, filter, paging,
"+ New", inline edit, save per row, soft delete after confirmation, and Active/Inactive.
Records that are inactive or deleted still show their name on old records as
"Name (Inactive)" / "Name (Deleted)" but cannot be picked.

| Screen                  | Route                           | Permission  | Backend                       | Notes                                                            |
| ----------------------- | ------------------------------- | ----------- | ----------------------------- | ---------------------------------------------------------------- |
| Body Locations          | `/body-location`                | `BODY_LOC`  | `Config/BodyLocation`         |                                                                  |
| Branches                | `/branches`                     | `BRANCHES`  | `Config/Branch`               | Country and province                                             |
| Documents               | `/documents/documents`          | `DOCUMENTS` | `Config/Document`             | Document types clients can ask for                               |
| Vehicles                | `/vehicle/vehicle`              | `VEH_LIST`  | `Config/Vehicle`              | Shows the branch's province                                      |
| Transport Operators     | `/transport-operator/transport` | `TRANS_OP`  | `Config/TransportOperator`    | Phone formatted for the branch's country                         |
| Claim Centre            | `/claim-centre`                 | `CLM_CTR`   | `Config/ClaimCentre`          | Edited in a popup                                                |
| Rating Question Types   | `/types/types`                  | `RQT`       | `Config/RatingQuestionType`   |                                                                  |
| Rating Questions        | `/list/list`                    | `RQL`       | `Config/RatingQuestion`       | Popup                                                            |
| Rating Question Options | `/options/options`              | `RQO`       | `Config/RatingQuestionOption` | Popup; the answers offered in Case Rating                        |
| Company Details         | `/company-details`              | `CMP`       | `Config/CompanyDetails`       | Company name, addresses and logo; used as the letterhead on PDFs |

---

## 6. Services

| Screen            | Route                         | Permission   | Backend               | Notes                                                                                                                                                                           |
| ----------------- | ----------------------------- | ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service Types     | `/services/service-types`     | `SRV_PRV_TY` | `Config/ServiceTypes` | Services and providers refer to a type by its **code**. When a code is reused after deletion, the live record is shown.                                                         |
| Services          | `/services/services`          | `SERVICES`   | `Service`             | Popup with a rich-text note (Quill) and AVS voucher rules                                                                                                                       |
| Service Providers | `/services/service-providers` | `SERVICE_PR` | `ServiceProvider`     | Large popup: details, B-BBEE certificate upload, contact rows, rate, and the authorised / opened / verified / accredited trail. Internal providers are the company's own fleet. |

---

## 7. Security

### 7.1 Users

`/users` · `USR` · `GET/POST/PUT Users`

- List and popup: name, email, employee id, phone and mobile numbers, profile photo (round, uploaded
  to file storage), Active. Mobile number is required.
- "Last sign-in" is shown only when the backend has recorded one (today it never does).

### 7.2 Roles

`/roles` · `ROLES` · `Permission/GetRoles`, `Permission/Roles`

- Inline grid. Only one active role per role type. The eye button opens the role's permissions.

### 7.3 Permissions

`/permissions/:roleId` · `ROLES` · `Permission/RolesPermissions`

- A matrix of every menu with Visible / Read / Edit / Create toggles, plus field-level permissions.
  The title bar shows "Security / {role} / Permissions". Save sends every changed menu at once.

### 7.4 User Roles Mapping

`/userrolemap` · `USRROLEMAP` · `Permission/UserRoles`

- Pick a user, then move roles between "available" and "assigned" lists (with search).

### 7.5 My Profile

Header user menu → My Profile.

- Opens the user's own record (`GET Users` by email) in the Users popup titled "My Profile".
- The user can change their **name, phone numbers and photo**. Email, employee id and Active are
  locked.
- The backend only accepts the save from users with **create** access to `USR`, so for everyone else
  the popup is read-only with "Ask an administrator to change your details." If the record cannot be
  read, the popup shows what the session knows, read-only.
- After saving, the header shows the new name.

---

## 8. Voucher Approval

**Route** `/voucherapproval` · **Permission** `VchApprvl` · **Backend** `Voucher/*`

- Lists vouchers **reserved** for cases (`Voucher/GetReservedVouchers`).
- **Approve**: after a confirmation, because the caller is then texted.
- **Reject**: needs a reason of at least 5 characters.
- Both need edit access; the decided voucher leaves the list. View-only users see no actions.
- The decision is logged against the voucher id, which is looked up by code
  (`Voucher/GetVoucherByCode`), without opening the case. The original requester is kept on the
  decision.

---

## 9. Reports

### Client Reports

**Route** `/reports/clientreports` · **Permission** `CLIENT_REPORTS` · **Backend**
`GET Client/ClientCaseDetails`

- **Filters:** client, some or all of its active services, and a period (default: last month).
- **View** shows:
  - a **Dashboard** tab: service tiles with trends, status and province totals, and monthly charts
    with their tables. Nedgroup and Capitec have their own dashboards (chosen by the client's name);
    every other client gets FNB's. Year-to-date lines are running totals of the months.
  - a tab with **all the client's cases**;
  - a tab **per chosen service** with that service type's columns: Funeral adds the deceased's
    details, AVS and FINF the policy holder's, voucher services a row per voucher (code, amount,
    month issued, status).
- Tables sort (amounts as numbers) and filter, ten rows a page.
- **Export Excel** (on the Dashboard tab) exports what was last viewed: a summary, the dashboard
  cards with their charts as drawn and their tables, a sheet per tab, and the redeemed vouchers.
  Amounts are real numbers formatted `R 1,250.00`, so they can be summed. Sheets have v21's look
  (teal title bar, orange headers, zebra rows, filters, frozen header).
- The backend only looks at cases created **this calendar year**, so an earlier period is empty,
  and the monthly charts always show the current year.

### Internal Reports

`/reports/internalreports` · `INTERNAL_REPORTS` · shows "coming soon" (v21 never finished it and
the backend has no report for it).

---

## 10. Documents the app prints (PDF)

Built in the browser (pdfmake, Poppins font) and opened in a new tab. The letterhead comes from
Company Details.

| Document                   | From                  | Rules                                                                                                                                                                                                                           |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Additional Cost PO         | Additional Cost popup | A block per cost and the total, dated today; only while the case can be changed                                                                                                                                                 |
| Removal Order              | Phase Costing         | Needs the phase **authorised**. Internal provider: names the company's driver and vehicle, with driver's notes, mileage and signature boxes. External: names the provider and bills the phase (fixed + rate × km + additional). |
| Removal Order Instructions | Phase Costing         | External providers only: the order without the billing                                                                                                                                                                          |

Remove From / Take To on the order are the phase's Collect From / Remove To.

---

## 11. Home, Dashboard and screens not built

| Screen           | State                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Home             | Blank page (left as is for now)                                                                |
| Dashboard        | "Coming soon": v21's page only said "dashboard works" and the backend has no dashboard data    |
| Internal Reports | "Coming soon"                                                                                  |
| Claims           | Not migrated: v21's screen was an empty placeholder, no menu links to it, no backend endpoints |
| Area Codes       | No backend endpoint                                                                            |

---

## 12. Backend quirks the app works around

These are backend behaviours the app has to live with. The full list of backend issues is in
[MIGRATION.md § Backend issues](MIGRATION.md#7-backend-issues-for-the-backend-team).

| Backend behaviour                                                                       | What the app does                                                                      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET CaseDetails/{id}` locks the case to the reader and resets its open date            | Loads the case once; notices when a reload hands the case to this user                 |
| `CaseExit` re-stamps the closed date of a closed case                                   | A finished case is released by clearing `CaseOpenedBy` instead                         |
| `CaseExit` returns 200 when someone else holds the case                                 | Reads the reply text and tells the user                                                |
| `POST CaseDetails/{id}` echoes the request: lists come back `[]`, single records `null` | Keeps the lists it already has; only takes plain fields from the reply                 |
| Rows are replaced, not merged                                                           | Always sends the full record with the changes                                          |
| `Service` and `ClientGroup` ids are nullable identities and refuse an explicit `0`      | Sends no id on create                                                                  |
| Uploads are stored under their original name and overwrite each other                   | Gives every upload a unique name; never deletes a stored file                          |
| Deleted rows are returned by every list                                                 | Configuration lists leave them out; lookups still name them "(Deleted)" on old records |
| Database errors (422) carry raw SQL text                                                | Translates them into plain messages                                                    |
| `GetReservedVouchers` leaves out the voucher id                                         | Looks the id up by code                                                                |
| Saving a user needs **create** access to Users                                          | My Profile is read-only without it                                                     |
| `LastLoginDateTime` is never set (year 0001)                                            | Hides "Last sign-in"                                                                   |
| Client reports cover only the current year                                              | Documented on the screen's behaviour; nothing else possible                            |

---

## 13. Screen and permission reference

| Section       | Screen                  | Route                           | Menu code          |
| ------------- | ----------------------- | ------------------------------- | ------------------ |
| —             | Home                    | `/home`                         | (signed in)        |
| —             | Dashboard               | `/dashboard`                    | `DBOARD`           |
| Call Centre   | Cases                   | `/cases`                        | `CASES`            |
| Call Centre   | Case Details            | `/cases/case-details?id=`       | `CASES`            |
| Client        | Client                  | `/client/client`                | `CLIENT`           |
| Client        | Client Group            | `/client/client-group`          | `CLIENT_GRP`       |
| Configuration | Body Locations          | `/body-location`                | `BODY_LOC`         |
| Configuration | Branches                | `/branches`                     | `BRANCHES`         |
| Configuration | Documents               | `/documents/documents`          | `DOCUMENTS`        |
| Configuration | Vehicles                | `/vehicle/vehicle`              | `VEH_LIST`         |
| Configuration | Transport Operators     | `/transport-operator/transport` | `TRANS_OP`         |
| Configuration | Claim Centre            | `/claim-centre`                 | `CLM_CTR`          |
| Configuration | Rating Questions        | `/list/list`                    | `RQL`              |
| Configuration | Rating Question Options | `/options/options`              | `RQO`              |
| Configuration | Rating Question Types   | `/types/types`                  | `RQT`              |
| Company       | Company Details         | `/company-details`              | `CMP`              |
| Services      | Service Types           | `/services/service-types`       | `SRV_PRV_TY`       |
| Services      | Services                | `/services/services`            | `SERVICES`         |
| Services      | Service Providers       | `/services/service-providers`   | `SERVICE_PR`       |
| Security      | Users                   | `/users`                        | `USR`              |
| Security      | Roles                   | `/roles`                        | `ROLES`            |
| Security      | Permissions             | `/permissions/:roleId`          | `ROLES`            |
| Security      | User Roles Mapping      | `/userrolemap`                  | `USRROLEMAP`       |
| Security      | Voucher Approval        | `/voucherapproval`              | `VchApprvl`        |
| Reports       | Client Reports          | `/reports/clientreports`        | `CLIENT_REPORTS`   |
| Reports       | Internal Reports        | `/reports/internalreports`      | `INTERNAL_REPORTS` |
