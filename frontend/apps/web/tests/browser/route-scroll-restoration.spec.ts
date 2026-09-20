import { expect, test } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const getScrollTop = (page: Parameters<typeof installE2eRoutes>[0]) =>
  page.evaluate(() =>
    Math.max(
      window.scrollY,
      document.scrollingElement?.scrollTop ?? 0,
      document.documentElement.scrollTop,
      document.body.scrollTop,
    ),
  );

test.describe('route scroll restoration', () => {
  test('starts a new route at the top and restores the prior page on Back', async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await installE2eRoutes(page);

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', {
          name: 'Build your collection. Find the right trade.',
        }),
      ).toBeVisible();

      await page.evaluate(() => {
        window.scrollTo({ top: 900, behavior: 'auto' });
        if (document.scrollingElement) document.scrollingElement.scrollTop = 900;
        document.documentElement.scrollTop = 900;
        document.body.scrollTop = 900;
      });
      await expect.poll(() => getScrollTop(page)).toBeGreaterThan(700);
      const homeScrollTop = await getScrollTop(page);

      await page.evaluate(() => {
        const helpLink = document.querySelector<HTMLAnchorElement>('a[href="/help"]');
        if (!helpLink) throw new Error('Home help link was not found');
        helpLink.click();
      });

      await expect(page).toHaveURL(/\/help$/);
      await expect(
        page.getByRole('heading', { name: 'Help & information' }),
      ).toBeVisible();
      await expect.poll(() => getScrollTop(page)).toBeLessThanOrEqual(2);

      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole('heading', {
          name: 'Build your collection. Find the right trade.',
        }),
      ).toBeVisible();
      await expect
        .poll(() => getScrollTop(page))
        .toBeGreaterThanOrEqual(homeScrollTop - 80);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
