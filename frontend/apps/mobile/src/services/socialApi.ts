import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  FriendSummary,
  FriendsOverview,
  TrainerProfile,
} from '@pokemongonexus/shared-contracts/users';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import type { NativeUsersApiClient } from './nativeApiClients';

type SocialClient = Pick<NativeUsersApiClient, 'delete' | 'get' | 'post'>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFriendSummary = (value: unknown): value is FriendSummary => {
  if (!isRecord(value)) return false;
  return typeof value.user_id === 'string' && value.user_id.trim().length > 0
    && typeof value.username === 'string' && value.username.trim().length > 0
    && typeof value.friendship_id === 'string' && value.friendship_id.trim().length > 0;
};

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isTrainerProfile = (value: unknown): value is TrainerProfile<PokemonInstance> => {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.stats) || !isRecord(value.viewer)) {
    return false;
  }
  return typeof value.user.user_id === 'string'
    && typeof value.user.username === 'string'
    && typeof value.user.app_joined_at === 'string'
    && isFiniteNumber(value.stats.caught)
    && isFiniteNumber(value.stats.for_trade)
    && isFiniteNumber(value.stats.wanted)
    && isFiniteNumber(value.stats.favorites)
    && isFiniteNumber(value.stats.registered)
    && Array.isArray(value.trainer_titles)
    && Array.isArray(value.highlights)
    && typeof value.viewer.relationship === 'string'
    && typeof value.viewer.can_view_profile === 'boolean'
    && typeof value.viewer.can_view_collection === 'boolean';
};

export const getNativeTrainerProfile = async (
  usersClient: Pick<SocialClient, 'get'>,
  username?: string | null,
): Promise<TrainerProfile<PokemonInstance>> => {
  const normalizedUsername = username?.trim();
  const path = normalizedUsername
    ? usersContract.endpoints.profileByUsername(normalizedUsername)
    : usersContract.endpoints.profile;
  const payload = await usersClient.get<unknown>(path);
  if (!isTrainerProfile(payload)) {
    throw new Error('The trainer profile response is invalid.');
  }
  return payload;
};

export const getNativeFriendsOverview = async (
  usersClient: Pick<SocialClient, 'get'>,
): Promise<FriendsOverview> => {
  const payload = await usersClient.get<unknown>(usersContract.endpoints.friends);
  if (!isRecord(payload)) throw new Error('The friends response is invalid.');
  const keys = ['friends', 'incoming', 'outgoing', 'blocked'] as const;
  if (keys.some((key) => {
    const rows = payload[key];
    return !Array.isArray(rows) || rows.some((row) => !isFriendSummary(row));
  })) {
    throw new Error('The friends response is invalid.');
  }
  return payload as unknown as FriendsOverview;
};

const required = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};

export const sendNativeFriendRequest = async (
  usersClient: Pick<SocialClient, 'post'>,
  username: string,
): Promise<string> => {
  const payload = await usersClient.post<unknown>(usersContract.endpoints.friendRequests, {
    username: required(username, 'Username'),
  });
  if (!isRecord(payload) || typeof payload.friendship_id !== 'string' || !payload.friendship_id) {
    throw new Error('The friend request response is invalid.');
  }
  return payload.friendship_id;
};

export const acceptNativeFriendRequest = async (
  usersClient: Pick<SocialClient, 'post'>,
  friendshipId: string,
): Promise<void> => {
  await usersClient.post(
    usersContract.endpoints.acceptFriendRequest(required(friendshipId, 'Friend request ID')),
  );
};

export const deleteNativeFriendRequest = async (
  usersClient: Pick<SocialClient, 'delete'>,
  friendshipId: string,
): Promise<void> => {
  await usersClient.delete(
    usersContract.endpoints.friendRequest(required(friendshipId, 'Friend request ID')),
  );
};

export const removeNativeFriend = async (
  usersClient: Pick<SocialClient, 'delete'>,
  userId: string,
): Promise<void> => {
  await usersClient.delete(usersContract.endpoints.friend(required(userId, 'User ID')));
};

export const blockNativeTrainer = async (
  usersClient: Pick<SocialClient, 'post'>,
  userId: string,
): Promise<void> => {
  await usersClient.post(usersContract.endpoints.friendBlocks, {
    user_id: required(userId, 'User ID'),
  });
};

export const unblockNativeTrainer = async (
  usersClient: Pick<SocialClient, 'delete'>,
  userId: string,
): Promise<void> => {
  await usersClient.delete(usersContract.endpoints.friendBlock(required(userId, 'User ID')));
};
