import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  audience?: 'guest' | 'trainer';
  onDismiss: () => void;
  onOpen: () => void;
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

export const NativeActionMenuHint = ({
  assetBaseUrl,
  audience = 'trainer',
  onDismiss,
  onOpen,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const dismiss = () => {
    const startedAt = Date.now();
    setVisible(false);
    onDismiss();
    markNativeUiPerformanceAfterPaint('home_hint_dismiss_result_painted', startedAt);
  };
  const open = () => {
    setVisible(false);
    onDismiss();
    onOpen();
  };
  if (!visible) return null;
  return (
    <View
      accessibilityLabel="Action menu tip"
      accessibilityRole="summary"
      style={[
        styles.root,
        light && styles.rootLight,
        { bottom: Math.max(82, insets.bottom + 70) },
      ]}
    >
      <Image fadeDuration={0}
        accessibilityElementsHidden
        resizeMode="contain"
        source={{ uri: toAssetUrl(assetBaseUrl, '/images/btn_action_menu.png') }}
        style={styles.logo}
      />
      <Pressable
        accessibilityLabel="Open action menu from tip"
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
      >
        <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>QUICK NAVIGATION</Text>
        <Text style={[styles.copy, light && styles.copyLight]}>
          {audience === 'guest'
            ? 'Tap the Poké Ball below to explore the app.'
            : 'Tap the Poké Ball below for quick navigation.'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Dismiss action menu tip"
        accessibilityRole="button"
        hitSlop={4}
        onPress={dismiss}
        style={styles.dismiss}
      >
        <Text style={[styles.dismissText, light && styles.dismissTextLight]}>×</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 18,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2b9be9',
    borderRadius: 14,
    backgroundColor: 'rgba(11, 30, 38, 0.97)',
  },
  rootLight: { backgroundColor: 'rgba(242, 250, 248, 0.98)' },
  logo: { width: 42, height: 42 },
  copyButton: { minHeight: 44, minWidth: 0, flex: 1, justifyContent: 'center', gap: 2 },
  eyebrow: { color: '#299cf5', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  eyebrowLight: { color: '#005bb5' },
  copy: { color: '#d4e2e4', fontSize: 11, lineHeight: 15 },
  copyLight: { color: '#193d40' },
  dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissText: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  dismissTextLight: { color: '#193d40' },
  pressed: { opacity: 0.72 },
});
