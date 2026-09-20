import { expect, test } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';
import { homeExperienceParityContract } from '../../../../packages/shared-ui-tokens/src/index';

const dashboardInstance = (
  instanceId: string,
  variantId: string,
  pokemonId: number,
  overrides: Record<string, unknown>,
) => ({
  date_added: '2026-08-20T00:00:00.000Z',
  instance_id: instanceId,
  is_caught: false,
  is_for_trade: false,
  is_wanted: false,
  favorite: false,
  most_wanted: false,
  last_update: Date.parse('2026-08-20T00:00:00.000Z'),
  nickname: null,
  pokemon_id: pokemonId,
  registered: true,
  user_id: 'home-user',
  variant_id: variantId,
  ...overrides,
});

const addSignedInUser = async (page: Parameters<typeof installE2eRoutes>[0]) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('user', JSON.stringify({
      accessTokenExpiry: '2099-01-01T00:00:00.000Z',
      allowLocation: false,
      email: 'home@example.test',
      location: '',
      pokemonGoName: 'HomeTrainerGO',
      refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
      trainerCode: '',
      user_id: 'home-user',
      username: 'HomeTrainer',
    }));
  });
};

const seedDashboardInstances = async (
  page: Parameters<typeof installE2eRoutes>[0],
  instances: Record<string, Record<string, unknown>>,
) => {
  await page.evaluate((records) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('instancesDB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('instances')) {
        db.close();
        reject(new Error('instances store was not initialized'));
        return;
      }

      const transaction = db.transaction('instances', 'readwrite');
      const store = transaction.objectStore('instances');
      store.clear();
      Object.values(records).forEach((record) => store.put(record));
      transaction.oncomplete = () => {
        db.close();
        window.localStorage.setItem('ownershipTimestamp', String(Date.now()));
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  }), instances);
};

test.describe('Home page', () => {
  test('presents real product workflows to signed-out visitors without mobile overflow', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await installE2eRoutes(page);

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Build your collection. Find the right trade.' })).toBeVisible();
      await expect(page.getByRole('note', { name: 'Action menu tip' })).toContainText('explore tools');
      await page.getByRole('button', { name: 'Action Menu', exact: true }).click();
      await expect(page.getByRole('note', { name: 'Action menu tip' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
      const closeActionMenu = page.getByRole('button', { name: 'Close' });
      await expect(closeActionMenu).toBeEnabled();
      await closeActionMenu.click();
      await expect(page.getByRole('button', { name: 'Action Menu' })).toBeVisible();
      await expect(page.getByText('You each have what the other trainer wants')).toBeVisible();
      await page.getByRole('link', { name: /explore the app/i }).click();
      await expect.poll(() => page.locator('#feature-directory').evaluate((element) =>
        Math.abs(element.getBoundingClientRect().top))).toBeLessThan(30);
      await expect(page).toHaveURL(/#feature-directory$/);
      const featureDirectory = page.locator('#feature-directory');
      await expect(featureDirectory.getByRole('heading', { name: 'Explore Pokémon Go Nexus' })).toBeVisible();
      await expect(featureDirectory.getByRole('link', { name: /Pokémon collection/i })).toBeVisible();
      await expect(featureDirectory.getByRole('link', { name: /Search & discovery/i })).toBeVisible();
      await expect(featureDirectory.getByRole('link', { name: /^Trades/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /complete illustrated guide/i })).toBeAttached();
      await expect(page.getByRole('link', { name: 'Help & information' })).toBeAttached();
      const sectionOrder = await page.evaluate(() => {
        const story = document.querySelector('#trade-matching');
        const directory = document.querySelector('#feature-directory');
        return Boolean(story && directory && (
          story.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING
        ));
      });
      expect(sectionOrder).toBe(true);
      const guestDestinations = new Set(await page.locator('a[href]').evaluateAll((links) => (
        links.map((link) => link.getAttribute('href')).filter(Boolean)
      )));
      for (const destination of [
        '/', '/about', '/data-deletion', '/faq', '/friends', '/getting-started', '/help',
        '/login', '/max', '/pokedex', '/pokemon', '/privacy', '/pvp', '/raid', '/rankings',
        '/register', '/safety', '/search', '/terms', '/trade-board', '/trades',
      ]) {
        expect(guestDestinations.has(destination), `missing guest Home link ${destination}`).toBe(true);
      }

      const widths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('keeps the public help directory readable and complete on mobile and desktop', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const mobileProject = testInfo.project.name.includes('mobile');
    await page.setViewportSize(mobileProject
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 });
    await installE2eRoutes(page);

    try {
      await page.goto('/help', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Help & information' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Getting started/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Raid methodology/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /PvP methodology/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Privacy policy/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Terms of service/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Data deletion/i })).toBeVisible();

      const widths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('keeps the complete getting-started guide readable on mobile and desktop', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const mobileProject = testInfo.project.name.includes('mobile');
    await page.setViewportSize(mobileProject
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 });
    await installE2eRoutes(page);

    try {
      await page.goto('/getting-started', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Your first useful trade, step by step.' })).toBeVisible();
      await expect(page.getByText(/offer a Shiny Gigantamax Charizard/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Start your collection' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Propose and coordinate' })).toBeVisible();
      await expect(page.getByRole('link', { name: /create a trade board/i })).toBeVisible();

      const widths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('guides an empty signed-in account before showing dashboard zeroes', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const mobileProject = testInfo.project.name.includes('mobile');
    await page.setViewportSize(mobileProject
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 });
    await addSignedInUser(page);
    await installE2eRoutes(page);

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Let’s make your account useful.' })).toBeVisible();
      await expect(page.getByLabel('0 of 4 setup milestones complete')).toBeVisible();
      await expect(page.getByRole('link', { name: /open wishlist/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'At a glance' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Dismiss action menu tip' }).click();
      await page.getByRole('button', { name: 'Open trainer dashboard' }).click();
      await expect(page.getByRole('heading', { name: 'Welcome back, HomeTrainerGO' })).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Welcome back, HomeTrainerGO' })).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('summarizes authenticated collection, trade, and friend actions responsively', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const mobileProject = testInfo.project.name.includes('mobile');
    await page.setViewportSize(mobileProject
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 });
    await addSignedInUser(page);

    const pokemonInstances = {
      favorite: dashboardInstance('favorite', '0001-default', 1, {
        favorite: true,
        is_caught: true,
        last_update: 4,
      }),
      trade: dashboardInstance('trade', '0006-default', 6, {
        is_caught: true,
        is_for_trade: true,
        last_update: 3,
      }),
      wanted: dashboardInstance('wanted', '0025-default', 25, {
        is_wanted: true,
        most_wanted: true,
        last_update: 2,
      }),
    };
    const trades = {
      incoming: {
        trade_id: 'incoming',
        trade_status: 'proposed',
        username_accepting: 'HomeTrainer',
        username_proposed: 'OtherTrainer',
      },
      confirm: {
        trade_id: 'confirm',
        trade_status: 'pending',
        username_accepting: 'HomeTrainer',
        user_accepting_completion_confirmed: false,
      },
    };

    await installE2eRoutes(page, {
      friendsOverview: {
        friends: [],
        incoming: [{
          friendship_id: 'friendship-1',
          user_id: 'friend-user',
          username: 'NewFriend',
          direction: 'incoming',
        }],
        outgoing: [],
        blocked: [],
      },
      trades,
      userOverview: {
        user: { user_id: 'home-user', username: 'HomeTrainer' },
        pokemon_instances: pokemonInstances,
        trades,
        related_instances: {},
        registrations: {},
      },
    });

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Let’s make your account useful.' })).toBeVisible();
      await seedDashboardInstances(page, pokemonInstances);
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: 'Welcome back, HomeTrainerGO' })).toBeVisible();
      await expect(page.getByRole('note', { name: 'Action menu tip' })).toBeVisible();
      if (mobileProject) {
        await page.getByRole('button', { name: 'Action Menu', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Open action menu' }).click();
      }
      await expect(page.getByRole('note', { name: 'Action menu tip' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
      const closeActionMenu = page.getByRole('button', { name: 'Close' });
      await expect(closeActionMenu).toBeEnabled();
      await closeActionMenu.click();
      await expect(page.getByRole('button', { name: 'Action Menu' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '3 items need your attention' })).toBeVisible();
      await expect(page.getByText('1 offer to review')).toBeVisible();
      await expect(page.getByText('1 trade ready to confirm')).toBeVisible();
      await expect(page.getByText('1 friend request')).toBeVisible();
      await expect(page.getByRole('link', { name: /1 For Trade/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /1 Wanted/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your latest Pokémon' })).toBeVisible();
      await expect(page.locator('.home-stat--caught')).toHaveAttribute(
        'href',
        homeExperienceParityContract.collectionSummaryPaths.caught,
      );
      await expect(page.locator('.home-stat--favorite')).toHaveAttribute(
        'href',
        homeExperienceParityContract.collectionSummaryPaths.favorites,
      );
      await expect(page.locator('.home-stat--trade')).toHaveAttribute(
        'href',
        homeExperienceParityContract.collectionSummaryPaths.trade,
      );
      await expect(page.locator('.home-stat--wanted')).toHaveAttribute(
        'href',
        homeExperienceParityContract.collectionSummaryPaths.wanted,
      );
      for (const recentLink of await page.locator('.home-recent-pokemon a').all()) {
        await expect(recentLink).toHaveAttribute(
          'href',
          homeExperienceParityContract.recentPokemonPath,
        );
      }
      await expect(page.getByRole('link', { name: /Help & guides/i })).toBeVisible();
      const signedInDestinations = new Set(await page.locator('a[href]').evaluateAll((links) => (
        links.map((link) => link.getAttribute('href')).filter(Boolean)
      )));
      for (const destination of [
        '/', '/help', '/max', '/pokedex', '/pokemon', '/pokemon?filter=caught',
        '/pokemon?filter=favorites', '/pokemon?filter=trade', '/pokemon?filter=wanted',
        '/profile', '/profile/friends', '/pvp', '/raid', '/search', '/trade-board',
        '/trades?section=activity', '/trades?section=preferences',
      ]) {
        expect(signedInDestinations.has(destination), `missing signed-in Home link ${destination}`).toBe(true);
      }

      const widths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);

      await page.evaluate(() => {
        window.localStorage.setItem('isLightMode', 'true');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.getByRole('heading', { name: 'Welcome back, HomeTrainerGO' })).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
