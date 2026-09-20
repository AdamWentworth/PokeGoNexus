import {
  authContract,
  type MobileSessionUser,
  type UpdateAuthProfileRequest,
} from '@pokemongonexus/shared-contracts/auth';
import {
  type UpdateTrainerProfileRequest,
  usersContract,
} from '@pokemongonexus/shared-contracts/users';
import type {
  NativeAuthApiClient,
  NativeUsersApiClient,
} from './nativeApiClients';

type AuthProfileClient = Pick<NativeAuthApiClient, 'put'>;
type UsersProfileClient = Pick<NativeUsersApiClient, 'put'>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const updateNativeAuthProfile = async (
  client: AuthProfileClient,
  userId: string,
  request: UpdateAuthProfileRequest,
): Promise<MobileSessionUser> => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error('User ID is required.');
  const payload = await client.put<unknown>(
    authContract.endpoints.updateUser(normalizedUserId),
    request,
  );
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
      || typeof payload.data.user_id !== 'string'
      || typeof payload.data.username !== 'string'
      || typeof payload.data.email !== 'string') {
    throw new Error('The authentication profile response is invalid.');
  }
  return payload.data as unknown as MobileSessionUser;
};

export const updateNativeTrainerProfile = async (
  client: UsersProfileClient,
  request: UpdateTrainerProfileRequest,
): Promise<void> => {
  const payload = await client.put<unknown>(usersContract.endpoints.profile, request);
  if (!isRecord(payload) || payload.success !== true) {
    throw new Error('The trainer profile response is invalid.');
  }
};
