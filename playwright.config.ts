import { defineConfig, devices } from '@playwright/test'

const playwrightPort = 3100
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `NEXT_PUBLIC_E2E_MOCK_RUNTIME=1 npx next dev --port ${playwrightPort} --webpack`,
    url: playwrightBaseUrl,
    reuseExistingServer: false,
  },
})
