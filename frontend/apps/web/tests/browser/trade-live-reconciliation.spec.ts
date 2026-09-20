import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const ash = {
  user_id: 'trade-user-1',
  username: 'ash',
  email: 'ash@example.invalid',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const misty = {
  user_id: 'trade-user-2',
  username: 'misty',
  email: 'misty@example.invalid',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const instances = {
  'trade-bulbasaur': {
    instance_id: 'trade-bulbasaur',
    user_id: ash.user_id,
    variant_id: '0001-default',
    pokemon_id: 1,
    nickname: 'Sprout',
    is_caught: true,
    is_for_trade: true,
    disabled: false,
  },
  'trade-charmander': {
    instance_id: 'trade-charmander',
    user_id: misty.user_id,
    variant_id: '0004-default',
    pokemon_id: 4,
    nickname: 'Ember',
    is_caught: true,
    is_for_trade: true,
    disabled: false,
  },
};

let trade = {
  trade_id: 'trade-live-e2e',
  user_id_proposed: ash.user_id,
  username_proposed: ash.username,
  user_id_accepting: misty.user_id,
  username_accepting: misty.username,
  pokemon_instance_id_user_proposed: 'trade-bulbasaur',
  pokemon_instance_id_user_accepting: 'trade-charmander',
  trade_status: 'proposed',
  trade_friendship_level: 'Forever',
  user_proposed_completion_confirmed: false,
  user_accepting_completion_confirmed: false,
  last_update: 100,
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function seedLogin(page: Page, user: typeof ash) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => localStorage.setItem('user', JSON.stringify(value)), user);
}

async function openTradeActivity(page: Page) {
  await page.goto('/trades', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Trade Activity' }).click();
  await expect(page.locator('.trade-activity-workspace')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __e2eEventSourceCount?: () => number }
  ).__e2eEventSourceCount?.() ?? 0), {
    timeout: 30_000,
    message: 'authenticated trade event stream should be connected',
  }).toBeGreaterThan(0);
}

async function emitTrade(page: Page) {
  const delivered = await page.evaluate(
    (payload) => (
      window as unknown as { __emitE2eEventSourceMessage: (message: unknown) => number }
    ).__emitE2eEventSourceMessage(payload),
    { trade: { [trade.trade_id]: trade }, relatedInstance: instances },
  );
  expect(delivered).toBeGreaterThan(0);
}

async function confirmTradeCommand(page: Page, actionName: string, endpointSuffix: string) {
  const action = page.getByRole('button', { name: actionName });
  const confirm = page.getByRole('button', { name: 'OK' });

  // A live-feed update can replace the trade card in the same frame as the
  // action click. Retry only until the confirmation dialog is mounted; the
  // authoritative command below is still submitted exactly once.
  await expect(async () => {
    if (!(await confirm.isVisible())) {
      await action.click();
    }
    await expect(confirm).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === 'POST'
      && new URL(response.url()).pathname.endsWith(endpointSuffix);
  });

  await confirm.click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await response.json();
}

async function installCanonicalTradeFeed(page: Page) {
  const handler = async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await fulfillJson(route, {
      trades: [trade],
      related_instances: instances,
    });
  };

  for (const pattern of ['**/api/users/trades', '**/__e2e/users/trades']) {
    await page.route(pattern, handler);
  }
}

async function installTradeCommands(page: Page, actor: 'ash' | 'misty') {
  const handler = async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/accept') && actor === 'misty') {
      trade = { ...trade, trade_status: 'pending', last_update: 200 };
      await fulfillJson(route, { trade, affected_instances: {} });
      return;
    }
    if (pathname.endsWith('/complete-confirmation')) {
      if (actor === 'misty') {
        trade = {
          ...trade,
          user_accepting_completion_confirmed: true,
          last_update: 300,
        };
      } else {
        trade = {
          ...trade,
          trade_status: 'completed',
          user_proposed_completion_confirmed: true,
          last_update: 400,
        };
      }
      await fulfillJson(route, { trade, affected_instances: {} });
      return;
    }
    await fulfillJson(route, { message: `Unexpected ${actor} trade command` }, 409);
  };

  for (const pattern of [
    '**/api/users/trades/trade-live-e2e/**',
    '**/__e2e/users/trades/trade-live-e2e/**',
  ]) {
    await page.route(pattern, handler);
  }
}

async function prepareParticipant(
  context: BrowserContext,
  user: typeof ash,
  actor: 'ash' | 'misty',
) {
  const page = await context.newPage();
  await installE2eRoutes(page, {
    userOverview: { related_instances: instances },
  });
  await installCanonicalTradeFeed(page);
  await installTradeCommands(page, actor);
  await seedLogin(page, user);
  await openTradeActivity(page);
  return page;
}

test('reconciles acceptance and dual confirmation between two active trainers', async ({
  browser,
}, testInfo) => {
  trade = {
    ...trade,
    trade_status: 'proposed',
    user_proposed_completion_confirmed: false,
    user_accepting_completion_confirmed: false,
    last_update: 100,
  };
  const ashContext = await browser.newContext();
  const mistyContext = await browser.newContext();
  const ashPage = await prepareParticipant(ashContext, ash, 'ash');
  const mistyPage = await prepareParticipant(mistyContext, misty, 'misty');
  const ashDiagnostics = attachBrowserDiagnostics(ashPage, testInfo);
  const mistyDiagnostics = attachBrowserDiagnostics(mistyPage, testInfo);

  try {
    await expect(ashPage.getByRole('button', { name: /^Sent, 1/ })).toBeVisible();
    await expect(mistyPage.getByRole('button', { name: /^Needs response, 1/ })).toBeVisible();

    await confirmTradeCommand(mistyPage, 'Accept offer', '/accept');
    // Command responses and the live feed are separate authoritative paths.
    // Deliver the accepted state to both active clients before asserting the
    // reconciled activity buckets so a pending bootstrap refresh cannot win
    // the race under a loaded CI browser worker.
    await emitTrade(mistyPage);
    await expect(mistyPage.getByRole('button', { name: /^Active, 1/ })).toBeVisible();
    await emitTrade(ashPage);

    await expect(ashPage.getByRole('button', { name: /^Sent, 0/ })).toBeVisible();
    await expect(ashPage.getByRole('button', { name: /^Active, 1/ })).toBeVisible();
    await expect(mistyPage.getByRole('button', { name: /^Active, 1/ })).toBeVisible();

    await mistyPage.getByRole('button', { name: /^Active, 1/ }).click();
    await confirmTradeCommand(mistyPage, 'Confirm Complete', '/complete-confirmation');
    await expect(mistyPage.getByRole('button', { name: 'Awaiting Partner...' })).toBeDisabled();
    await emitTrade(ashPage);

    await ashPage.getByRole('button', { name: /^Active, 1/ }).click();
    await expect(ashPage.getByRole('button', { name: 'Confirm Complete' })).toBeVisible();
    await confirmTradeCommand(ashPage, 'Confirm Complete', '/complete-confirmation');
    await expect(ashPage.getByRole('button', { name: /^Completed, 1/ })).toBeVisible();
    await emitTrade(mistyPage);

    await expect(ashPage.getByRole('button', { name: /^Active, 0/ })).toBeVisible();
    await expect(ashPage.getByRole('button', { name: /^Completed, 1/ })).toBeVisible();
    await expect(mistyPage.getByRole('button', { name: /^Active, 0/ })).toBeVisible();
    await expect(mistyPage.getByRole('button', { name: /^Completed, 1/ })).toBeVisible();
    expect(ashDiagnostics.blockingErrors()).toEqual([]);
    expect(mistyDiagnostics.blockingErrors()).toEqual([]);
  } finally {
    await ashContext.close();
    await mistyContext.close();
  }
});
