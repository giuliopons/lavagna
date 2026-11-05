import { defineConfig } from '@playwright/test';

// Se il browser e' gia' installato altrove, indicalo con PW_CHROMIUM=/percorso/chrome
// I test partono da dist: npm test la rigenera
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 760 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'node tests/serve.mjs',
    port: 4173,
    reuseExistingServer: false,
  },
});
