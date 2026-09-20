import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

export type NativeTrainerWorkspace = 'profile' | 'friends';

type Props = {
  active: NativeTrainerWorkspace;
  progress?: Animated.AnimatedDivision<number>;
  onOpenFriends: () => void;
  onOpenProfile: () => void;
};

export const NativeTrainerWorkspaceNav = ({
  active,
  progress,
  onOpenFriends,
  onOpenProfile,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const [width, setWidth] = useState(0);
  const buttonWidth = Math.max(0, width - 8) / 2;
  const translateX = useMemo(() => progress
    ? Animated.multiply(progress, buttonWidth)
    : active === 'friends' ? buttonWidth : 0, [active, buttonWidth, progress]);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel="Profile pages"
      accessibilityRole="tablist"
      style={[styles.nav, light && styles.navLight]}
      testID="native-trainer-workspace-nav"
    >
      <Animated.View
        pointerEvents="none"
        testID="native-trainer-workspace-indicator"
        style={[styles.indicator, { width: buttonWidth, transform: [{ translateX }] }]}
      >
        <Svg height="100%" width="100%">
          <Defs>
            <LinearGradient id="trainer-workspace" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#14b9c8" />
              <Stop offset="1" stopColor="#63e2b4" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#trainer-workspace)" height="100%" rx={7} width="100%" />
        </Svg>
      </Animated.View>
      {([
        ['profile', 'Profile', onOpenProfile],
        ['friends', 'Friends', onOpenFriends],
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
            <View style={styles.labelRow}>
              <WorkspaceIcon friends={workspace === 'friends'} selected={selected} />
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

const WorkspaceIcon = ({ friends, selected }: { friends: boolean; selected: boolean }) => {
  const color = selected ? '#071516' : '#9daaac';
  return (
    <Svg height={14} viewBox="0 0 24 24" width={14}>
      <Circle cx={friends ? 8 : 12} cy={8} fill={color} r={3.2} />
      {friends ? <Circle cx={16} cy={8.5} fill={color} r={2.7} /> : null}
      <Path
        d={friends
          ? 'M2.5 19c.3-4.2 2.3-6.3 5.5-6.3s5.2 2.1 5.5 6.3H2.5Zm9.2 0c.2-3.5 1.7-5.3 4.4-5.3 2.8 0 4.5 1.8 4.8 5.3h-9.2Z'
          : 'M5 20c.3-5.2 2.7-7.8 7-7.8s6.7 2.6 7 7.8H5Z'}
        fill={color}
      />
    </Svg>
  );
};

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    width: '100%',
    padding: 3,
    borderWidth: 1,
    borderColor: '#35494d',
    borderRadius: 10,
    backgroundColor: '#0e1517',
  },
  indicator: { position: 'absolute', left: 3, top: 3, bottom: 3 },
  navLight: { borderColor: '#9bb8b1', backgroundColor: '#e7f3eb' },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  labelRow: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#9daaac', fontSize: 13, fontWeight: '800' },
  labelLight: { color: '#4b625e' },
  labelActive: { color: '#071516', fontWeight: '900' },
  pressed: { opacity: 0.66 },
});
