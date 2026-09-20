import { memo, useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NATIVE_ACTION_MENU_ASSET_PATHS,
  toNativeActionMenuAssetUrl,
} from './nativeActionMenuAssets';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';

type Props = {
  assetBaseUrl: string;
  disabled?: boolean;
  onPress: () => void;
};

const warmedActionMenuAssetOrigins = new Set<string>();

export const NativeActionMenuAnchor = memo(function NativeActionMenuAnchor({
  assetBaseUrl,
  disabled = false,
  onPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (warmedActionMenuAssetOrigins.has(assetBaseUrl)) return;
    warmedActionMenuAssetOrigins.add(assetBaseUrl);
    for (const path of NATIVE_ACTION_MENU_ASSET_PATHS) {
      void Promise.resolve(
        Image.prefetch(toNativeActionMenuAssetUrl(assetBaseUrl, path)),
      ).catch(() => undefined);
    }
  }, [assetBaseUrl]);
  const size = width <= 480
    ? Math.min(80, Math.max(50, width * 0.12))
    : width < 768
      ? Math.min(90, Math.max(60, width * 0.1))
      : Math.min(80, Math.max(60, width * 0.035));
  const imageSource = useMemo(() => ({
    cache: 'force-cache' as const,
    uri: toNativeActionMenuAssetUrl(assetBaseUrl, '/images/btn_action_menu.png'),
  }), [assetBaseUrl]);
  return (
    <Pressable
      accessibilityLabel="Open action menu"
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        markNativeUiPerformance('action_menu_anchor_pressed');
        onPress();
      }}
      pointerEvents={disabled ? 'none' : 'auto'}
      testID="native-action-menu-anchor"
      style={({ pressed }) => [
        styles.anchor,
        {
          borderRadius: size / 2,
          bottom: Math.max(20, insets.bottom),
          height: size,
          marginLeft: -(size / 2),
          width: size,
        },
        pressed && styles.pressed,
      ]}
    >
      <Image fadeDuration={0}
        accessibilityElementsHidden
        resizeMode="contain"
        source={imageSource}
        style={{ height: size, width: size }}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: '50%',
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
