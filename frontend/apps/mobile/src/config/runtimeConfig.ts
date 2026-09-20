import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  resolveMobileExperienceMode,
  type MobileExperienceMode,
} from './mobileExperience';

type RuntimeApiConfig = {
  authApiUrl: string;
  usersApiUrl: string;
  searchApiUrl: string;
  pokemonApiUrl: string;
  locationApiUrl: string;
  eventsApiUrl: string;
  receiverApiUrl: string;
  frontendAppUrl: string;
};

type RuntimeObservabilityConfig = {
  crashReportUrl: string | null;
  crashReportApiKey: string | null;
  appEnv: string;
  appRelease: string;
};

type RuntimeRealtimeConfig = {
  allowAccessTokenQueryFallback: boolean;
};

type RuntimeMobileConfig = {
  experienceMode: MobileExperienceMode;
  deviceSmokeMode: boolean;
  deviceSmokeColorScheme: 'light' | 'dark' | null;
  deviceSmokeHost: string;
};

type ExpoExtra = {
  api?: Partial<RuntimeApiConfig>;
  observability?: Partial<RuntimeObservabilityConfig>;
  realtime?: Partial<RuntimeRealtimeConfig>;
  mobile?: {
    experienceMode?: unknown;
    deviceSmokeMode?: unknown;
    deviceSmokeColorScheme?: unknown;
    deviceSmokeHost?: unknown;
  };
};

const DEFAULT_API_CONFIG: RuntimeApiConfig = {
  authApiUrl: 'https://pokegonexus.com/api/auth',
  usersApiUrl: 'https://pokegonexus.com/api/users',
  searchApiUrl: 'https://pokegonexus.com/api/search',
  pokemonApiUrl: 'https://pokegonexus.com/api/pokemon',
  locationApiUrl: 'https://pokegonexus.com/api/location',
  eventsApiUrl: 'https://pokegonexus.com/api/events',
  receiverApiUrl: 'https://pokegonexus.com/api/receiver',
  frontendAppUrl: 'https://pokegonexus.com',
};

const deriveExpoHost = (): string | null => {
  const expoConfig = Constants.expoConfig as
    | {
        hostUri?: string;
        debuggerHost?: string;
      }
    | undefined;

  const hostFromHostUri = expoConfig?.hostUri?.split(':')[0];
  if (hostFromHostUri) return hostFromHostUri;

  const hostFromDebugger = expoConfig?.debuggerHost?.split(':')[0];
  if (hostFromDebugger) return hostFromDebugger;

  return null;
};

const deriveDevFrontendAppUrl = (): string | null => {
  if (!__DEV__) return null;
  const host = deriveExpoHost();
  if (!host) return null;
  return `http://${host}:3000`;
};

const DEFAULT_FRONTEND_APP_URL =
  deriveDevFrontendAppUrl() ?? DEFAULT_API_CONFIG.frontendAppUrl;

const DEV_WEB_FRONTEND_APP_URL = __DEV__ && Platform.OS === 'web'
  ? deriveDevFrontendAppUrl() ?? 'http://localhost:3000'
  : null;

const developmentWebApiUrl = (service: keyof Omit<RuntimeApiConfig, 'frontendAppUrl'>): string | null => {
  if (!DEV_WEB_FRONTEND_APP_URL) return null;
  const servicePath: Record<keyof Omit<RuntimeApiConfig, 'frontendAppUrl'>, string> = {
    authApiUrl: 'auth',
    usersApiUrl: 'users',
    searchApiUrl: 'search',
    pokemonApiUrl: 'pokemon',
    locationApiUrl: 'location',
    eventsApiUrl: 'events',
    receiverApiUrl: 'receiver',
  };
  return `${DEV_WEB_FRONTEND_APP_URL.replace(/\/$/, '')}/api/${servicePath[service]}`;
};

const DEFAULT_OBSERVABILITY_CONFIG: RuntimeObservabilityConfig = {
  crashReportUrl: null,
  crashReportApiKey: null,
  appEnv: __DEV__ ? 'development' : 'production',
  appRelease: 'mobile@1.0.0',
};

const DEFAULT_REALTIME_CONFIG: RuntimeRealtimeConfig = {
  allowAccessTokenQueryFallback: false,
};

const sanitizeUrl = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeOptionalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

const sanitizeColorScheme = (value: unknown): 'light' | 'dark' | null =>
  value === 'light' || value === 'dark' ? value : null;

const readExtra = (): ExpoExtra => {
  const fromExpoConfig = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  return fromExpoConfig;
};

const extra = readExtra();
const apiOverrides = extra.api ?? {};
const observabilityOverrides = extra.observability ?? {};
const realtimeOverrides = extra.realtime ?? {};
const mobileOverrides = extra.mobile ?? {};

export const runtimeConfig: {
  api: RuntimeApiConfig;
  observability: RuntimeObservabilityConfig;
  realtime: RuntimeRealtimeConfig;
  mobile: RuntimeMobileConfig;
} = {
  api: {
    authApiUrl: developmentWebApiUrl('authApiUrl') ?? sanitizeUrl(apiOverrides.authApiUrl, DEFAULT_API_CONFIG.authApiUrl),
    usersApiUrl: developmentWebApiUrl('usersApiUrl') ?? sanitizeUrl(apiOverrides.usersApiUrl, DEFAULT_API_CONFIG.usersApiUrl),
    searchApiUrl: developmentWebApiUrl('searchApiUrl') ?? sanitizeUrl(apiOverrides.searchApiUrl, DEFAULT_API_CONFIG.searchApiUrl),
    pokemonApiUrl: developmentWebApiUrl('pokemonApiUrl') ?? sanitizeUrl(apiOverrides.pokemonApiUrl, DEFAULT_API_CONFIG.pokemonApiUrl),
    locationApiUrl: developmentWebApiUrl('locationApiUrl') ?? sanitizeUrl(apiOverrides.locationApiUrl, DEFAULT_API_CONFIG.locationApiUrl),
    eventsApiUrl: developmentWebApiUrl('eventsApiUrl') ?? sanitizeUrl(apiOverrides.eventsApiUrl, DEFAULT_API_CONFIG.eventsApiUrl),
    receiverApiUrl: developmentWebApiUrl('receiverApiUrl') ?? sanitizeUrl(apiOverrides.receiverApiUrl, DEFAULT_API_CONFIG.receiverApiUrl),
    frontendAppUrl: DEV_WEB_FRONTEND_APP_URL ?? sanitizeUrl(apiOverrides.frontendAppUrl, DEFAULT_FRONTEND_APP_URL),
  },
  observability: {
    crashReportUrl:
      sanitizeOptionalUrl(observabilityOverrides.crashReportUrl) ??
      DEFAULT_OBSERVABILITY_CONFIG.crashReportUrl,
    crashReportApiKey:
      sanitizeOptionalString(observabilityOverrides.crashReportApiKey) ??
      DEFAULT_OBSERVABILITY_CONFIG.crashReportApiKey,
    appEnv: sanitizeString(observabilityOverrides.appEnv, DEFAULT_OBSERVABILITY_CONFIG.appEnv),
    appRelease: sanitizeString(
      observabilityOverrides.appRelease,
      DEFAULT_OBSERVABILITY_CONFIG.appRelease,
    ),
  },
  realtime: {
    allowAccessTokenQueryFallback: sanitizeBoolean(
      realtimeOverrides.allowAccessTokenQueryFallback,
      DEFAULT_REALTIME_CONFIG.allowAccessTokenQueryFallback,
    ),
  },
  mobile: {
    experienceMode: resolveMobileExperienceMode(
      mobileOverrides.experienceMode,
    ),
    // Release smoke builds explicitly opt in through app.config. Ordinary
    // production builds keep the default false value, while the standalone
    // lifecycle gate can exercise the same binary shape users receive.
    deviceSmokeMode: sanitizeBoolean(
      mobileOverrides.deviceSmokeMode,
      false,
    ),
    deviceSmokeColorScheme: sanitizeColorScheme(mobileOverrides.deviceSmokeColorScheme),
    deviceSmokeHost: sanitizeString(mobileOverrides.deviceSmokeHost, '10.0.2.2'),
  },
};
