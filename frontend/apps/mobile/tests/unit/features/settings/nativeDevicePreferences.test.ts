import * as SecureStore from 'expo-secure-store';
import {
  parseNativeDevicePreferences,
  readNativeDevicePreferences,
  writeNativeDevicePreferences,
} from '../../../../src/features/settings/nativeDevicePreferences';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);

describe('nativeDevicePreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the current device theme when no valid preference exists', () => {
    expect(parseNativeDevicePreferences(null, 'light')).toEqual({
      colorTheme: 'light',
      reduceMotion: false,
    });
    expect(parseNativeDevicePreferences('{broken', 'dark')).toEqual({
      colorTheme: 'dark',
      reduceMotion: false,
    });
  });

  it('normalizes persisted device preferences', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
      colorTheme: 'light',
      reduceMotion: true,
      ignored: 'value',
    }));
    await expect(readNativeDevicePreferences('dark')).resolves.toEqual({
      colorTheme: 'light',
      reduceMotion: true,
    });
  });

  it('persists only the native device preference contract', async () => {
    await writeNativeDevicePreferences({ colorTheme: 'dark', reduceMotion: true });
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'pokemongonexus.mobile.device-preferences.v1',
      JSON.stringify({ colorTheme: 'dark', reduceMotion: true }),
    );
  });
});

