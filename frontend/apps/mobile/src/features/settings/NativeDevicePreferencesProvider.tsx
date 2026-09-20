import {
  AccessibilityInfo,
  Appearance,
} from 'react-native';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { logWarn } from '../../observability/logger';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  defaultNativeDevicePreferences,
  readNativeDevicePreferences,
  type NativeColorTheme,
  type NativeDevicePreferences,
  writeNativeDevicePreferences,
} from './nativeDevicePreferences';

type NativeDevicePreferencesContextValue = NativeDevicePreferences & {
  hydrated: boolean;
  shouldReduceMotion: boolean;
  setColorTheme: (theme: NativeColorTheme) => void;
  setReduceMotion: (enabled: boolean) => void;
  toggleColorTheme: () => void;
};

const normalizeTheme = (scheme: string | null | undefined): NativeColorTheme =>
  scheme === 'light' ? 'light' : 'dark';

const applyColorScheme = (theme: NativeColorTheme): void => {
  const appearance = Appearance as typeof Appearance & {
    setColorScheme?: (scheme: NativeColorTheme) => void;
  };
  if (typeof appearance.setColorScheme === 'function') {
    appearance.setColorScheme(theme);
    return;
  }
  // react-native-web does not currently implement Appearance.setColorScheme.
  // The native screens consume the provider value directly, while this keeps
  // browser-owned controls and the document canvas in the same theme.
  if (typeof document !== 'undefined') document.documentElement.style.colorScheme = theme;
};

const NativeDevicePreferencesContext = createContext<NativeDevicePreferencesContextValue | null>(null);

export const useNativeDevicePreferences = (): NativeDevicePreferencesContextValue => {
  const context = useContext(NativeDevicePreferencesContext);
  if (!context) throw new Error('Native device preferences require their provider.');
  return context;
};

export const useOptionalNativeDevicePreferences = (): NativeDevicePreferencesContextValue | null =>
  useContext(NativeDevicePreferencesContext);

export const NativeDevicePreferencesProvider = ({ children }: PropsWithChildren) => {
  const smokeColorTheme = runtimeConfig.mobile.deviceSmokeMode
    ? runtimeConfig.mobile.deviceSmokeColorScheme
    : null;
  const [preferences, setPreferences] = useState<NativeDevicePreferences>(() =>
    defaultNativeDevicePreferences(smokeColorTheme ?? normalizeTheme(Appearance.getColorScheme())),
  );
  const [hydrated, setHydrated] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    const restorePreferences = smokeColorTheme
      ? Promise.resolve(defaultNativeDevicePreferences(smokeColorTheme))
      : readNativeDevicePreferences(normalizeTheme(Appearance.getColorScheme()));
    void restorePreferences
      .then((stored) => {
        if (!active) return;
        setPreferences(stored);
      })
      .catch((error: unknown) => {
        logWarn('device-preferences', 'Unable to restore native device preferences', error);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setSystemReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [smokeColorTheme]);

  // Match Vite's ThemeProvider ordering: commit the app-owned theme state
  // first, then synchronize the platform appearance as a post-commit effect.
  // Appearance.setColorScheme can cross the native boundary and must not hold
  // up the React palette update that the person is waiting to see.
  useEffect(() => {
    applyColorScheme(preferences.colorTheme);
  }, [preferences.colorTheme]);

  const persist = useCallback((next: NativeDevicePreferences) => {
    setPreferences(next);
    void writeNativeDevicePreferences(next).catch((error: unknown) => {
      logWarn('device-preferences', 'Unable to persist native device preferences', error);
    });
  }, []);

  const setColorTheme = useCallback((colorTheme: NativeColorTheme) => {
    persist({ ...preferences, colorTheme });
  }, [persist, preferences]);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    persist({ ...preferences, reduceMotion });
  }, [persist, preferences]);

  const toggleColorTheme = useCallback(() => {
    setColorTheme(preferences.colorTheme === 'light' ? 'dark' : 'light');
  }, [preferences.colorTheme, setColorTheme]);

  const value = useMemo<NativeDevicePreferencesContextValue>(() => ({
    ...preferences,
    hydrated,
    setColorTheme,
    setReduceMotion,
    shouldReduceMotion: preferences.reduceMotion || systemReduceMotion,
    toggleColorTheme,
  }), [hydrated, preferences, setColorTheme, setReduceMotion, systemReduceMotion, toggleColorTheme]);

  return (
    <NativeDevicePreferencesContext.Provider value={value}>
      {children}
    </NativeDevicePreferencesContext.Provider>
  );
};
