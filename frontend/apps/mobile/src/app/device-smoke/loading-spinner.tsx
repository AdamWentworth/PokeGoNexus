import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeLoadingSpinner } from '../../components/NativeLoadingSpinner';

export default function DeviceSmokeLoadingSpinnerRoute() {
  const [blocking, setBlocking] = useState(false);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  const blockJavaScript = () => {
    if (blocking) return;
    setBlocking(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const releaseAt = performance.now() + 1000;
      while (performance.now() < releaseAt) {
        // Deliberately saturate JavaScript. Native image playback must continue.
      }
      setBlocking(false);
    }));
  };

  return (
    <View style={styles.screen} testID="device-smoke-loading-spinner">
      <NativeLoadingSpinner light={false} />
      <Pressable
        accessibilityLabel="Block JavaScript for spinner stress test"
        accessibilityRole="button"
        disabled={blocking}
        onPress={blockJavaScript}
        style={styles.stressButton}
        testID="device-smoke-loading-spinner-block-js"
      >
        <Text style={styles.stressButtonText}>
          {blocking ? 'JavaScript blocked' : 'Block JavaScript for 1 second'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101a19',
  },
  stressButton: {
    position: 'absolute',
    bottom: 80,
    minHeight: 48,
    paddingHorizontal: 18,
    borderColor: '#82eee3',
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stressButtonText: {
    color: '#f7fcff',
    fontSize: 14,
    fontWeight: '700',
  },
});
