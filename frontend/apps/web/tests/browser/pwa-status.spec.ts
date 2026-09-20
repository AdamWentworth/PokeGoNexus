import { expect, test } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

test.describe('PWA connectivity status', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['chromium-desktop', 'mobile-chrome'].includes(testInfo.project.name),
      'Representative desktop and installed-mobile dimensions cover the shared status surface.',
    );
  });

  test('explains offline behavior and clears after reconnecting', async ({ context, page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await installE2eRoutes(page, { preserveBrowserConnectivity: true });

    try {
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(
        page.getByRole('heading', { name: 'Build your collection. Find the right trade.' }),
      ).toBeVisible();
      await context.setOffline(true);

      const offlineStatus = page.getByRole('alert').filter({ hasText: 'You’re offline' });
      await expect(offlineStatus).toBeVisible();
      await expect(offlineStatus).toContainText('Collection data already loaded on this device');

      const dimensions = await offlineStatus.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        };
      });
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth);
      expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight);

      await context.setOffline(false);
      await expect(page.getByRole('status').filter({ hasText: 'Back online' })).toBeVisible();
    } finally {
      await context.setOffline(false);
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
