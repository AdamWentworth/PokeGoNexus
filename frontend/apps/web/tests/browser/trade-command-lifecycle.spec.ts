import { expect, test, type Page, type Route } from '@playwright/test';

import { installE2eRoutes } from './support/e2eRoutes';

const user = {
  user_id: 'trade-user-2',
  username: 'misty',
  email: 'misty@example.invalid',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const instances = {
  'trade-bulbasaur': {
    instance_id: 'trade-bulbasaur',
    user_id: 'trade-user-1',
    variant_id: '0001-default',
    pokemon_id: 1,
    nickname: 'Sprout',
    is_caught: true,
    is_for_trade: true,
    disabled: false,
  },
  'trade-charmander': {
    instance_id: 'trade-charmander',
    user_id: 'trade-user-2',
    variant_id: '0004-default',
    pokemon_id: 4,
    nickname: 'Ember',
    is_caught: true,
    is_for_trade: true,
    disabled: false,
  },
};

const proposedTrade = {
  trade_id: 'trade-e2e',
  user_id_proposed: 'trade-user-1',
  username_proposed: 'ash',
  user_id_accepting: 'trade-user-2',
  username_accepting: 'misty',
  pokemon_instance_id_user_proposed: 'trade-bulbasaur',
  pokemon_instance_id_user_accepting: 'trade-charmander',
  trade_status: 'proposed',
  trade_friendship_level: 'Great',
  user_proposed_completion_confirmed: false,
  user_accepting_completion_confirmed: false,
  last_update: 100,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function seedLogin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    localStorage.setItem('user', JSON.stringify(value));
  }, user);
}

async function openTradeActivity(page: Page) {
  await page.goto('/trades');
  await page.getByRole('tab', { name: 'Trade Activity' }).click();
  const slider = page.locator('.trade-page-slider');
  const activityPanel = slider.locator(
    '.horizontal-page-slider__panel:has(.trade-activity-workspace)',
  );
  await expect(activityPanel).toHaveAttribute('data-active', 'true');
  await expect
    .poll(async () =>
      activityPanel.evaluate((panel, viewport) =>
        Math.abs(
          panel.getBoundingClientRect().left -
          document.querySelector(viewport)!.getBoundingClientRect().left,
        ), '.trade-page-slider'),
    )
    .toBeLessThanOrEqual(1);
}

async function routeTradeCommand(
  page: Page,
  handler: (route: Route) => Promise<void>,
) {
  for (const pattern of [
    '**/api/users/trades/trade-e2e/**',
    '**/__e2e/users/trades/trade-e2e/**',
  ]) {
    await page.route(pattern, handler);
  }
}

test('accepts and confirms a trade through authoritative commands', async ({
  page,
}) => {
  let trade = { ...proposedTrade };
  const calls: string[] = [];
  await installE2eRoutes(page, {
    trades: { [trade.trade_id]: trade },
    userOverview: { related_instances: instances },
  });
  await routeTradeCommand(page, async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname);
    if (url.pathname.endsWith('/accept')) {
      trade = { ...trade, trade_status: 'pending', last_update: 200 };
      await json(route, { trade, affected_instances: {} });
      return;
    }
    if (url.pathname.endsWith('/complete-confirmation')) {
      trade = {
        ...trade,
        user_accepting_completion_confirmed: true,
        last_update: 300,
      };
      await json(route, { trade, affected_instances: {} });
      return;
    }
    await json(route, { message: 'Unhandled trade command' }, 404);
  });

  await seedLogin(page);
  await openTradeActivity(page);
  await page.getByRole('button', { name: /^Needs response,/ }).click();
  await expect(page.getByRole('button', { name: 'Accept offer' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept offer' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  await page.getByRole('button', { name: /^Active,/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Complete' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByRole('button', { name: 'Awaiting Partner...' })).toBeDisabled();
  expect(calls.map((path) => path.slice(path.indexOf('/trades/')))).toEqual([
    '/trades/trade-e2e/accept',
    '/trades/trade-e2e/complete-confirmation',
  ]);
});

test('keeps canonical trade state and explains a rejected server command', async ({
  page,
}) => {
  await installE2eRoutes(page, {
    trades: { [proposedTrade.trade_id]: proposedTrade },
    userOverview: { related_instances: instances },
  });
  await routeTradeCommand(page, async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith('/accept')) {
      await json(route, { message: 'Unhandled trade command' }, 404);
      return;
    }
    await json(route, { message: 'This trade changed on another device.' }, 409);
  });

  await seedLogin(page);
  await openTradeActivity(page);
  await page.getByRole('button', { name: /^Needs response,/ }).click();
  await page.getByRole('button', { name: 'Accept offer' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  const failureMessage = page.getByText('This trade changed on another device.');
  await expect(failureMessage).toBeVisible();
  await failureMessage.click();
  await expect(page.getByRole('button', { name: 'Accept offer' })).toBeVisible();
});

test('denies an offer, moves it to Closed, and re-proposes it', async ({ page }) => {
  let trade = { ...proposedTrade };
  const commands: string[] = [];
  await installE2eRoutes(page, {
    trades: { [trade.trade_id]: trade },
    userOverview: { related_instances: instances },
  });
  await routeTradeCommand(page, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    commands.push(pathname.slice(pathname.indexOf('/trades/')));
    if (pathname.endsWith('/deny')) {
      trade = { ...trade, trade_status: 'denied', last_update: 200 };
      await json(route, { trade, affected_instances: {} });
      return;
    }
    if (pathname.endsWith('/repropose')) {
      trade = {
        ...trade,
        user_id_proposed: 'trade-user-2',
        username_proposed: 'misty',
        user_id_accepting: 'trade-user-1',
        username_accepting: 'ash',
        trade_status: 'proposed',
        last_update: 300,
      };
      await json(route, { trade, affected_instances: {} });
      return;
    }
    await json(route, { message: 'Unhandled trade command' }, 404);
  });

  await seedLogin(page);
  await openTradeActivity(page);
  await page.getByRole('button', { name: 'Deny' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByRole('button', { name: /^Closed, 1/ })).toBeVisible();
  await page.getByRole('button', { name: /^Closed, 1/ }).click();
  await page.getByRole('button', { name: 'Re-Propose Trade' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByRole('button', { name: /^Sent, 1/ })).toBeVisible();
  expect(commands).toEqual([
    '/trades/trade-e2e/deny',
    '/trades/trade-e2e/repropose',
  ]);
});

test('withdraws a sent proposal and reconciles it into Closed', async ({ page }) => {
  let trade = {
    ...proposedTrade,
    user_id_proposed: 'trade-user-2',
    username_proposed: 'misty',
    user_id_accepting: 'trade-user-1',
    username_accepting: 'ash',
  };
  await installE2eRoutes(page, {
    trades: { [trade.trade_id]: trade },
    userOverview: { related_instances: instances },
  });
  await routeTradeCommand(page, async (route) => {
    trade = {
      ...trade,
      trade_status: 'cancelled',
      trade_cancelled_by: 'misty',
      trade_cancelled_date: '2026-07-30T12:00:00Z',
      last_update: 200,
    };
    await json(route, { trade, affected_instances: {} });
  });

  await seedLogin(page);
  await openTradeActivity(page);
  await page.getByRole('button', { name: /^Sent, 1/ }).click();
  await page.getByRole('button', { name: 'Cancel proposal' }).click();
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByRole('button', { name: /^Sent, 0/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Closed, 1/ })).toBeVisible();
  await page.getByRole('button', { name: /^Closed, 1/ }).click();
  await expect(page.getByRole('button', { name: 'Re-Propose Trade' })).toBeVisible();
});

test('records satisfaction only from completed trade history', async ({ page }) => {
  let trade = {
    ...proposedTrade,
    trade_status: 'completed',
    user_proposed_completion_confirmed: true,
    user_accepting_completion_confirmed: true,
    user_1_trade_satisfaction: false,
    user_2_trade_satisfaction: false,
  };
  const trades = { [trade.trade_id]: trade };
  await installE2eRoutes(page, {
    trades,
    userOverview: { related_instances: instances },
  });
  await routeTradeCommand(page, async (route) => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toEqual({ satisfied: true });
    trade = { ...trade, user_2_trade_satisfaction: true, last_update: 200 };
    trades[trade.trade_id] = trade;
    await json(route, { trade, affected_instances: {} });
  });

  await seedLogin(page);
  await openTradeActivity(page);
  await page.getByRole('button', { name: /^Completed, 1/ }).click();
  await page.getByRole('button', { name: 'Mark as satisfying' }).click();

  await expect(page.getByRole('button', { name: 'Feedback saved' })).toBeVisible();
  await expect(page.getByText('Thanks for the feedback!')).toBeVisible();
});

test('uses a compact side-by-side comparison without horizontal overflow on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 336, height: 750 });
  await installE2eRoutes(page, {
    trades: { [proposedTrade.trade_id]: proposedTrade },
    userOverview: { related_instances: instances },
  });

  await seedLogin(page);
  await openTradeActivity(page);

  const card = page.locator('.trade-activity-card-shell').first();
  await expect(card).toBeVisible();
  const positions = await card.evaluate((element) => {
    const left = element.querySelector('.trade-pokemon > .pokemon:first-child');
    const summary = element.querySelector('.trade-pokemon > .center-column');
    const right = element.querySelector('.trade-pokemon > .pokemon:last-child');
    if (!left || !summary || !right) return null;
    return {
      leftTop: left.getBoundingClientRect().top,
      leftBottom: left.getBoundingClientRect().bottom,
      summaryTop: summary.getBoundingClientRect().top,
      rightTop: right.getBoundingClientRect().top,
      rightBottom: right.getBoundingClientRect().bottom,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(positions).not.toBeNull();
  expect(Math.abs(positions!.leftTop - positions!.rightTop)).toBeLessThanOrEqual(1);
  expect(positions!.summaryTop).toBeGreaterThanOrEqual(
    Math.max(positions!.leftBottom, positions!.rightBottom),
  );
  expect(positions!.documentWidth).toBeLessThanOrEqual(positions!.viewportWidth);
  const stageNavigation = page.getByLabel('Trade activity stage');
  await expect(stageNavigation).toBeVisible();
  const activityDescription = page.getByText(
    'Respond to offers, track active trades, and revisit past exchanges.',
  );
  await expect(activityDescription).toHaveCSS('text-align', 'center');
  const stageLayout = await stageNavigation.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    childrenFit: Array.from(element.querySelectorAll('button')).every((button) => {
      const buttonBounds = button.getBoundingClientRect();
      return (
        buttonBounds.left >= element.getBoundingClientRect().left &&
        buttonBounds.right <= element.getBoundingClientRect().right
      );
    }),
  }));
  expect(stageLayout.left).toBeGreaterThanOrEqual(0);
  expect(stageLayout.right).toBeLessThanOrEqual(336);
  expect(stageLayout.childrenFit).toBe(true);
});
