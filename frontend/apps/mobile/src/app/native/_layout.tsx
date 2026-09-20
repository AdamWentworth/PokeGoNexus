import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { NativeSessionProvider } from '../../auth/NativeSessionContext';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeQueryProvider } from '../../query/NativeQueryProvider';
import { NativeCollectionSyncProvider } from '../../features/collection/NativeCollectionSyncProvider';
import { NativeRealtimeProvider } from '../../features/realtime/NativeRealtimeProvider';
import { useNativeDevicePreferences } from '../../features/settings/NativeDevicePreferencesProvider';
import { nativeRouteAnimation } from '../../navigation/nativeRouteMotion';
import { nativeRouteSurface } from '../../navigation/nativeRouteSurface';
import { NativeAppStatusCenter } from '../../components/NativeAppStatusCenter';

export default function NativeLayout() {
  const { colorTheme, shouldReduceMotion } = useNativeDevicePreferences();
  const light = colorTheme === 'light';
  const { width } = useWindowDimensions();
  const compact = width < 600;
  if (runtimeConfig.mobile.experienceMode !== 'native-preview') {
    return <Redirect href="/" />;
  }

  return (
    <NativeSessionProvider>
      <NativeQueryProvider>
        <NativeCollectionSyncProvider>
          <NativeRealtimeProvider>
            <View style={styles.screenSurface}>
            {/* Keep native screen identities in stack order. Moving an existing
                singular screen to the top can corrupt Android view ownership. */}
            <Stack
              screenLayout={({ children, route }) => (
                <View
                  style={[
                    styles.screenSurface,
                    { backgroundColor: nativeRouteSurface(route.name, light, compact) },
                  ]}
                >
                  {children}
                </View>
              )}
              screenOptions={({ route }) => ({
                contentStyle: { backgroundColor: nativeRouteSurface(route.name, light, compact) },
                headerShown: false,
                navigationBarTranslucent: true,
                statusBarTranslucent: true,
              })}
            >
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Screen name="login" options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion) }} />
              <Stack.Screen name="register" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="reset-password" options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion) }} />
              <Stack.Screen name="verify-email-change" options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion) }} />
              <Stack.Screen name="not-found" options={{ animation: nativeRouteAnimation('fade', shouldReduceMotion) }} />
              <Stack.Screen name="info/[slug]" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="pokedex/index" options={{ animation: 'none' }} />
              <Stack.Screen name="pokedex/[variantId]" options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion), gestureDirection: 'vertical' }} />
              <Stack.Screen name="rankings" options={{ animation: 'none' }} />
              <Stack.Screen name="raid" options={{ animation: 'none' }} />
              <Stack.Screen name="raid-methodology" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="max" options={{ animation: 'none' }} />
              <Stack.Screen name="pvp" options={{ animation: 'none' }} />
              <Stack.Screen name="pvp-methodology" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="collection" options={{ animation: 'none' }} />
              <Stack.Screen name="search" options={{ animation: 'none' }} />
              <Stack.Screen name="trades" options={{ animation: 'none' }} />
              <Stack.Screen name="trade-board" options={{ animation: 'none' }} />
              <Stack.Screen name="trade-board/[username]" options={{ animation: 'none' }} />
              <Stack.Screen name="settings" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="account" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="friends" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="profile/index" options={{ animation: nativeRouteAnimation('slide_from_right', shouldReduceMotion) }} />
              <Stack.Screen name="profile/[username]" options={{ animation: 'none' }} />
              <Stack.Screen
                name="collection/[instanceId]"
                options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion), gestureDirection: 'vertical' }}
              />
              <Stack.Screen
                name="collection/catalog/[variantId]"
                options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion), gestureDirection: 'vertical' }}
              />
              <Stack.Screen
                name="collection/trainer/[username]/index"
                options={{ animation: 'none', gestureDirection: 'horizontal' }}
              />
              <Stack.Screen
                name="collection/trainer/[username]/[instanceId]"
                options={{ animation: nativeRouteAnimation('slide_from_bottom', shouldReduceMotion), gestureDirection: 'vertical' }}
              />
            </Stack>
              <NativeAppStatusCenter />
            </View>
          </NativeRealtimeProvider>
        </NativeCollectionSyncProvider>
      </NativeQueryProvider>
    </NativeSessionProvider>
  );
}

const styles = StyleSheet.create({
  screenSurface: { flex: 1, backgroundColor: '#101a19' },
});
