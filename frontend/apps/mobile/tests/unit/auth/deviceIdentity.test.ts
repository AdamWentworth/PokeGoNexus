import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getOrCreateDeviceId } from '../../../src/auth/deviceIdentity';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockedCrypto = jest.mocked(Crypto);
const mockedSecureStore = jest.mocked(SecureStore);

describe('native device identity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reuses a valid stored device ID', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('native-existing-device');

    await expect(getOrCreateDeviceId()).resolves.toBe('native-existing-device');
    expect(mockedCrypto.randomUUID).not.toHaveBeenCalled();
  });

  it('replaces a missing or malformed device ID', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('not allowed spaces');
    mockedCrypto.randomUUID.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

    await expect(getOrCreateDeviceId()).resolves.toBe(
      'native-123e4567-e89b-12d3-a456-426614174000',
    );
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'pokegonexus.mobile.device-id',
      'native-123e4567-e89b-12d3-a456-426614174000',
    );
  });
});
