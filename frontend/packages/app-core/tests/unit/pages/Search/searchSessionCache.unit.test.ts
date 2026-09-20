import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearSearchSession,
  createDefaultPokemonSearchDraft,
  patchSearchSession,
  readSearchSession,
  writeSearchSession,
} from '@/pages/Search/searchSessionCache';

describe('searchSessionCache', () => {
  beforeEach(() => {
    clearSearchSession();
  });

  it('round-trips a completed search for only the owning account', () => {
    const draft = {
      ...createDefaultPokemonSearchDraft(),
      pokemon: 'Pikachu',
      ownershipMode: 'trade' as const,
    };

    writeSearchSession({
      ownerKey: 'user-a',
      queryParams: { pokemon_id: 25, ownership: 'trade' },
      draft,
      rawResults: [{ pokemon_id: 25, username: 'Misty' }],
      boundaryWKT: null,
      ownershipMode: 'trade',
      searchMode: 'pokemon',
      view: 'list',
      scrollY: 240,
    });

    expect(readSearchSession('user-a')).toMatchObject({
      ownerKey: 'user-a',
      draft: { pokemon: 'Pikachu', ownershipMode: 'trade' },
      rawResults: [{ pokemon_id: 25, username: 'Misty' }],
      scrollY: 240,
    });
    expect(readSearchSession('user-b')).toBeNull();
  });

  it('patches navigation state without discarding filters or results', () => {
    writeSearchSession({
      ownerKey: 'user-a',
      queryParams: { pokemon_id: 1 },
      draft: createDefaultPokemonSearchDraft(),
      rawResults: [{ pokemon_id: 1 }],
      boundaryWKT: null,
      ownershipMode: 'caught',
      searchMode: 'pokemon',
      view: 'list',
      scrollY: 0,
    });

    patchSearchSession('user-a', { view: 'map', scrollY: 812 });

    expect(readSearchSession('user-a')).toMatchObject({
      queryParams: { pokemon_id: 1 },
      rawResults: [{ pokemon_id: 1 }],
      view: 'map',
      scrollY: 812,
    });
  });

  it('ignores malformed persisted data', () => {
    window.sessionStorage.setItem(
      'pokegonexus.search-session.v1:user-a',
      JSON.stringify({ version: 1, ownerKey: 'somebody-else' }),
    );

    expect(readSearchSession('user-a')).toBeNull();
  });
});
