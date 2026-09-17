import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'bun browser/decision-server.ts',
    url: 'http://127.0.0.1:4174/health',
  }, {
    command: 'ROVERLAB_BACKEND_URL=http://127.0.0.1:4174 bun run dev --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
  }],
});
