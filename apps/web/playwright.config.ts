import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a running stack (web + API + seeded database):
 *   npm run db:seed:demo   (with DEMO_USER_PASSWORD set)
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
 * Set E2E_START_SERVERS=1 to let Playwright start the production servers itself (used in CI).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_START_SERVERS
    ? [
        { command: 'npm run start -w @asva/api', cwd: '../..', url: 'http://localhost:4000/api/v1/health/ready', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run start -w @asva/web', cwd: '../..', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
      ]
    : undefined,
});
