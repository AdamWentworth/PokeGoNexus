import {
  authContract,
  type AccountSecuritySummary,
  type MobileSessionUser,
  type MobileOAuthLinkExchangeResponse,
  type MobileOAuthLinkStartResponse,
  type OAuthProvider,
} from '@pokemongonexus/shared-contracts/auth';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import type {
  NativeAuthApiClient,
  NativeUsersApiClient,
} from './nativeApiClients';
import type {
  NativeEmailChangeRequest,
  NativePasswordUpdateRequest,
  NativeUsernameUpdateRequest,
} from '../features/settings/nativeAccountSecurityModel';

type AuthAccountClient = Pick<NativeAuthApiClient, 'get' | 'post' | 'put' | 'request'>;
type UsersAccountClient = Pick<NativeUsersApiClient, 'put' | 'request'>;

const PROVIDERS = new Set<OAuthProvider>(['google', 'discord', 'facebook']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const requireMessageResponse = (value: unknown, operation: string): void => {
  if (!isRecord(value) || typeof value.message !== 'string' || !value.message.trim()) {
    throw new Error(`The ${operation} response is invalid.`);
  }
};

const requireAccountSecurity = (value: unknown): AccountSecuritySummary => {
  if (!isRecord(value)
      || typeof value.email !== 'string'
      || typeof value.hasPassword !== 'boolean'
      || !Number.isInteger(value.activeSessions)
      || Number(value.activeSessions) < 0
      || !Array.isArray(value.providers)
      || !value.providers.every((identity) => isRecord(identity)
        && typeof identity.provider === 'string'
        && PROVIDERS.has(identity.provider as OAuthProvider)
        && (identity.email === null || typeof identity.email === 'string')
        && typeof identity.emailVerified === 'boolean'
        && (identity.linkedAt === null || typeof identity.linkedAt === 'string'))) {
    throw new Error('The account security response is invalid.');
  }
  return value as unknown as AccountSecuritySummary;
};

const requireUpdatedUser = (value: unknown): MobileSessionUser => {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)
      || typeof value.data.user_id !== 'string'
      || typeof value.data.username !== 'string'
      || typeof value.data.email !== 'string') {
    throw new Error('The account update response is invalid.');
  }
  return value.data as unknown as MobileSessionUser;
};

const requireOAuthLinkStart = (value: unknown): MobileOAuthLinkStartResponse => {
  if (!isRecord(value)
      || typeof value.provider !== 'string'
      || !PROVIDERS.has(value.provider as OAuthProvider)
      || typeof value.authorizationUrl !== 'string'
      || !/^https:\/\//.test(value.authorizationUrl)) {
    throw new Error('The provider connection response is invalid.');
  }
  return value as unknown as MobileOAuthLinkStartResponse;
};

const requireOAuthLinkExchange = (value: unknown): MobileOAuthLinkExchangeResponse => {
  if (!isRecord(value)
      || typeof value.provider !== 'string'
      || !PROVIDERS.has(value.provider as OAuthProvider)
      || !['linked', 'link-conflict', 'failed'].includes(String(value.status))) {
    throw new Error('The provider connection result is invalid.');
  }
  return value as unknown as MobileOAuthLinkExchangeResponse;
};

export const getNativeAccountSecurity = async (
  client: Pick<AuthAccountClient, 'get'>,
): Promise<AccountSecuritySummary> => requireAccountSecurity(
  await client.get<unknown>(authContract.endpoints.accountSecurity),
);

export const updateNativeAccountUsername = async (
  client: Pick<AuthAccountClient, 'put'>,
  userId: string,
  request: NativeUsernameUpdateRequest,
): Promise<MobileSessionUser> => requireUpdatedUser(
  await client.put<unknown>(authContract.endpoints.updateUser(userId), request),
);

export const updateNativeAccountPassword = async (
  client: Pick<AuthAccountClient, 'put'>,
  userId: string,
  request: NativePasswordUpdateRequest,
): Promise<MobileSessionUser> => requireUpdatedUser(
  await client.put<unknown>(authContract.endpoints.updateUser(userId), request),
);

export const requestNativeEmailChange = async (
  client: Pick<AuthAccountClient, 'post'>,
  request: NativeEmailChangeRequest,
): Promise<void> => requireMessageResponse(
  await client.post<unknown>(authContract.endpoints.requestEmailChange, request),
  'email change',
);

export const confirmNativeEmailChange = async (
  client: Pick<AuthAccountClient, 'post'>,
  token: string,
): Promise<void> => requireMessageResponse(
  await client.post<unknown>(authContract.endpoints.confirmEmailChange, { token }),
  'email verification',
);

export const revokeNativeAccountSessions = async (
  client: Pick<AuthAccountClient, 'post'>,
  proof: { currentPassword?: string },
): Promise<void> => requireMessageResponse(
  await client.post<unknown>(authContract.endpoints.revokeAllSessions, proof),
  'session revocation',
);

export const unlinkNativeAccountProvider = async (
  client: Pick<AuthAccountClient, 'request'>,
  provider: OAuthProvider,
  proof: { currentPassword?: string },
): Promise<void> => requireMessageResponse(
  await client.request<unknown>(authContract.endpoints.unlinkProvider(provider), {
    method: 'DELETE',
    json: proof,
  }),
  'provider removal',
);

export const startNativeOAuthProviderLink = async (
  client: Pick<AuthAccountClient, 'post'>,
  provider: OAuthProvider,
): Promise<MobileOAuthLinkStartResponse> => requireOAuthLinkStart(
  await client.post<unknown>(authContract.endpoints.mobileOAuthLinkStart, { provider }),
);

export const exchangeNativeOAuthProviderLink = async (
  client: Pick<AuthAccountClient, 'post'>,
  code: string,
): Promise<MobileOAuthLinkExchangeResponse> => requireOAuthLinkExchange(
  await client.post<unknown>(authContract.endpoints.mobileOAuthLinkExchange, { code }),
);

export const deleteNativeApplicationAccount = async (
  client: Pick<UsersAccountClient, 'request'>,
  userId: string,
): Promise<void> => requireMessageResponse(
  await client.request<unknown>(usersContract.endpoints.deleteUser(userId), { method: 'DELETE' }),
  'account-data deletion',
);

export const deleteNativeAuthenticationAccount = async (
  client: Pick<AuthAccountClient, 'request'>,
  userId: string,
  proof: { currentPassword?: string },
): Promise<void> => requireMessageResponse(
  await client.request<unknown>(authContract.endpoints.deleteUser(userId), {
    method: 'DELETE',
    json: proof,
  }),
  'account deletion',
);

export const updateNativeSecondaryUsername = async (
  client: Pick<UsersAccountClient, 'put'>,
  userId: string,
  username: string,
): Promise<void> => {
  const payload = await client.put<unknown>(usersContract.endpoints.updateUser(userId), { username });
  if (!isRecord(payload) || payload.success !== true) {
    throw new Error('The trainer username response is invalid.');
  }
};
