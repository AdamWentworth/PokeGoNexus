import { useMemo, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeBackIcon } from '../components/NativeBackIcon';
import { NativeHorizontalPageSlider } from '../components/NativeHorizontalPageSlider';
import {
  NativeTrainerWorkspaceNav,
  type NativeTrainerWorkspace,
} from '../components/NativeTrainerWorkspaceNav';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  active: NativeTrainerWorkspace;
  friends: ReactNode;
  profile: ReactNode;
  username: string;
  onBack: () => void;
  onChange: (workspace: NativeTrainerWorkspace) => void;
};

export const NativeTrainerWorkspaceScreen = ({
  active, friends, profile, username, onBack, onChange,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const activeIndex = active === 'friends' ? 1 : 0;
  const [scrollX] = useState(() => new Animated.Value(activeIndex * width));
  // One native animation drives both the button and the retained content track.
  const progress = useMemo(() => Animated.divide(scrollX, Math.max(width, 1)), [scrollX, width]);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-trainer-workspace"
    >
      <View style={[styles.header, { paddingTop: 14 + insets.top }]} testID="native-trainer-workspace-header">
        <View style={styles.titleRow}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={[styles.back, light && styles.backLight]}>
            <NativeBackIcon color={light ? '#172124' : '#f7fbfa'} size={20} />
          </Pressable>
          <View style={styles.titleCopy}>
            <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>YOUR TRAINER CARD</Text>
            <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, light && styles.textLight]}>{username}</Text>
          </View>
        </View>
        <NativeTrainerWorkspaceNav
          active={active}
          onOpenFriends={() => onChange('friends')}
          onOpenProfile={() => onChange('profile')}
          progress={progress}
        />
      </View>
      <NativeHorizontalPageSlider
        activeIndex={activeIndex}
        onIndexChange={(index) => onChange(index === 1 ? 'friends' : 'profile')}
        scrollX={scrollX}
        swipeEnabled={false}
      >
        {profile}
        {friends}
      </NativeHorizontalPageSlider>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#081012' },
  screenLight: { backgroundColor: '#f8fff9' },
  header: { paddingHorizontal: 14, paddingBottom: 7, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 50 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { color: '#f7fbfa', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  textLight: { color: '#172124' },
  eyebrow: { color: '#35a8ff', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.3 },
  eyebrowLight: { color: '#005bb5' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#315052', borderRadius: 10, backgroundColor: '#171c1d' },
  backLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
});
