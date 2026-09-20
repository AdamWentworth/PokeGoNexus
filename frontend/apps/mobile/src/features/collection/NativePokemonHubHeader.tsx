import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomTagParent } from '@pokemongonexus/shared-contracts/users';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collectionExperienceParityContract,
  collectionParityTokens,
} from '@pokemongonexus/shared-ui-tokens';
import { NativeBackIcon } from '../../components/NativeBackIcon';
import { useOptionalNativeDevicePreferences } from '../settings/NativeDevicePreferencesProvider';
import { markNativeUiPerformance } from '../../observability/nativeUiPerformanceTrace';

export type NativePokemonHubView = 'inventory' | 'pokemon' | 'wishlist';

const NATIVE_POKEMON_HUB_TABS = collectionExperienceParityContract.viewOrder.map(
  (key, index) => ({
    key,
    label: collectionExperienceParityContract.viewLabels[index]!,
  }),
);

export const resolveNativePokemonHubIndicatorMetrics = (
  width: number,
  pagePosition: number,
) => {
  const desktop = width >= 768;
  const horizontalPadding = desktop
    ? collectionParityTokens.header.horizontalPaddingWide
    : collectionParityTokens.header.horizontalPaddingNarrow;
  const contentWidth = Math.max(0, width - (horizontalPadding * 2));
  const tabWidth = contentWidth / 3;
  const indicatorWidth = Math.max(
    collectionParityTokens.header.underlineMinWidth,
    width * collectionParityTokens.header.underlineViewportRatio,
  );
  return {
    horizontalPadding,
    indicatorLeft: horizontalPadding + (tabWidth / 2) - (indicatorWidth / 2),
    indicatorTranslateX: Math.max(0, Math.min(2, pagePosition)) * tabWidth,
    indicatorWidth,
    tabWidth,
  };
};

type Props = {
  activeView: NativePokemonHubView;
  activeTag?: string | null;
  activeTagParent?: CustomTagParent | null;
  collectionCount: number;
  backgroundColor: string;
  textColor: string;
  secondaryTextColor: string;
  inactiveTextColor?: string;
  onViewChange: (view: NativePokemonHubView) => void;
  selectionCount?: number;
  selectionBackgroundColor?: string;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  catalogOwner?: string | null;
  onReturnToContext?: () => void;
};

export type NativePokemonHubHeaderHandle = {
  setView: (view: NativePokemonHubView, interactionStartedAt?: number) => void;
};

const viewIndex = (view: NativePokemonHubView): number => (
  view === 'inventory' ? 0 : view === 'pokemon' ? 1 : 2
);

export const NativePokemonHubHeader = memo(forwardRef<
  NativePokemonHubHeaderHandle,
  Props
>(function NativePokemonHubHeader({
  activeView,
  activeTag,
  activeTagParent = null,
  collectionCount,
  backgroundColor,
  textColor,
  secondaryTextColor,
  inactiveTextColor = secondaryTextColor,
  onViewChange,
  selectionCount = 0,
  selectionBackgroundColor,
  onClearSelection,
  onSelectAll,
  catalogOwner = null,
  onReturnToContext,
}, ref) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useOptionalNativeDevicePreferences()?.shouldReduceMotion ?? false;
  const desktop = width >= 768;
  const selectedIndex = viewIndex(activeView);
  const hasSelection = selectionCount > 0;
  const metrics = resolveNativePokemonHubIndicatorMetrics(width, selectedIndex);
  const [indicatorPosition] = useState(() => new Animated.Value(selectedIndex));
  const previousSelectedIndexRef = useRef(selectedIndex);
  const startIndicatorMotion = useCallback((
    nextView: NativePokemonHubView,
    interactionStartedAt?: number,
  ) => {
    const nextIndex = viewIndex(nextView);
    previousSelectedIndexRef.current = nextIndex;
    indicatorPosition.stopAnimation();
    if (reduceMotion) {
      indicatorPosition.setValue(nextIndex);
      return;
    }
    // Vite changes activeView first, then HeaderUI's effect updates `left`.
    // Its underline therefore runs an independent 300 ms CSS `ease` after
    // the page transform starts; it does not follow the finger while swiping.
    Animated.timing(indicatorPosition, {
      duration: collectionExperienceParityContract.pageTransitionMs,
      easing: Easing.ease,
      isInteraction: false,
      toValue: nextIndex,
      useNativeDriver: true,
    }).start();
    markNativeUiPerformance(
      interactionStartedAt === undefined
        ? 'collection_header_indicator_started'
        : 'collection_tag_header_indicator_started',
      {
        activeView: nextView,
        ...(interactionStartedAt === undefined ? {} : {
          interactionLatencyMs: Date.now() - interactionStartedAt,
        }),
      },
    );
  }, [indicatorPosition, reduceMotion]);
  useImperativeHandle(ref, () => ({ setView: startIndicatorMotion }), [startIndicatorMotion]);
  useEffect(() => {
    const previousIndex = previousSelectedIndexRef.current;
    if (previousIndex === selectedIndex && !reduceMotion) return;
    startIndicatorMotion(activeView);
  }, [activeView, reduceMotion, selectedIndex, startIndicatorMotion]);
  const indicatorTranslateX = useMemo(
    () => Animated.multiply(indicatorPosition, metrics.tabWidth),
    [indicatorPosition, metrics.tabWidth],
  );
  const indicatorStyle = useMemo(() => [
    styles.activeUnderline,
    {
      backgroundColor: textColor,
      left: metrics.indicatorLeft,
      width: metrics.indicatorWidth,
      transform: [{
        translateX: hasSelection ? metrics.tabWidth : indicatorTranslateX,
      }],
    },
  ], [
    hasSelection,
    indicatorTranslateX,
    metrics.indicatorLeft,
    metrics.indicatorWidth,
    metrics.tabWidth,
    textColor,
  ]);
  const headerStyle = useMemo(() => [
    styles.header,
    {
      backgroundColor: hasSelection && selectionBackgroundColor
        ? selectionBackgroundColor
        : backgroundColor,
      paddingHorizontal: metrics.horizontalPadding,
      paddingTop: collectionParityTokens.header.paddingTop + insets.top,
    },
  ], [
    backgroundColor,
    hasSelection,
    insets.top,
    metrics.horizontalPadding,
    selectionBackgroundColor,
  ]);

  return (
    <View
      style={headerStyle}
    >
      {!hasSelection && catalogOwner ? (
        <View style={styles.catalogContext}>
          {onReturnToContext ? (
            <Pressable
              accessibilityLabel="Back to results"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onReturnToContext}
              style={({ pressed }) => [
                styles.catalogBack,
                { borderColor: inactiveTextColor },
                pressed && styles.pressedTab,
              ]}
            >
              <NativeBackIcon color={textColor} size={17} />
              {desktop ? (
                <Text style={[styles.catalogBackText, { color: textColor }]}>Back to results</Text>
              ) : null}
            </Pressable>
          ) : null}
          <View
            accessibilityLabel={`Viewing ${catalogOwner}'s catalog`}
            accessibilityRole="summary"
            style={styles.catalogOwner}
          >
            <Text style={[styles.catalogOwnerLabel, { color: inactiveTextColor }]}>Viewing catalog</Text>
            <Text numberOfLines={1} style={[styles.catalogOwnerName, { color: textColor }]}>
              {catalogOwner}
            </Text>
          </View>
        </View>
      ) : null}
      <View accessibilityRole={hasSelection ? undefined : 'tablist'} style={styles.controlsRow}>
        {NATIVE_POKEMON_HUB_TABS.map(({ key, label }) => {
          const selected = activeView === key;
          const tagBelongsHere = activeTag && (
            (key === 'inventory' && activeTagParent === 'caught')
            || (key === 'wishlist' && activeTagParent === 'wanted')
          );
          const subtext = tagBelongsHere
            ? `(${activeTag.toUpperCase()})`
            : key === 'pokemon' ? `(${collectionCount})` : null;
          return (
            <Pressable
              aria-selected={hasSelection ? undefined : selected}
              accessibilityRole={hasSelection ? 'button' : 'tab'}
              accessibilityState={hasSelection ? undefined : { selected }}
              key={key}
              onPress={() => {
                if (hasSelection && key === 'inventory') onClearSelection?.();
                else if (hasSelection && key === 'wishlist') onSelectAll?.();
                else onViewChange(key);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressedTab]}
            >
              <Text style={[
                styles.tabText,
                desktop && styles.desktopTabText,
                { color: hasSelection || selected ? textColor : inactiveTextColor },
              ]}>
                {hasSelection && key === 'inventory'
                  ? 'X'
                  : hasSelection && key === 'wishlist'
                    ? 'SELECT ALL'
                    : label}
              </Text>
              {(!hasSelection || key === 'pokemon') && subtext ? (
                <Text style={[
                  styles.tabSubtext,
                  desktop && styles.desktopTabSubtext,
                  { color: selected ? textColor : inactiveTextColor },
                ]}>
                  {subtext}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Animated.View
        pointerEvents="none"
        style={indicatorStyle}
        testID="native-pokemon-hub-indicator"
      />
    </View>
  );
}));

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'column',
    paddingTop: collectionParityTokens.header.paddingTop,
    paddingBottom: collectionParityTokens.header.paddingBottom,
    marginBottom: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: -4 },
    shadowOpacity: 0.36,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 2,
  },
  controlsRow: { flexDirection: 'row', minHeight: 34 },
  catalogContext: {
    width: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: -5,
    marginBottom: 8,
  },
  catalogBack: {
    minWidth: 36,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 999,
  },
  catalogBackText: { fontSize: 12, fontWeight: '800' },
  catalogOwner: {
    minWidth: 0,
    maxWidth: '70%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  catalogOwnerLabel: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  catalogOwnerName: { flexShrink: 1, fontSize: 13, fontWeight: '900' },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-start' },
  pressedTab: { opacity: 0.72 },
  tabText: { fontSize: collectionParityTokens.header.narrowLabelSize, fontWeight: '800' },
  tabSubtext: { fontSize: 10, fontWeight: '800', lineHeight: 12 },
  desktopTabText: { fontSize: collectionParityTokens.header.wideLabelSize },
  desktopTabSubtext: { fontSize: 16, lineHeight: 19 },
  activeUnderline: {
    position: 'absolute',
    bottom: 0,
    height: collectionParityTokens.header.underlineHeight,
    borderRadius: collectionParityTokens.header.underlineRadius,
  },
});
