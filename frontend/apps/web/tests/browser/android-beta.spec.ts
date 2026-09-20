import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { getAndroidBetaRelease } from '../../../../packages/app-core/src/pages/Download/androidBeta';
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
    await expect(page.locator('.loading-container:visible')).toHaveCount(0);
    const release = getAndroidBetaRelease();
    const download = page.getByRole('link', { name: 'Download Android APK' });
    if (release) {
      await expect(download).toBeVisible();
      await expect(download).toBeInViewport();
      await expect(download).toHaveAttribute('href', release.downloadUrl);
      await expect(download).toHaveAttribute('download', `PokeGoNexus-Android-${release.versionCode}.apk`);
      await expect(page.getByRole('link', { name: 'What changed' })).toHaveAttribute('href', release.releaseNotesUrl);
      await expect(page.getByText(`Version ${release.version} · Build ${release.versionCode}`, { exact: false })).toBeVisible();
      const feedback = new URL(await page.getByRole('link', { name: /Send beta feedback/ }).getAttribute('href') ?? '');
      expect(feedback.searchParams.get('title')).toContain(`${release.version}, build ${release.versionCode}`);
    } else {
      await expect(download).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'The first beta download is being prepared' })).toBeVisible();
    }
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

test('Android download finishes with an APK filename while the beta page stays open', async ({ page }, testInfo) => {
  const release = getAndroidBetaRelease();
  test.skip(!release, 'There is no active Android beta');
  if (!release) return;
  await installE2eRoutes(page);
  const filename = `PokeGoNexus-Android-${release.versionCode}.apk`;
  await page.goto('/download');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download Android APK' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  const destination = testInfo.outputPath(filename);
  await download.saveAs(destination);
  expect((await stat(destination)).size).toBe(release.sizeBytes);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  expect(hash.digest('hex')).toBe(release.sha256);
  await expect(page).toHaveURL(/\/download$/);
  await expect(page.getByRole('heading', { name: 'Try the Android beta' })).toBeVisible();
});
