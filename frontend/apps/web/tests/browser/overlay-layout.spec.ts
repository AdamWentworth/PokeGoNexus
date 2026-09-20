import path from 'node:path';

import { expect, test } from '@playwright/test';

const instanceOverlayCssPath = path.resolve(
  process.cwd(),
  '../../packages/app-core/src/pages/Pokemon/features/instances/InstanceOverlay.css',
);
const overlayPortalCssPath = path.resolve(
  process.cwd(),
  '../../packages/app-core/src/components/OverlayPortal.css',
);
const backgroundLocationOverlayCssPath = path.resolve(
  process.cwd(),
  '../../packages/app-core/src/components/pokemonComponents/BackgroundLocationOverlay.css',
);

test.describe('instance overlay layout', () => {
  test('keeps the full-bleed background fixed while caught content scrolls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            html,
            body {
              margin: 0;
            }

            .fixture-content {
              height: 1800px;
            }
          </style>
        </head>
        <body>
          <div class="instance-overlay caught-mode" data-overlay-motion="entered">
            <div class="io-bg"></div>
            <div class="fixture-content">Tall caught overlay</div>
          </div>
        </body>
      </html>
    `);
    await page.addStyleTag({ path: instanceOverlayCssPath });
    await page.addStyleTag({ path: overlayPortalCssPath });

    const overlay = page.locator('.instance-overlay');
    const background = page.locator('.io-bg');
    await overlay.evaluate((element) => {
      element.scrollTop = 650;
    });

    const metrics = await page.evaluate(() => {
      const overlayElement = document.querySelector('.instance-overlay');
      const backgroundElement = document.querySelector('.io-bg');
      if (!overlayElement || !backgroundElement) {
        throw new Error('Overlay background fixture did not render');
      }

      const bounds = backgroundElement.getBoundingClientRect();
      return {
        backgroundBottom: bounds.bottom,
        backgroundTop: bounds.top,
        backgroundPosition: window.getComputedStyle(backgroundElement).position,
        overlayScrollTop: overlayElement.scrollTop,
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.overlayScrollTop).toBeGreaterThan(0);
    expect(metrics.backgroundPosition).toBe('fixed');
    expect(metrics.backgroundTop).toBe(0);
    expect(metrics.backgroundBottom).toBe(metrics.viewportHeight);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedMotionBounds = await background.boundingBox();
    expect(reducedMotionBounds?.y).toBe(0);
    expect(reducedMotionBounds?.height).toBe(metrics.viewportHeight);
  });

  test('caught panel background follows short content instead of stretching to viewport height', async ({
    page,
  }) => {
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <style>
            html,
            body {
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="instance-overlay caught-mode">
            <div class="caught-fullscreen">
              <div class="caught-scroll">
                <div class="instance-motion-shell instance-motion-shell--caught">
                  <div class="caught-column">
                    <div class="caught-instance">
                      <div class="instance-details-body" style="height: 180px;">
                        Short caught overlay content
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    await page.addStyleTag({ path: instanceOverlayCssPath });

    const metrics = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const scroll = document.querySelector('.caught-scroll');
      const column = document.querySelector('.caught-column');
      const content = document.querySelector('.instance-details-body');
      if (!scroll || !column || !content) {
        throw new Error('Overlay fixture did not render expected elements');
      }

      return {
        viewportHeight,
        scrollMinHeight: window.getComputedStyle(scroll).minHeight,
        columnHeight: column.getBoundingClientRect().height,
        contentHeight: content.getBoundingClientRect().height,
      };
    });

    expect(metrics.scrollMinHeight).not.toBe('100dvh');
    expect(metrics.columnHeight).toBeGreaterThanOrEqual(metrics.contentHeight);
    expect(metrics.columnHeight).toBeLessThan(metrics.viewportHeight * 0.75);
  });

  test('background picker covers the Search sheet and keeps its content in view', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            html,
            body {
              margin: 0;
            }

            .search-filter-overlay {
              position: fixed;
              z-index: 2100;
              inset: 0;
            }

            .fixture-content {
              height: 1600px;
            }
          </style>
        </head>
        <body>
          <div class="search-filter-overlay">Search filters</div>
          <div class="background-overlay">
            <div class="background-overlay-content">
              <div class="fixture-content">Background choices</div>
            </div>
          </div>
        </body>
      </html>
    `);
    await page.addStyleTag({ path: backgroundLocationOverlayCssPath });

    const metrics = await page.evaluate(() => {
      const overlay = document.querySelector('.background-overlay');
      const content = document.querySelector('.background-overlay-content');
      if (!overlay || !content) {
        throw new Error('Background overlay fixture did not render expected elements');
      }

      const overlayStyle = window.getComputedStyle(overlay);
      const contentStyle = window.getComputedStyle(content);
      const overlayBounds = overlay.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();

      return {
        contentHeight: contentBounds.height,
        contentOverflow: contentStyle.overflow,
        contentWidth: contentBounds.width,
        overlayHeight: overlayBounds.height,
        overlayPosition: overlayStyle.position,
        overlayWidth: overlayBounds.width,
        overlayZIndex: Number(overlayStyle.zIndex),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(metrics.overlayPosition).toBe('fixed');
    expect(metrics.overlayZIndex).toBeGreaterThan(2100);
    expect(metrics.overlayWidth).toBe(metrics.viewportWidth);
    expect(metrics.overlayHeight).toBe(metrics.viewportHeight);
    expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.viewportWidth * 0.9 + 1);
    expect(metrics.contentHeight).toBeLessThanOrEqual(metrics.viewportHeight * 0.8 + 1);
    expect(metrics.contentOverflow).toBe('auto');
  });
});
