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
