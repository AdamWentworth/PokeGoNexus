import { expect, test, type Page } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const partnerInstance = {
  instance_id: 'partner-bulbasaur',
  user_id: 'search-partner-user',
  variant_id: '0001-default',
  pokemon_id: 1,
  is_caught: true,
  is_for_trade: true,
  disabled: false,
};

const searchResult = {
  ...partnerInstance,
  username: 'catalog-trainer',
  distance: 1.2,
  wanted_list: {},
};

async function triggerBrowserBack(page: Page) {
  await page.evaluate(() => window.history.back());
  await page.waitForTimeout(350);
}

test('restores completed results after stepping back through a listing overlay', async ({
  page,
}, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  let searchRequests = 0;

  try {
    await page.addInitScript(() => {
      localStorage.setItem(
        'user',
        JSON.stringify({
          user_id: 'search-owner-user',
          username: 'search-owner',
          email: 'search-owner@example.invalid',
          accessTokenExpiry: '2099-01-01T00:00:00.000Z',
          refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
        }),
      );
    });
    await installE2eRoutes(page, {
      pokemonCatalogDelayMs: 1_000,
      searchResults: [searchResult],
      locationSuggestions: [
        {
          displayName: 'Burnaby, British Columbia, Canada',
          latitude: 49.2488,
          longitude: -122.9805,
          boundary: null,
        },
      ],
      userInstances: {
        username: 'catalog-trainer',
        instances: {
          [partnerInstance.instance_id]: partnerInstance,
        },
      },
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/search/searchPokemon')) {
        searchRequests += 1;
      }
    });

    await page.goto('/search');
    const perfTelemetryButton = page.getByRole('button', {
      name: /Perf telemetry/i,
    });
    if (await perfTelemetryButton.isVisible().catch(() => false)) {
      await perfTelemetryButton.evaluate((button) => button.parentElement?.remove());
    }
    const pokemonInput = page.getByRole('combobox', { name: 'Pokémon' });
    await expect(pokemonInput).toBeVisible({ timeout: 30_000 });
    await pokemonInput.fill('Bulb');
    const bulbasaurOption = page.getByRole('option', { name: /Bulbasaur/i }).first();
    // Catalog delivery is deliberately delayed so this workflow proves typed
    // autocomplete text recovers when hydration finishes after input begins.
    await expect(bulbasaurOption).toBeVisible({ timeout: 30_000 });
    await bulbasaurOption.click();
    await page.getByRole('button', { name: 'For Trade', exact: true }).click();
    await page.getByRole('button', { name: /Location/i }).click();
    await page.getByPlaceholder('Search for a city').fill('Burnaby');
    await page
      .getByRole('button', { name: 'Burnaby, British Columbia, Canada' })
      .click();
    await page.getByRole('button', { name: 'Apply and search' }).click();
    await expect(page.locator('.search-filter-sheet')).toHaveCount(0);
    // Let the sheet's same-route history guard fully unwind before opening a
    // result, matching the point at which the closing motion has settled.
    await page.waitForTimeout(350);

    const resultRegion = page.getByRole('region', {
      name: 'Pokémon search results',
    });
    await expect(resultRegion.getByText('catalog-trainer')).toBeVisible();
    await expect(resultRegion.getByText('1 result')).toBeVisible();
    expect(searchRequests).toBe(1);

    await resultRegion.getByRole('button', { name: 'Open listing' }).click();
    await expect(page).toHaveURL(/\/pokemon\/catalog-trainer\?filter=trade$/);
    const listingOverlay = page.locator('.instance-overlay.trade-mode');
    await expect(listingOverlay).toBeVisible({ timeout: 30_000 });

    await triggerBrowserBack(page);
    await expect(page).toHaveURL(/\/pokemon\/catalog-trainer\?filter=trade$/);
    await expect(listingOverlay).toHaveCount(0);

    await triggerBrowserBack(page);
    await expect(page).toHaveURL(/\/search$/);
    await expect(
      page.getByRole('region', { name: 'Pokémon search results' }).getByText(
        'catalog-trainer',
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Current Pokémon search')).toContainText(
      'Bulbasaur',
    );
    await expect(page.getByLabel('Current Pokémon search')).toContainText(
      'For Trade',
    );
    expect(searchRequests).toBe(1);
  } finally {
    await diagnostics.flush();
  }

  expect(
    diagnostics.blockingErrors(),
    'search/listing history should not produce browser runtime errors',
  ).toEqual([]);
});
