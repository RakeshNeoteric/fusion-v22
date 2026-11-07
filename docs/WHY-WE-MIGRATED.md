# Why we migrated to Angular 22

Short answers for when someone asks why Fusion Edge was rebuilt, what it gained, and what the new
Angular terms (signals, zoneless, standalone…) mean. All numbers are from this project.

For the full story (phases, bugs fixed, backend issues) see [MIGRATION.md](MIGRATION.md). For
what each screen does, see [FUNCTIONALITY.md](FUNCTIONALITY.md).

---

## In one sentence

> We rebuilt the app on the current Angular so it is **about 10× smaller to download, checked by
> 665 automatic tests, permission-checked on every page, free of a paid grid licence, and much
> easier and safer to change**, while keeping the same screens and business rules.

---

## 1. Why we migrated

| Question                               | Simple answer                                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why migrate at all?**                | v21 worked, but it was hard to change safely: very large files, five UI libraries, almost no real tests, and the older Angular style. Every new feature or fix was slow and risky. |
| **Why rebuild instead of upgrading?**  | Raising the version number would have kept all the old problems. Each screen was rebuilt cleanly with the same business behaviour and checked against v21.                         |
| **Did the business behaviour change?** | No. Same screens, same URLs, same backend calls, same rules. Bugs found on the way were fixed; they are listed in [MIGRATION.md](MIGRATION.md).                                    |
| **Was the backend changed?**           | No. v22 talks to the same backend in the same way as v21.                                                                                                                          |

---

## 2. What we gained

| Area                    | Before (v21)                                                                                      | After (v22)                                                                           | Why it matters                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **First download**      | 8.5 MB (1.8 MB over the network)                                                                  | **831 kB** (198 kB over the network)                                                  | About 10× smaller: the app opens much faster, especially on slow connections.  |
| **Automatic tests**     | 180, of which most only check that a screen loads (Angular's generated test)                      | **665** tests of real business rules and screens                                      | Every change is checked before pushing; bugs are caught before users see them. |
| **UI libraries**        | 5 (Bootstrap, ngx-bootstrap, PrimeNG, Angular Material, ng-select)                                | **1** (Angular Material)                                                              | Less code, one consistent look, fewer upgrades to manage.                      |
| **Icon sources**        | 4 (Font Awesome, Bootstrap Icons, PrimeIcons, Boxicons from a CDN)                                | **Built into the app** (v21's own Font Awesome shapes)                                | Same icons, nothing extra to download, no dependence on outside servers.       |
| **Grid licence**        | AG Grid **Enterprise** (paid)                                                                     | AG Grid **Community** (free)                                                          | Case grouping was rebuilt in our code, so no licence is needed.                |
| **Security**            | Menus hidden only; typing a URL opened any screen                                                 | **Every page checks permissions**                                                     | A user cannot open a screen they are not allowed to, even with a direct link.  |
| **Code checking**       | Loose TypeScript, no lint rules                                                                   | **Strict TypeScript + ESLint**                                                        | Many mistakes are caught while typing, before the app runs.                    |
| **Code layout**         | Mixed folders; components called the backend directly                                             | Clear `api / core / shared / features`; only `api/` calls the backend                 | Easy to find things; one place to change when the backend changes.             |
| **Copied screens**      | About 12 near-identical list screens                                                              | **One shared grid**, configured per screen                                            | Fix a bug once and it is fixed everywhere.                                     |
| **Documentation**       | Only the README Angular generates for a new project                                               | README, [FUNCTIONALITY.md](FUNCTIONALITY.md), [MIGRATION.md](MIGRATION.md), this file | New developers can learn the app without asking around.                        |
| **Rendering / hosting** | **SSR**: an Express (Node.js) server rendered pages, with 31 browser-vs-server checks in the code | **Client-side only (CSR)**: static files                                              | No Node server to host, monitor or patch; any static web host works.           |

---

## 3. Client-side, not server-side rendering (SSR)

v21 was set up for **SSR** (Angular SSR with an Express server, `src/server.ts`). v22 is
**client-side only (CSR)**: the browser builds every page. (Neither version uses SSE, Server-Sent
Events.)

|                  | v21                                                                                          | v22                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Type**         | SSR: Express server (`src/server.ts`, `outputMode: "server"`)                                | Client-side only (CSR)                                                   |
| **Build output** | A Node.js server plus browser files                                                          | Static files only (HTML, JS, CSS, images) in `dist/fusion-edge/browser`  |
| **Hosting**      | A Node.js server running all the time                                                        | Any static web host: IIS, Azure Static Web Apps, Nginx, a storage bucket |
| **Extra code**   | 31 `isPlatformBrowser` / `PLATFORM_ID` checks (`window`, `localStorage` break on the server) | None needed                                                              |

**Why v22 does not use SSR:**

| Reason                                        | Explanation                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everything is behind sign-in**              | SSR helps public pages (faster first view, Google indexing). Every Fusion Edge page needs a Microsoft sign-in first, so there is nothing to pre-render or index. |
| **Microsoft sign-in only works in a browser** | MSAL uses the browser's storage and redirects; the server cannot sign in, so it could only render an empty shell.                                                |
| **Less to run and maintain**                  | No Node server to host, monitor, scale or patch, and no browser-vs-server checks in the code.                                                                    |
| **Fast anyway**                               | The first download is 198 kB over the network, and large parts load only when a screen needs them.                                                               |

**For deployment:** copy the built files to any web server, and set up the **SPA fallback**: an
unknown URL must return `index.html`, or refreshing a page such as
`/cases/case-details?id=123` gives a 404. See the [README](../README.md#deployment).

## 4. Angular terms, before and after

| Term                        | Before (v21)                                                                            | After (v22)                                                                         | In simple words                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signals**                 | Data shared with `BehaviorSubject` and an NGXS store; subscribe and unsubscribe by hand | `signal()`                                                                          | A signal is **a box holding a value that tells the screen when it changes**. Change the box and only the parts of the screen that use it update. Nothing to unsubscribe, so no memory leaks. |
| **computed()**              | Values worked out again by hand in several places                                       | `computed(() => …)`                                                                 | **A value worked out from other signals that updates by itself.** Example: the case tabs are computed from the service; pick another service and the tabs update.                            |
| **Zone.js / Zoneless**      | zone.js watched every click, timer and request, then re-checked the page                | **Zoneless**: no zone.js                                                            | Before, Angular guessed when something might have changed and checked everything. Now signals say exactly what changed: faster, and one library fewer.                                       |
| **OnPush**                  | Default change detection (check everything, often)                                      | OnPush everywhere                                                                   | A component redraws only when its own data changes, not on every event in the app.                                                                                                           |
| **NgModules vs Standalone** | Every screen declared in a module file (`client-module.module.ts`, …)                   | **Standalone** components                                                           | Each component lists what it uses itself. No module files to keep in sync, and screens load on their own.                                                                                    |
| **Lazy loading**            | Large libraries in the first download                                                   | Grid, PDF, Excel, charts and the text editor load **only when a screen needs them** | The main reason the first download dropped from 8.5 MB to 831 kB.                                                                                                                            |
| **inject()**                | `constructor(private x: X, private y: Y, …)` with long lists                            | `private readonly x = inject(X)`                                                    | Same purpose (getting a service), shorter and easier to read.                                                                                                                                |
| **Control flow**            | `*ngIf`, `*ngFor`                                                                       | `@if`, `@for`                                                                       | Newer template syntax: easier to read, a little faster, and type-checked.                                                                                                                    |
| **input() / output()**      | `@Input()`, `@Output()` decorators                                                      | `input()`, `output()`                                                               | Component inputs are signals too, so they react automatically.                                                                                                                               |
| **Strict TypeScript**       | `any` used freely                                                                       | `strict`, no `any` allowed                                                          | Every piece of data has a known shape, so typos and wrong field names are caught before running.                                                                                             |
| **Sign-in**                 | `@azure/msal-angular` on top of `@azure/msal-browser`                                   | `@azure/msal-browser` with a small service of our own                               | Same Microsoft sign-in, one library fewer, written for the zoneless app.                                                                                                                     |
| **Tests**                   | Karma + Jasmine (runs in a real browser, slower)                                        | **Vitest**                                                                          | Much faster; all 665 tests run in seconds.                                                                                                                                                   |

---

## 5. One example, before and after

**"Pick another service on a case, and the tabs change":**

|          | v21                                                                                                                                                            | v22                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **How**  | The Caller tab subscribes to the service field, asks the backend again, pushes the tabs into a `BehaviorSubject`, and the tab strip subscribes to that subject | The tab list is `computed()` from the chosen service |
| **Code** | Dozens of lines across several files, with manual subscriptions                                                                                                | A few lines; Angular keeps it up to date             |
| **Risk** | A forgotten unsubscribe leaks memory; timing bugs between the subscriptions                                                                                    | Nothing to unsubscribe; always in step               |

---

## 6. Quick answers

| If someone asks…                 | Answer                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "Is it faster?"                  | Yes: about 10× less to download at start, and screens redraw only what changed.                                      |
| "Is it safer?"                   | Yes: every page checks permissions, every change is checked by 665 tests, strict TypeScript and ESLint.              |
| "Does it cost less?"             | No paid AG Grid Enterprise licence is needed.                                                                        |
| "Did anything change for users?" | Same screens and rules; known v21 bugs fixed (listed in [MIGRATION.md](MIGRATION.md)).                               |
| "Do we need backend changes?"    | No. Backend issues found on the way are listed for the backend team in [MIGRATION.md](MIGRATION.md).                 |
| "Is it SSR or client-side?"      | Client-side only (CSR). v21 had SSR; v22 does not need it, since every page is behind Microsoft sign-in (section 3). |
| "How do I learn the app?"        | Start with the [README](../README.md), then [FUNCTIONALITY.md](FUNCTIONALITY.md).                                    |
