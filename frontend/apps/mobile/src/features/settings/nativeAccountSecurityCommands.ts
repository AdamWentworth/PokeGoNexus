import type { MobileSessionUser } from '@pokemongonexus/shared-contracts/auth';
import type {
  NativeAuthApiClient,
  NativeUsersApiClient,
} from '../../services/nativeApiClients';
import {
  deleteNativeApplicationAccount,
  deleteNativeAuthenticationAccount,
  revokeNativeAccountSessions,
  updateNativeAccountPassword,
  updateNativeAccountUsername,
  updateNativeSecondaryUsername,
} from '../../services/nativeAccountSecurityApi';
import type {
  NativePasswordUpdateRequest,
  NativeUsernameUpdateRequest,
} from './nativeAccountSecurityModel';

type AuthCommandClient = Pick<NativeAuthApiClient, 'post' | 'put' | 'request'>;
type UsersCommandClient = Pick<NativeUsersApiClient, 'put' | 'request'>;

export const saveNativeUsernameGraph = async ({
  auth,
  onAuthUpdated,
  request,
  userId,
  users,
}: {
  auth: Pick<AuthCommandClient, 'put'>;
  onAuthUpdated: (user: MobileSessionUser) => void;
  request: NativeUsernameUpdateRequest;
  userId: string;
  users: Pick<UsersCommandClient, 'put'>;
}): Promise<MobileSessionUser> => {
  const updated = await updateNativeAccountUsername(auth, userId, request);
  // The auth database is canonical for sign-in. Publish that committed state
  // before attempting the secondary profile projection so a partial failure is
  // visible and can be retried without pretending the auth update rolled back.
  onAuthUpdated(updated);
  await updateNativeSecondaryUsername(users, userId, updated.username);
  return updated;
};

export const changeNativePasswordAndClearSession = async ({
  auth,
  clearSession,
  request,
  userId,
}: {
  auth: Pick<AuthCommandClient, 'put'>;
  clearSession: () => Promise<void>;
  request: NativePasswordUpdateRequest;
  userId: string;
}): Promise<void> => {
  await updateNativeAccountPassword(auth, userId, request);
  await clearSession();
};

export const revokeNativeSessionsAndClearSession = async ({
  auth,
  clearSession,
  proof,
}: {
  auth: Pick<AuthCommandClient, 'post'>;
  clearSession: () => Promise<void>;
  proof: { currentPassword?: string };
}): Promise<void> => {
  await revokeNativeAccountSessions(auth, proof);
  await clearSession();
};

export const deleteNativeAccountGraph = async ({
  auth,
  clearSession,
  proof,
  userId,
  users,
}: {
  auth: Pick<AuthCommandClient, 'request'>;
  clearSession: () => Promise<void>;
  proof: { currentPassword?: string };
  userId: string;
  users: Pick<UsersCommandClient, 'request'>;
}): Promise<void> => {
  // Keep authentication available for a safe retry unless every SQL-backed
  // application record has already been deleted transactionally.
  await deleteNativeApplicationAccount(users, userId);
  await deleteNativeAuthenticationAccount(auth, userId, proof);
  await clearSession();
};
