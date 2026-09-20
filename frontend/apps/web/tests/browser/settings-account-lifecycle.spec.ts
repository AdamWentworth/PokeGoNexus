import { expect, test, type Page, type Route } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const currentUser = {
  user_id: 'settings-user-1',
  username: 'ash',
  email: 'ash@example.invalid',
  pokemonGoName: 'AshGo',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const initialPreferences = {
  user_id: currentUser.user_id,
  profile_visibility: 'public',
  collection_visibility: 'public',
  friend_request_permission: 'everyone',
  trainer_code_visibility: 'private',
  coordination_method: 'campfire',
  coordination_handle: null,
  share_trade_contact: true,
  show_location: true,
  show_pokemon_go_name: true,
  bio: null,
  updated_at: '2026-08-20T00:00:00.000Z',
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function seedLogin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((user) => localStorage.setItem('user', JSON.stringify(user)), currentUser);
}

test('persists server privacy settings and device display preferences', async ({ page }, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  let preferences = { ...initialPreferences };
  const savedPayloads: unknown[] = [];
  await installE2eRoutes(page);

  const preferencesHandler = async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, preferences);
      return;
    }
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      savedPayloads.push(payload);
      preferences = {
        ...preferences,
        ...payload,
        updated_at: '2026-08-21T00:00:00.000Z',
      };
      await fulfillJson(route, preferences);
      return;
    }
    await fulfillJson(route, { message: 'Unsupported preferences command' }, 405);
  };
  for (const pattern of ['**/api/users/preferences', '**/__e2e/users/preferences']) {
    await page.route(pattern, preferencesHandler);
  }

  await seedLogin(page);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();

  await page.getByLabel('Profile visibility').selectOption('friends');
  await page.getByLabel('Pokemon visibility').selectOption('private');
  await page.getByLabel('Friend requests').selectOption('nobody');
  await page.getByLabel('Trainer code visibility').selectOption('friends');
  await page.getByRole('checkbox', { name: 'Show Pokemon GO name' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show profile location' }).uncheck();
  await page.getByRole('checkbox', { name: /Reduce motion/ }).check();
  await page.getByRole('button', { name: 'Save privacy' }).click();

  await expect(page.getByText('Privacy settings saved')).toBeVisible();
  expect(savedPayloads).toEqual([
    {
      profile_visibility: 'friends',
      collection_visibility: 'private',
      friend_request_permission: 'nobody',
      trainer_code_visibility: 'friends',
      coordination_method: 'campfire',
      coordination_handle: null,
      share_trade_contact: true,
      show_location: false,
      show_pokemon_go_name: false,
    },
  ]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pokegonexus-reduced-motion')))
    .toBe('true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducedMotion))
    .toBe('true');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Profile visibility')).toHaveValue('friends');
  await expect(page.getByLabel('Pokemon visibility')).toHaveValue('private');
  await expect(page.getByLabel('Friend requests')).toHaveValue('nobody');
  await expect(page.getByLabel('Trainer code visibility')).toHaveValue('friends');
  await expect(page.getByRole('checkbox', { name: /Reduce motion/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Use (dark|light) theme/ })).toHaveCount(1);

  expect(diagnostics.blockingErrors()).toEqual([]);
});

test('validates account changes, disconnects a provider, and revokes every session', async ({
  page,
}, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  let providers = [
    {
      provider: 'google',
      email: currentUser.email,
      emailVerified: true,
      linkedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      provider: 'discord',
      email: currentUser.email,
      emailVerified: true,
      linkedAt: '2026-07-02T00:00:00.000Z',
    },
  ];
  const commands: Array<{ method: string; path: string; body: unknown }> = [];
  await installE2eRoutes(page);

  const authHandler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/(?:api|__e2e)\/auth/, '');
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;

    if (method === 'GET' && path === '/account/security') {
      await fulfillJson(route, {
        email: currentUser.email,
        hasPassword: true,
        providers,
        activeSessions: 3,
      });
      return;
    }

    commands.push({ method, path, body });
    if (method === 'PUT' && path === `/update/${currentUser.user_id}`) {
      await fulfillJson(route, {
        success: true,
        data: { username: currentUser.username, email: currentUser.email },
      });
      return;
    }
    if (method === 'POST' && path === '/email-change') {
      await fulfillJson(route, { success: true });
      return;
    }
    if (method === 'DELETE' && path === '/account/identities/google') {
      providers = providers.filter((identity) => identity.provider !== 'google');
      await fulfillJson(route, { success: true });
      return;
    }
    if (method === 'POST' && path === '/sessions/revoke-all') {
      await fulfillJson(route, { success: true });
      return;
    }
    if (method === 'POST' && path === '/logout') {
      await fulfillJson(route, { success: true });
      return;
    }
    await fulfillJson(route, { message: `Unhandled auth command: ${method} ${path}` }, 404);
  };

  for (const pattern of ['**/api/auth/**', '**/__e2e/auth/**']) {
    await page.route(pattern, authHandler);
  }

  await seedLogin(page);
  await page.goto('/settings/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
  await expect(page.getByText('3 active sessions')).toBeVisible();

  await page.getByLabel('New password', { exact: true }).fill('Valid_password_42!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('Different_password_42!');
  await page.getByRole('button', { name: 'Update account' }).click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  expect(commands).toEqual([]);

  await page.getByLabel('Current password').fill('Current_password_42!');
  await page.getByLabel('Email', { exact: true }).fill('new-ash@example.invalid');
  await page.getByLabel('Confirm new password', { exact: true }).fill('Valid_password_42!');
  await page.getByRole('button', { name: 'Update account' }).click();
  await expect(page.getByText('Verification sent to new-ash@example.invalid')).toBeVisible();

  await page.getByLabel('Current password').fill('Current_password_42!');
  const googleRow = page.locator('.trainer-connected-account').filter({ hasText: 'Google' });
  await googleRow.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Google disconnected')).toBeVisible();
  await expect(googleRow.getByText('Not connected')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out every device' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('user'))).toBeNull();

  expect(commands).toEqual([
    {
      method: 'PUT',
      path: `/update/${currentUser.user_id}`,
      body: {
        username: currentUser.username,
        email: currentUser.email,
        password: 'Valid_password_42!',
        currentPassword: 'Current_password_42!',
      },
    },
    {
      method: 'POST',
      path: '/email-change',
      body: {
        email: 'new-ash@example.invalid',
        currentPassword: 'Current_password_42!',
      },
    },
    {
      method: 'DELETE',
      path: '/account/identities/google',
      body: { currentPassword: 'Current_password_42!' },
    },
    {
      method: 'POST',
      path: '/sessions/revoke-all',
      body: { currentPassword: 'Current_password_42!' },
    },
    { method: 'POST', path: '/logout', body: {} },
  ]);
  expect(diagnostics.blockingErrors()).toEqual([]);
});
