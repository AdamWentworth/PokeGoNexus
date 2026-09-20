import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionRow } from '../../../src/features/collection/collectionModel';
import {
  buildNativeTradeBoardModel,
  nativeTradeBoardFilename,
} from '../../../src/features/tradeBoard/nativeTradeBoardModel';

const row = (patch: Partial<NativeCollectionRow>): NativeCollectionRow => ({
  cp: null,
  favorite: false,
  id: 'instance-1',
  imageUri: 'https://pokegonexus.com/images/pikachu.png',
  locationBackgroundUri: null,
  lucky: false,
  maxKind: null,
  mostWanted: false,
  name: 'Pikachu',
  pokedexNumber: 25,
  pokemonId: 25,
  purified: false,
  source: 'instance',
  status: 'trade',
  typeIconUris: [],
  ...patch,
});

const instance = (patch: Partial<PokemonInstance>): PokemonInstance => ({
  instance_id: 'instance-1',
  pref_lucky: false,
  ...patch,
} as PokemonInstance);

describe('nativeTradeBoardModel', () => {
  it('groups equivalent listings while preserving wanted priorities', () => {
    const model = buildNativeTradeBoardModel({
      boardUrl: 'https://pokegonexus.com/trade-board/AdamZilla',
      generatedAt: '2026-08-25T00:00:00.000Z',
      instances: {
        one: instance({ instance_id: 'trade-1' }),
        two: instance({ instance_id: 'trade-2' }),
        wanted: instance({ instance_id: 'wanted-1', pref_lucky: true }),
      },
      pokemonGoName: 'AdamGO',
      rows: [
        row({ id: 'trade-1' }),
        row({ id: 'trade-2' }),
        row({ id: 'wanted-1', mostWanted: true, status: 'wanted' }),
      ],
      username: 'AdamZilla',
    });

    expect(model.tradeCount).toBe(2);
    expect(model.tradeEntries).toHaveLength(1);
    expect(model.tradeEntries[0]?.quantity).toBe(2);
    expect(model.wantedEntries[0]).toEqual(expect.objectContaining({
      luckyRequested: true,
      mostWanted: true,
    }));
    expect(model.pokemonGoName).toBe('AdamGO');
  });

  it('can hide either board section without mutating the source rows', () => {
    const model = buildNativeTradeBoardModel({
      boardUrl: 'https://pokegonexus.com/trade-board/Misty',
      includeTrade: false,
      instances: { wanted: instance({ instance_id: 'wanted-1' }) },
      rows: [row({ id: 'wanted-1', status: 'wanted' })],
      username: 'Misty',
    });
    expect(model.tradeCount).toBe(0);
    expect(model.tradeEntries).toEqual([]);
    expect(model.wantedCount).toBe(1);
  });

  it('creates a stable safe image filename', () => {
    expect(nativeTradeBoardFilename('Adam Zilla!', '2026-08-25T10:00:00.000Z'))
      .toBe('pokegonexus-Adam-Zilla-trade-board-2026-08-25.png');
  });
});
