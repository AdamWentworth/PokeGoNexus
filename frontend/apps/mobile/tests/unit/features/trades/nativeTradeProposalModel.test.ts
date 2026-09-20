import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeInstanceDetail } from '../../../../src/features/collection/collectionModel';
import { buildNativeTradeProposalSelection } from '../../../../src/features/trades/nativeTradeProposalModel';

const parseVariantId = (input: string) => ({ baseKey: input });

const pokemonInstance = (
  overrides: Partial<PokemonInstance>,
): PokemonInstance => ({
  instance_id: 'instance-1',
  variant_id: '0001-default',
  pokemon_id: 1,
  is_caught: false,
  is_for_trade: false,
  is_wanted: false,
  friendship_level: 1,
  ...overrides,
} as PokemonInstance);

const detail = (
  status: 'caught' | 'trade' | 'wanted',
  instance: PokemonInstance,
): NativeInstanceDetail => ({
  row: {
    id: instance.instance_id ?? '',
    pokemonId: instance.pokemon_id,
    pokedexNumber: instance.pokemon_id,
    name: instance.variant_id,
    imageUri: null,
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status,
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  instance,
  traits: [],
  stats: [],
  ivs: [],
  moves: [],
  provenance: [],
  preferences: [],
});

describe('native trade proposal selection', () => {
  it('uses a For Trade listing as theirs and its selected Wanted target as mine', () => {
    const theirs = detail('trade', pokemonInstance({
      instance_id: 'theirs-charizard',
      variant_id: '0006-default',
      pokemon_id: 6,
      is_caught: true,
      is_for_trade: true,
    }));
    const wantedTarget = detail('wanted', pokemonInstance({
      instance_id: 'their-wanted-bulbasaur',
      variant_id: '0001-default',
      is_wanted: true,
      friendship_level: 5,
      pref_lucky: false,
    }));
    const mine = pokemonInstance({
      instance_id: 'mine-bulbasaur',
      is_caught: true,
      is_for_trade: true,
    });

    const result = buildNativeTradeProposalSelection({
      listing: theirs,
      selectedTarget: wantedTarget,
      ownedInstances: { 'mine-bulbasaur': mine },
      activeTrades: [],
      parseVariantId,
    });

    expect(result).toEqual(expect.objectContaining({
      kind: 'proposalReady',
      acceptingInstanceId: 'theirs-charizard',
      candidateVariantId: '0001-default',
      friendshipLevel: 5,
      luckyRequested: false,
      partnerPokemon: theirs,
      offeredInstances: [expect.objectContaining({ instance_id: 'mine-bulbasaur' })],
    }));
  });

  it('uses the Wanted listing as mine and the selected return as theirs', () => {
    const theirWanted = detail('wanted', pokemonInstance({
      instance_id: 'their-wanted-bulbasaur',
      variant_id: '0001-default',
      is_wanted: true,
      friendship_level: 4,
      pref_lucky: true,
    }));
    const theirReturn = detail('trade', pokemonInstance({
      instance_id: 'theirs-charizard',
      variant_id: '0006-default',
      pokemon_id: 6,
      is_caught: true,
      is_for_trade: true,
    }));
    const mine = pokemonInstance({
      instance_id: 'mine-bulbasaur',
      is_caught: true,
      is_for_trade: true,
    });

    const result = buildNativeTradeProposalSelection({
      listing: theirWanted,
      selectedTarget: theirReturn,
      ownedInstances: { 'mine-bulbasaur': mine },
      activeTrades: [],
      parseVariantId,
    });

    expect(result).toEqual(expect.objectContaining({
      kind: 'proposalReady',
      acceptingInstanceId: 'theirs-charizard',
      candidateVariantId: '0001-default',
      friendshipLevel: 4,
      luckyRequested: true,
      partnerPokemon: theirReturn,
    }));
  });

  it('returns the canonical mark-For-Trade stage instead of skipping it', () => {
    const theirWanted = detail('wanted', pokemonInstance({
      instance_id: 'their-wanted-bulbasaur',
      is_wanted: true,
    }));
    const theirReturn = detail('trade', pokemonInstance({
      instance_id: 'theirs-charizard',
      variant_id: '0006-default',
      pokemon_id: 6,
      is_caught: true,
      is_for_trade: true,
    }));
    const mine = pokemonInstance({
      instance_id: 'mine-bulbasaur',
      is_caught: true,
      is_for_trade: false,
    });

    const result = buildNativeTradeProposalSelection({
      listing: theirWanted,
      selectedTarget: theirReturn,
      ownedInstances: { 'mine-bulbasaur': mine },
      activeTrades: [],
      parseVariantId,
    });

    expect(result).toEqual(expect.objectContaining({
      kind: 'needsTradeSelection',
      caughtInstances: [mine],
    }));
  });
});
