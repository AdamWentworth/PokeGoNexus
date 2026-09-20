import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPokemonCommunityRankings,
  SEARCH_REQUEST_TIMEOUT_MS,
  searchPokemon,
} from '@/services/searchService';

describe('searchService.searchPokemon', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns array payload from search endpoint', async () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ pokemon_id: 1 }, { pokemon_id: 2 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await searchPokemon({ ownership: 'caught' });

    expect(result).toEqual([{ pokemon_id: 1 }, { pokemon_id: 2 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/searchPokemon?ownership=caught'),
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(timeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      SEARCH_REQUEST_TIMEOUT_MS,
    );
  });

  it('normalizes object payload into array rows', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          a: { pokemon_id: 1 },
          b: { pokemon_id: 2 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await searchPokemon({ ownership: 'trade' });

    expect(result).toEqual([{ pokemon_id: 1 }, { pokemon_id: 2 }]);
  });

  it('throws normalized error on non-2xx responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(searchPokemon({ ownership: 'wanted' })).rejects.toMatchObject({
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    });
  });
});

describe('searchService.getPokemonCommunityRankings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests and returns the precomputed community snapshot', async () => {
    const payload = {
      privacy_threshold: 5,
      snapshot: {
        collector_users: 12,
        wishlist_users: 9,
        updated_at: '2026-07-25T12:00:00Z',
      },
      most_wanted: [
        {
          variant_id: '25-default',
          wanted_users: 7,
          most_wanted_users: 2,
          caught_users: 4,
        },
      ],
      rarest: [],
    };
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(getPokemonCommunityRankings(40)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rankings?limit=40'),
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        cache: 'no-cache',
      }),
    );
  });

  it('rejects unavailable snapshots with a user-facing message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'not ready' }), { status: 503 }),
    );

    await expect(getPokemonCommunityRankings()).rejects.toThrow(
      'Community rankings are temporarily unavailable.',
    );
  });
});
