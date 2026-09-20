import { expect, test, type Route } from '@playwright/test';

import { installE2eRoutes } from './support/e2eRoutes';

const token = 'a'.repeat(64);
const newPassword = 'New_secure_password_42!';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test('requests a reset, changes the password, and logs in with it', async ({ page }) => {
  await installE2eRoutes(page);
  const state = { requested: false, reset: false, loggedIn: false };

  const handleAuthRoute = async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(
      /^\/(?:__e2e|api)\/auth/,
      '',
    );
    const payload = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'POST' && path === '/reset-password') {
      expect(payload).toMatchObject({ identifier: 'trainer@example.com' });
      state.requested = true;
      await json(route, {
        message: 'If an account matches that information, a password reset email has been sent.',
      }, 202);
      return;
    }
    if (request.method() === 'POST' && path === '/reset-password/confirm') {
      expect(payload).toEqual({ token, password: newPassword });
      state.reset = true;
      await json(route, { message: 'Password updated. Please sign in with your new password.' });
      return;
    }
    if (request.method() === 'POST' && path === '/login') {
      expect(payload).toMatchObject({
        username: 'trainer@example.com',
        password: newPassword,
      });
      state.loggedIn = true;
      await json(route, {
        user_id: 'password-reset-e2e',
        username: 'trainer',
        email: 'trainer@example.com',
        pokemonGoName: '',
        trainerCode: '',
        allowLocation: false,
        location: '',
        coordinates: null,
        accessTokenExpiry: '2099-01-01T00:00:00.000Z',
        refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
        token: 'e2e-token',
      });
      return;
    }
    await json(route, { message: `Unhandled auth route: ${request.method()} ${path}` }, 404);
  };

  for (const pathPattern of ['**/__e2e/auth/**', '**/api/auth/**']) {
    await page.route(pathPattern, handleAuthRoute);
  }

  await page.goto('/login');
  const perfTelemetryButton = page.getByRole('button', { name: /Perf telemetry/i });
  if (await perfTelemetryButton.isVisible().catch(() => false)) {
    await perfTelemetryButton.evaluate((button) => button.parentElement?.remove());
  }
  await page.getByRole('button', { name: 'Reset Password' }).click();
  const resetDialog = page.getByRole('dialog', { name: 'Reset your password' });
  await resetDialog.getByPlaceholder('you@example.com').fill('trainer@example.com');
  await resetDialog.getByRole('button', { name: 'Email reset link' }).click();
  await expect.poll(() => state.requested).toBe(true);
  await expect(resetDialog).toHaveCount(0);
  await page.waitForTimeout(350);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  expect(state.reset).toBe(true);

  await page.getByRole('link', { name: 'Continue to login' }).click();
  await page.getByPlaceholder('Username or Email').fill('trainer@example.com');
  await page.getByPlaceholder('Password').fill(newPassword);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('You are now successfully logged in!')).toBeVisible();
  expect(state.loggedIn).toBe(true);
});
