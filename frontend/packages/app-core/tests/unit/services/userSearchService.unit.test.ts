import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchForeignInstancesByUsername,
  fetchPublicUserByUsername,
  fetchTrainerAutocomplete,
} from '@/services/userSearchService';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL;

const makeResponse = (
  status: number,
  body: unknown = {},
  headers?: Record<string, string>,
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : status === 500 ? 'Server Error' : 'OK',
    headers: new Headers(headers ?? {}),
    json: async () => body,
  }) as Response;

describe.sequential('userSearchService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success from canonical endpoint and forwards ETag', async () => {
    const instances = {
      i1: { instance_id: 'i1', pokemon_id: 1, variant_id: '0001-default' },
    };

    fetchMock.mockResolvedValueOnce(
      makeResponse(200, { username: 'FakeUser0632', instances }, { ETag: 'etag-v1' }),
    );

    const outcome = await fetchForeignInstancesByUsername('fakeuser0632', 'cached-etag');

    expect(outcome).toEqual({
      type: 'success',
      username: 'FakeUser0632',
      instances,
      etag: 'etag-v1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${USERS_API_URL}/instances/by-username/fakeuser0632`,
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.headers).toEqual({ 'If-None-Match': 'cached-etag' });
  });

  it('falls back to public endpoint when canonical lookup returns 404', async () => {
    const instances = {
      i2: { instance_id: 'i2', pokemon_id: 2, variant_id: '0002-default' },
    };

    fetchMock
      .mockResolvedValueOnce(makeResponse(404))
      .mockResolvedValueOnce(
        makeResponse(200, { user: { username: 'LegacyUser' }, instances }, { ETag: 'pub-v1' }),
      );

    const outcome = await fetchForeignInstancesByUsername('legacyuser');

    expect(outcome).toEqual({
      type: 'success',
      username: 'LegacyUser',
      instances,
      etag: 'pub-v1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${USERS_API_URL}/instances/by-username/legacyuser`,
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${USERS_API_URL}/public/users/legacyuser`,
    );
  });

  it('returns notModified for 304 responses', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(304));

    const outcome = await fetchForeignInstancesByUsername('fakeuser0632', 'etag-1');
    expect(outcome).toEqual({ type: 'notModified' });
  });

  it('returns forbidden when canonical endpoint is forbidden and public fallback does not recover', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(403))
      .mockResolvedValueOnce(makeResponse(403));

    const outcome = await fetchForeignInstancesByUsername('hiddenuser');
    expect(outcome).toEqual({ type: 'forbidden' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns notFound when canonical + public endpoints both return 404', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(404))
      .mockResolvedValueOnce(makeResponse(404));

    const outcome = await fetchForeignInstancesByUsername('missinguser');
    expect(outcome).toEqual({ type: 'notFound' });
  });

  it('returns error payload for non-recoverable HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500));

    const outcome = await fetchForeignInstancesByUsername('broken');
    expect(outcome).toEqual({
      type: 'error',
      status: 500,
      statusText: 'Server Error',
    });
  });

  it('fetches trainer autocomplete results', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, [{ username: 'ash', pokemonGoName: 'Ash Ketchum' }]),
    );

    const outcome = await fetchTrainerAutocomplete('ash');
    expect(outcome).toEqual({
      type: 'success',
      results: [{ username: 'ash', pokemonGoName: 'Ash Ketchum' }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${USERS_API_URL}/autocomplete-trainers?q=ash`,
    );
  });

  it('returns autocomplete errors with backend message when available', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(400, { message: 'Query must be at least 2 characters.' }),
    );

    const outcome = await fetchTrainerAutocomplete('a');
    expect(outcome).toEqual({
      type: 'error',
      status: 400,
      message: 'Query must be at least 2 characters.',
    });
  });

  it('returns friendly autocomplete message when response payload is malformed', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, { results: [{ username: 'ash' }] }),
    );

    const outcome = await fetchTrainerAutocomplete('ash');
    expect(outcome).toEqual({
      type: 'error',
      message: "Looks like this trainer hasn't signed up for Pokémon Go Nexus yet.",
    });
  });

  it('fetches public user lookup by username and returns user_id', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, {
        user: { user_id: 'user-42', username: 'FakeUser0632' },
      }),
    );

    const outcome = await fetchPublicUserByUsername('fakeuser0632');
    expect(outcome).toEqual({
      type: 'success',
      username: 'FakeUser0632',
      userId: 'user-42',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${USERS_API_URL}/public/users/fakeuser0632`,
    );
  });

  it('returns notFound for missing public user snapshot', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(404));

    const outcome = await fetchPublicUserByUsername('missing');
    expect(outcome).toEqual({ type: 'notFound' });
  });
});
