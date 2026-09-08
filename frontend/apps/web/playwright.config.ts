import { defineConfig, devices } from '@playwright/test';

const parsedPort = Number(process.env.E2E_PORT ?? 3100);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3100;
const rawBaseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const baseURL = rawBaseURL.replace(/\/+$/, '');
const useRealApis = process.env.E2E_USE_REAL_APIS === '1';
const viteMode = process.env.E2E_VITE_MODE ?? (useRealApis ? 'development' : 'e2e');
const shouldStartWebServer =
  process.env.E2E_SKIP_WEBSERVER !== '1' &&
  (Boolean(process.env.E2E_WEB_SERVER_COMMAND) || !process.env.E2E_BASE_URL);

const scrubbedEnvPrefixes = ['GIO_', 'GTK_', 'SNAP_'];
const scrubbedEnvNames = new Set(['SNAP']);

function shouldScrubEnvKey(key: string) {
  return scrubbedEnvNames.has(key) || scrubbedEnvPrefixes.some((prefix) => key.startsWith(prefix));
}

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && !shouldScrubEnvKey(entry[0]),
  ),
);

const e2eApiEnv = useRealApis
  ? {
      VITE_POKEMON_API_URL: `${baseURL}/api/pokemon`,
      VITE_AUTH_API_URL: `${baseURL}/api/auth`,
      VITE_RECEIVER_API_URL: `${baseURL}/api/receiver`,
      VITE_USERS_API_URL: `${baseURL}/api/users`,
      VITE_SEARCH_API_URL: `${baseURL}/api/search`,
      VITE_LOCATION_SERVICE_URL: `${baseURL}/api/location`,
      VITE_EVENTS_API_URL: `${baseURL}/api/events`,
    }
  : {
      VITE_POKEMON_API_URL: `${baseURL}/__e2e/pokemon`,
      VITE_AUTH_API_URL: `${baseURL}/__e2e/auth`,
      VITE_RECEIVER_API_URL: `${baseURL}/__e2e/receiver`,
      VITE_USERS_API_URL: `${baseURL}/__e2e/users`,
      VITE_SEARCH_API_URL: `${baseURL}/__e2e/search`,
      VITE_LOCATION_SERVICE_URL: `${baseURL}/__e2e/location`,
      VITE_EVENTS_API_URL: `${baseURL}/__e2e/events`,
    } satisfies Record<string, string>;

const e2eServerEnv = {
  ...inheritedEnv,
  ...e2eApiEnv,
  VITE_ASSET_ORIGIN: process.env.E2E_ASSET_ORIGIN ?? 'https://pokegonexus.com',
  VITE_FORCED_REFRESH_TIMESTAMP: '0',
  VITE_DISABLE_SERVICE_WORKER: 'true',
  VITE_LOG_LEVEL: 'warn',
} satisfies Record<string, string>;

const devServerCommand = `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort --mode ${viteMode}`;
const previewServerCommand = [
  `npm run build -- --mode ${viteMode}`,
  `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
].join(' && ');

const webServerCommand =
  process.env.E2E_WEB_SERVER_COMMAND ??
  (process.env.E2E_USE_DEV_SERVER === '1' ? devServerCommand : previewServerCommand);

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.artifacts/browser/test-results',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: '.artifacts/browser/html-report',
        open: 'never',
      },
    ],
    [
      'json',
      {
        outputFile: '.artifacts/browser/reports/results.json',
      },
    ],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: {
      env: inheritedEnv,
      ...(process.env.E2E_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
  },
  webServer: shouldStartWebServer
    ? {
        command: webServerCommand,
        env: e2eServerEnv,
        url: baseURL,
        reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === '1',
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 15'],
        browserName: 'webkit',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
});
