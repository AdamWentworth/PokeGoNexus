import { expect, test, type Locator } from '@playwright/test';

import { installE2eRoutes } from './support/e2eRoutes';

const routes = [
  '/login',
  '/register',
  '/reset-password?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '/terms',
  '/privacy',
  '/data-deletion',
];

async function contrastRatio(locator: Locator) {
  return locator.evaluate((element) => {
    const parseColor = (value: string) => {
      const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
      if (rgbMatch) {
        const channels = rgbMatch[1]
          .split(',')
          .map((part) => Number.parseFloat(part.trim()));
        return [channels[0], channels[1], channels[2], channels[3] ?? 1] as const;
      }
      const srgbMatch = value.match(/color\(srgb\s+([^)/]+)(?:\s*\/\s*([^)]+))?\)/);
      if (srgbMatch) {
        const channels = srgbMatch[1]
          .trim()
          .split(/\s+/)
          .map((part) => Number.parseFloat(part) * 255);
        return [
          channels[0],
          channels[1],
          channels[2],
          srgbMatch[2] ? Number.parseFloat(srgbMatch[2]) : 1,
        ] as const;
      }
      return null;
    };
    const luminance = (channels: number[]) => {
      const [red, green, blue] = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const resolveBackground = (node: Element | null): number[] => {
      if (!node) return [255, 255, 255];
      const parsed = parseColor(window.getComputedStyle(node).backgroundColor);
      if (!parsed || parsed[3] === 0) return resolveBackground(node.parentElement);
      if (parsed[3] >= 1) return parsed.slice(0, 3);
      const parent = resolveBackground(node.parentElement);
      return parsed.slice(0, 3).map(
        (channel, index) => channel * parsed[3] + parent[index] * (1 - parsed[3]),
      );
    };
    const styles = window.getComputedStyle(element);
    const text = parseColor(styles.color);
    const background = resolveBackground(element);
    if (!text || !background) {
      throw new Error(
        `Could not parse control colors: text=${styles.color}, background=${styles.backgroundColor}`,
      );
    }
    const lighter = Math.max(luminance(text.slice(0, 3)), luminance(background));
    const darker = Math.min(luminance(text.slice(0, 3)), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

for (const route of routes) {
  test(`${route} fits the viewport without horizontal overflow`, async ({ page }) => {
    await installE2eRoutes(page);
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();

    const widths = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth);
  });
}

test('desktop registration method selection uses a compact balanced card', async ({ page }) => {
  await installE2eRoutes(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/register');

  const card = page.locator('.register-form--method');
  const methodNote = page.locator('.register-method-note');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByText('Already have an account?')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose a sign-up method' })).toBeVisible();

  const [cardBounds, noteBounds] = await Promise.all([
    card.boundingBox(),
    methodNote.boundingBox(),
  ]);
  expect(cardBounds).not.toBeNull();
  expect(noteBounds).not.toBeNull();
  expect(cardBounds!.height).toBeLessThan(520);
  expect(cardBounds!.y + cardBounds!.height - (noteBounds!.y + noteBounds!.height)).toBeLessThan(60);

  const google = await page.getByRole('button', { name: 'Sign up with Google' }).boundingBox();
  const discord = await page.getByRole('button', { name: 'Sign up with Discord' }).boundingBox();
  const facebook = await page.getByRole('button', { name: 'Sign up with Facebook' }).boundingBox();
  const email = await page.getByRole('button', { name: 'Continue with email' }).boundingBox();
  expect(google).not.toBeNull();
  expect(discord).not.toBeNull();
  expect(facebook).not.toBeNull();
  expect(email).not.toBeNull();
  expect(Math.abs(google!.y - discord!.y)).toBeLessThan(2);
  expect(Math.abs(facebook!.y - email!.y)).toBeLessThan(2);
});

test('registration controls remain legible in light mode', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('isLightMode', 'true'));
  await installE2eRoutes(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/register');

  const emailMethod = page.getByRole('button', { name: 'Continue with email' });
  const methodStyles = await emailMethod.evaluate(
    (element) => {
      const styles = window.getComputedStyle(element);
      return { background: styles.backgroundColor };
    },
  );
  expect(methodStyles.background).not.toBe('rgb(34, 34, 34)');
  expect(await contrastRatio(emailMethod)).toBeGreaterThanOrEqual(4.5);

  await emailMethod.click();
  const usernameInput = page.locator('#register-username');
  const accountStepStyles = await page.getByRole('heading', { name: 'Your account', exact: true }).evaluate(
    (element) => {
      const heading = element.closest('.register-step-heading');
      const input = document.querySelector<HTMLInputElement>('#register-username');
      return {
        headingBackground: heading ? window.getComputedStyle(heading).backgroundColor : '',
        inputBackground: input ? window.getComputedStyle(input).backgroundColor : '',
      };
    },
  );
  expect(accountStepStyles.headingBackground).not.toBe('rgb(34, 34, 34)');
  expect(accountStepStyles.inputBackground).not.toBe('rgb(34, 34, 34)');
  expect(await contrastRatio(usernameInput)).toBeGreaterThanOrEqual(4.5);
});

test('mobile Terms content and footer remain readable inside the viewport', async ({ page }) => {
  await installE2eRoutes(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/terms');

  const document = page.locator('.legal-document');
  await expect(document.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  await expect(document.getByRole('link', { name: 'Return to Pokémon Go Nexus' })).toBeVisible();
  await expect(document.locator('a[href^="mailto:"]')).toHaveCount(0);

  const bounds = await document.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
});
