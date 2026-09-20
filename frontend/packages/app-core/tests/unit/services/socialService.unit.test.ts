import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptFriendRequest,
  deleteFriendRequest,
  fetchFriendsOverview,
  fetchOwnTrainerProfile,
  fetchTrainerPreferences,
  fetchTrainerProfile,
  removeFriend,
  sendFriendRequest,
  updateTrainerPreferences,
  updateTrainerProfile,
} from '@/services/socialService';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe.sequential('socialService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a normalized public profile with authenticated cookies', async () => {
    const profile = {
      user: {
        user_id: 'u-1',
        username: 'Misty',
        app_joined_at: '2026-01-01T00:00:00Z',
      },
      stats: {
        caught: 10,
        for_trade: 1,
        wanted: 2,
        favorites: 3,
        registered: 9,
      },
      highlights: [],
      viewer: {
        relationship: 'none',
        can_view_profile: true,
        can_view_collection: true,
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));

    await expect(fetchTrainerProfile('MiStY')).resolves.toEqual(profile);
    expect(fetchMock.mock.calls[0][0]).toBe(`${USERS_API_URL}/profiles/misty`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('loads the signed-in trainer profile without requiring a public username lookup', async () => {
    const profile = {
      user: {
        user_id: 'u-1',
        username: 'Adam',
        app_joined_at: '2026-01-01T00:00:00Z',
      },
      stats: {
        caught: 0,
        for_trade: 0,
        wanted: 0,
        favorites: 0,
        registered: 0,
      },
      highlights: [],
      viewer: {
        relationship: 'self',
        can_view_profile: true,
        can_view_collection: true,
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));

    await expect(fetchOwnTrainerProfile()).resolves.toEqual(profile);
    expect(fetchMock.mock.calls[0][0]).toBe(`${USERS_API_URL}/profile`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
    });
  });

  it('sends profile and preference updates to their distinct endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user_id: 'u-1',
          profile_visibility: 'friends',
          collection_visibility: 'friends',
          friend_request_permission: 'everyone',
          trainer_code_visibility: 'friends',
          coordination_method: 'campfire',
          coordination_handle: null,
          share_trade_contact: true,
          show_location: false,
          show_pokemon_go_name: true,
        }),
      );

    await updateTrainerProfile({
      trainer_titles: ['raid-regular', 'egg-hatcher'],
    });
    await updateTrainerPreferences({
      profile_visibility: 'friends',
      collection_visibility: 'friends',
      friend_request_permission: 'everyone',
      trainer_code_visibility: 'friends',
      coordination_method: 'campfire',
      coordination_handle: null,
      share_trade_contact: true,
      show_location: false,
      show_pokemon_go_name: true,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${USERS_API_URL}/profile`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({
        trainer_titles: ['raid-regular', 'egg-hatcher'],
      }),
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`${USERS_API_URL}/preferences`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('loads preferences and the complete friendship inbox', async () => {
    const preferences = {
      user_id: 'u-1',
      profile_visibility: 'public',
      collection_visibility: 'public',
      friend_request_permission: 'everyone',
      trainer_code_visibility: 'friends',
      coordination_method: 'campfire',
      coordination_handle: null,
      share_trade_contact: true,
      show_location: false,
      show_pokemon_go_name: true,
    };
    const friends = {
      friends: [],
      incoming: [{ user_id: 'u-2', username: 'Brock' }],
      outgoing: [],
      blocked: [],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, preferences))
      .mockResolvedValueOnce(jsonResponse(200, friends));

    await expect(fetchTrainerPreferences()).resolves.toEqual(preferences);
    await expect(fetchFriendsOverview()).resolves.toEqual(friends);
  });

  it('preserves friend request lifecycle method and path semantics', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { friendship_id: 'f-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(jsonResponse(204, null))
      .mockResolvedValueOnce(jsonResponse(204, null));

    await sendFriendRequest('Brock');
    await acceptFriendRequest('f-1');
    await deleteFriendRequest('f-1');
    await removeFriend('u-2');

    expect(
      fetchMock.mock.calls.map(([url, init]) => [
        url,
        (init as RequestInit).method,
      ]),
    ).toEqual([
      [`${USERS_API_URL}/friends/requests`, 'POST'],
      [`${USERS_API_URL}/friends/requests/f-1/accept`, 'POST'],
      [`${USERS_API_URL}/friends/requests/f-1`, 'DELETE'],
      [`${USERS_API_URL}/friends/u-2`, 'DELETE'],
    ]);
  });

  it('surfaces backend privacy errors as normalized HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { message: 'This trainer profile is private' }),
    );

    await expect(fetchTrainerProfile('hidden')).rejects.toMatchObject({
      message: 'This trainer profile is private',
      response: {
        status: 403,
        data: { message: 'This trainer profile is private' },
      },
    });
  });
});
