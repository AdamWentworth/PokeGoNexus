import { expect, type Page } from '@playwright/test';

export async function openActionMenu(page: Page, projectName: string) {
  const actionMenuButton = page.getByRole('button', { name: 'Action Menu', exact: true });
  const openMenu = page.locator('.action-menu-overlay[data-menu-state="open"]');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await openMenu.isVisible({ timeout: 250 }).catch(() => false)) {
      return;
    }

    await expect(actionMenuButton).toBeVisible({ timeout: 15_000 });

    if (projectName.includes('mobile')) {
      await actionMenuButton.tap().catch(async () => {
        await actionMenuButton.click({ force: true });
      });
    } else {
      await actionMenuButton.click();
    }

    const didOpen = await openMenu
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (didOpen) {
      await page.waitForTimeout(450);
      if (await openMenu.isVisible().catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(150);
  }

  await actionMenuButton.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(openMenu).toBeVisible();
  await page.waitForTimeout(450);
  await expect(openMenu).toBeVisible();
}
