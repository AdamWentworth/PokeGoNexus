import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MobileErrorBoundary } from '../components/MobileErrorBoundary';
import { initializeObservability } from '../observability/bootstrap';
import {
  NativeDevicePreferencesProvider,
  useNativeDevicePreferences,
} from '../features/settings/NativeDevicePreferencesProvider';
import {
  NativeAppLoadingOverlay,
  NativeAppLoadingProvider,
} from '../components/NativeAppLoadingProvider';
import { nativePathSurface } from '../navigation/nativeRouteSurface';
import { runtimeConfig } from '../config/runtimeConfig';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';

initializeObservability();

const RootContent = () => {
  const devicePreferences = useNativeDevicePreferences();
  const light = devicePreferences.colorTheme === 'light';
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const windowSurface = nativePathSurface(pathname, light, width < 600);
  const touchStartedAtRef = useRef<number | null>(null);

  const performanceTouchProps = runtimeConfig.mobile.deviceSmokeMode ? {
    onTouchStart: () => {
      const startedAt = Date.now();
      touchStartedAtRef.current = startedAt;
      requestAnimationFrame(() => {
        if (touchStartedAtRef.current !== startedAt) return;
        touchStartedAtRef.current = null;
        markNativeUiPerformance('global_touch_next_frame', {
          interactionLatencyMs: Date.now() - startedAt,
          routePath: pathname,
        });
      });
    },
  } : {};

  return (
    <View
      {...performanceTouchProps}
      style={[styles.windowSurface, { backgroundColor: windowSurface }]}
    >
      <NativeAppLoadingProvider navigationPath={pathname}>
        <StatusBar style={light ? 'dark' : 'light'} />
        <MobileErrorBoundary>
          <Stack
            screenLayout={({ children }) => children}
            screenOptions={{
              contentStyle: { backgroundColor: windowSurface },
              headerShown: false,
              navigationBarTranslucent: true,
              statusBarTranslucent: true,
            }}
          />
        </MobileErrorBoundary>
        {Platform.OS !== 'web' && insets.top > 0 && (
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.statusBarSurface, { height: insets.top, backgroundColor: windowSurface }]}
            testID="native-status-bar-surface"
          />
        )}
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>
    </View>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.appShell}>
      <SafeAreaProvider>
        <NativeDevicePreferencesProvider>
          <RootContent />
        </NativeDevicePreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#000',
  },
  appShellLight: { backgroundColor: '#f8fff9' },
  windowSurface: { flex: 1, minHeight: 0 },
  // Scroll content keeps its existing insets; this fixed surface prevents it
  // painting behind the system icons after the content's top padding scrolls away.
  statusBarSurface: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9000, elevation: 9000 },
});
