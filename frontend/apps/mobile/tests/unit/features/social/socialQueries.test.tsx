import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import {
  nativeSocialQueryKeys,
  useNativeFriendsMutation,
  useNativeFriendsQuery,
  useNativeProfileRelationshipMutation,
  useNativeTrainerPreferencesMutation,
  useNativeTrainerPreferencesQuery,
  useNativeTrainerProfileMutation,
} from '../../../../src/features/social/socialQueries';
import {
  acceptNativeFriendRequest,
  blockNativeTrainer,
  deleteNativeFriendRequest,
  getNativeFriendsOverview,
  removeNativeFriend,
  sendNativeFriendRequest,
  unblockNativeTrainer,
} from '../../../../src/services/socialApi';
import {
  updateNativeAuthProfile,
  updateNativeTrainerProfile,
} from '../../../../src/services/nativeTrainerProfileApi';
import {
  getNativeTrainerPreferences,
  updateNativeTrainerPreferences,
} from '../../../../src/services/nativeTrainerPreferencesApi';

const mockReplaceSessionUser = jest.fn();

notifyManager.setNotifyFunction((notification) => {
  act(notification);
});

jest.mock('../../../../src/auth/NativeSessionContext', () => ({
  useNativeSession: () => ({
    user: {
      user_id: 'viewer-1',
      username: 'Misty',
      email: 'misty@example.invalid',
      pokemonGoName: 'MistyGo',
      trainerCode: null,
      location: null,
      allowLocation: false,
    },
    replaceSessionUser: mockReplaceSessionUser,
  }),
}));

jest.mock('../../../../src/services/useNativeApiClients', () => ({
  useNativeApiClients: () => ({
    auth: { kind: 'auth-client' },
    users: { kind: 'users-client' },
  }),
}));

jest.mock('../../../../src/services/socialApi', () => ({
  acceptNativeFriendRequest: jest.fn().mockResolvedValue(undefined),
  blockNativeTrainer: jest.fn().mockResolvedValue(undefined),
  deleteNativeFriendRequest: jest.fn().mockResolvedValue(undefined),
  getNativeFriendsOverview: jest.fn(),
  getNativeTrainerProfile: jest.fn(),
  removeNativeFriend: jest.fn().mockResolvedValue(undefined),
  sendNativeFriendRequest: jest.fn().mockResolvedValue('friendship-1'),
  unblockNativeTrainer: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/services/nativeTrainerProfileApi', () => ({
  updateNativeAuthProfile: jest.fn(),
  updateNativeTrainerProfile: jest.fn(),
}));

jest.mock('../../../../src/services/nativeTrainerPreferencesApi', () => ({
  getNativeTrainerPreferences: jest.fn(),
  updateNativeTrainerPreferences: jest.fn(),
}));

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe('native friends queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads friends only for a signed-in viewer', async () => {
    const overview = { friends: [], incoming: [], outgoing: [], blocked: [] };
    jest.mocked(getNativeFriendsOverview).mockResolvedValue(overview);
    const { queryClient, wrapper } = makeWrapper();
    const signedOut = renderHook(() => useNativeFriendsQuery(null), { wrapper });
    expect(signedOut.result.current.fetchStatus).toBe('idle');
    signedOut.unmount();

    const signedIn = renderHook(() => useNativeFriendsQuery('viewer-1'), { wrapper });
    await act(async () => {
      await signedIn.result.current.refetch();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(getNativeFriendsOverview).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'users-client' }),
    );
    queryClient.clear();
  });

  it('dispatches every friends-hub command and invalidates the overview', async () => {
    const { queryClient, wrapper } = makeWrapper();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeFriendsMutation('viewer-1'), { wrapper });
    const run = async (command: Parameters<typeof result.current.mutateAsync>[0]) => act(async () => {
      const message = await result.current.mutateAsync(command);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return message;
    });

    await expect(run({ action: 'add', username: 'Misty' })).resolves.toBe('Friend request sent.');
    await expect(run({ action: 'accept', friendshipId: 'friendship-1' })).resolves.toBe('Friend request accepted.');
    await expect(run({ action: 'delete-request', friendshipId: 'friendship-1', message: 'Request declined.' })).resolves.toBe('Request declined.');
    await expect(run({ action: 'remove-friend', userId: 'user-2' })).resolves.toBe('Friend removed.');
    await expect(run({ action: 'unblock', userId: 'user-2' })).resolves.toBe('Trainer unblocked.');

    const client = expect.objectContaining({ kind: 'users-client' });
    expect(sendNativeFriendRequest).toHaveBeenCalledWith(client, 'Misty');
    expect(acceptNativeFriendRequest).toHaveBeenCalledWith(client, 'friendship-1');
    expect(deleteNativeFriendRequest).toHaveBeenCalledWith(client, 'friendship-1');
    expect(removeNativeFriend).toHaveBeenCalledWith(client, 'user-2');
    expect(unblockNativeTrainer).toHaveBeenCalledWith(client, 'user-2');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.friends('viewer-1'),
    });
    queryClient.clear();
  });
});

describe('useNativeProfileRelationshipMutation', () => {
  beforeEach(() => jest.clearAllMocks());
  it('dispatches each authoritative command and refreshes profile and friends state', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useNativeProfileRelationshipMutation('viewer-1', 'Misty'),
      { wrapper },
    );

    const run = async (
      command: Parameters<typeof result.current.mutateAsync>[0],
    ) => act(async () => {
      const message = await result.current.mutateAsync(command);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return message;
    });
    await expect(run({ action: 'add', username: 'Misty' })).resolves.toBe('Friend request sent.');
    await run({ action: 'accept', friendshipId: 'friendship-1' });
    await run({ action: 'cancel-request', friendshipId: 'friendship-1' });
    await run({ action: 'remove-friend', userId: 'user-2' });
    await run({ action: 'block', userId: 'user-2' });

    const client = expect.objectContaining({ kind: 'users-client' });
    expect(sendNativeFriendRequest).toHaveBeenCalledWith(client, 'Misty');
    expect(acceptNativeFriendRequest).toHaveBeenCalledWith(client, 'friendship-1');
    expect(deleteNativeFriendRequest).toHaveBeenCalledWith(client, 'friendship-1');
    expect(removeNativeFriend).toHaveBeenCalledWith(client, 'user-2');
    expect(blockNativeTrainer).toHaveBeenCalledWith(client, 'user-2');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.profile('viewer-1', 'Misty'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.friends('viewer-1'),
    });
    queryClient.clear();
  });
});

describe('useNativeTrainerProfileMutation', () => {
  beforeEach(() => jest.clearAllMocks());

  const profile = {
    user: {
      user_id: 'viewer-1',
      username: 'Misty',
      pokemonGoName: 'MistyGo',
      app_joined_at: '2026-01-01',
    },
    trainer_titles: [],
    stats: { caught: 0, for_trade: 0, wanted: 0, favorites: 0, registered: 0 },
    highlights: [],
    viewer: { relationship: 'self', can_view_profile: true, can_view_collection: true },
  } as Parameters<typeof useNativeTrainerProfileMutation>[0] extends infer T ? NonNullable<T> : never;

  it('writes auth only when identity changed, then saves and invalidates the trainer profile', async () => {
    const updatedUser = {
      user_id: 'viewer-1',
      username: 'Misty',
      email: 'misty@example.invalid',
      pokemonGoName: 'NewMisty',
      trainerCode: null,
      location: null,
      allowLocation: false,
    };
    jest.mocked(updateNativeAuthProfile).mockResolvedValue(updatedUser);
    jest.mocked(updateNativeTrainerProfile).mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeTrainerProfileMutation(profile), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        trainerTitles: ['shiny-hunter'],
        pokemonGoName: 'NewMisty',
        trainerCode: '',
        team: 'Mystic',
        trainerLevel: '50',
        totalXp: '1000',
        startedOn: '2016-07-06',
        location: '',
        highlightInstanceIds: [],
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(updateNativeAuthProfile).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'auth-client' }),
      'viewer-1',
      expect.objectContaining({ pokemonGoName: 'NewMisty' }),
    );
    expect(mockReplaceSessionUser).toHaveBeenCalledWith(updatedUser);
    expect(updateNativeTrainerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'users-client' }),
      expect.objectContaining({ trainer_level: 50, trainer_titles: ['shiny-hunter'] }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.profile('viewer-1'),
    });
    queryClient.clear();
  });

  it('refuses to edit a foreign profile', async () => {
    const { queryClient, wrapper } = makeWrapper();
    const { result } = renderHook(() => useNativeTrainerProfileMutation({
      ...profile,
      user: { ...profile.user, user_id: 'other-user' },
    }), { wrapper });
    await expect(result.current.mutateAsync({
      trainerTitles: [],
      pokemonGoName: '',
      trainerCode: '',
      team: '',
      trainerLevel: '',
      totalXp: '',
      startedOn: '',
      location: '',
      highlightInstanceIds: [],
    })).rejects.toThrow('Only your own');
    expect(updateNativeTrainerProfile).not.toHaveBeenCalled();
    queryClient.clear();
  });
});

describe('native trainer preferences queries', () => {
  beforeEach(() => jest.clearAllMocks());
  const preferences = {
    user_id: 'viewer-1',
    profile_visibility: 'public' as const,
    collection_visibility: 'friends' as const,
    friend_request_permission: 'everyone' as const,
    trainer_code_visibility: 'friends' as const,
    coordination_method: 'discord' as const,
    coordination_handle: 'MistyTrades',
    share_trade_contact: true,
    show_location: false,
    show_pokemon_go_name: true,
  };

  it('loads settings only for the signed-in viewer', async () => {
    jest.mocked(getNativeTrainerPreferences).mockResolvedValue(preferences);
    const { queryClient, wrapper } = makeWrapper();
    const signedOut = renderHook(() => useNativeTrainerPreferencesQuery(null), { wrapper });
    expect(signedOut.result.current.fetchStatus).toBe('idle');
    signedOut.unmount();

    const signedIn = renderHook(() => useNativeTrainerPreferencesQuery('viewer-1'), { wrapper });
    await act(async () => {
      await signedIn.result.current.refetch();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(getNativeTrainerPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'users-client' }),
    );
    queryClient.clear();
  });

  it('normalizes, saves, caches, and invalidates preference consumers', async () => {
    jest.mocked(updateNativeTrainerPreferences).mockResolvedValue(preferences);
    const { queryClient, wrapper } = makeWrapper();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const setQueryData = jest.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(
      () => useNativeTrainerPreferencesMutation('viewer-1'),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({
        collectionVisibility: 'friends',
        coordinationHandle: '  @MistyTrades  ',
        coordinationMethod: 'discord',
        friendRequestPermission: 'everyone',
        profileVisibility: 'public',
        shareTradeContact: true,
        showLocation: false,
        showPokemonGoName: true,
        trainerCodeVisibility: 'friends',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(updateNativeTrainerPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'users-client' }),
      expect.objectContaining({ coordination_handle: 'MistyTrades' }),
    );
    expect(setQueryData).toHaveBeenCalledWith(
      nativeSocialQueryKeys.preferences('viewer-1'),
      preferences,
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.profile('viewer-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: nativeSocialQueryKeys.friends('viewer-1'),
    });
    queryClient.clear();
  });
});
