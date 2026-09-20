import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  active: 'settings' | 'account';
  onOpenAccount: () => void;
  onOpenSettings: () => void;
};

export const NativeSettingsWorkspaceNav = ({
  active,
  onOpenAccount,
  onOpenSettings,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  return (
    <View
      accessibilityLabel="Settings pages"
      accessibilityRole="tablist"
      style={[styles.nav, light && styles.navLight]}
    >
      {([
        ['settings', 'Settings', onOpenSettings],
        ['account', 'Account', onOpenAccount],
      ] as const).map(([workspace, label, onPress]) => {
        const selected = workspace === active;
        return (
          <Pressable
            aria-selected={selected}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            disabled={selected}
            key={workspace}
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
            ]}
          >
            {selected ? (
              <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
                <Defs>
                  <LinearGradient id={`settings-workspace-${workspace}`} x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0" stopColor="#14b9c8" />
                    <Stop offset="1" stopColor="#63e2b4" />
                  </LinearGradient>
                </Defs>
                <Rect fill={`url(#settings-workspace-${workspace})`} height="100%" rx={6} width="100%" />
              </Svg>
            ) : null}
            <View style={styles.labelRow}>
              <WorkspaceIcon account={workspace === 'account'} selected={selected} />
            <Text style={[
              styles.label,
              light && styles.labelLight,
              selected && styles.labelActive,
            ]}>{label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const WorkspaceIcon = ({ account, selected }: { account: boolean; selected: boolean }) => {
  const color = selected ? '#071516' : '#9daaac';
  return account ? (
    <Svg height={14} viewBox="0 0 24 24" width={14}>
      <Circle cx={12} cy={7.5} fill={color} r={3.5} />
      <Path d="M4.5 20c.4-5.4 2.9-8 7.5-8s7.1 2.6 7.5 8h-15Z" fill={color} />
    </Svg>
  ) : (
    <Svg height={14} viewBox="0 0 24 24" width={14}>
      <Path d="M12 3.2 14 5l2.7-.4.8 2.6 2.4 1.3-1 2.5 1 2.5-2.4 1.3-.8 2.6L14 17l-2 1.8-2-1.8-2.7.4-.8-2.6-2.4-1.3 1-2.5-1-2.5 2.4-1.3.8-2.6L10 5l2-1.8Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={1.8} />
      <Circle cx={12} cy={11} fill="none" r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', padding: 3, borderWidth: 1, borderColor: '#35494d', borderRadius: 9, backgroundColor: '#0e1517' },
  navLight: { borderColor: '#9bb8b1', backgroundColor: '#e7f3eb' },
  button: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  labelRow: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#9daaac', fontSize: 13, fontWeight: '800' },
  labelLight: { color: '#4b625e' },
  labelActive: { color: '#061617', fontWeight: '900' },
  pressed: { opacity: 0.66 },
});
