import { defineConfig, devices } from '@playwright/test';

// E2E-tests draaien tegen een build in de LOKALE testmodus (`--mode devlocal`): de backend wordt in de
// browser nagebootst, er gaat niets naar Supabase. Zo zijn service worker, offline-modus en de
// volledige gebruikersflow testbaar zonder echte gegevens. (De RLS-beveiliging zelf testen de Vitest-tests op Postgres.)
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite build --mode devlocal --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
