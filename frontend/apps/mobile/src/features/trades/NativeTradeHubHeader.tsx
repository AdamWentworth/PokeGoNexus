import { useNativeHorizontalPageOffset } from '../../components/NativeHorizontalPageSlider';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeUiIcon } from '../../components/NativeUiIcon';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

export type NativeTradeHubView = 'preferences' | 'activity';

type Props = {
  activeView: NativeTradeHubView;
  assetBaseUrl?: string;
  onOpenTradeBoard?: () => void;
  onViewChange: (view: NativeTradeHubView) => void;
  scrollX?: Animated.Value;
  dragX?: Animated.Value;
};

const VIEW_ORDER: NativeTradeHubView[] = ['preferences', 'activity'];

export const NativeTradeHubHeader = ({
  activeView,
  assetBaseUrl,
  onOpenTradeBoard,
  onViewChange,
  scrollX,
  dragX,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabWidth = Math.max(0, width - 28) / 2;
  const activeIndex = VIEW_ORDER.indexOf(activeView);
  const renderedOffset = useNativeHorizontalPageOffset(scrollX, dragX, width);
  const translateX = renderedOffset?.interpolate({
    inputRange: [0, Math.max(1, width)],
    outputRange: [0, tabWidth],
    extrapolate: 'clamp',
  }) ?? activeIndex * tabWidth;

  return (
    <View style={[styles.header, { paddingTop: 20 + insets.top }, light && styles.headerLight]}>
      <View style={styles.productRow}>
        {assetBaseUrl ? (
          <Image fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/btn_trades.png` }}
            style={styles.productIcon}
          />
        ) : null}
        <View style={styles.productCopy}>
          <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>TRAINER EXCHANGE</Text>
          <Text accessibilityRole="header" style={[styles.title, light && styles.titleLight]}>Trades</Text>
          <Text style={[styles.description, light && styles.descriptionLight]}>
            Set your preferences, respond to offers, and follow every exchange.
          </Text>
        </View>
      </View>

      {onOpenTradeBoard ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenTradeBoard}
          style={({ pressed }) => [
            styles.shareButton,
            light && styles.shareButtonLight,
            pressed && styles.pressed,
          ]}
          testID="open-native-trade-board"
        >
          <NativeUiIcon color={light ? '#13201e' : '#f6fbfa'} name="share" size={16} />
          <Text style={[styles.shareText, light && styles.titleLight]}>Share board</Text>
        </Pressable>
      ) : null}

      <View
        accessibilityRole="tablist"
        style={[styles.tabs, light && styles.tabsLight]}
        testID="native-trade-hub-header"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: tabWidth, transform: [{ translateX }] },
          ]}
          testID="native-trade-hub-indicator"
        />
        {VIEW_ORDER.map((view) => {
          const selected = activeView === view;
          const iconColor = selected ? '#041411' : light ? '#60726f' : '#9eb8b3';
          return (
            <Pressable
              aria-selected={selected}
              accessibilityLabel={view === 'preferences' ? 'Trade Preferences' : 'Trade Activity'}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={view}
              onPress={() => onViewChange(view)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={styles.labelRow}>
                <NativeUiIcon color={iconColor} name={view === 'preferences' ? 'sliders' : 'trade'} size={14} />
                <Text style={[
                  styles.label,
                  light && styles.labelLight,
                  selected && styles.selectedLabel,
                ]}>
                  {view === 'preferences' ? 'Trade Preferences' : 'Trade Activity'}
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
    gap: 12,
    paddingHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#24464b',
    backgroundColor: '#071012',
  },
  headerLight: { borderBottomColor: '#a8bbb7', backgroundColor: '#f8fff9' },
  productRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 11 },
  productIcon: { width: 44, height: 44, flexShrink: 0 },
  productCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#43d5c5', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  eyebrowLight: { color: '#006a61' },
  title: { marginTop: 1, color: '#f6fbfa', fontSize: 26, lineHeight: 29, fontWeight: '900' },
  titleLight: { color: '#13201e' },
  description: { maxWidth: 560, marginTop: 5, color: '#9db6b2', fontSize: 13, lineHeight: 19 },
  descriptionLight: { color: '#526762' },
  shareButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#315f58',
    borderRadius: 9,
    backgroundColor: '#0b1718',
  },
  shareButtonLight: { borderColor: '#91aaa4', backgroundColor: '#ffffff' },
  shareText: { color: '#f6fbfa', fontSize: 12, fontWeight: '900' },
  tabs: {
    position: 'relative',
    flexDirection: 'row',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#24464b',
    borderRadius: 10,
    padding: 4,
    overflow: 'hidden',
    backgroundColor: '#0b1618',
  },
  tabsLight: { borderColor: '#9db8b2', backgroundColor: '#ffffff' },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 7,
    backgroundColor: '#14b9c8',
  },
  tab: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  label: { color: '#9eb8b3', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  labelLight: { color: '#60726f' },
  selectedLabel: { color: '#041411', fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
