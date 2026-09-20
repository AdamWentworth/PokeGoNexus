import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(mobileDirectory, '../..');
const repositoryDirectory = resolve(workspaceDirectory, '..');
const assetDirectory = resolve(repositoryDirectory, 'assets');
const fixtureDirectory = resolve(workspaceDirectory, 'packages/app-core/tests/__helpers__/fixtures');
const artifactDirectory = resolve(mobileDirectory, '.artifacts/native-web-parity');
// A per-process default prevents a long-running local Expo session from making
// parity checks exercise a stale route manifest or bundle. CI and callers may
// still pin the port explicitly when required.
const expoPort = Number(process.env.POKEGONEXUS_NATIVE_WEB_PORT || (10_000 + (process.pid % 20_000)));
const fixturePort = 8092;
const baseUrl = `http://127.0.0.1:${expoPort}`;
const routeFilter = process.env.POKEGONEXUS_PARITY_ROUTE?.trim() ?? '';
const routeMatches = (route) => {
  if (!routeFilter) return true;
  return routeFilter.startsWith('=')
    ? route === routeFilter.slice(1)
    : route.includes(routeFilter);
};

const routeCases = [
  ['home', 'native-home-screen'],
  ['home?guest=1', 'native-guest-home-screen'],
  ['collection', 'native-collection-hub'],
  ['collection?instance=0006-default_demo-charizard', 'native-instance-overlay'],
  ['collection?instance=0025-party_hat_default_demo-trade', 'native-instance-overlay'],
  ['collection?instance=0094-default_demo-wanted', 'native-instance-overlay'],
  ['collection?foreign=1&tag=trade', 'native-collection-hub'],
  ['collection?foreign=1&tag=wanted', 'native-collection-hub'],
  ['sync', 'device-smoke-sync'],
  ['search', 'native-pokemon-search'],
  ['trade-preferences', 'native-trade-preferences-screen'],
  ['trade-activity', 'native-trade-activity-screen'],
  ['trade-activity?canonical=1', 'native-trade-activity-screen'],
  ['trade-proposal', 'native-trade-proposal-sheet'],
  ['profile', 'native-trainer-profile'],
  ['profile-relationship', 'native-trainer-profile'],
  ['public-profile', 'native-trainer-profile'],
  ['friends', 'native-friends-screen'],
  ['settings', 'native-trainer-settings-screen'],
  ['account', 'native-account-security-screen'],
  ['account?oauthOnly=1', 'native-account-security-screen'],
  ['login', 'native-login-screen'],
  ['public', 'native-information-getting-started'],
  ['public?page=about', 'native-information-about'],
  ['public?page=help', 'native-information-help'],
  ['public?page=faq', 'native-information-faq'],
  ['public?page=safety', 'native-information-safety'],
  ['public?page=privacy', 'native-information-privacy'],
  ['public?page=terms', 'native-information-terms'],
  ['public?page=data-deletion', 'native-information-data-deletion'],
  ['public?page=register', 'native-register-screen'],
  ['public?page=reset', 'native-password-reset-overlay'],
  ['public?page=reset-confirm', 'native-password-reset-screen'],
  ['verify-email-change', 'native-verify-email-change-screen'],
  ['not-found?path=%2Fnative%2Fmissing-route', 'native-not-found-screen'],
  ['public?page=trade-board', 'native-trade-board-screen'],
  ['public?page=public-trade-board', 'native-trade-board-screen'],
  ['public?page=raid-methodology', 'native-methodology-screen'],
  ['public?page=pvp-methodology', 'native-methodology-screen'],
  ['tools?tool=pokedex', 'native-pokedex-screen'],
  ['tools?tool=pokedex-detail', 'native-pokedex-detail-screen'],
  ['tools?tool=raid', 'native-raid-screen'],
  ['tools?tool=max', 'native-max-screen'],
  ['tools?tool=pvp', 'native-pvp-screen'],
  ['tools?tool=rankings', 'native-rankings-screen'],
];

// Every deterministic mobile state must also remain usable when the native
// route tree is hosted in a desktop browser. The canonical Vite app remains
// the production desktop surface during migration, but this catches layout
// regressions before a native route is ever promoted.
const desktopRouteCases = routeCases;

const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const startFixtureServer = () => new Promise((resolvePromise, reject) => {
  const server = createServer((request, response) => {
    const filename = request.url?.replace(/^\//, '').split('?')[0] || '';
    const filepath = resolve(fixtureDirectory, filename);
    if (!filename.endsWith('.json') || !filepath.startsWith(`${fixtureDirectory}/`) || !existsSync(filepath)) {
      response.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': extname(filepath) === '.json' ? 'application/json' : 'application/octet-stream',
    });
    createReadStream(filepath).pipe(response);
  });
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      resolvePromise(null);
      return;
    }
    reject(error);
  });
  server.listen(fixturePort, '127.0.0.1', () => resolvePromise(server));
});

const assetContentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

const installAssetRoutes = async (context) => {
  // Fulfill fixture JSON inside Playwright as well as hosting it over HTTP.
  // This keeps browser captures deterministic when an already-running local
  // fixture server owns port 8092 but does not emit CORS headers.
  await context.route(`http://127.0.0.1:${fixturePort}/*.json`, async (route) => {
    const filename = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
    const localPath = resolve(fixtureDirectory, filename);
    if (!filename.endsWith('.json')
        || !localPath.startsWith(`${fixtureDirectory}/`)
        || !existsSync(localPath)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      body: readFileSync(localPath),
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await context.route('**/api/location/autocomplete?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [{
        city: 'Burnaby',
        country: 'Canada',
        latitude: 49.2488,
        longitude: -122.9805,
        name: 'Burnaby',
        state_or_province: 'British Columbia',
      }],
    });
  });
  await context.route(/\/(?:favicons|icons|images|media)\//, async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const localPath = resolve(assetDirectory, pathname.replace(/^\/+/, ''));
    if (!localPath.startsWith(`${assetDirectory}/`) || !existsSync(localPath)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      body: readFileSync(localPath),
      contentType: assetContentTypes.get(extname(localPath).toLocaleLowerCase())
        ?? 'application/octet-stream',
    });
  });
};

const startExpo = async () => {
  try {
    await waitFor(`${baseUrl}/device-smoke/home`, 1_000);
    return null;
  } catch {
    // A fresh deterministic server is required when one is not already live.
  }
  const command = join(workspaceDirectory, 'node_modules/.bin/expo');
  const child = spawn(command, ['start', '--web', '--port', String(expoPort), '--clear'], {
    cwd: mobileDirectory,
    env: {
      ...process.env,
      CI: '1',
      EXPO_PUBLIC_DEVICE_SMOKE_MODE: 'true',
      EXPO_PUBLIC_MOBILE_EXPERIENCE: 'native-preview',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
  child.stderr.on('data', (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
  child.once('exit', (code) => {
    if (code && code !== 0) process.stderr.write(`Expo exited with ${code}.\n${output}\n`);
  });
  try {
    await waitFor(`${baseUrl}/device-smoke/home`);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${error instanceof Error ? error.message : error}\n${output}`);
  }
  return child;
};

const assertNoRuntimeErrors = (route, errors) => {
  if (errors.length === 0) return;
  throw new Error(`${route} emitted runtime errors:\n${errors.join('\n')}`);
};

const assertAccessibleControlState = async (page, route) => {
  const invalid = await page.evaluate(() => {
    const missingChecked = [...document.querySelectorAll('[role="checkbox"], [role="radio"], [role="switch"]')]
      .filter((element) => !element.hasAttribute('aria-checked'));
    const missingSelected = [...document.querySelectorAll('[role="tab"]')]
      .filter((element) => !element.hasAttribute('aria-selected'));
    return [...missingChecked, ...missingSelected]
      .slice(0, 5)
      .map((element) => element.outerHTML);
  });
  if (invalid.length > 0) {
    throw new Error(`${route} rendered stateful controls without accessible state:\n${invalid.join('\n')}`);
  }
};

const assertWcagAccessibility = async (page, route) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(({ id, impact }) => (
    impact === 'serious'
    || impact === 'critical'
    || id === 'target-size'
  ));
  if (blocking.length === 0) return;
  const details = blocking.map((violation) => {
    const nodes = violation.nodes.slice(0, 4).map((node) => (
      `    ${node.target.join(' ')}: ${node.failureSummary ?? 'Rule failed'}\n      ${node.html}`
    ));
    return `- ${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes.join('\n')}`;
  });
  throw new Error(`${route} failed WCAG accessibility checks:\n${details.join('\n')}`);
};

const trackPageFailures = (page, errors) => {
  const trackedResourceTypes = ['fetch', 'font', 'image', 'script', 'stylesheet', 'xhr'];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    if (message.type() === 'warning' && message.text().includes('[mobile:')) {
      errors.push(`application warning: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400 && trackedResourceTypes.includes(resourceType)) {
      errors.push(`${resourceType}: ${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType();
    if (trackedResourceTypes.includes(resourceType)) {
      errors.push(`${resourceType}: ${request.failure()?.errorText ?? 'request failed'} ${request.url()}`);
    }
  });
};

const waitForDeterministicFixture = async (page, route) => {
  if (!route.startsWith('tools?')) return;
  await page.getByTestId('device-smoke-tools-ready').waitFor({
    state: 'attached',
    timeout: 30_000,
  });
};

// Collection now mirrors Vite with one translated three-panel track. Other
// legacy smoke fixtures still use horizontal ScrollViews, so keep this helper
// scoped to Collection rather than teaching their assertions the wrong model.
const readCollectionPageOffset = (page) => page
  .getByTestId('native-horizontal-page-track')
  .evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === 'none') return 0;
    return -new DOMMatrixReadOnly(transform).m41;
  });

const waitForCollectionPageOffset = (page, expectedOffset) => page.waitForFunction(
  ({ expected }) => {
    const element = document.querySelector('[data-testid="native-horizontal-page-track"]');
    if (!element) return false;
    const transform = getComputedStyle(element).transform;
    const offset = !transform || transform === 'none'
      ? 0
      : -new DOMMatrixReadOnly(transform).m41;
    return Math.abs(offset - expected) <= 2;
  },
  { expected: expectedOffset },
);

const run = async () => {
  mkdirSync(artifactDirectory, { recursive: true });
  const fixtureServer = await startFixtureServer();
  const expo = await startExpo();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const colorScheme of ['dark', 'light']) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { width: 412, height: 915 },
      });
      await installAssetRoutes(context);
      for (const [route, testId] of routeCases.filter(([route]) => routeMatches(route))) {
        const page = await context.newPage();
        const errors = [];
        trackPageFailures(page, errors);
        await page.goto(`${baseUrl}/device-smoke/${route}`, {
          timeout: 60_000,
          waitUntil: 'networkidle',
        });
        const root = page.getByTestId(testId);
        await root.waitFor({ state: 'visible', timeout: 15_000 });
        await waitForDeterministicFixture(page, route);
        if (await root.count() !== 1) {
          throw new Error(`${route} did not render ${testId}; current URL is ${page.url()}`);
        }
        assertNoRuntimeErrors(route, errors);
        await assertAccessibleControlState(page, route);
        await assertWcagAccessibility(page, route);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        ) - window.innerWidth);
        if (overflow > 2) throw new Error(`${route} overflows the mobile viewport by ${overflow}px.`);
        const initialSafeName = route.replace(/[?=&]/g, '-');
        await page.screenshot({
          fullPage: true,
          path: join(artifactDirectory, `${colorScheme}-${initialSafeName}-initial.png`),
        });

        if (route === 'collection') {
          const initialOffset = await readCollectionPageOffset(page);
          if (Math.abs(initialOffset - 412) > 2) {
            throw new Error(`Collection opened at track offset ${initialOffset}; Pokémon must be the initial page.`);
          }
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-catalog.png`),
          });
          await page.getByRole('button', { name: /^Sort by / }).click();
          await page.getByTestId('native-collection-sort-menu').waitFor({ state: 'visible' });
          // The canonical six rows arrive 50 ms apart and each owns a 150 ms
          // transition. Capture only after the final option has settled.
          await page.waitForTimeout(425);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-sort-menu.png`),
          });
          await page.getByRole('button', { name: 'Close sort menu' }).click();
          await page.getByTestId('native-collection-sort-menu').waitFor({ state: 'detached' });
          await page.getByRole('tab', { name: 'TAGS' }).click();
          await waitForCollectionPageOffset(page, 0);
          const tagsOffset = await readCollectionPageOffset(page);
          if (Math.abs(tagsOffset) > 2) throw new Error(`Tags tab stopped at track offset ${tagsOffset}.`);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-tags.png`),
          });
          await page.getByRole('button', { name: /Open All Caught, 8 Pokémon/i }).click();
          await waitForCollectionPageOffset(page, 412);
          await page.getByRole('tab', { name: 'WISHLIST' }).click();
          await waitForCollectionPageOffset(page, 824);
          const wishlistOffset = await readCollectionPageOffset(page);
          if (Math.abs(wishlistOffset - 824) > 2) throw new Error(`Wishlist tab stopped at track offset ${wishlistOffset}.`);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-wishlist-tags.png`),
          });
          await page.getByRole('tab', { name: 'TAGS' }).click();
          await waitForCollectionPageOffset(page, 0);
          await page.getByRole('button', { name: 'New inventory tag' }).click();
          await page.getByLabel('Tag name').fill('Parity Check');
          await page.getByRole('button', { name: 'Use #7C3AED' }).click();
          await page.getByRole('button', { name: 'Create tag' }).click();
          await page.getByRole('button', { name: /Open Parity Check, 0 Pokémon/i }).waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'POKÉMON' }).click();
          await waitForCollectionPageOffset(page, 412);
        }

        if (route.startsWith('collection?foreign=1')) {
          const expectedTag = route.endsWith('tag=wanted') ? 'Wanted' : 'For Trade';
          if (await page.getByRole('button', { name: new RegExp(`Clear ${expectedTag} tag filter`, 'i') }).count()) {
            throw new Error(`Foreign ${expectedTag} catalog allowed its required tag to be cleared.`);
          }
          const listing = page.getByRole('button', { name: /^View / }).first();
          await listing.click();
          await page.getByTestId('native-instance-overlay').waitFor({ state: 'visible' });
          if (await page.getByRole('button', { name: /Edit Pokémon|Edit wanted listing/i }).count()) {
            throw new Error(`Foreign ${expectedTag} listing exposed owner editing controls.`);
          }
          if (await page.getByRole('button', { name: 'Edit preferences' }).count()) {
            throw new Error(`Foreign ${expectedTag} listing exposed preference editing controls.`);
          }
          await page.getByTestId('native-instance-overlay').getByRole('button', { name: 'Close' }).click();
          await page.getByTestId('native-instance-overlay').waitFor({ state: 'detached' });
        }

        if (route === 'collection?instance=0006-default_demo-charizard') {
          await page.getByRole('button', { name: 'Edit Pokémon' }).click();
          await page.getByLabel('Pokémon detail editor').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-caught-overlay-edit.png`),
          });
          await page.getByTestId('native-instance-scroll').evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await page.waitForTimeout(100);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-caught-overlay-edit-bottom.png`),
          });
          await page.getByTestId('native-instance-scroll').evaluate((element) => {
            element.scrollTop = 0;
          });
          await page.getByLabel('Pokémon nickname').fill('Parity Charizard');
          await page.getByRole('button', { name: 'Save Pokémon' }).click();
          await page.getByLabel('Pokémon detail editor').waitFor({ state: 'detached' });
        }

        if (route === 'collection?instance=0025-party_hat_default_demo-trade') {
          const overlay = page.getByTestId('native-instance-overlay');
          if (await overlay.getByRole('button', { name: /Favorite/i }).count()) {
            throw new Error('For Trade overlay exposed the caught-only Favorite action.');
          }
          await page.getByRole('button', { name: 'Edit Pokémon' }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Edit Pokémon' }).click();
          await page.getByLabel('Pokémon detail editor').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-trade-overlay-edit.png`),
          });
          await page.getByTestId('native-instance-scroll').evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await page.waitForTimeout(100);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-trade-overlay-edit-bottom.png`),
          });
        }

        if (route === 'collection?instance=0094-default_demo-wanted') {
          await page.getByRole('button', { name: 'Edit wanted listing' }).click();
          await page.getByRole('button', { name: 'Set friendship to 5 hearts' }).click();
          await page.getByLabel('Remote trade available').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-wanted-overlay-edit.png`),
          });
          await page.getByTestId('native-instance-scroll').evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await page.waitForTimeout(100);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-collection-wanted-overlay-edit-bottom.png`),
          });
          await page.getByTestId('native-instance-scroll').evaluate((element) => {
            element.scrollTop = 0;
          });
          await page.getByRole('button', { name: 'Save wanted listing' }).click();
          await page.getByLabel('5 of 5 friendship hearts').waitFor({ state: 'visible' });
        }

        if (route === 'search') {
          await page.getByRole('button', { name: 'Modify search' }).click();
          await page.getByRole('button', { name: 'Filters' }).click();
          const filters = page.getByTestId('native-pokemon-search-filter-sheet');
          await filters.waitFor({ state: 'visible' });
          // React Native Web exposes the modal tree before its slide animation
          // reaches the viewport. Wait for the same settled state a trainer
          // actually sees; otherwise parity captures record a half-open sheet.
          await page.waitForTimeout(400);
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-search-filters.png`),
          });
          await filters.getByRole('tab', { name: 'Location' }).click();
          await filters.getByText('Where should we look?').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-search-filters-location.png`),
          });
          await filters.getByRole('tab', { name: 'Matching' }).click();
          await filters.getByText('What kind of match?').waitFor({ state: 'visible' });
          await filters.getByRole('tab', { name: 'Pokémon' }).click();
          await filters.getByRole('button', { name: /Apply & search/ }).click();
          // The embedded sheet stays mounted and inert after its first open so
          // subsequent opens never pay React's mount cost. Confirm the visible
          // route has resumed instead of expecting the prewarmed tree to detach.
          await page.getByText(/SEARCH COMPLETE/i).first().waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'Trainer search' }).click();
          await page.getByTestId('native-trainer-search').waitFor({ state: 'visible' });
          await page.getByLabel('Trainer name').fill('Other');
          await page.getByText('@OtherTrainer').waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'Pokémon search' }).click();
          await page.getByTestId('native-pokemon-search').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-search-results-list.png`),
          });
          await page.getByRole('tab', { name: 'Map view' }).click();
          await page.getByTestId('native-search-map').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-search-results-map.png`),
          });
          await page.getByRole('tab', { name: 'List view' }).click();
        }

        if (route === 'trade-preferences') {
          await page.getByTestId('trade-preferences-edit').first().click();
          await page.getByTestId('trade-preferences-save').click();
          await page.getByTestId('trade-preferences-save-success').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss saved message' }).click();
          await page.getByRole('tab', { name: /Wanted \(/ }).click();
          await page.getByRole('tab', { name: /For Trade \(/ }).click();
          await page.getByRole('tab', { name: 'Trade Activity' }).click();
          // The shared slider is transform-driven, so its viewport scrollLeft
          // deliberately remains zero. Wait through the canonical transition
          // before asserting the destination instead of inspecting stale
          // ScrollView-era geometry.
          await page.waitForTimeout(400);
          await page.getByTestId('native-trade-activity-screen').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-trade-activity-empty.png`),
          });
          await page.getByRole('tab', { name: 'Trade Preferences' }).click();
          await page.waitForTimeout(400);
          await page.getByTestId('native-trade-preferences-screen').waitFor({ state: 'visible' });
        }

        if (route === 'trade-activity') {
          await page.getByTestId('trade-action-accept-incoming').click();
          const actionConfirmation = page.getByTestId('trade-action-confirmation');
          await actionConfirmation.waitFor({ state: 'visible' });
          await actionConfirmation.getByRole('button', { name: 'Accept offer' }).click();
          await page.getByText('Trade updated from the server response.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await page.getByTestId('trade-filter-Proposed').click();
          await page.getByTestId('trade-action-cancel-sent').click();
          await page.getByTestId('trade-action-confirmation').getByRole('button', { name: 'Cancel trade' }).click();
          await page.getByText('Trade updated from the server response.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await page.getByTestId('trade-filter-Pending').click();
          await page.getByTestId('trade-action-coordinate-active').click();
          await page.getByTestId('trade-partner-information').waitFor({ state: 'visible' });
          await page.getByText('Trainer code: 1234 5678 9012').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Done' }).click();
        }

        if (route === 'trade-proposal') {
          await page.getByLabel('5 of 5 friendship hearts').waitFor({ state: 'visible' });
          await page.getByLabel('Remote trade available').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Propose trade' }).click();
          await page.getByText('Proposal committed').waitFor({ state: 'visible' });
          await page.getByText(/Trade #smoke-co is in Trade Activity/).waitFor({ state: 'visible' });
        }

        if (route === 'profile') {
          await page.getByRole('button', { name: 'Edit' }).click();
          await page.getByTestId('native-profile-editor').waitFor({ state: 'visible' });
          await page.getByTestId('native-profile-showcase-slot-1').click();
          await page.getByLabel('Search caught Pokémon').fill('Suicune');
          await page.getByRole('button', { name: /^Shiny Suicune/ }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Close showcase picker' }).click();
          await page.getByTestId('native-profile-editor').getByRole('button', { name: 'Cancel' }).click();
          await page.getByTestId('native-profile-editor').waitFor({ state: 'detached' });
        }

        if (route === 'profile-relationship') {
          const initialConfirmation = page.getByTestId('native-confirmation-dialog');
          await initialConfirmation.getByRole('button', { name: 'Cancel request' }).click();
          await page.getByText('Friend request canceled.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await page.getByTestId('native-profile-relationship-action').click();
          await page.getByText('Friend request sent.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await page.getByRole('button', { name: 'Block trainer' }).click();
          const blockConfirmation = page.getByTestId('native-confirmation-dialog');
          await blockConfirmation.getByRole('button', { name: 'Block trainer' }).click();
          await page.getByText('Trainer blocked.').waitFor({ state: 'visible' });
        }

        if (route === 'settings') {
          const locationSwitch = page.getByRole('switch', { name: 'Show profile location' });
          const initialLocationValue = await locationSwitch.getAttribute('aria-checked');
          await locationSwitch.click();
          await page.waitForTimeout(150);
          const changedLocationValue = await locationSwitch.getAttribute('aria-checked');
          if (changedLocationValue === initialLocationValue) {
            const markup = await locationSwitch.evaluate((element) => element.outerHTML);
            throw new Error(`Settings location switch stayed ${initialLocationValue}. Markup: ${markup}`);
          }
          await page.getByRole('button', { name: 'Save privacy' }).click();
          await page.getByText('Privacy settings saved.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
        }

        if (route === 'sync') {
          await page.getByText('You are offline').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Retain two changes' }).click();
          await page.getByText('2 changes are safely retained on this device.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Simulate sync error' }).click();
          await page.getByText('Receiver is temporarily unavailable.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Retry' }).click();
          await page.getByText('Accepted by Receiver').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Check' }).click();
          await page.getByText('Up to date').waitFor({ state: 'visible' });
        }

        if (route === 'account') {
          await page.getByRole('button', { name: 'Connect Facebook' }).click();
          await page.getByText('Facebook connected.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await page.getByRole('button', { name: 'Disconnect Facebook' }).click();
          await page.getByText('Disconnect Facebook?').waitFor({ state: 'visible' });
          await page.getByLabel('Current password').last().waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Cancel' }).click();
          await page.getByRole('button', { name: 'Sign out every device' }).click();
          await page.getByText('Sign out every device?').waitFor({ state: 'visible' });
          await page.getByLabel('Current password').last().waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Cancel' }).click();
        }

        if (route === 'account?oauthOnly=1') {
          if (await page.getByLabel('Current password').count()) {
            throw new Error('OAuth-only account incorrectly required a password field.');
          }
          await page.getByRole('button', { name: 'Disconnect Google' }).click();
          await page.getByText(/you do not need a separate password/i).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
          await page.getByText('Google disconnected.').waitFor({ state: 'visible' });
        }

        if (route === 'login') {
          await page.getByLabel('Username or email').fill('trainer@example.com');
          await page.getByLabel('Password', { exact: true }).fill('Password42!');
          await page.getByRole('button', { name: 'Show password' }).click();
          await page.getByRole('button', { name: 'Hide password' }).waitFor({ state: 'visible' });
        }

        if (route === 'public?page=register') {
          await page.getByRole('button', { name: 'Continue with email' }).click();
          await page.getByLabel('Username').waitFor({ state: 'visible' });
          await page.getByLabel('Username').fill('ParityTrainer');
        }

        if (route === 'public?page=reset') {
          await page.getByLabel('Recovery username or email').fill('trainer@example.com');
        }

        if (route === 'public?page=reset-confirm') {
          await page.getByLabel('New password', { exact: true }).fill('Valid_password_42!');
          await page.getByLabel('Confirm new password', { exact: true }).fill('Valid_password_42!');
          await page.getByRole('button', { name: 'Update password' }).click();
          await page.getByText('Password updated').waitFor({ state: 'visible' });
        }

        if (route === 'verify-email-change') {
          await page.getByText('Email not updated').waitFor({ state: 'visible' });
          await page.getByText('This verification link is incomplete.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Continue to login' }).waitFor({ state: 'visible' });
        }

        if (route.startsWith('not-found?')) {
          await page.getByText('That route wandered off.').waitFor({ state: 'visible' });
          await page.getByText(/No Pokémon Go Nexus page matches/).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: /Return home/ }).waitFor({ state: 'visible' });
        }

        if (route === 'public?page=faq') {
          await page.getByRole('button', { name: /Browse .* questions/ }).first().click();
          await page.getByRole('button', { name: 'Expand answers' }).click();
          await page.getByRole('button', { name: 'Collapse answers' }).waitFor({ state: 'visible' });
          await page.getByLabel('Search questions and answers').fill('trade');
          await page.getByRole('button', { name: 'Clear FAQ search' }).click();
        }

        if (route === 'public?page=trade-board') {
          const includeTrade = page.getByRole('checkbox', { name: 'Include For Trade Pokémon' });
          const includeWanted = page.getByRole('checkbox', { name: 'Include Looking For Pokémon' });
          await includeTrade.click();
          await includeWanted.click();
          if (await includeTrade.getAttribute('aria-checked') === 'false'
            && await includeWanted.getAttribute('aria-checked') === 'false') {
            throw new Error('Trade Board allowed both collection sections to be disabled.');
          }
          const errorOverlay = page.locator('#error-overlay');
          if (await errorOverlay.count() && await errorOverlay.isVisible()) {
            throw new Error(`Trade Board triggered the Expo error overlay:\n${await errorOverlay.innerText()}`);
          }
          await page.getByRole('button', { name: 'Copy live link', exact: true }).click();
          if (await errorOverlay.count() && await errorOverlay.isVisible()) {
            throw new Error(`Trade Board copy triggered the Expo error overlay:\n${await errorOverlay.innerText()}`);
          }
          await page.getByRole('button', { name: 'Dismiss Trade Board message' }).click();
        }

        if (route === 'public-profile') {
          if (await page.getByRole('button', { name: 'Add friend' }).count()) {
            throw new Error('Signed-out public profile exposed an authenticated friend action.');
          }
          await page.getByRole('button', {
            name: "View Misty's caught Pokémon",
          }).click();
          await page.getByText('Open Misty collection: caught').waitFor({ state: 'visible' });
        }


        if (route === 'public?page=public-trade-board') {
          await page.getByRole('link', { name: /For Trade/ }).waitFor({ state: 'visible' });
          await page.getByRole('link', { name: /Looking For/ }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Copy live Trade Board link' }).click();
          await page.getByText('Live Trade Board link copied.').waitFor({ state: 'visible' });
        }

        if (route === 'tools?tool=pokedex') {
          const advanced = page.getByRole('switch', { name: 'Advanced Pokédex filters' });
          await advanced.click();
          await page.getByRole('tab', { name: 'Shadow', exact: true }).waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'Shadow', exact: true }).click();
          const luckyFacet = page.getByRole('button', { name: 'Lucky', exact: true });
          if (!(await luckyFacet.isDisabled())) {
            throw new Error('Shadow Pokédex entries incorrectly allow the Lucky facet.');
          }
          await page.getByRole('tab', { name: 'Pokémon', exact: true }).click();
          await page.getByRole('button', { name: 'Open Kanto' }).click();
          await page.getByLabel('Search Pokédex').fill('Bulbasaur');
          await page.getByRole('button', { name: 'Register all', exact: true }).click();
          await page.getByText('Register every visible entry?').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Cancel' }).click();
        }

        if (route === 'tools?tool=pokedex-detail') {
          for (const tabName of ['Info', 'Battle', 'More', 'Registered']) {
            await page.getByRole('tab', { name: tabName === 'More' ? /^More/ : tabName, exact: true }).click();
          }
          await page.getByRole('button', { name: 'Register Shadow', exact: true }).click();
          await page.getByRole('button', { name: 'Clear Shadow', exact: true }).waitFor({ state: 'visible' });
        }

        if (route === 'tools?tool=raid') {
          await page.getByRole('tab', { name: 'Boss counters' }).click();
          await page.getByLabel('Find boss').fill('Bulbasaur');
          await page.getByRole('button', { name: 'Select Bulbasaur raid boss' }).click();
          const settings = page.getByRole('button', { name: /Ranking settings/ });
          await settings.click();
          await page.getByText('Ranking conditions').waitFor({ state: 'visible' });
          await page.getByText('ALL MOVESETS').click();
          await page.getByLabel('Search raid counters').fill('Vine Whip');
          await page.getByRole('tab', { name: 'Attacker rankings' }).click();
          await page.getByRole('button', { name: /Sort by CP/ }).click();
        }

        if (route === 'tools?tool=max') {
          await page.getByRole('button', { name: /Healing/ }).click();
          await page.getByRole('button', { name: 'grass', exact: true }).click();
          await page.getByLabel('Search Max rankings').fill('Vine Whip');
          await page.getByRole('tab', { name: 'Boss teams' }).click();
          await page.getByRole('button', { name: /ALL POKÉMON/ }).click();
          await page.getByRole('button', { name: /Select .*Bulbasaur Max boss/ }).click();
          await page.getByLabel('Max Battle simulator').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Add one Trainer' }).click();
        }

        if (route === 'tools?tool=pvp') {
          await page.getByRole('tab', { name: 'Team Builder' }).click();
          await page.getByLabel('PvP Team Builder').waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'Battle Lab' }).click();
          await page.getByLabel('Battle Lab mode').waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'IV Rank' }).click();
          await page.getByLabel('Search IV Rank Pokémon').waitFor({ state: 'visible' });
          await page.getByRole('tab', { name: 'Rankings' }).click();
          await page.getByLabel('Search PvP rankings').fill('Bulbasaur');
          await page.getByRole('button', { name: 'Show details for Bulbasaur' }).click();
          await page.getByText('Role profile', { exact: true }).waitFor({ state: 'visible' });
        }

        if (route === 'tools?tool=rankings') {
          await page.getByRole('tab', { name: 'Rarest owned' }).click();
          await page.getByLabel('Search rankings').fill('Bulbasaur');
          await page.getByRole('button', { name: 'Clear ranking search' }).click();
          await page.getByText('How these rankings work').click();
          await page.getByText(/Duplicate wanted copies do not add votes/).waitFor({ state: 'visible' });
        }

        if (route === 'friends') {
          const slider = page.getByTestId('native-horizontal-page-slider');
          const goToFriendsPage = async (label, index) => {
            await page.getByRole('tab', { name: label }).click();
            await page.waitForFunction((expectedIndex) => {
              const viewport = document.querySelector('[data-testid="native-horizontal-page-slider"]');
              const track = document.querySelector('[data-testid="native-horizontal-page-track"]');
              if (!viewport || !track) return false;
              const viewportBounds = viewport.getBoundingClientRect();
              const trackBounds = track.getBoundingClientRect();
              return Math.abs(
                trackBounds.left + (viewportBounds.width * expectedIndex) - viewportBounds.left,
              ) <= 2;
            }, index);
          };
          await goToFriendsPage('Requests view', 1);
          await page.getByRole('button', { name: 'Accept Brock' }).click();
          await page.getByText('Friend request accepted.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await goToFriendsPage('Find view', 2);
          await page.getByRole('button', { name: 'Add GaryOak' }).click();
          await page.getByText('Friend request sent.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await goToFriendsPage('Blocked view', 3);
          await page.getByRole('button', { name: 'Unblock Rocket' }).click();
          await page.getByText('Trainer unblocked.').waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Dismiss message' }).click();
          await goToFriendsPage('Friends view', 0);
          const friendsOffset = await slider.evaluate((element) => {
            const track = element.querySelector('[data-testid="native-horizontal-page-track"]');
            return track
              ? track.getBoundingClientRect().left - element.getBoundingClientRect().left
              : Number.NaN;
          });
          if (Math.abs(friendsOffset) > 2) throw new Error(`Friends view stopped at scroll offset ${friendsOffset}.`);
        }

        assertNoRuntimeErrors(route, errors);
        const safeName = route.replace(/[?=&]/g, '-');
        await page.screenshot({
          fullPage: true,
          path: join(artifactDirectory, `${colorScheme}-${safeName}.png`),
        });
        await page.close();
      }

      if (!routeFilter || routeFilter === 'action-menu') {
      const actionPage = await context.newPage();
      const actionErrors = [];
      trackPageFailures(actionPage, actionErrors);
      await actionPage.goto(`${baseUrl}/device-smoke/home`, { waitUntil: 'networkidle' });
      await actionPage.getByTestId('native-action-menu-anchor').click();
      const actionMenu = actionPage.getByTestId('native-action-menu');
      await actionMenu.waitFor({ state: 'visible' });
      await actionPage.waitForFunction(() => {
        const menu = document.querySelector('[data-testid="native-action-menu"]');
        if (!(menu instanceof HTMLElement)) return false;
        return Number.parseFloat(window.getComputedStyle(menu).opacity || '0') >= 0.99;
      });
      for (const label of ['Raid', 'Pokedex', 'PvP', 'Search', 'Home', 'Trades', 'Pokémon', 'Max Battles', 'Rankings']) {
        if (await actionMenu.getByRole('button', { name: label, exact: true }).count() !== 1) {
          throw new Error(`Action menu is missing ${label}.`);
        }
      }
      const targetTheme = colorScheme === 'dark' ? 'light' : 'dark';
      await actionMenu.getByRole('switch', { name: `Use ${targetTheme} theme` }).click();
      await actionMenu.getByRole('switch', { name: `Use ${colorScheme} theme` }).waitFor({ state: 'visible' });
      await actionMenu.getByRole('switch', { name: `Use ${colorScheme} theme` }).click();
      await actionMenu.getByRole('switch', { name: `Use ${targetTheme} theme` }).waitFor({ state: 'visible' });
      assertNoRuntimeErrors('action-menu', actionErrors);
      await actionPage.screenshot({
        path: join(artifactDirectory, `${colorScheme}-action-menu.png`),
      });
      const actionDestinations = [
        ['Raid', '/raid'],
        ['Pokedex', '/pokedex'],
        ['PvP', '/pvp'],
        ['Search', '/search'],
        ['Home', '/'],
        ['Trades', '/trades'],
        ['Pokémon', '/pokemon'],
        ['Max Battles', '/max'],
        ['Rankings', '/rankings'],
        ['Share Trade Board', '/trade-board'],
        ['Settings', '/settings'],
        ['Profile', '/profile'],
      ];
      for (const [label, expectedPath] of actionDestinations) {
        const destinationButton = expectedPath === '/profile'
          ? actionMenu.getByRole('button', { name: /^Profile/ })
          : actionMenu.getByRole('button', { name: label, exact: true });
        await destinationButton.click();
        await actionPage.getByText(`Navigate ${expectedPath}`, { exact: true }).waitFor({ state: 'visible' });
        await actionPage.getByTestId('native-action-menu-anchor').click();
        await actionMenu.waitFor({ state: 'visible' });
      }
      await actionMenu.getByRole('button', { name: 'Learn and support' }).click();
      await actionPage.getByTestId('native-action-menu-support-panel').waitFor({ state: 'visible' });
      for (const label of ['Getting Started', 'FAQ', 'About', 'Trade Safety', 'Help directory']) {
        if (await actionMenu.getByRole('button', { name: label, exact: true }).count() !== 1) {
          throw new Error(`Action-menu support panel is missing ${label}.`);
        }
      }
      await actionPage.screenshot({
        path: join(artifactDirectory, `${colorScheme}-action-menu-support.png`),
      });
      await actionPage.close();

      const guestActionPage = await context.newPage();
      const guestActionErrors = [];
      trackPageFailures(guestActionPage, guestActionErrors);
      await guestActionPage.goto(`${baseUrl}/device-smoke/home?guest=1`, { waitUntil: 'networkidle' });
      await guestActionPage.getByTestId('native-action-menu-anchor').click();
      await guestActionPage.getByTestId('native-action-menu').waitFor({ state: 'visible' });
      await guestActionPage.getByRole('button', { name: 'Register', exact: true }).click();
      await guestActionPage.getByText('Navigate /register', { exact: true }).waitFor({ state: 'visible' });
      await guestActionPage.getByTestId('native-action-menu-anchor').click();
      await guestActionPage.getByRole('button', { name: 'Login', exact: true }).click();
      await guestActionPage.getByText('Navigate /login', { exact: true }).waitFor({ state: 'visible' });
      assertNoRuntimeErrors('guest-action-menu', guestActionErrors);
      await guestActionPage.close();
      }
      await context.close();
    }

    for (const colorScheme of ['dark', 'light']) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { width: 360, height: 800 },
      });
      await installAssetRoutes(context);
      for (const [route, testId] of routeCases.filter(([route]) => routeMatches(route))) {
        const page = await context.newPage();
        const errors = [];
        trackPageFailures(page, errors);
        await page.goto(`${baseUrl}/device-smoke/${route}`, {
          timeout: 60_000,
          waitUntil: 'networkidle',
        });
        await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 15_000 });
        await waitForDeterministicFixture(page, route);
        await assertAccessibleControlState(page, `narrow:${route}`);
        await assertWcagAccessibility(page, `narrow:${route}`);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        ) - window.innerWidth);
        if (overflow > 2) throw new Error(`${route} overflows the narrow mobile viewport by ${overflow}px.`);
        assertNoRuntimeErrors(`narrow:${route}`, errors);
        const safeName = route.replace(/[?=&]/g, '-');
        await page.screenshot({
          fullPage: true,
          path: join(artifactDirectory, `${colorScheme}-narrow-${safeName}.png`),
        });
        await page.close();
      }
      await context.close();
    }

    for (const colorScheme of ['dark', 'light']) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { width: 1440, height: 900 },
      });
      await installAssetRoutes(context);
      for (const [route, testId] of desktopRouteCases.filter(([route]) => routeMatches(route))) {
        const page = await context.newPage();
        const errors = [];
        trackPageFailures(page, errors);
        await page.goto(`${baseUrl}/device-smoke/${route}`, {
          timeout: 60_000,
          waitUntil: 'networkidle',
        });
        const root = page.getByTestId(testId);
        await root.waitFor({ state: 'visible', timeout: 15_000 });
        await waitForDeterministicFixture(page, route);
        if (route === 'collection') {
          await page.getByRole('tab', { name: 'TAGS' }).click();
          await waitForCollectionPageOffset(page, 0);
          await page.getByRole('button', { name: /Open All Caught, 8 Pokémon/i }).click();
          await waitForCollectionPageOffset(page, 1440);
          const collectionOffset = await readCollectionPageOffset(page);
          if (Math.abs(collectionOffset - 1440) > 2) {
            throw new Error(`Desktop Collection stopped at track offset ${collectionOffset}.`);
          }
        }
        await assertAccessibleControlState(page, `desktop:${route}`);
        await assertWcagAccessibility(page, `desktop:${route}`);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        ) - window.innerWidth);
        if (overflow > 2) throw new Error(`${route} overflows the desktop viewport by ${overflow}px.`);
        assertNoRuntimeErrors(`desktop:${route}`, errors);
        const safeName = route.replace(/[?=&]/g, '-');
        await page.screenshot({
          fullPage: true,
          path: join(artifactDirectory, `${colorScheme}-desktop-${safeName}.png`),
        });
        if (route === 'search') {
          await page.getByRole('tab', { name: 'Map view' }).click();
          await page.getByTestId('native-search-map').waitFor({ state: 'visible' });
          await page.screenshot({
            fullPage: true,
            path: join(artifactDirectory, `${colorScheme}-desktop-search-results-map.png`),
          });
          await page.getByRole('tab', { name: 'List view' }).click();
        }
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (expo) expo.kill('SIGTERM');
    if (fixtureServer) await new Promise((resolvePromise) => fixtureServer.close(resolvePromise));
  }
};

await run();
process.stdout.write(`Native web parity smoke passed. Screenshots: ${artifactDirectory}\n`);
