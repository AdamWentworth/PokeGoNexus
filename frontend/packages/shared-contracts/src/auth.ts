import type { Coordinates } from './location';

export const authContract = {
  endpoints: {
    register: '/register',
    login: '/login',
    logout: '/logout',
    refresh: '/refresh',
    mobileLogin: '/mobile/login',
    mobileLogout: '/mobile/logout',
    mobileRefresh: '/mobile/refresh',
    mobileOAuthLinkStart: '/mobile/oauth/link/start',
    mobileOAuthLinkExchange: '/mobile/oauth/link/exchange',
    mobileOAuthStart: '/mobile/oauth/start',
    mobileOAuthExchange: '/mobile/oauth/exchange',
    mobileOAuthCompleteRegistration: '/mobile/oauth/complete-registration',
    resetPassword: '/reset-password',
    confirmPasswordReset: '/reset-password/confirm',
    accountSecurity: '/account/security',
    revokeAllSessions: '/sessions/revoke-all',
    requestEmailChange: '/email-change',
    confirmEmailChange: '/email-change/confirm',
    unlinkProvider: (provider: OAuthProvider) =>
      `/account/identities/${encodeURIComponent(provider)}`,
    googleStart: '/google',
    googlePending: '/google/pending',
    googleCompleteRegistration: '/google/complete-registration',
    discordStart: '/discord',
    discordPending: '/discord/pending',
    discordCompleteRegistration: '/discord/complete-registration',
    facebookStart: '/facebook',
    facebookPending: '/facebook/pending',
    facebookCompleteRegistration: '/facebook/complete-registration',
    updateUser: (userId: string) => `/update/${encodeURIComponent(userId)}`,
    deleteUser: (userId: string) => `/delete/${encodeURIComponent(userId)}`,
  },
} as const;

export interface AuthUser {
  user_id: string;
  username: string;
  email: string;
  pokemonGoName: string;
  trainerCode: string;
  location: string;
  allowLocation: boolean;
  coordinates?: Coordinates | null;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  [key: string]: unknown;
}

export interface LoginResponse extends AuthUser {
  token: string;
  coordinates: Coordinates | null;
}

export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

export interface MobileSessionUser {
  user_id: string;
  username: string;
  email: string;
  pokemonGoName: string | null;
  trainerCode: string | null;
  location: string | null;
  allowLocation: boolean;
  coordinates?: Coordinates | null;
}

export interface MobileSessionResponse {
  user: MobileSessionUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  message?: string;
}

export interface MobileLoginRequest {
  username: string;
  password: string;
  device_id: string;
}

export interface MobileRegisterRequest {
  username: string;
  email: string;
  password: string;
  pokemonGoName?: string | null;
  trainerCode?: string | null;
  location?: string | null;
  allowLocation?: boolean;
  coordinates?: Coordinates | null;
  device_id: string;
}

export interface MobileRefreshRequest {
  refreshToken: string;
}

export interface UpdateAuthProfileRequest {
  pokemonGoName: string | null;
  trainerCode: string | null;
  location: string | null;
}

export type OAuthSessionResponse = AuthUser;

export interface ResetPasswordRequest {
  identifier: string;
}

export interface ConfirmPasswordResetRequest {
  token: string;
  password: string;
}

export type OAuthProvider = 'google' | 'discord' | 'facebook';

export interface MobileOAuthLinkStartRequest {
  provider: OAuthProvider;
}

export interface MobileOAuthLinkStartResponse {
  provider: OAuthProvider;
  authorizationUrl: string;
}

export interface MobileOAuthLinkExchangeRequest {
  code: string;
}

export interface MobileOAuthLinkExchangeResponse {
  provider: OAuthProvider;
  status: 'linked' | 'link-conflict' | 'failed';
}

export type MobileOAuthIntent = 'login' | 'register';

export interface MobileOAuthStartRequest {
  provider: OAuthProvider;
  intent: MobileOAuthIntent;
  device_id: string;
}

export interface MobileOAuthStartResponse {
  provider: OAuthProvider;
  intent: MobileOAuthIntent;
  authorizationUrl: string;
}

export type MobileOAuthAuthenticationStatus =
  | 'authenticated'
  | 'registration-required'
  | 'account-exists'
  | 'account-not-found'
  | 'failed';

export interface MobileOAuthExchangeRequest {
  code: string;
  device_id: string;
}

export interface MobileOAuthExchangeResponse {
  provider: OAuthProvider;
  status: MobileOAuthAuthenticationStatus;
  email?: string;
  session?: MobileSessionResponse;
}

export interface MobileOAuthCompleteRegistrationRequest {
  code: string;
  device_id: string;
  username: string;
  pokemonGoName?: string | null;
  trainerCode?: string | null;
  location?: string | null;
  allowLocation?: boolean;
  coordinates?: Coordinates | null;
}

export interface AccountSecuritySummary {
  email: string;
  hasPassword: boolean;
  providers: Array<{
    provider: OAuthProvider;
    email: string | null;
    emailVerified: boolean;
    linkedAt: string | null;
  }>;
  activeSessions: number;
}

export type AuthRequestPayload = Record<string, unknown>;
