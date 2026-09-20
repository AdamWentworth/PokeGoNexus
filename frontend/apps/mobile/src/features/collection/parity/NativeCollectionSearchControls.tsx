import {
  useCallback,
  type ComponentProps,
  useEffect,
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { toNativeCollectionImageSource } from './nativeCollectionImageSource';
import { runAfterNativeUiInteractions } from '../../../interaction/nativeUiInteractionScheduler';

type FilterSection = 'Variants' | 'Qualities' | 'Rarity' | 'Region' | 'Types';

const FILTER_SECTIONS: Record<FilterSection, string[]> = {
  Variants: ['Shiny', 'Costume', 'Shadow', 'Mega', 'Dynamax', 'Gigantamax'],
  Qualities: ['Lucky', 'XXS', 'XXL', '100%'],
  Rarity: ['Legendary', 'Mythical', 'Regional'],
  Region: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea'],
  Types: ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy'],
};
const FILTER_TILE_COUNT = Object.values(FILTER_SECTIONS).reduce(
  (total, filters) => total + filters.length,
  0,
);
// Each tile owns a native Image. Pace the concealed warmup by real display
// frames instead of allowing a chain of zero-delay React commits to mount the
// complete menu before Android has painted once.
export const NATIVE_FILTER_TILE_WARM_BATCH = 2;
export const NATIVE_FILTER_TILE_WARM_PERIOD_MS = 16;

const FILTER_ASSETS: Record<string, string> = {
  Shiny: '/images/shiny_search.png',
  Costume: '/images/costume_search.png',
  Shadow: '/images/shadow_search.png',
  Mega: '/images/mega_search.png',
  Dynamax: '/images/dynamax_search.png',
  Gigantamax: '/images/gigantamax_search.png',
  Lucky: '/images/lucky-icon.png',
  XXS: '/images/xxs.png',
  XXL: '/images/xxl.png',
  '100%': '/images/appraisal_04.png',
  Legendary: '/images/legendary_search.png',
  Mythical: '/images/mythical_search.png',
  Regional: '/images/regional_search.png',
};

const FILTER_SURFACES: Record<string, string> = {
  Shiny: '#efcf78',
  Costume: '#e4ade4',
  Shadow: '#c39eeb',
  Mega: '#d15382',
  Dynamax: '#de0c87',
  Gigantamax: '#a70e68',
  Lucky: '#eac89b',
  XXS: '#add8e6',
  XXL: '#90ee90',
  '100%': '#f29ead',
  Legendary: '#595566',
  Mythical: '#e89beb',
  Regional: '#85e0fd',
};

const REGION_GRADIENTS: Record<string, readonly [string, string, string]> = {
  Kanto: ['#ee4b2b', '#3b4cca', '#ffde00'],
  Johto: ['#d4af37', '#c0c0c0', '#9bd3e0'],
  Hoenn: ['#aa0000', '#0a6dc2', '#2e8b57'],
  Sinnoh: ['#8fd2f5', '#e1b8d8', '#a7a7a7'],
  Unova: ['#f5f5f5', '#1c1c1c', '#f5f5f5'],
  Kalos: ['#637cff', '#ff6b81', '#b68fcc'],
  Alola: ['#fdb813', '#2d2d70', '#eaadea'],
  Galar: ['#0074b8', '#d80040', '#b9a0e7'],
  Hisui: ['#a1a1a1', '#ae8baf', '#e3d1a7'],
  Paldea: ['#b80000', '#7f3fbf', '#ffd966'],
};

const RegionGradient = memo(function RegionGradient({ name }: { name: string }) {
  const colors = REGION_GRADIENTS[name];
  if (!colors) return null;
  return (
    <LinearGradient
      colors={colors}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.5, 1]}
      pointerEvents="none"
      start={{ x: 0, y: 0 }}
      style={StyleSheet.absoluteFill}
      testID={`native-region-gradient-${name.toLowerCase()}`}
    />
  );
});

const FilterTile = memo(function FilterTile({
  assetBaseUrl,
  filter,
  onPress,
  onPressIn,
  onPressOut,
  section,
  textColor,
}: {
  assetBaseUrl: string;
  filter: string;
  onPress: (filter: string) => void;
  onPressIn?: (filter: string) => void;
  onPressOut?: (filter: string) => void;
  section: FilterSection;
  textColor: string;
}) {
  const assetPath = section === 'Region'
    ? `/images/${filter.toLowerCase()}_search.png`
    : section === 'Types'
      ? `/images/types/${filter.toLowerCase()}.png`
      : FILTER_ASSETS[filter];
  return (
    <Pressable
      accessibilityLabel={`Filter by ${filter}`}
      accessibilityRole="button"
      onPress={() => onPress(filter)}
      onPressIn={onPressIn ? () => onPressIn(filter) : undefined}
      onPressOut={onPressOut ? () => onPressOut(filter) : undefined}
      style={styles.filterTile}
      testID={`native-collection-filter-${filter.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      unstable_pressDelay={onPressIn ? 16 : undefined}
    >
      <View style={[
        styles.filterImageCircle,
        section !== 'Types' && section !== 'Region'
          ? { backgroundColor: FILTER_SURFACES[filter] ?? '#85e0fd' }
          : null,
      ]}>
        {section === 'Region' ? <RegionGradient name={filter} /> : null}
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={toNativeCollectionImageSource(assetBaseUrl, assetPath)}
          style={section === 'Types' ? styles.typeFilterImage : styles.filterImage}
        />
      </View>
      <Text numberOfLines={1} style={[styles.filterLabel, { color: textColor }]}>{filter}</Text>
    </Pressable>
  );
});

export const NativeCollectionSearchMenu = memo(function NativeCollectionSearchMenu({
  assetBaseUrl,
  onFilterPress,
  onFilterPressIn,
  onFilterPressOut,
  textColor,
  tileLimit = FILTER_TILE_COUNT,
}: {
  assetBaseUrl: string;
  onFilterPress: (filter: string) => void;
  onFilterPressIn?: (filter: string) => void;
  onFilterPressOut?: (filter: string) => void;
  textColor: string;
  tileLimit?: number;
}) {
  let tileIndex = 0;
  return (
  <View accessibilityLabel="Pokémon search filters" style={styles.searchMenu}>
    {(Object.keys(FILTER_SECTIONS) as FilterSection[]).map((section) => (
      <View key={section} style={styles.filterSection}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: textColor }]}>
          {section}
        </Text>
        <View style={styles.filterGrid}>
          {FILTER_SECTIONS[section].map((filter) => {
            const visible = tileIndex < tileLimit;
            tileIndex += 1;
            return visible ? (
              <FilterTile
                assetBaseUrl={assetBaseUrl}
                filter={filter}
                key={filter}
                onPress={onFilterPress}
                onPressIn={onFilterPressIn}
                onPressOut={onFilterPressOut}
                section={section}
                textColor={textColor}
              />
            ) : null;
          })}
        </View>
      </View>
    ))}
  </View>
  );
});

export const NativeRetainedCollectionSearchMenu = memo(function NativeRetainedCollectionSearchMenu({
  visible,
  ...props
}: ComponentProps<typeof NativeCollectionSearchMenu> & { visible: boolean }) {
  const [tileLimit, setTileLimit] = useState(() => visible ? FILTER_TILE_COUNT : 0);
  useEffect(() => {
    if (visible) {
      setTileLimit(FILTER_TILE_COUNT);
      return undefined;
    }
    if (tileLimit >= FILTER_TILE_COUNT) return undefined;
    // This tree is invisible preparation, not animation. A bare sequence of
    // zero-delay tasks can still produce several React commits and Android
    // image decodes inside one display frame. Put an actual frame interval in
    // front of the interaction-aware queue; the queue then pauses immediately
    // if a foreground gesture begins during that interval.
    let task: ReturnType<typeof runAfterNativeUiInteractions> | null = null;
    const timer = setTimeout(() => {
      task = runAfterNativeUiInteractions(() => {
        setTileLimit((current) => Math.min(
          FILTER_TILE_COUNT,
          current + NATIVE_FILTER_TILE_WARM_BATCH,
        ));
      }, { preferIdle: false });
    }, NATIVE_FILTER_TILE_WARM_PERIOD_MS);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [tileLimit, visible]);
  return <NativeCollectionSearchMenu {...props} tileLimit={tileLimit} />;
});

export type NativeCollectionSearchControlsHandle = {
  commitQueryValue: (query: string) => void;
  dismissKeyboard: () => void;
};

export const NativeCollectionSearchControls = memo(forwardRef<
  NativeCollectionSearchControlsHandle,
  {
    assetBaseUrl: string;
    inputBackground: string;
    inputTextColor: string;
    menuVisible: boolean;
    onMenuVisibleChange: (visible: boolean) => void;
    onQueryChange: (query: string) => void;
    onEvolutionPressIn?: () => void;
    onEvolutionPressOut?: () => void;
    onToggleEvolutionaryLine: () => void;
    query: string;
    showEvolutionaryLine: boolean;
    textColor: string;
  }
>(function NativeCollectionSearchControls({
  assetBaseUrl,
  inputBackground,
  inputTextColor,
  menuVisible,
  onMenuVisibleChange,
  onQueryChange,
  onEvolutionPressIn,
  onEvolutionPressOut,
  onToggleEvolutionaryLine,
  query,
  showEvolutionaryLine,
  textColor,
}, ref) {
  const inputRef = useRef<TextInput>(null);
  // Match Vite's SearchUI: the input owns an urgent local value while the
  // collection projection is allowed to update at transition priority. A
  // controlled TextInput tied directly to the Hub made every keystroke wait
  // for the full route and grid tree to reconcile before it could paint.
  const [inputValue, setInputValue] = useState(query);
  const [, startTransition] = useTransition();
  const commitQueryValue = useCallback((value: string) => {
    setInputValue(value);
  }, []);
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);
  useImperativeHandle(
    ref,
    () => ({ commitQueryValue, dismissKeyboard }),
    [commitQueryValue, dismissKeyboard],
  );
  useLayoutEffect(() => {
    setInputValue((current) => (current === query ? current : query));
  }, [query]);
  const commitQuery = (value: string) => {
    commitQueryValue(value);
    startTransition(() => onQueryChange(value));
  };
  const expanded = menuVisible || Boolean(inputValue.trim());
  const closeSearch = () => {
    onMenuVisibleChange(false);
    commitQuery('');
    dismissKeyboard();
  };
  const clearSearch = () => {
    commitQuery('');
    onMenuVisibleChange(true);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.searchSection}>
      <View style={styles.searchShell}>
        {expanded ? (
          <Pressable
            accessibilityLabel="Close Pokémon search"
            accessibilityRole="button"
            hitSlop={10}
            onPress={closeSearch}
            style={styles.backButton}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={toNativeCollectionImageSource(assetBaseUrl, '/images/arrow_right.png')}
              style={[styles.backIcon, { tintColor: textColor }]}
            />
          </Pressable>
        ) : null}
        <View
          style={[
            styles.searchInputWrapper,
            expanded ? styles.searchInputWrapperExpanded : null,
            { backgroundColor: inputBackground },
          ]}
        >
          {expanded ? (
            <Image fadeDuration={0}
              accessibilityElementsHidden
              source={toNativeCollectionImageSource(assetBaseUrl, '/images/search_icon.png')}
              style={[styles.searchIconLeft, { tintColor: inputTextColor }]}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Search Pokémon"
            autoCapitalize="none"
            onChangeText={(value) => {
              commitQuery(value);
              onMenuVisibleChange(false);
            }}
            onFocus={() => onMenuVisibleChange(true)}
            ref={inputRef}
            style={[
              styles.searchInput,
              expanded ? styles.searchInputExpanded : null,
              { color: inputTextColor },
            ]}
            value={inputValue}
          />
          {!expanded ? (
            <View pointerEvents="none" style={styles.placeholder}>
              <Image fadeDuration={0}
                accessibilityElementsHidden
                source={toNativeCollectionImageSource(assetBaseUrl, '/images/search_icon.png')}
                style={[styles.placeholderIcon, { tintColor: '#666666' }]}
              />
              <Text style={styles.placeholderText}>Search</Text>
            </View>
          ) : null}
          {inputValue.trim() ? (
            <Pressable
              accessibilityLabel="Clear Pokémon search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={clearSearch}
              style={styles.clearButton}
            >
              <View style={styles.clearDivider} />
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={toNativeCollectionImageSource(assetBaseUrl, '/images/close.png')}
                style={styles.clearIcon}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {inputValue.trim() ? (
        <Pressable
          aria-checked={showEvolutionaryLine}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: showEvolutionaryLine }}
          onPress={onToggleEvolutionaryLine}
          onPressIn={onEvolutionPressIn}
          onPressOut={onEvolutionPressOut}
          style={styles.evolutionToggle}
        >
          <View style={[styles.evolutionCheckbox, { borderColor: textColor }]}>
            {showEvolutionaryLine ? <Text style={[styles.checkmark, { color: textColor }]}>✓</Text> : null}
          </View>
          <Text style={[styles.evolutionLabel, { color: textColor }]}>SHOW EVOLUTIONARY LINE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}));

const styles = StyleSheet.create({
  searchSection: { width: '100%', alignItems: 'center', paddingVertical: 15 },
  searchShell: { position: 'relative', width: '80%', maxWidth: '90%', height: 40 },
  backButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 22,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  backIcon: { width: 18, height: 18, transform: [{ scaleX: -1 }] },
  searchInputWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
  },
  searchInputWrapperExpanded: { left: 32 },
  searchInput: { width: '100%', height: '100%', paddingHorizontal: 20, fontSize: 14 },
  searchInputExpanded: { paddingLeft: 35, paddingRight: 60 },
  searchIconLeft: { position: 'absolute', left: 15, width: 17, height: 17, opacity: 0.5 },
  placeholder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: { width: 17, height: 17, marginRight: 2, opacity: 0.5 },
  placeholderText: { color: '#666666', fontSize: 14 },
  clearButton: {
    position: 'absolute',
    top: 0,
    right: 4,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDivider: { position: 'absolute', top: 8, bottom: 8, left: 0, width: 1, backgroundColor: '#00000033' },
  clearIcon: { width: 16, height: 16, tintColor: '#333333', opacity: 0.8 },
  evolutionToggle: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  evolutionCheckbox: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 8, marginRight: 4 },
  checkmark: { fontSize: 10, fontWeight: '800', lineHeight: 11 },
  evolutionLabel: { fontSize: 8 },
  searchMenu: { width: '100%', paddingHorizontal: 8, paddingBottom: 80 },
  filterSection: { marginBottom: 16 },
  sectionTitle: { marginBottom: 8, fontSize: 16, fontWeight: '700' },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  filterTile: { width: '25%', alignItems: 'center', justifyContent: 'center' },
  filterImageCircle: { overflow: 'hidden', width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 3, borderRadius: 21 },
  filterImage: { width: 27, height: 27 },
  typeFilterImage: { width: '100%', height: '100%' },
  filterLabel: { maxWidth: '100%', fontSize: 13, textAlign: 'center' },
});
