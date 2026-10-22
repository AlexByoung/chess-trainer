import { defineConfig, devices } from '@playwright/test';

// BASE_URL set → test an already-deployed site (post-deploy check); otherwise
// build and serve the app locally.
const remote = process.env.BASE_URL;
// GitHub's ubuntu runners ship Google Chrome; using it skips a slow browser + apt install.
const channel = process.env.CI ? 'chrome' : undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: remote ?? 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 860 } } },
    {
      name: 'ipad-touch',
      // iPad Pro 11 landscape, touch input (Chromium engine; WebKit isn't installed here).
      use: { channel, viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: false, deviceScaleFactor: 2 },
    },
  ],
  webServer: remote
    ? undefined
    : { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: true, timeout: 120_000 },
});
