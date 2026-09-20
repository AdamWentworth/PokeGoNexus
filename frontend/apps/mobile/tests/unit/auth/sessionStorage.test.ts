import * as SecureStore from 'expo-secure-store';
import {
  clearRefreshToken,
  readRefreshToken,
  storeRefreshToken,
} from '../../../src/auth/sessionStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);

describe('native session storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores and reads only the refresh token', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('refresh-token');

    await storeRefreshToken(' refresh-token ');
    await expect(readRefreshToken()).resolves.toBe('refresh-token');

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'pokegonexus.mobile.refresh-token',
      'refresh-token',
    );
  });

  it('removes invalid persisted values instead of restoring them', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('   ');

    await expect(readRefreshToken()).resolves.toBeNull();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'pokegonexus.mobile.refresh-token',
    );
  });

  it('rejects invalid writes and can clear the session', async () => {
    await expect(storeRefreshToken('')).rejects.toThrow(
      'Cannot store an invalid refresh token',
    );

    await clearRefreshToken();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'pokegonexus.mobile.refresh-token',
    );
  });
});
