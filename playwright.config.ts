import { defineConfig, devices } from '@playwright/test'

/**
 * Automatische Klicktests: die gebaute App (dist/) wird vom echten Abgleich-Server ausgeliefert,
 * mit leerer Datenbank in einem Temp-Ordner. Starten: `npm run build && npm run e2e`.
 */
const PORT = 8791

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // github: Fehler erscheinen als Anmerkung am Lauf (auch ohne Zugriff auf das Protokoll lesbar)
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    serviceWorkers: 'block'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1000, height: 1200 },
        // Nachgebautes Mikrofon (Piepton) für die Sprachnotizen
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
      }
    }
  ],
  webServer: {
    command: `node e2e/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000
  }
})
