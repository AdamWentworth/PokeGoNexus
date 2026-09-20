import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { Image as ExpoImage } from 'expo-image';
import {
  StyleSheet,
  View,
} from 'react-native';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';

const FRAME_COUNT = 72;
const FRAME_DURATION_MS = 1000 / 60;
const FRAME_SIZE = 50;

const DARK_SPINNER_SOURCE = require('../../assets/loading-spinner-dark.webp');
const LIGHT_SPINNER_SOURCE = require('../../assets/loading-spinner-light.webp');

export const NATIVE_LOADING_SPINNER_SOURCES = [
  DARK_SPINNER_SOURCE,
  LIGHT_SPINNER_SOURCE,
] as const;

export const NATIVE_LOADING_SPINNER_DURATION_MS = FRAME_COUNT * FRAME_DURATION_MS;

export type NativeLoadingSpinnerHandle = {
  start: () => void;
  stop: () => void;
};

type Props = {
  autoStart?: boolean;
  light: boolean;
};

export const NativeLoadingSpinner = forwardRef<NativeLoadingSpinnerHandle, Props>(({
  autoStart = true,
  light,
}, ref) => {
  const darkImageRef = useRef<ExpoImage | null>(null);
  const lightImageRef = useRef<ExpoImage | null>(null);
  const activeLightRef = useRef(light);
  const previousLightRef = useRef(light);
  const runningRef = useRef(autoStart);
  activeLightRef.current = light;

  const ignorePlaybackError = useCallback((operation: Promise<void> | undefined) => {
    void operation?.catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    ignorePlaybackError(darkImageRef.current?.stopAnimating());
    ignorePlaybackError(lightImageRef.current?.stopAnimating());
  }, [ignorePlaybackError]);

  const start = useCallback(() => {
    runningRef.current = true;
    const activeImage = activeLightRef.current ? lightImageRef.current : darkImageRef.current;
    const inactiveImage = activeLightRef.current ? darkImageRef.current : lightImageRef.current;
    ignorePlaybackError(inactiveImage?.stopAnimating());
    ignorePlaybackError(activeImage?.startAnimating());
    markNativeUiPerformance('loading_spinner_driver_started');
  }, [ignorePlaybackError]);

  const handleImageLoad = useCallback((loadedLightImage: boolean) => {
    const image = loadedLightImage ? lightImageRef.current : darkImageRef.current;
    if (runningRef.current && loadedLightImage === activeLightRef.current) {
      ignorePlaybackError(image?.startAnimating());
    } else {
      ignorePlaybackError(image?.stopAnimating());
    }
  }, [ignorePlaybackError]);

  useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);

  useLayoutEffect(() => {
    if (autoStart) start();
    else stop();
  }, [autoStart, start, stop]);

  useLayoutEffect(() => {
    if (previousLightRef.current === light) return;
    previousLightRef.current = light;
    if (runningRef.current) start();
    else stop();
  }, [light, start, stop]);

  useLayoutEffect(() => stop, [stop]);

  return (
    <View pointerEvents="none" style={styles.viewport}>
      <ExpoImage
        accessible={false}
        accessibilityLabel="Loading animation"
        accessibilityElementsHidden
        autoplay={false}
        cachePolicy="memory"
        contentFit="fill"
        importantForAccessibility="no-hide-descendants"
        onLoad={() => handleImageLoad(false)}
        priority="high"
        ref={darkImageRef}
        source={DARK_SPINNER_SOURCE}
        style={[styles.frame, light && styles.hiddenFrame]}
        testID={light ? undefined : 'native-loading-spinner-dark'}
        transition={0}
        useAppleWebpCodec={false}
      />
      <ExpoImage
        accessible={false}
        accessibilityLabel="Loading animation"
        accessibilityElementsHidden
        autoplay={false}
        cachePolicy="memory"
        contentFit="fill"
        importantForAccessibility="no-hide-descendants"
        onLoad={() => handleImageLoad(true)}
        priority="high"
        ref={lightImageRef}
        source={LIGHT_SPINNER_SOURCE}
        style={[styles.frame, !light && styles.hiddenFrame]}
        testID={light ? 'native-loading-spinner-light' : undefined}
        transition={0}
        useAppleWebpCodec={false}
      />
    </View>
  );
});

NativeLoadingSpinner.displayName = 'NativeLoadingSpinner';

const styles = StyleSheet.create({
  frame: {
    height: FRAME_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: FRAME_SIZE,
  },
  hiddenFrame: { opacity: 0 },
  viewport: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
});
