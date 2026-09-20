import type { ConfigContext, ExpoConfig } from 'expo/config';

const readEnv = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback;
const readBool = (name: string, fallback: boolean): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return fallback;
};

const readMobileExperience = (): 'webview' | 'native-preview' =>
  process.env.EXPO_PUBLIC_MOBILE_EXPERIENCE?.trim() === 'native-preview'
    ? 'native-preview'
    : 'webview';

const readDeviceSmokeColorScheme = (): 'light' | 'dark' | null => {
  const value = process.env.EXPO_PUBLIC_DEVICE_SMOKE_COLOR_SCHEME?.trim().toLowerCase();
  return value === 'light' || value === 'dark' ? value : null;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name === 'mobile' || !config.name ? 'Pokémon Go Nexus' : config.name,
  slug: config.slug === 'mobile' || !config.slug ? 'pokegonexus' : config.slug,
  version: config.version ?? '1.0.0',
  scheme: config.scheme ?? 'pokegonexus',
  plugins: Array.from(
    new Set([
      ...(config.plugins ?? []),
      'expo-router',
      'expo-image',
      'expo-secure-store',
      'expo-sharing',
      'expo-sqlite',
      'expo-status-bar',
      'expo-web-browser',
      '@maplibre/maplibre-react-native',
      './plugins/with-device-smoke-cleartext',
      './plugins/with-transparent-navigation-bar',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#06162f',
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
        },
      ],
    ]),
  ),
  experiments: {
    ...config.experiments,
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    api: {
      authApiUrl: readEnv('EXPO_PUBLIC_AUTH_API_URL', 'https://pokegonexus.com/api/auth'),
      usersApiUrl: readEnv('EXPO_PUBLIC_USERS_API_URL', 'https://pokegonexus.com/api/users'),
      searchApiUrl: readEnv('EXPO_PUBLIC_SEARCH_API_URL', 'https://pokegonexus.com/api/search'),
      pokemonApiUrl: readEnv('EXPO_PUBLIC_POKEMON_API_URL', 'https://pokegonexus.com/api/pokemon'),
      locationApiUrl: readEnv('EXPO_PUBLIC_LOCATION_API_URL', 'https://pokegonexus.com/api/location'),
      eventsApiUrl: readEnv('EXPO_PUBLIC_EVENTS_API_URL', 'https://pokegonexus.com/api/events'),
      receiverApiUrl: readEnv('EXPO_PUBLIC_RECEIVER_API_URL', 'https://pokegonexus.com/api/receiver'),
      frontendAppUrl: readEnv('EXPO_PUBLIC_FRONTEND_APP_URL', 'https://pokegonexus.com'),
    },
    observability: {
      crashReportUrl: readEnv('EXPO_PUBLIC_CRASH_REPORT_URL', ''),
      crashReportApiKey: readEnv('EXPO_PUBLIC_CRASH_REPORT_API_KEY', ''),
      appEnv: readEnv('EXPO_PUBLIC_APP_ENV', 'development'),
      appRelease: readEnv('EXPO_PUBLIC_APP_RELEASE', config.version ?? 'mobile@1.0.0'),
    },
    realtime: {
      allowAccessTokenQueryFallback: readBool('EXPO_PUBLIC_REALTIME_ALLOW_QUERY_TOKEN', false),
    },
    mobile: {
      experienceMode: readMobileExperience(),
      deviceSmokeMode: readBool('EXPO_PUBLIC_DEVICE_SMOKE_MODE', false),
      deviceSmokeColorScheme: readDeviceSmokeColorScheme(),
      deviceSmokeHost: readEnv('EXPO_PUBLIC_DEVICE_SMOKE_HOST', '10.0.2.2'),
    },
  },
});
