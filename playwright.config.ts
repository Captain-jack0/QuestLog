import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const DESKTOP_ONLY = /shell-desktop\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: DESKTOP_ONLY },
    // WebKit is the engine this app is actually used on and the only one that reproduces the
    // iOS bugs Chromium papers over — the body scroll lock in `sheet-keyboard.spec.ts` exists
    // because `overflow: hidden` alone is ignored here and nowhere else.
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] }, testIgnore: DESKTOP_ONLY },
    // The rail, top bar breadcrumb and ⌘K only exist from md up. Only the shell spec runs here:
    // the flows above are the same code at any width, and doubling them doubles the run.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: DESKTOP_ONLY,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
