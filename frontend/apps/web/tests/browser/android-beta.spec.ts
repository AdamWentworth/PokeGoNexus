import { expect, test } from '@playwright/test';
import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

test('Android beta is reachable without sign-in and preserves the web option', async ({ page }, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  await installE2eRoutes(page);
  try {
    await page.goto('/help');
    await page.getByRole('link', { name: /Android beta/ }).click();
    await expect(page).toHaveURL(/\/download$/);
    await expect(page).toHaveTitle('Android beta | Pokémon Go Nexus');
    await expect(page.getByRole('heading', { name: 'Try the Android beta' })).toBeVisible();
    await expect(page.getByText(/affect your real account/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue in the web app/ })).toHaveAttribute('href', '/pokemon');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('android-beta.png') });
    const feedback = page.getByRole('link', { name: /Send beta feedback/ });
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('android-beta-feedback.png') });
  } finally {
    await diagnostics.flush();
  }
  expect(diagnostics.blockingErrors()).toEqual([]);
});
