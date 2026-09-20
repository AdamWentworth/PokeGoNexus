import { expect, test, type Page } from '@playwright/test';

import { openActionMenu } from './support/actionMenu';
import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const maxUser = {
  user_id: 'max-user',
  username: 'MaxTrainer',
  email: 'max@pokegonexus.local',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const caughtDynamaxBulbasaur = {
  instance_id: 'max-bulbasaur',
  variant_id: '0001-dynamax',
  pokemon_id: 1,
  nickname: 'Sprout',
  is_caught: true,
  disabled: false,
  registered: true,
  cp: 927,
  level: 30,
  attack_iv: 15,
  defense_iv: 13,
  stamina_iv: 12,
  fast_move_id: 15,
  charged_move1_id: 133,
  charged_move2_id: null,
  shiny: false,
  dynamax: true,
  gigantamax: false,
  crown: false,
  max_attack: 2,
  max_guard: 1,
  max_spirit: 3,
};

const caughtGigantamaxVenusaur = {
  instance_id: 'max-venusaur',
  variant_id: '0003-default',
  pokemon_id: 3,
  nickname: 'G-Max Garden',
  is_caught: true,
  disabled: false,
  registered: true,
  cp: 2_721,
  level: 40,
  attack_iv: 15,
  defense_iv: 15,
  stamina_iv: 14,
  fast_move_id: 15,
  charged_move1_id: 90,
  charged_move2_id: null,
  shiny: false,
  dynamax: true,
  gigantamax: true,
  crown: false,
  max_attack: 3,
  max_guard: 2,
  max_spirit: 2,
};

async function seedMaxRoster(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ user, caught }) =>
      new Promise<void>((resolve, reject) => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('ownershipTimestamp', String(Date.now()));

        const request = indexedDB.open('instancesDB', 2);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('instances')) {
            database.createObjectStore('instances', { keyPath: 'instance_id' });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('instances', 'readwrite');
          const store = transaction.objectStore('instances');
          store.clear();
          caught.forEach((instance) => store.put(instance));
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
    {
      user: maxUser,
      caught: [caughtDynamaxBulbasaur, caughtGigantamaxVenusaur],
    },
  );
}

test.describe('Max Battles page', () => {
  test('opens from the action menu and supports rankings and boss teams', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      await page.goto('/');

      await openActionMenu(page, testInfo.project.name);
      const menu = page.locator('.action-menu-overlay[data-menu-state="open"]');
      await expect(menu).toBeVisible();
      await expect(menu.locator('.action-menu-item')).toHaveCount(9);
      await page.waitForTimeout(350);

      const menuLayout = await menu.locator('.action-menu-item').evaluateAll((items) => ({
        viewport: { width: window.innerWidth, height: window.innerHeight },
        items: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            className: item.className,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
          };
        }),
      }));
      const home = menuLayout.items.find((item) => item.className.includes('button-home'));
      const max = menuLayout.items.find((item) => item.className.includes('button-max'));
      expect(home).toBeDefined();
      expect(max).toBeDefined();
      expect(Math.abs((home?.centerX ?? 0) - menuLayout.viewport.width / 2)).toBeLessThan(2);
      expect(Math.abs((home?.centerY ?? 0) - menuLayout.viewport.height / 2)).toBeLessThan(2);
      expect(Math.abs((max?.centerX ?? 0) - (home?.centerX ?? 0))).toBeLessThan(2);
      expect((max?.centerY ?? 0) > (home?.centerY ?? 0)).toBe(true);

      for (const [index, item] of menuLayout.items.entries()) {
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeLessThanOrEqual(menuLayout.viewport.width);

        for (const other of menuLayout.items.slice(index + 1)) {
          const overlaps =
            item.left < other.right &&
            item.right > other.left &&
            item.top < other.bottom &&
            item.bottom > other.top;
          expect(overlaps, `${item.className} should not overlap ${other.className}`).toBe(false);
        }
      }

      await page.getByRole('button', { name: 'Max Battles' }).click();
      await expect(page).toHaveURL(/\/max$/);
      await expect(page.getByRole('heading', { name: 'Max Battles' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'All Pokémon' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByRole('button', { name: 'My Pokémon' })).toBeDisabled();
      await expect(page.getByRole('heading', { name: 'Top damage dealers' })).toBeVisible();
      await expect(page.getByLabel('Ranking assumptions')).toContainText(
        'Level 50 · 15/15/15 IVs · Max Moves Level 3',
      );
      await expect(page.locator('.max-ranking-row').first()).toBeVisible();
      await expect(page.getByText('Attack index').first()).toBeVisible();
      const firstMoveset = page.locator('.max-ranking-fast-move').first();
      await expect(firstMoveset).toBeVisible();
      await expect(firstMoveset.getByText('Fast')).toBeVisible();
      await expect(firstMoveset.getByText('Charged')).toHaveCount(0);
      await expect(page.getByText('Damage rating')).toHaveCount(0);
      await expect(page.locator('.max-ranking-row')).toHaveCount(18);
      const showMoreRankings = page.getByRole('button', {
        name: /Show \d+ more/,
      });
      await expect(showMoreRankings).toBeVisible();
      await showMoreRankings.click();
      expect(await page.locator('.max-ranking-row').count()).toBeGreaterThan(18);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await page.getByRole('button', { name: 'Tank' }).click();
      await expect(page.getByRole('button', { name: 'Tank' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByRole('button', { name: 'Water' }).click();
      await expect(page.getByRole('heading', { name: 'Top tanks vs Water' })).toBeVisible();
      await expect.poll(() => new URL(page.url()).searchParams.get('role')).toBe('tank');
      await expect.poll(() => new URL(page.url()).searchParams.get('type')).toBe('water');

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Top tanks vs Water' })).toBeVisible();

      await page.getByRole('button', { name: 'Boss teams' }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('bosses');
      await expect(
        page.getByRole('heading', {
          name: 'Can this group beat Dynamax Bulbasaur?',
        }),
      ).toBeVisible();
      await expect(page.getByText('Estimated profile')).toBeVisible();
      await expect(page.getByLabel('Trainer count')).toHaveValue('1');
      await expect(page.locator('.max-simulator-verdict')).toContainText('Likely clear');
      await page.getByRole('button', { name: 'Add one Trainer' }).click();
      await expect(page.getByLabel('Trainer count')).toHaveValue('2');
      await expect.poll(() => new URL(page.url()).searchParams.get('trainers')).toBe('2');
      await page.reload();
      await expect(page.getByLabel('Trainer count')).toHaveValue('2');

      await page.getByText('Advanced setup', { exact: true }).click();
      await expect(page.getByText('Charge plan', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Modeled outcome range')).toContainText(
        'Standard:',
      );
      await expect(page.getByLabel('Modeled outcome range')).toContainText('Stress:');
      await expect(page.getByLabel('Max Battle execution')).toHaveValue('standard');
      await page.getByLabel('Max Battle execution').selectOption('stress-test');
      await expect(page.getByText(/Miss orbs and targeted dodges/i)).toBeVisible();
      await expect(page.getByLabel('Boss HP estimate')).toBeVisible();
      await expect(page.getByLabel('Boss HP estimate')).toHaveValue('1700');
      await page.getByLabel('Max Battle difficulty').selectOption('three-star');
      await expect(page.getByLabel('Boss HP estimate')).toHaveValue('10000');
      const modeledDamageAtTwo = await page
        .locator('.max-simulator-verdict strong')
        .textContent();
      await page.getByRole('button', { name: 'Remove one Trainer' }).click();
      await expect(page.getByLabel('Trainer count')).toHaveValue('1');
      await expect(page.locator('.max-simulator-verdict strong')).not.toHaveText(
        modeledDamageAtTwo ?? '',
      );
      await expect
        .poll(() => new URL(page.url()).searchParams.get('difficulty'))
        .toBe('three-star');
      await expect(page.getByLabel('Recommended three-Pokémon party')).toBeVisible();
      await expect(
        page.getByLabel('Recommended three-Pokémon party').locator('article'),
      ).toHaveCount(3);
      await expect(page.getByLabel('Damage team member')).toBeVisible();
      await expect(page.getByLabel('Tank team member')).toBeVisible();
      await expect(page.getByLabel('Healing team member')).toBeVisible();
      await expect(page.locator('.max-simulator-verdict')).toContainText(
        /modeled damage/i,
      );
      await expect(page.getByLabel('Boss ranking method')).toContainText(
        'Standardized matchup',
      );
      await expect(page.getByLabel('Boss ranking method')).toContainText(
        'expected pressure across legal boss movesets',
      );
      await expect(
        page.getByRole('region', { name: 'Boss team role', exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Role alternatives')).toBeVisible();
      await expect(page.locator('.max-ranking-row')).toHaveCount(3);
      const showMoreBossPicks = page.getByRole('button', { name: /Show \d+ more/ });
      await expect(showMoreBossPicks).toBeVisible();
      await showMoreBossPicks.click();
      expect(await page.locator('.max-ranking-row').count()).toBeGreaterThan(3);
      await expect(page.getByText('Max cycles').first()).toBeVisible();
      await expect(page.getByText('Next Max').first()).toBeVisible();
      await expect(page.getByText('With Guard').first()).toBeVisible();

      await page.getByRole('button', { name: 'Damage' }).click();
      await expect(page.getByText('Max hit').first()).toBeVisible();
      await expect(page.locator('.max-ranking-row')).toHaveCount(3);

      await page.getByRole('button', { name: 'Healing' }).click();
      await expect(page.getByText('Spirit L3 / ally').first()).toBeVisible();
      await expect(page.getByText('All 4 active').first()).toBeVisible();
      await expect(page.locator('.max-ranking-row')).toHaveCount(3);
      await expect(page.getByText('Tank rating')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('slides between standardized and caught Max rankings', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      await seedMaxRoster(page);
      const pokemonDataRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/pokemon/')) {
          pokemonDataRequests.push(request.url());
        }
      });
      await page.goto('/max');

      await expect(page.getByRole('button', { name: 'My Pokémon' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByLabel('Ranking assumptions')).toContainText(
        'Recorded level · recorded IVs · recorded Fast Move · unlocked Max Move levels',
      );
      await expect(page.getByText('Sprout')).toBeVisible();
      await expect(page.getByText('G-Max Garden')).toBeVisible();
      await expect(page.getByText('G-Max Vine Lash').first()).toBeVisible();
      expect(
        pokemonDataRequests.some((url) => url.includes('/pokemon/max-data')),
      ).toBe(true);
      // Owned crowned Pokémon need their original species from the base catalog.
      expect(
        pokemonDataRequests.some((url) => url.includes('/pokemon/catalog')),
      ).toBe(true);
      await expect(page.getByText('CP 927 · Level 30 · 89% IV')).toBeVisible();
      await expect(page.locator('[data-roster-scope="owned"]')).toHaveClass(
        /max-scope-stage--forward/,
      );

      await page.getByRole('button', { name: 'Tank' }).click();
      await page.getByRole('button', { name: 'All Pokémon' }).click();

      await expect(page.getByRole('heading', { name: 'Top tanks' })).toBeVisible();
      await expect(page.locator('[data-roster-scope="catalog"]')).toHaveClass(
        /max-scope-stage--backward/,
      );
      await expect.poll(() => new URL(page.url()).searchParams.get('scope')).toBe(
        'catalog',
      );
      await expect(page.getByLabel('Ranking assumptions')).toContainText(
        'Level 50 · 15/15/15 IVs · Max Moves Level 3',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
