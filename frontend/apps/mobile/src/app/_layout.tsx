import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { nativePathSurface, nativeRouteNameFromPath } from '../navigation/nativeRouteSurface';
import { runtimeConfig } from '../config/runtimeConfig';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';

initializeObservability();

const RootContent = () => {
  const devicePreferences = useNativeDevicePreferences();
  const light = devicePreferences.colorTheme === 'light';
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const windowSurface = nativePathSurface(pathname, light, width < 600);
  const routeName = nativeRouteNameFromPath(pathname);
  const isInstanceOverlay = routeName === 'collection/[instanceId]'
    || routeName === 'collection/trainer/[username]/[instanceId]';
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
        {/* Let route backgrounds reach the camera; screens retain their own content insets. */}
        <StatusBar style={isInstanceOverlay || !light ? 'light' : 'dark'} />
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
});
