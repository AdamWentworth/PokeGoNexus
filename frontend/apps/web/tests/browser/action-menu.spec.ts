import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Route } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { openActionMenu } from './support/actionMenu';
import { installE2eRoutes } from './support/e2eRoutes';
import { actionMenuExperienceParityContract } from '../../../../packages/shared-ui-tokens/src/index';

test.describe('Action Menu', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['chromium-desktop', 'mobile-chrome'].includes(testInfo.project.name),
      'The focused layout checks use representative desktop and mobile Chromium viewports.',
    );
  });

  test('keeps the radial navigation accessible and restores the Poké Ball trigger', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await installE2eRoutes(page);

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const trigger = page.getByRole('button', { name: 'Action Menu', exact: true });
      await trigger.click();

      const dialog = page.getByRole('dialog', { name: 'Quick navigation' });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close' })).toBeEnabled();
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      for (const { label } of actionMenuExperienceParityContract.primaryDestinations) {
        await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
      const supportButton = page.getByRole('button', { name: 'Learn & support' });
      await expect(supportButton).toBeVisible();
      await supportButton.click();
      const supportDirectory = page.getByRole('navigation', { name: 'Learn and support' });
      await expect(supportDirectory).toBeVisible();
      for (const { label } of actionMenuExperienceParityContract.supportDestinations) {
        await expect(supportDirectory.getByRole('button', { name: label })).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await expect(supportDirectory).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId('perf-telemetry')).toBeHidden();

      const searchDestination = page.getByRole('button', { name: 'Search', exact: true });
      await searchDestination.hover();
      await expect(searchDestination.locator('.button-content')).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      );

      const expectAccessibleMenu = async () => {
        const accessibility = await new AxeBuilder({ page })
          .include('.action-menu-overlay')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          accessibility.violations.filter(
            ({ impact }) => impact === 'critical' || impact === 'serious',
          ),
        ).toEqual([]);
      };

      await expectAccessibleMenu();
      await page.locator('.action-menu-overlay .switch').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('.settings-icon')).toHaveCSS('background-color', 'rgb(33, 79, 85)');
      await expect(page.locator('.auth-button-icon').first()).toHaveCSS('background-color', 'rgb(33, 79, 85)');
      await expectAccessibleMenu();

      await dialog.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Max Battles' })).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Action Menu', exact: true })).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('keeps every radial destination inside a short landscape viewport', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await page.setViewportSize({ width: 844, height: 390 });
    await installE2eRoutes(page);

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await openActionMenu(page, testInfo.project.name);
      await expect(page.getByRole('dialog', { name: 'Quick navigation' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close' })).toBeEnabled();

      const layout = await page.locator('.action-menu-item').evaluateAll((items) => ({
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        items: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          };
        }),
      }));

      for (const item of layout.items) {
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.top).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeLessThanOrEqual(layout.viewportWidth);
        expect(item.bottom).toBeLessThanOrEqual(layout.viewportHeight);
      }

      await page.getByRole('button', { name: 'Learn & support' }).click();
      const supportLayout = await page
        .getByRole('navigation', { name: 'Learn and support' })
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          };
        });
      expect(supportLayout.left).toBeGreaterThanOrEqual(0);
      expect(supportLayout.top).toBeGreaterThanOrEqual(0);
      expect(supportLayout.right).toBeLessThanOrEqual(supportLayout.viewportWidth);
      expect(supportLayout.bottom).toBeLessThanOrEqual(supportLayout.viewportHeight);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test('covers the previous page until a lazy destination is ready', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    let releaseSearchModule: () => void = () => undefined;
    const blockedSearchModule = new Promise<void>((resolve) => {
      releaseSearchModule = resolve;
    });
    let markSearchModuleRequested: () => void = () => undefined;
    const searchModuleRequested = new Promise<void>((resolve) => {
      markSearchModuleRequested = resolve;
    });

    const blockSearchRouteModule = async (route: Route) => {
      markSearchModuleRequested();
      await blockedSearchModule;
      await route.continue();
    };

    try {
      await installE2eRoutes(page);
      await page.route('**/src/pages/Search/Search.tsx*', blockSearchRouteModule);
      await page.route(/\/assets\/Search-[^/]+\.js(?:\?.*)?$/, blockSearchRouteModule);
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await openActionMenu(page, testInfo.project.name);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await searchModuleRequested;

      await expect(page).toHaveURL(/\/search$/);
      const loadingOverlay = page.locator('.app-loading-overlay');
      await expect(loadingOverlay).toBeVisible();
      await expect(loadingOverlay).toHaveCSS('position', 'fixed');
      await expect(loadingOverlay).toHaveCSS('background-color', 'rgb(16, 26, 25)');

      const coverage = await loadingOverlay.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          width: rect.width,
        };
      });
      expect(coverage.width).toBeGreaterThanOrEqual(coverage.viewportWidth);
      expect(coverage.height).toBeGreaterThanOrEqual(coverage.viewportHeight);

      releaseSearchModule();
      await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
      await expect(loadingOverlay).toHaveCount(0);
    } finally {
      releaseSearchModule();
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
