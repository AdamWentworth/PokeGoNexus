import { expect, test, type Page, type Route } from '@playwright/test';

import { installE2eRoutes } from './support/e2eRoutes';

const providers = ['google', 'discord', 'facebook'] as const;
type Provider = (typeof providers)[number];

const futureDate = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installOAuthLifecycle(
  page: Page,
  provider: Provider,
  account: { id: string; email: string; username: string },
) {
  const state = {
    created: false,
    deleted: false,
    completedPayload: {} as Record<string, unknown>,
  };

  const handleAuthRoute = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/(?:__e2e|api)\/auth/, '');

    if (request.method() === 'GET' && path === `/${provider}`) {
      expect(url.searchParams.get('intent')).toBe('register');
      const registrationUrl = `/register?oauth=${provider}`;
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'cache-control': 'no-store' },
        body: `<!doctype html><script>window.location.replace(${JSON.stringify(registrationUrl)})</script>`,
      });
      return;
    }

    if (request.method() === 'GET' && path === `/${provider}/pending`) {
      await fulfillJson(route, {
        provider,
        email: account.email,
        emailVerified: true,
      });
      return;
    }

    if (request.method() === 'POST' && path === `/${provider}/complete-registration`) {
      state.completedPayload = request.postDataJSON() as Record<string, unknown>;
      state.created = true;
      state.deleted = false;
      await fulfillJson(route, {
        user_id: account.id,
        username: state.completedPayload.username,
        email: account.email,
        pokemonGoName: state.completedPayload.pokemonGoName || '',
        trainerCode: state.completedPayload.trainerCode || '',
        allowLocation: false,
        location: '',
        coordinates: null,
        accessTokenExpiry: futureDate(15),
        refreshTokenExpiry: futureDate(1_440),
        token: `${provider}-e2e-token`,
      }, 201);
      return;
    }

    if (request.method() === 'POST' && path === '/refresh') {
      if (!state.created || state.deleted) {
        await fulfillJson(route, { message: 'Unauthorized' }, 401);
        return;
      }
      await fulfillJson(route, {
        user_id: account.id,
        username: account.username,
        email: account.email,
        pokemonGoName: '',
        trainerCode: '',
        allowLocation: false,
        location: '',
        coordinates: null,
        accessTokenExpiry: futureDate(15),
        refreshTokenExpiry: futureDate(1_440),
      });
      return;
    }

    if (request.method() === 'DELETE' && path === `/delete/${account.id}`) {
      expect(state.created).toBe(true);
      state.deleted = true;
      state.created = false;
      await fulfillJson(route, { message: 'Account deleted' });
      return;
    }

    await fulfillJson(route, { message: `Unhandled auth route: ${request.method()} ${path}` }, 404);
  };

  for (const pathPattern of ['**/__e2e/auth/**', '**/api/auth/**']) {
    await page.route(pathPattern, handleAuthRoute);
  }

  await page.route(`**/__e2e/users/update-user/${account.id}`, async (route) => {
    await fulfillJson(route, { success: true });
  });
  await page.route(`**/__e2e/users/${account.id}`, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    await fulfillJson(route, { message: 'Account data deleted' });
  });

  return state;
}

for (const provider of providers) {
  test(`${provider} registration creates and immediately deletes a new account`, async ({ page }) => {
    await installE2eRoutes(page);
    const account = {
      id: `oauth-e2e-${provider}`,
      email: `${provider}.oauth.e2e@example.invalid`,
      username: `e2e_${provider}`,
    };
    const lifecycle = await installOAuthLifecycle(page, provider, account);

    await page.goto('/register');
    await page.getByRole('button', {
      name: new RegExp(`sign up with ${provider}`, 'i'),
    }).click();

    await expect(page).toHaveURL(new RegExp(`/register\\?oauth=${provider}$`));
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue(account.email);
    await expect(emailInput).toBeDisabled();
    await page.getByLabel('Username').fill(account.username);

    const perfTelemetryButton = page.getByRole('button', { name: /Perf telemetry/i });
    if (await perfTelemetryButton.isVisible().catch(() => false)) {
      await perfTelemetryButton.evaluate((button) => button.parentElement?.remove());
    }

    await page.getByTestId('register-button').click();
    await page.getByTestId('register-button').click();
    await page.getByTestId('register-button').click();
    await page.getByTestId('register-button').click();

    await expect(
      page.getByRole('heading', { name: /Successfully Registered and Logged in/i }),
    ).toBeVisible();
    expect(lifecycle.created).toBe(true);
    expect(lifecycle.completedPayload).toMatchObject({
      username: account.username,
      email: account.email,
    });

    await page.goto('/settings/account');
    await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm action' })).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByPlaceholder('Username or Email')).toBeVisible();
    expect(lifecycle.deleted).toBe(true);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('user'))).toBeNull();
  });
}
