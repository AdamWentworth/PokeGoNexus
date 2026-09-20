import { useOptionalNativeDevicePreferences } from './NativeDevicePreferencesProvider';

export type NativeModalAnimation = 'fade' | 'none' | 'slide';

export const useNativeReducedMotion = (): boolean => (
  useOptionalNativeDevicePreferences()?.shouldReduceMotion ?? false
);

export const useNativeModalAnimation = (
  preferred: Exclude<NativeModalAnimation, 'none'>,
): NativeModalAnimation => (
  useNativeReducedMotion() ? 'none' : preferred
);
