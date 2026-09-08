import { expect, type Page, type Route, test } from '@playwright/test';

import { openActionMenu } from './support/actionMenu';
import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';
import {
  countIndexedDbStore,
  disconnectPokemonGridLayoutProbe,
  disconnectLoadingOverlayProbe,
  dispatchTouchLongPress,
  dispatchTouchSwipe,
  expectActivePokemonView,
  expectNoPokemonGridOverlapObserved,
  expectNoLoadingOverlaySeen,
  expectVisiblePokemonCardsDoNotOverlap,
  installPokemonGridLayoutProbe,
  installLoadingOverlayProbe,
  openCaughtPokemonList,
  openPokemonPage,
} from './support/pokemonApp';

async function triggerBrowserBack(page: Page) {
  await page.evaluate(() => {
    window.history.back();
  });
  await page.waitForTimeout(350);
}

async function getDocumentScrollTop(page: Page) {
  return page.evaluate(
    () =>
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0,
  );
}

async function getElementTop(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => element.getBoundingClientRect().top);
}

test.describe('pokemon app browser regressions', () => {
  test('settles a touch tag drag into an exact slot after release', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPokemonPage(page);
    await page.getByText('TAGS', { exact: true }).click();
    await expectActivePokemonView(page, 'TAGS');

    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
    const sourceHandle = page.getByRole('button', {
      name: /press and drag for trade to reorder/i,
    });
    const targetCard = page.locator('.tag-item[data-tag="Caught"]');
    await expect(sourceHandle).toBeVisible();
    await expect(targetCard).toBeVisible();

    const sourceBounds = await sourceHandle.boundingBox();
    const targetBounds = await targetCard.boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    const pointerId = 41;
    const targetPoint = {
      x: (targetBounds?.x ?? 0) + (targetBounds?.width ?? 0) / 2,
      y: (targetBounds?.y ?? 0) + 4,
    };

    await sourceHandle.dispatchEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: (sourceBounds?.x ?? 0) + (sourceBounds?.width ?? 0) / 2,
      clientY: (sourceBounds?.y ?? 0) + (sourceBounds?.height ?? 0) / 2,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    });
    await expect(page.locator('.tag-item-drag-preview')).toBeVisible();

    await page.evaluate(({ id, point }) => {
      document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: id,
        pointerType: 'touch',
      }));
    }, { id: pointerId, point: targetPoint });
    await expect(targetCard).toHaveAttribute('data-drop-position', 'before');

    await page.evaluate(({ id, point }) => {
      document.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: id,
        pointerType: 'touch',
      }));
    }, { id: pointerId, point: targetPoint });

    await expect(page.locator('.tag-item-drag-preview')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/tag-drag-active/);
    await expect
      .poll(() => page
        .locator('section[aria-label="Inventory tags"] .tag-item')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-tag'))))
      .toEqual(['Trade', 'Caught', 'Favorites']);
  });

  test('loads theme loading spinner WebM assets from shared media in every browser project', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      await page.route('**/__asset-probe', async (route) => {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><meta charset="utf-8"><title>asset probe</title>',
        });
      });
      await page.goto('/__asset-probe');

      const assetResults = await page.evaluate(async () => {
        type SpinnerVideoInspection = {
          src: string;
          byteLength: number;
          canDecodeWebM: boolean;
          width: number;
          height: number;
          cornerAlpha: number;
          lowAlphaPixels: number;
          maxAlpha: number;
        };

        const canDecodeWebM = Boolean(
          document.createElement('video').canPlayType('video/webm; codecs="vp9"') ||
            document.createElement('video').canPlayType('video/webm'),
        );

        const inspectVideo = async (src: string): Promise<SpinnerVideoInspection> => {
          const response = await fetch(src);
          const byteLength = (await response.arrayBuffer()).byteLength;
          if (!response.ok) {
            throw new Error(`Could not fetch ${src}: ${response.status}`);
          }

          if (!canDecodeWebM) {
            return {
              src,
              byteLength,
              canDecodeWebM,
              width: 0,
              height: 0,
              cornerAlpha: 0,
              lowAlphaPixels: 0,
              maxAlpha: 0,
            };
          }

          return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            // WebKit can report HAVE_ENOUGH_DATA for a detached video without
            // advancing or painting a frame. Exercise playback in the document,
            // just as the application's spinner does.
            video.width = 100;
            video.height = 100;
            document.body.append(video);

            let isDone = false;
            let timeoutId: number | undefined;

            const finish = (result: SpinnerVideoInspection) => {
              if (isDone) {
                return;
              }
              isDone = true;
              if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
              }
              video.pause();
              video.remove();
              resolve(result);
            };

            const fail = (error: Error) => {
              if (isDone) {
                return;
              }
              isDone = true;
              if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
              }
              video.pause();
              video.remove();
              reject(error);
            };

            timeoutId = window.setTimeout(
              () => fail(new Error(`Timed out while decoding ${src}`)),
              5_000,
            );

            const delay = (milliseconds: number) =>
              new Promise<void>((resolveDelay) => window.setTimeout(resolveDelay, milliseconds));

            const inspectCurrentFrame = (): SpinnerVideoInspection => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const context = canvas.getContext('2d');
              if (!context) {
                throw new Error('Could not inspect spinner video transparency');
              }

              context.drawImage(video, 0, 0);
              const imageData = context.getImageData(
                0,
                0,
                video.videoWidth,
                video.videoHeight,
              ).data;
              const cornerAlpha = context.getImageData(0, 0, 1, 1).data[3];
              let lowAlphaPixels = 0;
              let maxAlpha = 0;
              for (let index = 3; index < imageData.length; index += 4) {
                const alpha = imageData[index];
                if (alpha > 0 && alpha < 64) {
                  lowAlphaPixels += 1;
                }
                maxAlpha = Math.max(maxAlpha, alpha);
              }

              return {
                src,
                byteLength,
                canDecodeWebM,
                width: video.videoWidth,
                height: video.videoHeight,
                cornerAlpha,
                lowAlphaPixels,
                maxAlpha,
              };
            };

            video.onloadeddata = () => {
              void (async () => {
                try {
                  await video.play().catch(() => undefined);

                  let bestResult = inspectCurrentFrame();
                  for (let attempt = 0; attempt < 8 && bestResult.maxAlpha <= 200; attempt += 1) {
                    await delay(100);
                    const nextResult = inspectCurrentFrame();
                    if (nextResult.maxAlpha > bestResult.maxAlpha) {
                      bestResult = nextResult;
                    }
                  }

                  finish(bestResult);
                } catch (error) {
                  fail(error instanceof Error ? error : new Error(String(error)));
                }
              })();
            };
            video.onerror = () => {
              fail(new Error(`Could not decode ${src}`));
            };
            video.onabort = () => {
              if (!isDone) {
                fail(new Error(`Video load aborted for ${src}`));
              }
            };
            video.src = src;
            video.load();
          });
        };

        return Promise.all([
          inspectVideo('/media/media/loading_spinner.webm'),
          inspectVideo('/media/media/loading_spinner_light.webm'),
        ]);
      });

      expect(assetResults).toMatchObject([
        {
          src: '/media/media/loading_spinner.webm',
        },
        {
          src: '/media/media/loading_spinner_light.webm',
        },
      ]);
      for (const result of assetResults) {
        expect(result.byteLength).toBeGreaterThan(1_000);

        if (result.canDecodeWebM) {
          expect(result.width).toBeGreaterThanOrEqual(80);
          expect(result.height).toBeGreaterThanOrEqual(80);
          expect(result.maxAlpha).toBeGreaterThan(200);
        }
      }
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('renders the boot loading overlay as video-only shared media', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    let releasePokemonModule: () => void = () => undefined;
    const releaseBlockedPokemonModule = new Promise<void>((resolve) => {
      releasePokemonModule = resolve;
    });
    let resolvePokemonModuleRequested: () => void = () => undefined;
    const pokemonModuleRequested = new Promise<void>((resolve) => {
      resolvePokemonModuleRequested = resolve;
    });

    try {
      await installE2eRoutes(page);
      const blockPokemonRouteModule = async (route: Route) => {
        resolvePokemonModuleRequested();
        await releaseBlockedPokemonModule;
        await route.continue();
      };
      await page.route('**/src/pages/Pokemon/Pokemon.tsx*', async (route) => {
        await blockPokemonRouteModule(route);
      });
      await page.route(/\/assets\/Pokemon-[^/]+\.js(?:\?.*)?$/, async (route) => {
        await blockPokemonRouteModule(route);
      });

      const response = await page.goto('/pokemon', { waitUntil: 'commit' });
      expect(response?.ok(), '/pokemon document response should be OK').toBe(true);
      await pokemonModuleRequested;

      const overlay = page.locator('.app-loading-overlay');
      await expect(overlay).toBeVisible();
      await expect(overlay.locator('.loading-text')).toHaveCount(0);
      await expect(overlay.getByText(/^Loading/)).toHaveCount(0);

      const videos = overlay.locator('video.spinner-video');
      await expect(videos).toHaveCount(2);
      await expect(
        overlay.locator('source[src="/media/media/loading_spinner.webm"]'),
      ).toHaveCount(1);
      await expect(
        overlay.locator('source[src="/media/media/loading_spinner_light.webm"]'),
      ).toHaveCount(1);
      await expect(overlay.locator('source[src^="/assets/loading_spinner"]')).toHaveCount(0);

      const videoAttributes = await videos.evaluateAll((elements) =>
        elements.map((element) => {
          const video = element as HTMLVideoElement;
          return {
            ariaHidden: video.getAttribute('aria-hidden'),
            loop: video.loop,
            muted: video.muted,
            playsInline: video.hasAttribute('playsinline'),
            preload: video.preload,
            source: video.querySelector('source')?.getAttribute('src'),
            tabIndex: video.tabIndex,
          };
        }),
      );
      expect(videoAttributes).toEqual([
        {
          ariaHidden: 'true',
          loop: true,
          muted: true,
          playsInline: true,
          preload: 'auto',
          source: '/media/media/loading_spinner.webm',
          tabIndex: -1,
        },
        {
          ariaHidden: 'true',
          loop: true,
          muted: true,
          playsInline: true,
          preload: 'auto',
          source: '/media/media/loading_spinner_light.webm',
          tabIndex: -1,
        },
      ]);

      const visualLayerStyles = await overlay.locator('.spinner-visual-shell').evaluate(
        (shellElement) => {
          const shellStyle = window.getComputedStyle(shellElement);
          const videoStyles = Array.from(
            shellElement.querySelectorAll('video.spinner-video'),
          ).map((videoElement) => {
            const style = window.getComputedStyle(videoElement);
            return {
              backgroundColor: style.backgroundColor,
              boxShadow: style.boxShadow,
              filter: style.filter,
              objectFit: style.objectFit,
            };
          });

          return {
            shell: {
              backgroundColor: shellStyle.backgroundColor,
              boxShadow: shellStyle.boxShadow,
              filter: shellStyle.filter,
            },
            videos: videoStyles,
          };
        },
      );
      expect(visualLayerStyles).toEqual({
        shell: {
          backgroundColor: 'rgba(0, 0, 0, 0)',
          boxShadow: 'none',
          filter: 'none',
        },
        videos: [
          {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            boxShadow: 'none',
            filter: 'none',
            objectFit: 'contain',
          },
          {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            boxShadow: 'none',
            filter: 'none',
            objectFit: 'contain',
          },
        ],
      });
    } finally {
      releasePokemonModule();
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('switches between Pokemon menus without replaying the boot loading overlay', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);
      await expectActivePokemonView(page, 'Pokémon');
      await installLoadingOverlayProbe(page);

      await page.getByText('WISHLIST', { exact: true }).click();
      await expectActivePokemonView(page, 'WISHLIST');
      await expectNoLoadingOverlaySeen(page);

      await page.getByText('TAGS', { exact: true }).click();
      await expectActivePokemonView(page, 'TAGS');
      await expectNoLoadingOverlaySeen(page);

      await page.getByText('Pokémon', { exact: true }).click();
      await expectActivePokemonView(page, 'Pokémon');
      await expectNoLoadingOverlaySeen(page);
    } finally {
      await disconnectLoadingOverlayProbe(page);
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps the Pokemon grid scroll area bounded to the viewport', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);

      const metrics = await page.evaluate(() => {
        const wrapper = document.querySelector('.grid-wrapper');
        const container = document.querySelector('.grid-container');
        if (!wrapper || !container) {
          throw new Error('Pokemon grid did not render expected scroll elements');
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          wrapperHeight: wrapperRect.height,
          containerHeight: containerRect.height,
          wrapperOverflowY: window.getComputedStyle(wrapper).overflowY,
          containerOverflowY: window.getComputedStyle(container).overflowY,
        };
      });

      const expectedOffset = metrics.viewportWidth <= 480 ? 130 : 164;
      expect(
        Math.abs(metrics.wrapperHeight - (metrics.viewportHeight - expectedOffset)),
      ).toBeLessThanOrEqual(2);
      expect(metrics.containerHeight).toBeCloseTo(metrics.wrapperHeight, 0);
      expect(metrics.containerOverflowY).toBe('auto');
      expect(metrics.wrapperOverflowY).toBe('visible');
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps typed Pokemon menu search text visible without replaying the loader', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);
      await installLoadingOverlayProbe(page);

      const searchInput = page.locator('.search-input');
      await searchInput.click();
      await searchInput.pressSequentially('pi', { delay: 60 });
      await expect(searchInput).toHaveValue('pi');
      await expectNoLoadingOverlaySeen(page);
      await expect(page.getByRole('button', { name: /Select Pikachu/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Select Caterpie/i })).toHaveCount(0);

      const contrast = await searchInput.evaluate((element) => {
        const parseRgb = (value: string) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const [r, g, b] = match[1]
            .split(',')
            .slice(0, 3)
            .map((part) => Number.parseFloat(part.trim()));
          return [r, g, b] as const;
        };
        const luminance = ([r, g, b]: readonly number[]) => {
          const channels = [r, g, b].map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };

        const styles = window.getComputedStyle(element);
        const textRgb = parseRgb(styles.webkitTextFillColor || styles.color);
        const backgroundRgb = parseRgb(styles.backgroundColor);
        if (!textRgb || !backgroundRgb) {
          throw new Error(
            `Could not parse search input colors: text=${styles.color}, fill=${styles.webkitTextFillColor}, background=${styles.backgroundColor}`,
          );
        }

        const textLuminance = luminance(textRgb);
        const backgroundLuminance = luminance(backgroundRgb);
        const lighter = Math.max(textLuminance, backgroundLuminance);
        const darker = Math.min(textLuminance, backgroundLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      });

      expect(contrast).toBeGreaterThanOrEqual(4.5);
    } finally {
      await disconnectLoadingOverlayProbe(page);
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('selects catalog Pokemon on click or tap without opening the legacy Pokedex overlay', async ({
    page,
    isMobile,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);

      const catalogCard = page.getByRole('button', { name: /^Select / }).first();
      await expect(catalogCard).toBeVisible();

      if (isMobile) {
        await catalogCard.tap();
      } else {
        await catalogCard.click();
      }

      await expect(catalogCard).toHaveClass(/highlighted/);
      await expect(page.locator('.pokemon-overlay')).toHaveCount(0);
      await expect(page.locator('.highlight-action-container')).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('long-press selects the initiating instance before enabling mobile fast-select', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!isMobile, 'long-press selection coverage only runs on mobile browser projects');

    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      const { firstCaughtCard } = await openCaughtPokemonList(page);
      const secondCaughtCard = page.locator('.pokemon-card[role="button"]').nth(1);
      await expect(secondCaughtCard).toBeVisible();

      await dispatchTouchLongPress(firstCaughtCard);

      await expect(firstCaughtCard).toHaveClass(/highlighted/);
      await expect(page.locator('.instance-overlay')).toHaveCount(0);
      await expect(page.locator('.highlight-action-container')).toBeVisible();

      await secondCaughtCard.tap();
      await expect(secondCaughtCard).toHaveClass(/highlighted/);
      await expect(firstCaughtCard).toHaveClass(/highlighted/);
      await expect(page.locator('.instance-overlay')).toHaveCount(0);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps visible Pokemon cards non-overlapping through boot and refresh', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installPokemonGridLayoutProbe(page);
      await openPokemonPage(page);
      await expectVisiblePokemonCardsDoNotOverlap(page);
      await expectNoPokemonGridOverlapObserved(page);

      const response = await page.reload({ waitUntil: 'domcontentloaded' });
      expect(response?.ok(), '/pokemon reload response should be OK').toBe(true);
      await expect(page.locator('.pokemon-card[role="button"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('.pokemon-grid-cell.visible').first()).toBeVisible();
      await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
      await expectVisiblePokemonCardsDoNotOverlap(page);
      await expectNoPokemonGridOverlapObserved(page);
    } finally {
      await disconnectPokemonGridLayoutProbe(page).catch(() => undefined);
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('opens a caught instance overlay with scroll-safe layout', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      const { firstCaughtCard } = await openCaughtPokemonList(page);
      await firstCaughtCard.click();

      const overlay = page.locator('.instance-overlay.caught-mode');
      await expect(overlay).toBeVisible();
      await expect(page.locator('.caught-scroll')).toBeVisible();
      await expect(page.locator('.caught-instance')).toBeVisible();
      await expect(
        overlay.locator('.level-component'),
      ).toContainText(/Level:\s*N\/A/i);
      await expect(page.locator('.app-loading-overlay')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const overlay = document.querySelector('.instance-overlay.caught-mode');
        const scroll = document.querySelector('.caught-scroll');
        const column = document.querySelector('.caught-column');
        const content = document.querySelector('.caught-instance');
        if (!overlay || !scroll || !column || !content) {
          throw new Error('Caught overlay did not render expected elements');
        }

        return {
          viewportHeight: window.innerHeight,
          overlayHeight: overlay.getBoundingClientRect().height,
          scrollMinHeight: window.getComputedStyle(scroll).minHeight,
          scrollHeight: overlay.scrollHeight,
          clientHeight: overlay.clientHeight,
          columnWidth: column.getBoundingClientRect().width,
          contentWidth: content.getBoundingClientRect().width,
        };
      });

      expect(metrics.scrollMinHeight).not.toBe('100dvh');
      expect(metrics.overlayHeight).toBeGreaterThan(metrics.viewportHeight * 0.9);
      expect(metrics.clientHeight).toBeGreaterThan(0);
      expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight);
      expect(metrics.columnWidth).toBeGreaterThanOrEqual(metrics.contentWidth);

      await page.getByRole('button', { name: 'Close' }).click();
      await expect(overlay).toHaveCount(0);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps menu slide transition after closing a Pokemon overlay', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      const { firstCaughtCard } = await openCaughtPokemonList(page);
      await firstCaughtCard.click();

      const overlay = page.locator('.instance-overlay.caught-mode');
      await expect(overlay).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(overlay).toHaveCount(0);

      const slider = page.locator('.view-slider');
      await expect
        .poll(() =>
          slider.evaluate((element) => window.getComputedStyle(element).transitionProperty),
        )
        .toContain('transform');

      const sliderContainer = page.locator('.view-slider-container');
      const sliderWidth = await sliderContainer.evaluate((element) => element.clientWidth);
      const pokemonTransform = await slider.evaluate(
        (element) => (element as HTMLElement).style.transform,
      );

      await page.getByText('WISHLIST', { exact: true }).click();
      await expectActivePokemonView(page, 'WISHLIST');
      await expect
        .poll(() =>
          slider.evaluate((element) =>
            (element as HTMLElement).style.transform.replace(/\s+/g, ''),
          ),
        )
        .toBe(`translate3d(-${sliderWidth * 2}px,0px,0px)`);
      const transitionProperty = await slider.evaluate(
        (element) => window.getComputedStyle(element).transitionProperty,
      );
      const wishlistTransform = await slider.evaluate(
        (element) => (element as HTMLElement).style.transform,
      );
      expect(wishlistTransform).not.toBe(pokemonTransform);
      expect(transitionProperty).toContain('transform');
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps vertical caught overlay touches from switching menus on mobile', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!isMobile, 'touch scroll coverage only runs on mobile browser projects');

    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      const { firstCaughtCard } = await openCaughtPokemonList(page);
      await expectActivePokemonView(page, 'Pokémon');
      await firstCaughtCard.click();

      const overlay = page.locator('.instance-overlay.caught-mode');
      await expect(overlay).toBeVisible();
      await overlay.evaluate((element) => {
        const spacer = document.createElement('div');
        spacer.setAttribute('data-e2e-overlay-scroll-spacer', 'true');
        spacer.style.height = '480px';
        spacer.style.pointerEvents = 'none';
        const scrollContent =
          element.querySelector('.caught-column') ?? element.querySelector('.caught-scroll');
        (scrollContent ?? element).appendChild(spacer);
      });
      await expect
        .poll(() =>
          overlay.evaluate((element) => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop,
          })),
        )
        .toMatchObject({
          scrollTop: 0,
        });

      const scrollMetrics = await overlay.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

      const box = await overlay.boundingBox();
      expect(box, 'caught overlay should be measurable').not.toBeNull();
      if (!box) return;

      const x = Math.round(box.x + box.width * 0.5);
      await dispatchTouchSwipe(
        overlay,
        { clientX: x, clientY: Math.round(box.y + box.height * 0.78) },
        { clientX: x, clientY: Math.round(box.y + box.height * 0.24) },
      );

      await expect(overlay).toBeVisible();
      await expectActivePokemonView(page, 'Pokémon');
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('uses mobile Back to close the action menu without leaving the current URL', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile back behavior');
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);
      await expect(page).toHaveURL(/\/pokemon$/);

      await openActionMenu(page, testInfo.project.name);

      await triggerBrowserBack(page);

      await expect(page).toHaveURL(/\/pokemon$/);
      await expect(page.locator('.action-menu-overlay[data-menu-state="open"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Action Menu' })).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('mounts action menu closed before animating open', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);

      const viewportHeight = await page.evaluate(() => window.innerHeight);
      await page.evaluate(() => {
        const states: string[] = [];
        const rememberMenuState = () => {
          const state = document
            .querySelector('.action-menu-overlay')
            ?.getAttribute('data-menu-state');
          if (state && states[states.length - 1] !== state) {
            states.push(state);
          }
        };

        const observer = new MutationObserver(() => rememberMenuState());
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['data-menu-state'],
          childList: true,
          subtree: true,
        });

        (window as typeof window & {
          __actionMenuStateSequence?: string[];
          __actionMenuStateObserver?: MutationObserver;
        }).__actionMenuStateSequence = states;
        (window as typeof window & {
          __actionMenuStateObserver?: MutationObserver;
        }).__actionMenuStateObserver = observer;
      });

      await openActionMenu(page, testInfo.project.name);

      const overlay = page.locator('.action-menu-overlay');
      const homeMenuItem = page.locator('.action-menu-item.button-home');
      await expect(overlay).toBeAttached();
      await expect(homeMenuItem).toBeAttached();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & { __actionMenuStateSequence?: string[] })
                .__actionMenuStateSequence ?? [],
          ),
        )
        .toContain('closed');

      await expect(overlay).toHaveAttribute('data-menu-state', 'open');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & { __actionMenuStateSequence?: string[] })
                .__actionMenuStateSequence ?? [],
          ),
        )
        .toContain('open');
      await expect(overlay).toBeVisible();
      await page.waitForTimeout(350);
      const finalTop = await getElementTop(page, '.action-menu-item.button-home');
      const transitionDuration = await homeMenuItem.evaluate((element) =>
        getComputedStyle(element).transitionDuration,
      );

      expect(finalTop, 'home action should settle near the viewport center').toBeLessThan(
        viewportHeight * 0.65,
      );
      expect(
        transitionDuration,
        'home action should keep a CSS transition for opening movement',
      ).not.toBe('0s');
    } finally {
      await page
        .evaluate(() => {
          (window as typeof window & {
            __actionMenuStateObserver?: MutationObserver;
          }).__actionMenuStateObserver?.disconnect();
        })
        .catch(() => {});
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('uses browser back to return to the previous app route', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);
      await expect(page).toHaveURL(/\/pokemon$/);

      await openActionMenu(page, testInfo.project.name);
      await page
        .locator('.action-menu-overlay[data-menu-state="open"]')
        .getByRole('button', { name: /Search/i })
        .click();
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.getByRole('heading', { name: 'Search', level: 1 })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Pokémon' })).toBeVisible();

      await triggerBrowserBack(page);

      await expect(page).toHaveURL(/\/pokemon$/);
      await expect(page.getByRole('button', { name: 'Action Menu' })).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('uses browser back to close a Pokemon instance overlay without navigating away', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      const { firstCaughtCard } = await openCaughtPokemonList(page);
      await expect(page).toHaveURL(/\/pokemon$/);
      await firstCaughtCard.click();

      const overlay = page.locator('.instance-overlay.caught-mode');
      await expect(overlay).toBeVisible();

      await triggerBrowserBack(page);

      await expect(page).toHaveURL(/\/pokemon$/);
      await expect(overlay).toHaveCount(0);
      await expectActivePokemonView(page, 'Pokémon');
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('uses browser back to step out of Pokedex contexts before URL navigation', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      const response = await page.goto('/pokedex', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), '/pokedex document response should be OK').toBe(true);

      const pokemonRegions = page.getByLabel('Pokemon regions', { exact: true });
      const kantoRegion = pokemonRegions.getByRole('button', { name: /Kanto/i });
      await expect(kantoRegion).toBeVisible({ timeout: 30_000 });
      await kantoRegion.click();
      await expect(page.locator('.pokedex-region-detail')).toBeVisible();
      await expect(page).toHaveURL(/\/pokedex$/);

      await triggerBrowserBack(page);

      await expect(page).toHaveURL(/\/pokedex$/);
      await expect(page.locator('.pokedex-region-detail')).toHaveCount(0);
      await expect(pokemonRegions).toBeVisible();

      await kantoRegion.click();
      await expect(page.locator('.pokedex-region-detail')).toBeVisible();
      await page.locator('.pokedex-region-grid__open').first().click();
      await expect(page.locator('.pokedex-page--pokemon-detail')).toBeVisible();

      await triggerBrowserBack(page);

      await expect(page).toHaveURL(/\/pokedex$/);
      await expect(page.locator('.pokedex-page--pokemon-detail')).toHaveCount(0);
      await expect(page.locator('.pokedex-region-detail')).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('opens Pokedex detail at the region selected from the folder view', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      const response = await page.goto('/pokedex', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), '/pokedex document response should be OK').toBe(true);

      const pokemonRegions = page.getByLabel('Pokemon regions', { exact: true });
      const johtoRegion = pokemonRegions.getByRole('button', { name: /Johto/i });
      await expect(johtoRegion).toBeVisible({ timeout: 30_000 });
      await johtoRegion.click();

      const selectedRegion = page.locator(
        '.pokedex-category-panel[aria-hidden="false"] .pokedex-region-detail__section.is-current',
      );
      await expect(selectedRegion).toContainText('Johto');
      await expect
        .poll(() => selectedRegion.evaluate((element) => element.getBoundingClientRect().top))
        .toBeLessThan(100);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('keeps Pokedex region scroll position when closing a Pokemon detail view', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page);
      const response = await page.goto('/pokedex', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), '/pokedex document response should be OK').toBe(true);

      const pokemonRegions = page.getByLabel('Pokemon regions', { exact: true });
      await expect(pokemonRegions.getByRole('button', { name: /Kanto/i })).toBeVisible({
        timeout: 30_000,
      });
      await pokemonRegions.getByRole('button', { name: /Kanto/i }).click();
      await expect(page.locator('.pokedex-region-detail')).toBeVisible();

      const activeKantoCards = page.locator(
        '.pokedex-category-panel[aria-hidden="false"] .pokedex-region-detail__section.is-current .pokedex-region-grid__open',
      );
      const lowerKantoCard = activeKantoCards.nth(24);
      await lowerKantoCard.scrollIntoViewIfNeeded();
      await expect.poll(() => getDocumentScrollTop(page)).toBeGreaterThan(200);
      const scrollBeforeDetail = await getDocumentScrollTop(page);

      await lowerKantoCard.click();
      await expect(page.locator('.pokedex-page--pokemon-detail')).toBeVisible();

      const closeButton = page.locator('.pokedex-pokemon-detail__close');
      await expect(closeButton).toBeVisible();
      const closeButtonBox = await closeButton.boundingBox();
      expect(
        closeButtonBox?.width ?? 0,
        'Pokemon detail close button should use the shared app close-button sizing',
      ).toBeGreaterThanOrEqual(50);
      expect(
        closeButtonBox?.width ?? 0,
        'Pokemon detail close button should not use oversized page-specific sizing',
      ).toBeLessThanOrEqual(90);

      await closeButton.click();

      await expect(page.locator('.pokedex-page--pokemon-detail')).toHaveCount(0);
      await expect(page.locator('.pokedex-region-detail')).toBeVisible();
      await expect
        .poll(() => getDocumentScrollTop(page))
        .toBeGreaterThanOrEqual(scrollBeforeDetail - 80);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('persists Pokemon boot data into IndexedDB', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);

      await expect
        .poll(() => countIndexedDbStore(page, 'variantsDB', 'variants'))
        .toBeGreaterThan(0);
      await expect
        .poll(() => countIndexedDbStore(page, 'instancesDB', 'instances'))
        .toBeGreaterThan(0);
    } finally {
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });

  test('changes Pokemon views with horizontal touch swipes on mobile', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!isMobile, 'touch swipe coverage only runs on mobile browser projects');

    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await openPokemonPage(page);
      await expectActivePokemonView(page, 'Pokémon');
      await installLoadingOverlayProbe(page);

      const slider = page.locator('.view-slider-container');
      const box = await slider.boundingBox();
      expect(box, 'view slider should be measurable').not.toBeNull();
      if (!box) return;

      const y = Math.round(box.y + box.height * 0.45);
      await dispatchTouchSwipe(
        slider,
        { clientX: Math.round(box.x + box.width * 0.82), clientY: y },
        { clientX: Math.round(box.x + box.width * 0.18), clientY: y },
      );
      await expectActivePokemonView(page, 'WISHLIST');
      await expectNoLoadingOverlaySeen(page);

      await dispatchTouchSwipe(
        slider,
        { clientX: Math.round(box.x + box.width * 0.18), clientY: y },
        { clientX: Math.round(box.x + box.width * 0.82), clientY: y },
      );
      await expectActivePokemonView(page, 'Pokémon');
      await expectNoLoadingOverlaySeen(page);
    } finally {
      await disconnectLoadingOverlayProbe(page);
      await diagnostics.flush();
    }

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });
});
