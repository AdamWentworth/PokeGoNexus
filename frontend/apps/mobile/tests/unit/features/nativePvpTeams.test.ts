import * as SecureStore from 'expo-secure-store';
import { loadNativePvpTeam, saveNativePvpTeam } from '../../../src/features/tools/nativePvpTeams';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);

describe('native PvP team persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItemAsync.mockResolvedValue(null);
  });

  it('loads a saved format team and normalizes invalid slots', async () => {
    getItemAsync.mockResolvedValue(JSON.stringify({
      'great:catalog': ['bulbasaur', 12, 'venusaur', 'ignored'],
    }));
    await expect(loadNativePvpTeam('great:catalog')).resolves.toEqual([
      'bulbasaur',
      null,
      'venusaur',
    ]);
  });

  it('preserves other formats when saving a team', async () => {
    getItemAsync.mockResolvedValue(JSON.stringify({
      'ultra:catalog': ['giratina', null, null],
    }));
    await saveNativePvpTeam('great:catalog', ['bulbasaur', 'ivysaur', null]);
    expect(setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({
        'ultra:catalog': ['giratina', null, null],
        'great:catalog': ['bulbasaur', 'ivysaur', null],
      }),
    );
  });

  it('falls back safely when secure storage is unreadable', async () => {
    getItemAsync.mockRejectedValue(new Error('device locked'));
    await expect(loadNativePvpTeam('great:catalog')).resolves.toEqual([
      null,
      null,
      null,
    ]);
  });
});
