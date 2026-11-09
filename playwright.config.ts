import { defineConfig } from '@playwright/test';

/**
 * Responsive check (RESPONSIVE.md): every screen at 7 desktop sizes, against the hosted dev API.
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:responsive
 *
 * The login comes from the environment only; the signed-in session is kept outside the repo
 * (E2E_STATE_DIR, default .e2e/), which git ignores.
 */
const stateDir = process.env['E2E_STATE_DIR'] ?? '.e2e';

export default defineConfig({
  testDir: 'e2e',
  outputDir: `${stateDir}/results`,
  // Screens load from a remote API.
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: `${stateDir}/report`, open: 'never' }]],
  use: {
    baseURL: 'https://localhost:4200',
    // `ng serve` uses a self-signed certificate.
    ignoreHTTPSErrors: true,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'sign-in', testMatch: /sign-in\.setup\.ts/ },
    {
      name: 'responsive',
      testMatch: /\.e2e\.ts$/,
      dependencies: ['sign-in'],
      use: { storageState: `${stateDir}/session.json` },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'https://localhost:4200',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
