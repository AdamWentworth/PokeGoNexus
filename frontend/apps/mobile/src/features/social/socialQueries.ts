import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptNativeFriendRequest,
  blockNativeTrainer,
  deleteNativeFriendRequest,
  getNativeFriendsOverview,
  getNativeTrainerProfile,
  removeNativeFriend,
  sendNativeFriendRequest,
  unblockNativeTrainer,
} from '../../services/socialApi';
import {
  updateNativeAuthProfile,
  updateNativeTrainerProfile,
} from '../../services/nativeTrainerProfileApi';
import {
  getNativeTrainerPreferences,
  updateNativeTrainerPreferences,
} from '../../services/nativeTrainerPreferencesApi';
import { useNativeSession } from '../../auth/NativeSessionContext';
import {
  buildNativeTrainerProfileSavePlan,
  type NativeTrainerProfileDraft,
} from './nativeTrainerProfileEditorModel';
import {
  buildNativeTrainerPreferencesRequest,
  type NativeTrainerPreferencesDraft,
} from './nativeTrainerPreferencesModel';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { TrainerProfile } from '@pokemongonexus/shared-contracts/users';
import { useNativeApiClients } from '../../services/useNativeApiClients';

export const nativeSocialQueryKeys = {
  root: ['native', 'social'] as const,
  profile: (viewerId: string, username?: string | null) => [
    ...nativeSocialQueryKeys.root,
    viewerId,
    'profile',
    username?.trim().toLocaleLowerCase() || 'self',
  ] as const,
  friends: (viewerId: string) => [...nativeSocialQueryKeys.root, viewerId, 'friends'] as const,
  preferences: (viewerId: string) => [...nativeSocialQueryKeys.root, viewerId, 'preferences'] as const,
};

export type NativeProfileRelationshipCommand =
  | { action: 'add'; username: string }
  | { action: 'accept'; friendshipId: string }
  | { action: 'cancel-request'; friendshipId: string }
  | { action: 'remove-friend'; userId: string }
  | { action: 'block'; userId: string };

export type NativeFriendsCommand =
  | { action: 'add'; username: string }
  | { action: 'accept'; friendshipId: string }
  | { action: 'delete-request'; friendshipId: string; message: string }
  | { action: 'remove-friend'; userId: string }
  | { action: 'unblock'; userId: string };

export const useNativeTrainerProfileQuery = (
  viewerId: string | null,
  username?: string | null,
) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeSocialQueryKeys.profile(viewerId ?? 'signed-out', username),
    queryFn: () => getNativeTrainerProfile(clients.users, username),
    enabled: Boolean(viewerId || username?.trim()),
    staleTime: username ? 30_000 : 60_000,
  });
};

export const useNativeFriendsQuery = (viewerId: string | null) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeSocialQueryKeys.friends(viewerId ?? 'signed-out'),
    queryFn: () => getNativeFriendsOverview(clients.users),
    enabled: Boolean(viewerId),
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
};

export const useNativeTrainerPreferencesQuery = (viewerId: string | null) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeSocialQueryKeys.preferences(viewerId ?? 'signed-out'),
    queryFn: () => getNativeTrainerPreferences(clients.users),
    enabled: Boolean(viewerId),
    staleTime: 60_000,
  });
};

export const useNativeTrainerPreferencesMutation = (viewerId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: NativeTrainerPreferencesDraft) => {
      const request = buildNativeTrainerPreferencesRequest(draft);
      return updateNativeTrainerPreferences(clients.users, request);
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(nativeSocialQueryKeys.preferences(viewerId), preferences);
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.profile(viewerId) });
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.friends(viewerId) });
    },
  });
};

export const useNativeFriendsMutation = (viewerId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (command: NativeFriendsCommand) => {
      switch (command.action) {
        case 'add':
          await sendNativeFriendRequest(clients.users, command.username);
          return 'Friend request sent.';
        case 'accept':
          await acceptNativeFriendRequest(clients.users, command.friendshipId);
          return 'Friend request accepted.';
        case 'delete-request':
          await deleteNativeFriendRequest(clients.users, command.friendshipId);
          return command.message;
        case 'remove-friend':
          await removeNativeFriend(clients.users, command.userId);
          return 'Friend removed.';
        case 'unblock':
          await unblockNativeTrainer(clients.users, command.userId);
          return 'Trainer unblocked.';
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.friends(viewerId) });
    },
  });
};

export const useNativeTrainerProfileMutation = (
  profile: TrainerProfile<PokemonInstance> | null,
) => {
  const clients = useNativeApiClients();
  const session = useNativeSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: NativeTrainerProfileDraft) => {
      if (!profile || !session.user) throw new Error('The trainer profile is not ready.');
      if (profile.user.user_id !== session.user.user_id) {
        throw new Error('Only your own trainer profile can be edited.');
      }
      const plan = buildNativeTrainerProfileSavePlan(draft, session.user);
      if (plan.authUpdate) {
        const updatedUser = await updateNativeAuthProfile(
          clients.auth,
          session.user.user_id,
          plan.authUpdate,
        );
        session.replaceSessionUser(updatedUser);
      }
      await updateNativeTrainerProfile(clients.users, plan.profileUpdate);
      return plan;
    },
    onSuccess: () => {
      if (!session.user) return;
      void queryClient.invalidateQueries({
        queryKey: nativeSocialQueryKeys.profile(session.user.user_id),
      });
      void queryClient.invalidateQueries({
        queryKey: nativeSocialQueryKeys.friends(session.user.user_id),
      });
    },
  });
};

export const useNativeProfileRelationshipMutation = (
  viewerId: string,
  username: string,
) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (command: NativeProfileRelationshipCommand) => {
      switch (command.action) {
        case 'add':
          await sendNativeFriendRequest(clients.users, command.username);
          return 'Friend request sent.';
        case 'accept':
          await acceptNativeFriendRequest(clients.users, command.friendshipId);
          return 'Friend request accepted.';
        case 'cancel-request':
          await deleteNativeFriendRequest(clients.users, command.friendshipId);
          return 'Friend request canceled.';
        case 'remove-friend':
          await removeNativeFriend(clients.users, command.userId);
          return 'Friend removed.';
        case 'block':
          await blockNativeTrainer(clients.users, command.userId);
          return 'Trainer blocked.';
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.profile(viewerId, username) });
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.friends(viewerId) });
    },
  });
};
