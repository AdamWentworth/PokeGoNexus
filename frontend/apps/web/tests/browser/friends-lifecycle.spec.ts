import { expect, test, type Page, type Route } from '@playwright/test';

import { attachBrowserDiagnostics } from './support/diagnostics';
import { installE2eRoutes } from './support/e2eRoutes';

const currentUser = {
  user_id: 'friends-user-1',
  username: 'ash',
  email: 'ash@example.invalid',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

type Friend = {
  user_id: string;
  username: string;
  pokemonGoName?: string;
  team?: string;
  trainer_level?: number;
  friendship_id: string;
  direction: 'accepted' | 'incoming' | 'outgoing' | 'blocked';
};

type FriendsState = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  blocked: Friend[];
};

const friend = (
  userId: string,
  username: string,
  friendshipId: string,
  direction: Friend['direction'],
  pokemonGoName?: string,
): Friend => ({
  user_id: userId,
  username,
  pokemonGoName,
  team: 'Mystic',
  trainer_level: 50,
  friendship_id: friendshipId,
  direction,
});

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

async function installMutableFriendsApi(page: Page, state: FriendsState) {
  const commands: string[] = [];
  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/(?:api|__e2e)\/users/, '');
    const method = request.method();
    commands.push(`${method} ${path}`);

    if (method === 'GET' && path === '/friends') {
      await fulfillJson(route, state);
      return;
    }

    if (method === 'POST' && path === '/friends/requests') {
      const { username } = request.postDataJSON() as { username: string };
      state.outgoing.push(friend('may-user', username, 'friendship-may', 'outgoing', 'MayGo'));
      await fulfillJson(route, { friendship_id: 'friendship-may' });
      return;
    }

    const acceptMatch = path.match(/^\/friends\/requests\/([^/]+)\/accept$/);
    if (method === 'POST' && acceptMatch) {
      const index = state.incoming.findIndex((entry) => entry.friendship_id === acceptMatch[1]);
      if (index >= 0) {
        const [accepted] = state.incoming.splice(index, 1);
        state.friends.push({ ...accepted, direction: 'accepted' });
      }
      await fulfillJson(route, { success: true });
      return;
    }

    const requestMatch = path.match(/^\/friends\/requests\/([^/]+)$/);
    if (method === 'DELETE' && requestMatch) {
      state.incoming = state.incoming.filter(
        (entry) => entry.friendship_id !== requestMatch[1],
      );
      state.outgoing = state.outgoing.filter(
        (entry) => entry.friendship_id !== requestMatch[1],
      );
      await route.fulfill({ status: 204 });
      return;
    }

    const unblockMatch = path.match(/^\/friends\/blocks\/([^/]+)$/);
    if (method === 'DELETE' && unblockMatch) {
      state.blocked = state.blocked.filter((entry) => entry.user_id !== unblockMatch[1]);
      await route.fulfill({ status: 204 });
      return;
    }

    const friendMatch = path.match(/^\/friends\/([^/]+)$/);
    if (method === 'DELETE' && friendMatch) {
      state.friends = state.friends.filter((entry) => entry.user_id !== friendMatch[1]);
      await route.fulfill({ status: 204 });
      return;
    }

    await fulfillJson(route, { message: `Unhandled friends route: ${method} ${path}` }, 404);
  };

  for (const pattern of ['**/api/users/friends**', '**/__e2e/users/friends**']) {
    await page.route(pattern, handler);
  }
  return commands;
}

test('completes the friends request, discovery, removal, and unblock lifecycle', async ({
  page,
}, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  const state: FriendsState = {
    friends: [friend('brock-user', 'brock', 'friendship-brock', 'accepted', 'BrockGo')],
    incoming: [friend('misty-user', 'misty', 'friendship-misty', 'incoming', 'MistyGo')],
    outgoing: [friend('gary-user', 'gary', 'friendship-gary', 'outgoing', 'GaryGo')],
    blocked: [
      friend('giovanni-user', 'giovanni', 'friendship-giovanni', 'blocked', 'BossRocket'),
    ],
  };

  await installE2eRoutes(page, {
    friendsOverview: state,
    trainerSuggestions: [
      { username: 'ash', pokemonGoName: 'AshGo' },
      { username: 'may', pokemonGoName: 'MayGo', team: 'Valor', trainer_level: 48 },
    ],
  });
  const commands = await installMutableFriendsApi(page, state);
  await seedLogin(page);
  await page.goto('/profile/friends', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Friends\s*1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Requests\s*2/ })).toBeVisible();

  await page.getByRole('button', { name: /Requests\s*2/ }).click();
  await page.getByRole('button', { name: 'Accept misty' }).click();
  await expect(page.getByText('Friend request accepted')).toBeVisible();
  await expect(page.getByRole('button', { name: /Friends\s*2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Requests\s*1/ })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel request to gary' }).click();
  await expect(page.getByText('Friend request canceled')).toBeVisible();
  await expect(page.getByRole('button', { name: /Requests\s*0/ })).toBeVisible();

  await page.getByRole('button', { name: /^Find$/ }).click();
  await page.getByPlaceholder('Username or Pokemon GO name').fill('MayGo');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('MayGo')).toBeVisible();
  await page.getByRole('button', { name: 'Add may' }).click();
  await expect(page.getByText('Friend request sent')).toBeVisible();
  await expect(page.getByRole('button', { name: /Requests\s*1/ })).toBeVisible();

  await page.getByRole('button', { name: /Friends\s*2/ }).click();
  await page.getByRole('button', { name: 'Remove brock' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm action' })).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Friend removed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Friends\s*1/ })).toBeVisible();

  await page.getByRole('button', { name: /Blocked\s*1/ }).click();
  await page.getByRole('button', { name: 'Unblock' }).click();
  await expect(page.getByText('Trainer unblocked')).toBeVisible();
  await expect(page.getByRole('button', { name: /Blocked\s*0/ })).toBeVisible();

  expect(commands.filter((command) => command !== 'GET /friends')).toEqual([
    'POST /friends/requests/friendship-misty/accept',
    'DELETE /friends/requests/friendship-gary',
    'POST /friends/requests',
    'DELETE /friends/brock-user',
    'DELETE /friends/blocks/giovanni-user',
  ]);
  expect(diagnostics.blockingErrors()).toEqual([]);
});

test('keeps an incoming request actionable when the server rejects acceptance', async ({
  page,
}, testInfo) => {
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  const incoming = friend('misty-user', 'misty', 'friendship-misty', 'incoming', 'MistyGo');
  await installE2eRoutes(page, {
    friendsOverview: { friends: [], incoming: [incoming], outgoing: [], blocked: [] },
  });
  for (const pattern of [
    '**/api/users/friends/requests/friendship-misty/accept',
    '**/__e2e/users/friends/requests/friendship-misty/accept',
  ]) {
    await page.route(pattern, async (route) => {
      await fulfillJson(route, { message: 'This request is no longer available.' }, 409);
    });
  }

  await seedLogin(page);
  await page.goto('/profile/friends', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Requests\s*1/ }).click();
  await page.getByRole('button', { name: 'Accept misty' }).click();

  await expect(page.getByText('This request is no longer available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept misty' })).toBeVisible();
  expect(
    diagnostics.blockingErrors().filter((event) => !(
      event.kind === 'console' &&
      event.text.includes('409 (Conflict)') &&
      event.location?.url.includes('/friends/requests/friendship-misty/accept')
    )),
  ).toEqual([]);
});
