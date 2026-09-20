import { describe, expect, it } from 'vitest';

import {
  buildPokemonSearchQueryParams,
  findMatchingPokemonVariant,
  preparePokemonSearchQuery,
  validateBackgroundCostumePair,
  validateSearchInput,
} from '@/pages/Search/utils/buildPokemonSearchQuery';
import type { PokemonVariant } from '@/types/pokemonVariants';

const pokemonCache = [
  {
    pokemon_id: 1,
    name: 'Bulbasaur',
    form: null,
    costumes: [{ name: 'Party', costume_id: 7 }],
    backgrounds: [
      {
        background_id: 41,
        costume_id: null,
        image_url: '/images/base-bg.png',
        name: 'Base City',
        location: 'Seattle',
        date: '2025-01-01',
      },
      {
        background_id: 42,
        costume_id: 7,
        image_url: '/images/party-bg.png',
        name: 'Party City',
        location: 'Seattle',
        date: '2025-01-02',
      },
    ],
  },
  {
    pokemon_id: 25,
    name: 'Pikachu',
    form: 'Rockstar',
    costumes: [{ name: 'Rockstar', costume_id: 25 }],
  },
] as unknown as PokemonVariant[];

describe('buildPokemonSearchQuery utils', () => {
  it('validates blocking shadow+trade/wanted constraints', () => {
    const error = validateSearchInput({
      isShadow: true,
      ownershipMode: 'trade',
      pokemon: 'Bulbasaur',
      useCurrentLocation: false,
      city: 'Seattle',
      coordinates: { latitude: 47.6, longitude: -122.3 },
      pokemonCache,
    });

    expect(error).toBe('Shadow Pokemon cannot be listed for trade or wanted');
  });

  it('matches pokemon by name and optional form', () => {
    expect(findMatchingPokemonVariant(pokemonCache, 'bulbasaur', '')?.pokemon_id).toBe(1);
    expect(findMatchingPokemonVariant(pokemonCache, 'pikachu', 'rockstar')?.pokemon_id).toBe(25);
    expect(findMatchingPokemonVariant(pokemonCache, 'pikachu', 'libre')).toBeUndefined();
  });

  it('validates exact background and costume pairs', () => {
    const bulbasaur = pokemonCache[0];

    expect(validateBackgroundCostumePair(bulbasaur, null, 41)).toBeNull();
    expect(validateBackgroundCostumePair(bulbasaur, 'Party', 42)).toBeNull();
    expect(validateBackgroundCostumePair(bulbasaur, 'Party', 41)).toBe(
      'The selected background and costume do not form a valid Pokémon combination.',
    );
    expect(validateBackgroundCostumePair(bulbasaur, null, 42)).toBe(
      'The selected background and costume do not form a valid Pokémon combination.',
    );
    expect(validateBackgroundCostumePair(bulbasaur, null, 999)).toBe(
      'The selected background is not available for this Pokémon.',
    );
    expect(validateBackgroundCostumePair(bulbasaur, 'Missing', 41)).toBe(
      'The selected costume is not available for this Pokémon.',
    );
  });

  it('builds trade query with caught and wanted fields normalized out', () => {
    const query = buildPokemonSearchQueryParams({
      matchingPokemon: pokemonCache[0],
      costume: 'Party',
      isShiny: false,
      isShadow: false,
      selectedMoves: { fastMove: 1, chargedMove1: 2, chargedMove2: 3 },
      selectedGender: 'Female',
      selectedBackgroundId: 42,
      ivs: { Attack: 15, Defense: 14, Stamina: 13 },
      onlyMatchingTrades: true,
      prefLucky: true,
      friendshipLevel: 4,
      alreadyRegistered: true,
      tradeInWantedList: true,
      coordinates: { latitude: 47.6, longitude: -122.3 },
      ownershipMode: 'trade',
      range: 5,
      resultsLimit: 10,
      dynamax: false,
      gigantamax: false,
    });

    expect(query).toMatchObject({
      ownership: 'trade',
      costume_id: 7,
      only_matching_trades: true,
      attack_iv: null,
      defense_iv: null,
      stamina_iv: null,
      pref_lucky: null,
      friendship_level: null,
      already_registered: null,
      trade_in_wanted_list: null,
    });
  });

  it('builds wanted query with trade-only fields normalized out', () => {
    const query = buildPokemonSearchQueryParams({
      matchingPokemon: pokemonCache[0],
      costume: '',
      isShiny: false,
      isShadow: false,
      selectedMoves: { fastMove: null, chargedMove1: null, chargedMove2: null },
      selectedGender: 'Any',
      selectedBackgroundId: null,
      ivs: { Attack: 15, Defense: 14, Stamina: 13 },
      onlyMatchingTrades: true,
      prefLucky: true,
      friendshipLevel: 4,
      alreadyRegistered: true,
      tradeInWantedList: true,
      coordinates: { latitude: 47.6, longitude: -122.3 },
      ownershipMode: 'wanted',
      range: 5,
      resultsLimit: 10,
      dynamax: false,
      gigantamax: false,
    });

    expect(query).toMatchObject({
      ownership: 'wanted',
      only_matching_trades: null,
      attack_iv: null,
      defense_iv: null,
      stamina_iv: null,
      pref_lucky: true,
      friendship_level: 4,
      already_registered: true,
      trade_in_wanted_list: true,
    });
  });

  it('prepares search query and surfaces validation errors without expansion', () => {
    const prepared = preparePokemonSearchQuery({
      pokemon: '',
      selectedForm: '',
      isShiny: false,
      isShadow: false,
      costume: '',
      selectedMoves: { fastMove: null, chargedMove1: null, chargedMove2: null },
      selectedGender: 'Any',
      selectedBackgroundId: null,
      dynamax: false,
      gigantamax: false,
      city: 'Seattle',
      useCurrentLocation: false,
      ownershipMode: 'caught',
      coordinates: { latitude: 47.6, longitude: -122.3 },
      range: 5,
      resultsLimit: 10,
      ivs: { Attack: null, Defense: null, Stamina: null },
      onlyMatchingTrades: false,
      prefLucky: false,
      friendshipLevel: 0,
      alreadyRegistered: false,
      tradeInWantedList: false,
      pokemonCache,
    });

    expect(prepared).toEqual({
      ok: false,
      errorMessage: 'Please provide a Pokemon name.',
      shouldExpandSearchBar: false,
    });
  });

  it('prepares search query and requests expansion when no pokemon match exists', () => {
    const prepared = preparePokemonSearchQuery({
      pokemon: 'Missingno',
      selectedForm: '',
      isShiny: false,
      isShadow: false,
      costume: '',
      selectedMoves: { fastMove: null, chargedMove1: null, chargedMove2: null },
      selectedGender: 'Any',
      selectedBackgroundId: null,
      dynamax: false,
      gigantamax: false,
      city: 'Seattle',
      useCurrentLocation: false,
      ownershipMode: 'caught',
      coordinates: { latitude: 47.6, longitude: -122.3 },
      range: 5,
      resultsLimit: 10,
      ivs: { Attack: null, Defense: null, Stamina: null },
      onlyMatchingTrades: false,
      prefLucky: false,
      friendshipLevel: 0,
      alreadyRegistered: false,
      tradeInWantedList: false,
      pokemonCache,
    });

    expect(prepared).toEqual({
      ok: false,
      errorMessage: 'No matching Pokemon found in the default list.',
      shouldExpandSearchBar: true,
    });
  });

  it('prepares successful query params when inputs are valid and match exists', () => {
    const prepared = preparePokemonSearchQuery({
      pokemon: 'Bulbasaur',
      selectedForm: '',
      isShiny: false,
      isShadow: false,
      costume: 'Party',
      selectedMoves: { fastMove: 1, chargedMove1: 2, chargedMove2: 3 },
      selectedGender: 'Female',
      selectedBackgroundId: 42,
      dynamax: false,
      gigantamax: false,
      city: 'Seattle',
      useCurrentLocation: false,
      ownershipMode: 'trade',
      coordinates: { latitude: 47.6, longitude: -122.3 },
      range: 5,
      resultsLimit: 10,
      ivs: { Attack: 15, Defense: 14, Stamina: 13 },
      onlyMatchingTrades: true,
      prefLucky: true,
      friendshipLevel: 4,
      alreadyRegistered: true,
      tradeInWantedList: true,
      pokemonCache,
    });

    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.queryParams).toMatchObject({
        pokemon_id: 1,
        ownership: 'trade',
        costume_id: 7,
        only_matching_trades: true,
      });
    }
  });

  it('blocks a stale impossible background and costume pair before searching', () => {
    const prepared = preparePokemonSearchQuery({
      pokemon: 'Bulbasaur',
      selectedForm: '',
      isShiny: false,
      isShadow: false,
      costume: 'Party',
      selectedMoves: { fastMove: null, chargedMove1: null, chargedMove2: null },
      selectedGender: 'Any',
      selectedBackgroundId: 41,
      dynamax: false,
      gigantamax: false,
      city: 'Seattle',
      useCurrentLocation: false,
      ownershipMode: 'caught',
      coordinates: { latitude: 47.6, longitude: -122.3 },
      range: 5,
      resultsLimit: 10,
      ivs: { Attack: null, Defense: null, Stamina: null },
      onlyMatchingTrades: false,
      prefLucky: false,
      friendshipLevel: 0,
      alreadyRegistered: false,
      tradeInWantedList: false,
      pokemonCache,
    });

    expect(prepared).toEqual({
      ok: false,
      errorMessage:
        'The selected background and costume do not form a valid Pokémon combination.',
      shouldExpandSearchBar: true,
    });
  });
});
