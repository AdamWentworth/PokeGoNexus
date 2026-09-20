import { statSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';
import { openActionMenu } from './support/actionMenu';

const instance = (
  instanceId: string,
  variantId: string,
  pokemonId: number,
  overrides: Record<string, unknown>,
) => ({
  attack_iv: null,
  caught_tags: [],
  charged_move1_id: null,
  charged_move2_id: null,
  costume_id: null,
  cp: null,
  crown: false,
  date_added: '2026-08-20T00:00:00.000Z',
  date_caught: null,
  defense_iv: null,
  disabled: false,
  dynamax: false,
  fast_move_id: null,
  favorite: false,
  friendship_level: null,
  fused_with: null,
  fusion: null,
  fusion_form: null,
  gender: null,
  gigantamax: false,
  height: null,
  hp: null,
  instance_id: instanceId,
  is_caught: false,
  is_for_trade: false,
  is_fused: false,
  is_mega: false,
  is_traded: false,
  is_wanted: false,
  last_update: Date.parse('2026-08-20T00:00:00.000Z'),
  level: null,
  location_card: null,
  location_caught: null,
  lucky: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  mega: false,
  mega_form: null,
  mirror: false,
  most_wanted: false,
  nickname: null,
  not_trade_list: {},
  not_wanted_list: {},
  original_trainer_id: null,
  original_trainer_name: null,
  pokeball: null,
  pokemon_id: pokemonId,
  pref_lucky: false,
  purified: false,
  registered: true,
  shadow: false,
  shiny: false,
  stamina_iv: null,
  trade_filters: {},
  trade_tags: [],
  traded_date: null,
  user_id: 'board-user',
  variant_id: variantId,
  wanted_filters: {},
  wanted_tags: [],
  weight: null,
  ...overrides,
});

test.describe('shareable Trade Board', () => {
  test('honors collection privacy on the live board', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await installE2eRoutes(page);
    await page.route('**/instances/by-username/privatetrainer', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: 'Collection is private' }),
        contentType: 'application/json',
        status: 403,
      });
    });
    await page.route('**/public/users/privatetrainer', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: 'Collection is private' }),
        contentType: 'application/json',
        status: 403,
      });
    });

    try {
      await page.goto('/trade-board/PrivateTrainer', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'This Trade Board is private' })).toBeVisible();
      await expect(page.locator('.trade-board')).toHaveCount(0);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors().filter((event) => !(
      event.kind === 'console'
      && event.text.includes('403 (Forbidden)')
      && /\/(?:api|__e2e)\/users\//.test(event.location.url)
    ))).toEqual([]);
  });

  test('renders a readable live board without mobile overflow', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await installE2eRoutes(page, {
      trainerProfile: {
        user: {
          app_joined_at: '2026-01-01T00:00:00Z',
          pokemonGoName: 'BoardTrainerGO',
          user_id: 'board-user',
          username: 'BoardTrainer',
        },
        trainer_titles: [],
        stats: { caught: 1, favorites: 0, for_trade: 1, registered: 2, wanted: 1 },
        highlights: [],
        viewer: { can_view_collection: true, can_view_profile: true, relationship: 'none' },
      },
      userInstances: {
        username: 'BoardTrainer',
        instances: {
          trade: instance('trade', '0001-default', 1, { is_caught: true, is_for_trade: true }),
          wanted: instance('wanted', '0006-default', 6, { is_wanted: true, most_wanted: true }),
        },
      },
    });

    try {
      await page.goto('/trade-board/BoardTrainer', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: "@BoardTrainer’s Trade Board" })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
      await expect(page.getByText('Pokémon GO: BoardTrainerGO')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'For Trade', level: 2 })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Looking For', level: 2 })).toBeVisible();
      await expect(page.getByLabel('Most Wanted')).toBeVisible();
      await expect(page.getByAltText("QR code for this trainer's live trade board")).toBeVisible();

      const layout = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportBox: document.querySelector('[data-testid="trade-board-viewport"]')?.getBoundingClientRect(),
      }));
      expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.viewportBox?.width).toBeLessThanOrEqual(layout.viewportWidth);

      const screenshotPath = testInfo.outputPath('trade-board-mobile.png');
      await page.screenshot({ fullPage: true, path: screenshotPath });
      await testInfo.attach('trade-board-mobile.png', {
        contentType: 'image/png',
        path: screenshotPath,
      });

      await page.getByRole('link', { name: /1 For Trade/ }).click();
      await expect(page).toHaveURL(/\/pokemon\/BoardTrainer\?filter=trade$/);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('composes and downloads a deterministic board from the owner wishlist', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const mobileProject = testInfo.project.name.includes('mobile');
    await page.setViewportSize(mobileProject
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({
        accessTokenExpiry: '2099-01-01T00:00:00.000Z',
        allowLocation: false,
        email: 'board@example.test',
        location: '',
        pokemonGoName: 'BoardTrainerGO',
        refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
        trainerCode: '',
        user_id: 'board-user',
        username: 'BoardTrainer',
      }));
    });
    await installE2eRoutes(page);

    try {
      await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pokemon-card[role="button"]').first()).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
          const request = indexedDB.open('instancesDB');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('instances')) {
              db.close();
              resolve(0);
              return;
            }
            const transaction = db.transaction('instances', 'readonly');
            const count = transaction.objectStore('instances').count();
            count.onsuccess = () => { db.close(); resolve(count.result); };
            count.onerror = () => { db.close(); reject(count.error); };
          };
        })))
        .toBeGreaterThan(4);

      await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('instancesDB');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('instances', 'readwrite');
          const store = transaction.objectStore('instances');
          const getAll = store.getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            const records = getAll.result.slice(0, 6) as Array<Record<string, unknown>>;
            records.forEach((record, index) => {
              store.put({
                ...record,
                is_caught: index < 3,
                is_for_trade: index < 3,
                is_wanted: index >= 3,
                most_wanted: index === 3,
                registered: true,
                status: index < 3 ? 'trade' : 'wanted',
              });
            });
          };
          transaction.oncomplete = () => {
            db.close();
            window.localStorage.setItem('ownershipTimestamp', String(Date.now()));
            window.localStorage.removeItem('tagsTimestamp');
            resolve();
          };
          transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
      }));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pokemon-card[role="button"]').first()).toBeVisible({ timeout: 30_000 });
      await openActionMenu(page, testInfo.project.name);
      await page.getByRole('button', { name: 'Share Trade Board' }).click();
      await expect(page).toHaveURL(/\/trade-board$/);

      const workspace = page.getByRole('region', { name: 'Share your Trade Board' });
      await expect(workspace).toBeVisible();
      await expect(workspace.getByText('3 Pokémon').first()).toBeVisible();
      await expect(workspace.getByText('3 Pokémon').last()).toBeVisible();
      await expect(workspace.getByAltText("QR code for this trainer's live trade board").first()).toBeVisible();
      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        workspace: document.querySelector('.trade-board-composer')?.getBoundingClientRect(),
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.workspace?.width).toBeLessThanOrEqual(layout.viewportWidth);

      const actionDock = workspace.locator('.trade-board-composer__footer');
      if (mobileProject) {
        await expect(actionDock).toBeInViewport();
        await expect(actionDock).toHaveCSS('position', 'fixed');
        const [dockBox, menuButtonBox] = await Promise.all([
          actionDock.boundingBox(),
          page.locator('.action-menu-button').boundingBox(),
        ]);
        expect(dockBox).toBeTruthy();
        expect(menuButtonBox).toBeTruthy();
        expect((dockBox?.y ?? 0) + (dockBox?.height ?? 0)).toBeLessThanOrEqual(
          (menuButtonBox?.y ?? 0) - 4,
        );
      } else {
        await expect(actionDock).not.toHaveCSS('position', 'fixed');
      }

      await workspace.getByRole('button', { name: /Nexus Light/ }).click();
      await expect(workspace.locator('.trade-board').first()).toHaveAttribute('data-theme', 'brand-light');
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      await expect
        .poll(() => workspace.evaluate((element) => window.getComputedStyle(element).backgroundColor))
        .toBe('rgb(248, 255, 249)');

      const downloadPromise = page.waitForEvent('download');
      await workspace.getByRole('button', { name: 'Download PNG' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^pokegonexus-BoardTrainer-trade-board-\d{4}-\d{2}-\d{2}\.png$/);
      const downloadedPath = await download.path();
      expect(downloadedPath).toBeTruthy();
      const exportPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(exportPath);
      expect(statSync(exportPath).size).toBeGreaterThan(20_000);
      await testInfo.attach('exported-trade-board.png', {
        contentType: 'image/png',
        path: exportPath,
      });

      const pageHeight = await page.evaluate(() => ({
        builderBottom: document.querySelector('.trade-board-builder-page')?.getBoundingClientRect().bottom,
        documentHeight: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
      }));
      expect(pageHeight.documentHeight).toBeLessThanOrEqual(
        Math.ceil((pageHeight.builderBottom ?? 0) + pageHeight.scrollY) + 2,
      );

      const screenshotPath = testInfo.outputPath(
        mobileProject ? 'trade-board-composer-mobile.png' : 'trade-board-composer-desktop.png',
      );
      await page.screenshot({ fullPage: true, path: screenshotPath });
      await testInfo.attach(
        mobileProject ? 'trade-board-composer-mobile.png' : 'trade-board-composer-desktop.png',
        {
          contentType: 'image/png',
          path: screenshotPath,
        },
      );
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
