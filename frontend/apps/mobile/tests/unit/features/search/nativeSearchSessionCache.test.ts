import * as SecureStore from 'expo-secure-store';
import {
  clearNativeSearchSession,
  hydrateNativeSearchSession,
  patchNativeSearchSession,
  readNativeSearchSession,
  writeNativeSearchSession,
} from '../../../../src/features/search/nativeSearchSessionCache';
import { createNativePokemonSearchDraft } from '../../../../src/features/search/nativePokemonSearchDraft';

const pokemonQuery = {
  pokemon_id: 25,
  shiny: false,
  shadow: false,
  costume_id: null,
  fast_move_id: null,
  charged_move_1_id: null,
  charged_move_2_id: null,
  gender: null,
  background_id: null,
  attack_iv: null,
  defense_iv: null,
  stamina_iv: null,
  only_matching_trades: null,
  pref_lucky: null,
  friendship_level: null,
  already_registered: null,
  trade_in_wanted_list: null,
  latitude: 49.25,
  longitude: -122.98,
  ownership: 'trade' as const,
  range_km: 25,
  limit: 20,
  dynamax: false,
  gigantamax: false,
};

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockedSecureStore = jest.mocked(SecureStore);

describe('nativeSearchSessionCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNativeSearchSession();
  });

  it('keeps each trainer search session isolated in memory', () => {
    const draft = createNativePokemonSearchDraft({ city: 'Burnaby' });
    writeNativeSearchSession({
      activeView: 'pokemon',
      draft,
      executedDraft: draft,
      ownerKey: 'trainer-1',
      pokemonDisplayMode: 'map',
      pokemonQuery,
      pokemonScrollOffset: 480,
      trainerQuery: '',
      trainerScrollOffset: 0,
    });

    expect(readNativeSearchSession('trainer-1')).toEqual(expect.objectContaining({
      activeView: 'pokemon',
      pokemonDisplayMode: 'map',
      pokemonScrollOffset: 480,
    }));
    expect(readNativeSearchSession('trainer-2')).toBeNull();
  });

  it('patches navigation and scroll context without losing the executed search', () => {
    const draft = createNativePokemonSearchDraft({ city: 'Burnaby' });
    writeNativeSearchSession({
      activeView: 'pokemon',
      draft,
      executedDraft: draft,
      ownerKey: 'trainer-1',
      pokemonDisplayMode: 'list',
      pokemonQuery,
      pokemonScrollOffset: 0,
      trainerQuery: '',
      trainerScrollOffset: 0,
    });

    patchNativeSearchSession('trainer-1', {
      activeView: 'trainers',
      pokemonScrollOffset: 720,
      trainerQuery: 'misty',
    });

    expect(readNativeSearchSession('trainer-1')).toEqual(expect.objectContaining({
      activeView: 'trainers',
      executedDraft: draft,
      pokemonQuery: expect.objectContaining({ pokemon_id: 25 }),
      pokemonScrollOffset: 720,
      trainerQuery: 'misty',
    }));
  });

  it('coalesces rapid SecureStore writes so filter taps stay on the UI thread', () => {
    jest.useFakeTimers();
    try {
      const draft = createNativePokemonSearchDraft({ city: 'Burnaby' });
      writeNativeSearchSession({
        activeView: 'pokemon',
        draft,
        executedDraft: draft,
        ownerKey: 'trainer-fast',
        pokemonDisplayMode: 'list',
        pokemonQuery,
        pokemonScrollOffset: 0,
        trainerQuery: '',
        trainerScrollOffset: 0,
      });
      patchNativeSearchSession('trainer-fast', { trainerQuery: 'm' });
      patchNativeSearchSession('trainer-fast', { trainerQuery: 'mi' });

      expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(199);
      expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'pokemongonexus.mobile.search-session.v1.trainer-fast',
        expect.stringContaining('"trainerQuery":"mi"'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('can clear one trainer without affecting another', () => {
    for (const ownerKey of ['trainer-1', 'trainer-2']) {
      writeNativeSearchSession({
        activeView: 'pokemon',
        draft: createNativePokemonSearchDraft(),
        executedDraft: null,
        ownerKey,
        pokemonDisplayMode: 'list',
        pokemonQuery: null,
        pokemonScrollOffset: 0,
        trainerQuery: '',
        trainerScrollOffset: 0,
      });
    }

    clearNativeSearchSession('trainer-1');

    expect(readNativeSearchSession('trainer-1')).toBeNull();
    expect(readNativeSearchSession('trainer-2')).not.toBeNull();
  });

  it('restores a valid owner-scoped session after an app restart', async () => {
    const draft = createNativePokemonSearchDraft({ city: 'Burnaby' });
    const persisted = {
      activeView: 'trainers',
      draft,
      executedDraft: draft,
      ownerKey: 'trainer-1',
      pokemonDisplayMode: 'map',
      pokemonQuery,
      pokemonScrollOffset: 360,
      savedAt: 123,
      trainerQuery: 'misty',
      trainerScrollOffset: 180,
    };
    clearNativeSearchSession('trainer-1');
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(persisted));

    await expect(hydrateNativeSearchSession('trainer-1')).resolves.toEqual(persisted);
    expect(readNativeSearchSession('trainer-1')).toEqual(persisted);
  });

  it('discards a persisted session owned by another trainer', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify({
      activeView: 'pokemon',
      draft: createNativePokemonSearchDraft(),
      executedDraft: null,
      ownerKey: 'trainer-2',
      pokemonDisplayMode: 'list',
      pokemonQuery: null,
      pokemonScrollOffset: 0,
      savedAt: 123,
      trainerQuery: '',
      trainerScrollOffset: 0,
    }));

    await expect(hydrateNativeSearchSession('trainer-1')).resolves.toBeNull();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'pokemongonexus.mobile.search-session.v1.trainer-1',
    );
  });
});
