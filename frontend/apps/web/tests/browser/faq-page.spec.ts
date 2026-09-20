import { expect, test } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

test.describe('FAQ page', () => {
  test('searches, filters, deep-links, and remains responsive', async ({ page }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    await installE2eRoutes(page);

    try {
      await page.goto('/faq', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: 'Frequently asked questions' }),
      ).toBeVisible();
      await expect(page).toHaveTitle(/Frequently Asked Questions \| Pokémon Go Nexus/);
      await expect(page.getByText('Common questions')).toBeVisible();
      await expect(page.getByText('4 questions')).toBeVisible();

      const search = page.getByRole('searchbox', {
        name: 'Search questions and answers',
      });
      await search.fill('Forever Friends');
      await expect(page.getByText('1 question matching “Forever Friends”')).toBeVisible();

      const remoteQuestion = page.getByText('What does the fifth friendship heart mean?');
      await remoteQuestion.click();
      await expect(page.getByText(/Five hearts represents Forever Friends/i)).toBeVisible();
      await page.getByRole('link', { name: 'Link to this answer' }).click();
      await expect(page).toHaveURL(/\/faq#remote-trades$/);

      await search.fill('');
      await page.getByRole('button', { name: 'Browse Collection & tags questions' }).click();
      await expect(page.getByText('5 questions')).toBeVisible();
      await expect(page.getByText('How do custom tags work?')).toBeVisible();
      await expect(page.getByText('How do I propose a trade?')).toHaveCount(0);
      await page.getByRole('button', { name: 'All topics' }).click();
      await expect(page.getByText('Common questions')).toBeVisible();

      const widths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
