export type NativeColorTheme = 'dark' | 'light';

export type NativeDevicePreferences = {
  colorTheme: NativeColorTheme;
  reduceMotion: boolean;
};

const DEVICE_PREFERENCES_KEY = 'pokemongonexus.mobile.device-preferences.v1';

export const defaultNativeDevicePreferences = (
  colorTheme: NativeColorTheme,
): NativeDevicePreferences => ({
  colorTheme,
  reduceMotion: false,
});

export const parseNativeDevicePreferences = (
  value: string | null,
  fallbackTheme: NativeColorTheme,
): NativeDevicePreferences => {
  if (!value) return defaultNativeDevicePreferences(fallbackTheme);
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return defaultNativeDevicePreferences(fallbackTheme);
    const candidate = parsed as Record<string, unknown>;
    return {
      colorTheme: candidate.colorTheme === 'light' || candidate.colorTheme === 'dark'
        ? candidate.colorTheme
        : fallbackTheme,
      reduceMotion: candidate.reduceMotion === true,
    };
  } catch {
    return defaultNativeDevicePreferences(fallbackTheme);
  }
};

export const readNativeDevicePreferences = async (
  fallbackTheme: NativeColorTheme,
): Promise<NativeDevicePreferences> => {
  let stored: string | null = null;
  try {
    stored = globalThis.localStorage?.getItem(DEVICE_PREFERENCES_KEY) ?? null;
  } catch {
    // Use the system theme when browser storage is unavailable.
  }
  return parseNativeDevicePreferences(stored, fallbackTheme);
};

export const writeNativeDevicePreferences = async (
  preferences: NativeDevicePreferences,
): Promise<void> => {
  try {
    globalThis.localStorage?.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preference persistence is best-effort in restricted browser contexts.
  }
};
