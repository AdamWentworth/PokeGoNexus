import * as SecureStore from 'expo-secure-store';
import {
  clearNativeFriendsSession,
  hydrateNativeFriendsSession,
  patchNativeFriendsSession,
  readNativeFriendsSession,
  writeNativeFriendsSession,
} from '../../../../src/features/social/nativeFriendsSessionCache';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

describe('nativeFriendsSessionCache', () => {
  beforeEach(() => {
    clearNativeFriendsSession();
    jest.clearAllMocks();
  });

  it('keeps the selected workspace and completed trainer search owner-scoped', () => {
    writeNativeFriendsSession({
      activeView: 'find',
      executedQuery: 'Nexus',
      ownerKey: 'user-1',
      query: 'Nexus',
    });

    expect(readNativeFriendsSession('user-1')).toEqual(expect.objectContaining({
      activeView: 'find',
      executedQuery: 'Nexus',
      ownerKey: 'user-1',
      query: 'Nexus',
    }));
    expect(readNativeFriendsSession('user-2')).toBeNull();
  });

  it('patches navigation context without losing the executed search', () => {
    writeNativeFriendsSession({
      activeView: 'find',
      executedQuery: 'Nexus',
      ownerKey: 'user-1',
      query: 'Nexus',
    });

    patchNativeFriendsSession('user-1', { activeView: 'friends' });

    expect(readNativeFriendsSession('user-1')).toEqual(expect.objectContaining({
      activeView: 'friends',
      executedQuery: 'Nexus',
      query: 'Nexus',
    }));
  });

  it('hydrates a valid persisted session and rejects malformed state', async () => {
    const getItem = jest.mocked(SecureStore.getItemAsync);
    getItem.mockResolvedValueOnce(JSON.stringify({
      activeView: 'find',
      executedQuery: 'Nexus',
      ownerKey: 'persisted-user',
      query: 'Nexus',
      savedAt: 123,
    }));
    expect(await hydrateNativeFriendsSession('persisted-user')).toEqual(expect.objectContaining({
      activeView: 'find',
      executedQuery: 'Nexus',
    }));

    getItem.mockResolvedValueOnce(JSON.stringify({ activeView: 'unknown' }));
    expect(await hydrateNativeFriendsSession('invalid-user')).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
