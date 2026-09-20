import path from 'node:path';

import { expect, test } from '@playwright/test';

const appearanceCssPath = path.resolve(
  process.cwd(),
  '../../packages/app-core/src/pages/Search/SearchParameters/AppearanceFilters.css',
);
const pokemonArtworkCssPath = path.resolve(
  process.cwd(),
  '../../packages/app-core/src/components/pokemonComponents/PokemonArtwork.css',
);

const intrinsicImage =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><circle cx="120" cy="120" r="110" fill="gold"/></svg>',
  );

test.describe('reusable Pokémon artwork layout', () => {
  test('contains intrinsic Max artwork and anchors its badge to the artwork box', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          <main class="appearance-preview">
            <div class="pokemon-artwork appearance-preview__artwork">
              <img
                alt="Gigantamax Pokémon"
                class="pokemon-artwork__image appearance-preview__pokemon"
                src="${intrinsicImage}"
              />
              <img
                alt="Gigantamax"
                class="pokemon-artwork__max-badge"
                src="${intrinsicImage}"
              />
            </div>
          </main>
        </body>
      </html>
    `);

    // Load the reusable stylesheet last to prove its defaults cannot override
    // the size chosen by the consuming preview.
    await page.addStyleTag({ path: appearanceCssPath });
    await page.addStyleTag({ path: pokemonArtworkCssPath });

    const layout = await page.evaluate(() => {
      const frame = document.querySelector('.appearance-preview');
      const artwork = document.querySelector('.pokemon-artwork');
      const pokemon = document.querySelector('.pokemon-artwork__image');
      const badge = document.querySelector('.pokemon-artwork__max-badge');
      if (!frame || !artwork || !pokemon || !badge) {
        throw new Error('Artwork fixture did not render expected elements');
      }

      const toBounds = (element: Element) => {
        const bounds = element.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
        };
      };

      return {
        artwork: toBounds(artwork),
        badge: toBounds(badge),
        frame: toBounds(frame),
        pokemon: toBounds(pokemon),
      };
    });

    expect(layout.artwork.width).toBeCloseTo(156, 0);
    expect(layout.artwork.height).toBeCloseTo(156, 0);
    expect(layout.pokemon.width).toBeCloseTo(layout.artwork.width, 0);
    expect(layout.pokemon.height).toBeCloseTo(layout.artwork.height, 0);
    expect(layout.badge.width).toBeCloseTo(layout.artwork.width * 0.28, 0);
    expect(layout.artwork.left).toBeGreaterThan(layout.frame.left);
    expect(layout.artwork.right).toBeLessThan(layout.frame.right);
    expect(layout.badge.top).toBeGreaterThanOrEqual(layout.artwork.top);
    expect(layout.badge.right).toBeLessThanOrEqual(layout.artwork.right);
    expect(layout.badge.bottom).toBeLessThan(layout.artwork.bottom);
  });
});
