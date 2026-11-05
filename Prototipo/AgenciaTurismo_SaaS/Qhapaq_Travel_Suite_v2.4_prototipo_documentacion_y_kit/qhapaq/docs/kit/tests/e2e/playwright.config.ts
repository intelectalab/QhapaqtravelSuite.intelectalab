import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright sobre Next.js (App Router) — Qhapaq Travel Suite.
 * Casos: E2E-01…E2E-10 (DOC-PROC-001) + motor de reservas + ownership + 403.
 * Fecha de negocio congelada en backend: E2E_FROZEN_TODAY (2026-09-29, igual que window.TODAY del prototipo).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://andes.localhost:3000';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,          // los flujos comparten la base semilla; se paraleliza por archivo solo si cada spec reinicia datos
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]],
  globalSetup: './fixtures/global-setup.ts',
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@solo-movil/ },
    // Barrido responsive: toda pantalla marcada @responsive debe verse sin scroll horizontal a 400 px
    { name: 'movil-400', use: { ...devices['Pixel 7'], viewport: { width: 400, height: 860 } }, grep: /@responsive|@solo-movil/ },
  ],
});
