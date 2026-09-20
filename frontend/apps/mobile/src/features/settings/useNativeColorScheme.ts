import { useColorScheme, type ColorSchemeName } from 'react-native';
import { useOptionalNativeDevicePreferences } from './NativeDevicePreferencesProvider';

/**
 * The app-owned preference is authoritative whenever the native shell is
 * mounted. Falling back to the operating-system hook keeps isolated component
 * tests and reusable native views behaving normally outside that provider.
 */
export const useNativeColorScheme = (): ColorSchemeName => {
  const systemScheme = useColorScheme();
  const preferences = useOptionalNativeDevicePreferences();
  return preferences?.colorTheme ?? systemScheme;
};
