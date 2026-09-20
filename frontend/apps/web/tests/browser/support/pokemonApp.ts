import { expect, type Locator, type Page } from '@playwright/test';

import { installE2eRoutes, type E2eRouteOptions } from './e2eRoutes';

const cardSelector = '.pokemon-card[role="button"]';

type LoadingProbeWindow = Window & {
  __e2eLoadingOverlaySeen?: boolean;
  __e2eLoadingOverlayObserver?: MutationObserver;
};

type GridOverlapSample = {
  first: string;
  second: string;
  overlapWidth: number;
  overlapHeight: number;
};

type GridLayoutProbeWindow = Window & {
  __e2ePokemonGridOverlapSamples?: GridOverlapSample[];
  __e2eStopPokemonGridLayoutProbe?: boolean;
};

type TouchPoint = {
  clientX: number;
  clientY: number;
};

export async function openPokemonPage(page: Page, routeOptions: E2eRouteOptions = {}) {
  await installE2eRoutes(page, routeOptions);

  const pokemonUrl = routeOptions.baseUrl
    ? new URL('/pokemon', routeOptions.baseUrl).href
    : '/pokemon';
  const response = await page.goto(pokemonUrl, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), '/pokemon document response should be OK').toBe(true);

  const firstCard = page.locator(cardSelector).first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.pokemon-grid-cell.visible').first()).toBeVisible();
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);

  return { firstCard };
}

export async function openCaughtPokemonList(
  page: Page,
  routeOptions: E2eRouteOptions = {},
) {
  await openPokemonPage(page, routeOptions);
  await expect
    .poll(() => countIndexedDbStore(page, 'instancesDB', 'instances'))
    .toBeGreaterThan(0);

  // The app can finish an in-flight IndexedDB reconciliation between the
  // count probe and this write. Retry the idempotent update so workflow-only
  // performance runs cannot fail on that narrow clear-and-repopulate window.
  await expect
    .poll(() => markFirstInstancesCaught(page, 12), { timeout: 10_000 })
    .toBeGreaterThan(0);

  const pokemonUrl = routeOptions.baseUrl
    ? new URL('/pokemon', routeOptions.baseUrl).href
    : '/pokemon';
  const response = await page.goto(pokemonUrl, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), '/pokemon reload response should be OK').toBe(true);
  await expect(page.locator(cardSelector).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);

  await page.getByText('TAGS', { exact: true }).click();
  await expectActivePokemonView(page, 'TAGS');
  const caughtTag = page.locator('.tag-item[data-tag="Caught"]');
  await expect(caughtTag.locator('.tag-subtitle')).toContainText(
    /[1-9]\d* Pokémon have this tag\./,
  );
  await caughtTag.click();
  await expectActivePokemonView(page, 'Pokémon');

  const firstCaughtCard = page.locator(cardSelector).first();
  await expect(firstCaughtCard).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.pokemon-grid-cell.visible').first()).toBeVisible();
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);

  return { firstCaughtCard };
}

export async function expectActivePokemonView(page: Page, label: string | RegExp) {
  await expect(
    page.locator('.toggle-text.active').filter({ hasText: label }).first(),
  ).toBeVisible();
}

export async function installLoadingOverlayProbe(page: Page) {
  await page.evaluate(() => {
    const targetWindow = window as LoadingProbeWindow;
    targetWindow.__e2eLoadingOverlayObserver?.disconnect();
    targetWindow.__e2eLoadingOverlaySeen = Boolean(
      document.querySelector('.app-loading-overlay'),
    );

    targetWindow.__e2eLoadingOverlayObserver = new MutationObserver(() => {
      if (document.querySelector('.app-loading-overlay')) {
        targetWindow.__e2eLoadingOverlaySeen = true;
      }
    });
    targetWindow.__e2eLoadingOverlayObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

export async function expectNoLoadingOverlaySeen(page: Page) {
  await page.waitForTimeout(250);
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as LoadingProbeWindow).__e2eLoadingOverlaySeen),
      ),
    )
    .toBe(false);
}

export async function disconnectLoadingOverlayProbe(page: Page) {
  await page.evaluate(() => {
    const targetWindow = window as LoadingProbeWindow;
    targetWindow.__e2eLoadingOverlayObserver?.disconnect();
    delete targetWindow.__e2eLoadingOverlayObserver;
    delete targetWindow.__e2eLoadingOverlaySeen;
  });
}

export async function installPokemonGridLayoutProbe(page: Page) {
  await page.addInitScript(() => {
    const targetWindow = window as GridLayoutProbeWindow;
    targetWindow.__e2ePokemonGridOverlapSamples = [];
    targetWindow.__e2eStopPokemonGridLayoutProbe = false;

    const describeCard = (element: Element, index: number) =>
      element.getAttribute('aria-label') || `card-${index}`;

    const isInActiveSliderPanel = (element: Element) => {
      const container = document.querySelector<HTMLElement>('.view-slider-container');
      const panel = element.closest<HTMLElement>('.slider-panel');
      if (!container || !panel) return true;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const visibleWidth =
        Math.min(panelRect.right, containerRect.right) -
        Math.max(panelRect.left, containerRect.left);
      const visibleHeight =
        Math.min(panelRect.bottom, containerRect.bottom) -
        Math.max(panelRect.top, containerRect.top);

      return (
        visibleWidth > containerRect.width * 0.5 &&
        visibleHeight > containerRect.height * 0.5
      );
    };

    const intersectsViewport = (rect: DOMRect) => {
      const container = document.querySelector<HTMLElement>('.view-slider-container');
      const bounds = container?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };

      return (
        rect.right > bounds.left &&
        rect.left < bounds.right &&
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom
      );
    };

    const sample = () => {
      const target = window as GridLayoutProbeWindow;
      if (target.__e2eStopPokemonGridLayoutProbe) return;

      if (document.querySelector('.app-loading-overlay')) {
        window.requestAnimationFrame(sample);
        return;
      }

      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('.pokemon-grid-cell.visible .pokemon-card'),
      )
        .map((element, index) => {
          const cell = element.closest<HTMLElement>('.pokemon-grid-cell');
          const cellStyle = cell ? window.getComputedStyle(cell) : null;
          const cellOpacity = cellStyle ? Number(cellStyle.opacity) : 0;
          return {
            element,
            label: describeCard(element, index),
            rect: element.getBoundingClientRect(),
            cellOpacity,
            cellVisibility: cellStyle?.visibility,
          };
        })
        .filter(
          ({ element, rect, cellOpacity, cellVisibility }) =>
            cellOpacity > 0.95 &&
            cellVisibility === 'visible' &&
            rect.width > 0 &&
            rect.height > 0 &&
            intersectsViewport(rect) &&
            isInActiveSliderPanel(element),
        );

      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          const first = cards[i];
          const second = cards[j];
          const overlapWidth =
            Math.min(first.rect.right, second.rect.right) -
            Math.max(first.rect.left, second.rect.left);
          const overlapHeight =
            Math.min(first.rect.bottom, second.rect.bottom) -
            Math.max(first.rect.top, second.rect.top);

          if (overlapWidth > 2 && overlapHeight > 2) {
            target.__e2ePokemonGridOverlapSamples?.push({
              first: first.label,
              second: second.label,
              overlapWidth,
              overlapHeight,
            });
          }
        }
      }

      window.requestAnimationFrame(sample);
    };

    window.requestAnimationFrame(sample);
  });
}

export async function expectNoPokemonGridOverlapObserved(page: Page) {
  await page.evaluate(() => {
    (window as GridLayoutProbeWindow).__e2ePokemonGridOverlapSamples = [];
  });
  await page.waitForTimeout(250);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as GridLayoutProbeWindow).__e2ePokemonGridOverlapSamples ?? [],
      ),
    )
    .toEqual([]);
}

export async function disconnectPokemonGridLayoutProbe(page: Page) {
  await page.evaluate(() => {
    const targetWindow = window as GridLayoutProbeWindow;
    targetWindow.__e2eStopPokemonGridLayoutProbe = true;
  });
}

export async function expectVisiblePokemonCardsDoNotOverlap(page: Page) {
  await expect(page.locator('.pokemon-grid-cell.visible .pokemon-card').first()).toBeVisible();

  const overlaps = await page.evaluate(() => {
    const isInActiveSliderPanel = (element: Element) => {
      const container = document.querySelector<HTMLElement>('.view-slider-container');
      const panel = element.closest<HTMLElement>('.slider-panel');
      if (!container || !panel) return true;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const visibleWidth =
        Math.min(panelRect.right, containerRect.right) -
        Math.max(panelRect.left, containerRect.left);
      const visibleHeight =
        Math.min(panelRect.bottom, containerRect.bottom) -
        Math.max(panelRect.top, containerRect.top);

      return (
        visibleWidth > containerRect.width * 0.5 &&
        visibleHeight > containerRect.height * 0.5
      );
    };

    const intersectsViewport = (rect: DOMRect) => {
      const container = document.querySelector<HTMLElement>('.view-slider-container');
      const bounds = container?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };

      return (
        rect.right > bounds.left &&
        rect.left < bounds.right &&
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom
      );
    };

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.pokemon-grid-cell.visible .pokemon-card'),
    )
      .map((element, index) => ({
        element,
        label: element.getAttribute('aria-label') || `card-${index}`,
        rect: element.getBoundingClientRect(),
      }))
      .filter(
        ({ element, rect }) =>
          rect.width > 0 &&
          rect.height > 0 &&
          intersectsViewport(rect) &&
          isInActiveSliderPanel(element),
      );

    const found: GridOverlapSample[] = [];
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const first = cards[i];
        const second = cards[j];
        const overlapWidth =
          Math.min(first.rect.right, second.rect.right) -
          Math.max(first.rect.left, second.rect.left);
        const overlapHeight =
          Math.min(first.rect.bottom, second.rect.bottom) -
          Math.max(first.rect.top, second.rect.top);

        if (overlapWidth > 2 && overlapHeight > 2) {
          found.push({
            first: first.label,
            second: second.label,
            overlapWidth,
            overlapHeight,
          });
        }
      }
    }
    return found;
  });

  expect(
    overlaps,
    `visible Pokemon cards should not overlap:\n${JSON.stringify(overlaps, null, 2)}`,
  ).toEqual([]);
}

export async function dispatchTouchSwipe(
  locator: Locator,
  start: TouchPoint,
  end: TouchPoint,
) {
  const middle = {
    clientX: Math.round((start.clientX + end.clientX) / 2),
    clientY: Math.round((start.clientY + end.clientY) / 2),
  };

  await dispatchTouch(locator, 'touchstart', start);
  await dispatchTouch(locator, 'touchmove', middle);
  await dispatchTouch(locator, 'touchmove', end);
  await dispatchTouch(locator, 'touchend', end, true);
}

export async function dispatchTouchLongPress(
  locator: Locator,
  holdMilliseconds = 350,
) {
  const box = await locator.boundingBox();
  expect(box, 'long-press target should be measurable').not.toBeNull();
  if (!box) return;

  const point = {
    clientX: Math.round(box.x + box.width / 2),
    clientY: Math.round(box.y + box.height / 2),
  };

  await dispatchTouch(locator, 'touchstart', point);
  await locator.page().waitForTimeout(holdMilliseconds);
  await dispatchTouch(locator, 'touchend', point, true);
}

async function dispatchTouch(
  locator: Locator,
  type: 'touchstart' | 'touchmove' | 'touchend',
  point: TouchPoint,
  end = false,
) {
  const touch = {
    identifier: 1,
    clientX: point.clientX,
    clientY: point.clientY,
    pageX: point.clientX,
    pageY: point.clientY,
    screenX: point.clientX,
    screenY: point.clientY,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    force: 1,
  };

  await locator.dispatchEvent(type, {
    touches: end ? [] : [touch],
    targetTouches: end ? [] : [touch],
    changedTouches: [touch],
    bubbles: true,
    cancelable: true,
  });
}

export async function countIndexedDbStore(
  page: Page,
  dbName: string,
  storeName: string,
) {
  return page.evaluate(
    ({ dbName: targetDbName, storeName: targetStoreName }) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(targetDbName);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(targetStoreName)) {
            db.close();
            resolve(0);
            return;
          }

          const tx = db.transaction(targetStoreName, 'readonly');
          const countRequest = tx.objectStore(targetStoreName).count();
          countRequest.onerror = () => {
            db.close();
            reject(countRequest.error);
          };
          countRequest.onsuccess = () => {
            const count = countRequest.result;
            db.close();
            resolve(count);
          };
        };
      }),
    { dbName, storeName },
  );
}

async function markFirstInstancesCaught(page: Page, limit: number) {
  return page.evaluate(
    ({ limit: maxInstances }) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('instancesDB');

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('instances')) {
            db.close();
            resolve(0);
            return;
          }

          const tx = db.transaction('instances', 'readwrite');
          const store = tx.objectStore('instances');
          const getAllRequest = store.getAll();
          let caughtCount = 0;

          getAllRequest.onerror = () => {
            db.close();
            reject(getAllRequest.error);
          };

          getAllRequest.onsuccess = () => {
            const instances = getAllRequest.result
              .filter(
                (entry): entry is Record<string, unknown> =>
                  Boolean(
                    entry &&
                      typeof entry === 'object' &&
                      typeof entry.instance_id === 'string' &&
                      typeof entry.variant_id === 'string',
                  ),
              )
              .slice(0, maxInstances);
            caughtCount = instances.length;

            for (const instance of instances) {
              store.put({
                ...instance,
                is_caught: true,
                registered: true,
                status: 'caught',
              });
            }
          };

          tx.oncomplete = () => {
            db.close();
            window.localStorage.setItem('ownershipTimestamp', String(Date.now()));
            window.localStorage.removeItem('tagsTimestamp');
            resolve(caughtCount);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { limit },
  );
}
