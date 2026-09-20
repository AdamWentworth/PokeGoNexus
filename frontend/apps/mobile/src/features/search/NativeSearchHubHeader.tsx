import { useNativeHorizontalPageOffset } from '../../components/NativeHorizontalPageSlider';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeUiIcon } from '../../components/NativeUiIcon';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

export type NativeSearchHubView = 'pokemon' | 'trainers';

type Props = {
  activeView: NativeSearchHubView;
  onViewChange: (view: NativeSearchHubView) => void;
  scrollX?: Animated.Value;
  dragX?: Animated.Value;
};

const VIEW_ORDER: NativeSearchHubView[] = ['pokemon', 'trainers'];

export const NativeSearchHubHeader = ({
  activeView,
  onViewChange,
  scrollX,
  dragX,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabsWidth = Math.min(Math.max(0, width - 12), 520);
  const tabWidth = Math.max(0, tabsWidth - 8) / VIEW_ORDER.length;
  const activeIndex = VIEW_ORDER.indexOf(activeView);
  const renderedOffset = useNativeHorizontalPageOffset(scrollX, dragX, width);
  const translateX = renderedOffset?.interpolate({
    inputRange: [0, Math.max(1, width)],
    outputRange: [0, tabWidth],
    extrapolate: 'clamp',
  }) ?? activeIndex * tabWidth;

  return (
    <View style={[styles.header, { paddingTop: 6 + insets.top }, light && styles.headerLight]}>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>COMMUNITY DISCOVERY</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>
          Search
        </Text>
        <Text style={[styles.description, light && styles.secondaryLight]}>
          Find Pokémon listings and connect with trainers nearby.
        </Text>
      </View>
      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { width: tabsWidth }, light && styles.tabsLight]}
        testID="native-search-hub-header"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: tabWidth, transform: [{ translateX }] },
          ]}
          testID="native-search-hub-indicator"
        />
        {VIEW_ORDER.map((view) => {
          const selected = activeView === view;
          const iconColor = selected ? '#ffffff' : light ? '#5c6a6d' : '#a7b1b3';
          return (
            <Pressable
              aria-selected={selected}
              accessibilityLabel={view === 'pokemon' ? 'Pokémon search' : 'Trainer search'}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={view}
              onPress={() => onViewChange(view)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={styles.labelRow}>
                <NativeUiIcon color={iconColor} name={view === 'trainers' ? 'trainers' : 'search'} size={15} />
                <Text style={[
                  styles.label,
                  light && styles.labelLight,
                  selected && styles.selectedLabel,
                ]}>
                  {view === 'pokemon' ? 'Pokémon' : 'Trainers'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    zIndex: 2,
    paddingTop: 6,
    paddingBottom: 5,
    backgroundColor: '#080d0f',
  },
  headerLight: { backgroundColor: '#f8fff9' },
  heading: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7 },
  eyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  eyebrowLight: { color: '#005bb5' },
  title: { color: '#f8fcfd', fontSize: 29, fontWeight: '900' },
  description: {
    maxWidth: 520,
    marginTop: 1,
    color: '#a5b1b3',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  tabs: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 22,
    flexDirection: 'row',
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#35494d',
    borderRadius: 11,
    padding: 4,
    overflow: 'hidden',
    backgroundColor: '#0d1416',
  },
  tabsLight: { borderColor: '#aab9bc', backgroundColor: '#ffffff' },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderWidth: 1,
    borderColor: '#2f9cff',
    borderRadius: 8,
    backgroundColor: '#123b66',
  },
  tab: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { color: '#a7b1b3', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  labelLight: { color: '#5c6a6d' },
  selectedLabel: { color: '#ffffff' },
  pressed: { opacity: 0.72 },
  textLight: { color: '#172124' },
  secondaryLight: { color: '#566467' },
});
