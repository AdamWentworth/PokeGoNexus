import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { chooseCapturePokemon, installDemoRoutes, installPublicCaptureTheme, seedDemoBrowserState } from './support/demoFixtures';

const demoMediaDir = path.resolve(process.cwd(), '.artifacts/demo-media');
const captureLightTheme = process.env.DEMO_CAPTURE_THEME === 'light';

async function capture(page: Page, name: string, options: Parameters<Page['screenshot']>[0] = {}) {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    for (const button of Array.from(document.querySelectorAll('button'))) {
      if (button.textContent?.includes('Perf telemetry')) {
        const panel = button.parentElement;
        if (panel) {
          panel.style.display = 'none';
        }
      }
    }
  });

  const themedName = captureLightTheme ? `${name}-light` : name;
  const screenshotPath = path.join(demoMediaDir, `${themedName}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
    animations: 'disabled',
    ...options,
  });
}

test.describe('demo media capture', () => {
  test.skip(process.env.DEMO_CAPTURE !== '1', 'Only run through npm run capture:demo');

  test('captures canonical mobile public route references', async ({ page }, testInfo) => {
    fs.mkdirSync(demoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const routes = [
      { path: '/getting-started', name: 'getting-started-mobile', heading: 'Your first useful trade, step by step.' },
      { path: '/faq', name: 'faq-mobile', heading: 'Frequently asked questions' },
      { path: '/help', name: 'help-mobile', heading: 'Help & information' },
      { path: '/about', name: 'about-mobile', heading: 'About Pokémon Go Nexus' },
      { path: '/safety', name: 'safety-mobile', heading: 'Trade Safety & Community Guidelines' },
      { path: '/privacy', name: 'privacy-mobile', heading: 'Privacy Policy' },
      { path: '/terms', name: 'terms-mobile', heading: 'Terms of Service' },
      { path: '/data-deletion', name: 'data-deletion-mobile', heading: 'User Data Deletion' },
    ] as const;

    try {
      await installDemoRoutes(page);
      await installPublicCaptureTheme(page);
      await page.setViewportSize({ width: 412, height: 915 });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Build your collection.' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('heading', { name: 'Find the right trade.' })).toBeVisible();
      await capture(page, 'home-guest-mobile');

      for (const route of routes) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({
          timeout: 20_000,
        });
        await capture(page, route.name);
      }

      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'login-mobile');

      await page.goto('/register', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'registration-mobile');

      await page.goto('/reset-password?token=demo-reset-token', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'password-reset-mobile');

      await page.goto('/missing-reference-route', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'That route wandered off.' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'not-found-mobile');
    } finally {
      await diagnostics.flush();
    }

    expect(
      diagnostics.blockingErrors(),
      'public route reference capture should not include runtime errors',
    ).toEqual([]);
  });

  test('captures canonical mobile collection references', async ({ page }, testInfo) => {
    fs.mkdirSync(demoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installDemoRoutes(page);
      await seedDemoBrowserState(page);
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
      await capture(page, 'collection-catalog-mobile');

      await page.locator('.sort-button').click();
      await expect(page.locator('.sort-menu-overlay.visible')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(425);
      await capture(page, 'collection-sort-menu-mobile');
      await page.locator('.sort-menu-overlay .close-button').click();
      await expect(page.locator('.sort-menu-overlay')).toHaveCount(0, { timeout: 10_000 });

      await page.getByText('TAGS', { exact: true }).click();
      await expect(page.locator('.tag-item[data-tag="Caught"]')).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-tags-mobile');

      await page.locator('.tag-item[data-tag="Caught"]').click();
      await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-mobile');
      await page.locator('[role="button"][aria-label^="View "]').first().click();
      await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(page.locator('.caught-instance .name-editable-content.editable')).toBeVisible({ timeout: 10_000 });
      await capture(page, 'collection-caught-overlay-edit-mobile');
      await page.locator('.instance-overlay').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await capture(page, 'collection-caught-overlay-edit-bottom-mobile');
      await page.getByRole('button', { name: 'Close' }).click();

      await page.getByText('WISHLIST', { exact: true }).click();
      await expect(page.locator('.tag-item[data-tag="Wanted"]')).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-wishlist-tags-mobile');

      await page.locator('.tag-item[data-tag="Wanted"]').click();
      await page.locator('[role="button"][aria-label^="View Gengar"]').first().click();
      await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-wanted-overlay-mobile');
      await page.getByRole('button', { name: 'Edit wanted listing' }).click();
      await expect(page.getByRole('button', { name: 'Save wanted listing' })).toBeVisible({ timeout: 10_000 });
      await capture(page, 'collection-wanted-overlay-edit-mobile');
      await page.locator('.instance-overlay').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await capture(page, 'collection-wanted-overlay-edit-bottom-mobile');
      await page.getByRole('button', { name: 'Close' }).click();

      await page.getByText('TAGS', { exact: true }).click();
      await page.locator('.tag-item[data-tag="Trade"]').click();
      await page.locator('[role="button"][aria-label^="View Party Hat Pikachu"]').first().click();
      await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-trade-overlay-mobile');
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 });
      await capture(page, 'collection-trade-overlay-edit-mobile');
      await page.locator('.instance-overlay').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await capture(page, 'collection-trade-overlay-edit-bottom-mobile');
    } finally {
      await diagnostics.flush();
    }

    expect(
      diagnostics.blockingErrors(),
      'collection reference capture should not include runtime errors',
    ).toEqual([]);
  });

  test('captures current Pokémon Go Nexus product surfaces', async ({ page }, testInfo) => {
    fs.mkdirSync(demoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installDemoRoutes(page);
      await seedDemoBrowserState(page);

      await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
      await page.getByText('TAGS', { exact: true }).click();
      await expect(page.locator('.tag-item[data-tag="Caught"]')).toBeVisible({ timeout: 15_000 });
      await page.locator('.tag-item[data-tag="Caught"]').click();
      await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-desktop');

      await page.locator('[role="button"][aria-label^="View Charizard"]').first().click();
      await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
      await capture(page, 'collection-instance-overlay');
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.instance-overlay')).toHaveCount(0);

      await page.goto('/search', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Pokémon' }).click();
      await chooseCapturePokemon(page, 'Pikachu');
      await page.getByRole('button', { name: 'For Trade', exact: true }).click();
      await page.getByRole('button', { name: /Location/ }).click();
      await page.getByPlaceholder('Search for a city').fill('Vancouver');
      await page.getByText('Vancouver, British Columbia, Canada').click();
      await page.getByRole('button', { name: 'Apply and search' }).click();
      await expect(page.locator('.list-view-container')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('HarbourMew').first()).toBeVisible();
      await capture(page, 'search-results-list');

      await page.getByRole('button', { name: 'Map view' }).click();
      await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      await capture(page, 'search-results-map');

      await page.goto('/trades', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Trade Activity' }).click();
      const tradeActivity = page.locator('.trade-activity-workspace');
      await expect(tradeActivity).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Active, 1' }).click();
      await expect(tradeActivity.getByText('Party Hat Pikachu').first()).toBeVisible({ timeout: 20_000 });
      await expect(tradeActivity.getByText('Mewtwo').first()).toBeVisible({ timeout: 20_000 });
      await capture(page, 'trades-pending');

    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('captures canonical mobile trainer-tool references', async ({ page }, testInfo) => {
    fs.mkdirSync(demoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installDemoRoutes(page);
      await seedDemoBrowserState(page);
      await page.setViewportSize({ width: 412, height: 915 });

      for (const [route, heading, filename] of [
        ['/pokedex', 'Pokédex', 'pokedex-mobile'],
        ['/raid', 'Raid Planner', 'raid-mobile'],
        ['/max', 'Max Battles', 'max-mobile'],
        ['/pvp', 'PvP Rankings', 'pvp-mobile'],
        ['/rankings', 'Community Rankings', 'rankings-mobile'],
      ] as const) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.locator('.app-loading-overlay')).toHaveCount(0, { timeout: 30_000 });
        await capture(page, filename);
      }

      await page.goto('/raid/methodology', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'How raid rankings work' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'raid-methodology-mobile');

      await page.goto('/pvp/methodology', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'How PvP rankings work' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'pvp-methodology-mobile');
    } finally {
      await diagnostics.flush();
    }

    expect(
      diagnostics.blockingErrors(),
      'trainer-tool reference capture should not include runtime errors',
    ).toEqual([]);
  });

  test('captures canonical mobile social, account, and trade references', async ({ page }, testInfo) => {
    fs.mkdirSync(demoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installDemoRoutes(page);
      await seedDemoBrowserState(page);
      await page.setViewportSize({ width: 412, height: 915 });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Welcome back, NexusDemo' })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'home-authenticated-mobile');
      await page.getByRole('button', { name: 'Action Menu', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Quick navigation' })).toBeVisible();
      await capture(page, 'action-menu-mobile');
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog', { name: 'Quick navigation' })).toHaveCount(0);

      await page.goto('/search', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Pokémon' }).click();
      await chooseCapturePokemon(page, 'Pikachu');
      await page.getByRole('button', { name: 'For Trade', exact: true }).click();
      await page.getByRole('button', { name: /Filters/ }).click();
      await expect(page.getByRole('dialog', { name: 'Refine your search' })).toBeVisible();
      await capture(page, 'search-filters-mobile');
      await page.getByRole('tab', { name: 'Location' }).click();
      await page.getByPlaceholder('Search for a city').fill('Vancouver');
      await page.getByText('Vancouver, British Columbia, Canada').click();
      await capture(page, 'search-filters-location-mobile');
      await page.getByRole('button', { name: 'Close search filters' }).click();
      await expect(page.getByRole('dialog', { name: 'Refine your search' })).toHaveCount(0);

      // Re-enter through the established main Search path so this composite
      // capture does not couple its result state to the two filter-sheet
      // screenshots above. The Apply behavior has dedicated workflow coverage.
      await page.goto('/search', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Pokémon' }).click();
      await chooseCapturePokemon(page, 'Pikachu');
      await page.getByRole('button', { name: 'For Trade', exact: true }).click();
      await page.getByRole('button', { name: /Location/ }).click();
      await page.getByPlaceholder('Search for a city').fill('Vancouver');
      await page.getByText('Vancouver, British Columbia, Canada').click();
      await page.getByRole('button', { name: 'Apply and search' }).click();
      await expect(page.getByRole('dialog', { name: 'Refine your search' })).toHaveCount(0);
      await expect(page.locator('.list-view-container')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('HarbourMew').first()).toBeVisible();
      await capture(page, 'search-results-mobile');

      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.trainer-profile-card')).toBeVisible({ timeout: 20_000 });
      await capture(page, 'trainer-profile-mobile');

      await page.goto('/profile/friends', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText('HarbourMew').first()).toBeVisible();
      await capture(page, 'friends-mobile');

      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
      await capture(page, 'trainer-settings-mobile');

      await page.goto('/settings/account', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('2 active sessions')).toBeVisible();
      await capture(page, 'account-security-mobile');

      await page.goto('/trades', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Trade preferences' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Festival spare').first()).toBeVisible();
      await capture(page, 'trade-preferences-mobile');
      await page.getByRole('tab', { name: 'Trade Activity' }).click();
      await expect(page.locator('.trade-activity-workspace')).toBeVisible({ timeout: 20_000 });
      await capture(page, 'trade-activity-mobile');

      await page.goto('/trade-board', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Trade Board', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText('Include on board', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'trade-board-mobile');
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `mobile reference capture should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });
});
