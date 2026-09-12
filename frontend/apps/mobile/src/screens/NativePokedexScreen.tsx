import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  LayoutAnimation,
  Platform,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pokedexExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import type {
  NativePokedexCategory,
  NativePokedexEntry,
  NativePokedexFacet,
  NativePokedexManualRegistration,
  NativePokedexRegistrationFacets,
} from '../features/tools/nativePokedexModel';
import {
  buildNativePokedexRegistrationId,
  filterNativePokedexEntries,
  nativePokedexEntryIsRegistered,
} from '../features/tools/nativePokedexModel';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { useNativeReducedMotion } from '../features/settings/useNativeMotion';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  entries: NativePokedexEntry[];
  error?: string | null;
  registrationError?: string | null;
  onDismissRegistrationError?: () => void;
  isFocused?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onBack: () => void;
  onOpenEntry: (entry: NativePokedexEntry, facets?: NativePokedexRegistrationFacets) => void;
  onRetry: () => void;
  onSetRegistrations: (
    registrations: NativePokedexManualRegistration[],
    registered: boolean,
  ) => void;
};

type CategoryDefinition = {
  accent: string;
  icons: string[];
  label: string;
  value: NativePokedexCategory;
};

type FacetDefinition = {
  accent: string;
  icon: string;
  label: string;
  value: NativePokedexFacet;
};

type RegionSummary = (typeof REGIONS)[number] & {
  entries: NativePokedexEntry[];
  previews: NativePokedexEntry[];
  registered: number;
  totalCount: number;
  stats: {
    lucky: number;
    perfect: number;
    shiny: number;
    xxl: number;
    xxs: number;
  };
};

type PokedexListRow =
  | { key: string; kind: 'region'; region: RegionSummary }
  | { entries: NativePokedexEntry[]; key: string; kind: 'entries'; region: RegionSummary };

const REGIONS = [
  { accent: '#ee4b2b', generation: 1, label: 'Kanto', secondary: '#3b4cca', starters: [1, 4, 7], tertiary: '#ffde00', text: '#1687b8' },
  { accent: '#d4af37', generation: 2, label: 'Johto', secondary: '#c0c0c0', starters: [152, 155, 158], tertiary: '#9bd3e0', text: '#b8871f' },
  { accent: '#aa0000', generation: 3, label: 'Hoenn', secondary: '#0a6dc2', starters: [252, 255, 258], tertiary: '#2e8b57', text: '#168a72' },
  { accent: '#8fd2f5', generation: 4, label: 'Sinnoh', secondary: '#e1b8d8', starters: [387, 390, 393], tertiary: '#a7a7a7', text: '#607c9c' },
  { accent: '#1c1c1c', generation: 5, label: 'Unova', secondary: '#f5f5f5', starters: [495, 498, 501], tertiary: '#7f64c5', text: '#7561d5' },
  { accent: '#637cff', generation: 6, label: 'Kalos', secondary: '#ff6b81', starters: [650, 653, 656], tertiary: '#b68fcc', text: '#526de0' },
  { accent: '#fdb813', generation: 7, label: 'Alola', secondary: '#2d2d70', starters: [722, 725, 728], tertiary: '#eaadea', text: '#008f9c' },
  { accent: '#0074b8', generation: 8, label: 'Galar', secondary: '#d80040', starters: [810, 813, 816], tertiary: '#b9a0e7', text: '#0074b8' },
  { accent: '#a1a1a1', generation: 9, label: 'Hisui', secondary: '#ae8baf', starters: [722, 155, 501], tertiary: '#e3d1a7', text: '#6f7f8d' },
  { accent: '#b80000', generation: 10, label: 'Paldea', secondary: '#7f3fbf', starters: [906, 909, 912], tertiary: '#ffd966', text: '#b80000' },
] as const;

const BASE_CATEGORIES: CategoryDefinition[] = [
  { value: 'pokemon', label: 'Pokémon', icons: ['/images/pokedex-icon.png'], accent: '#1699c9' },
  { value: 'shiny', label: 'Shiny', icons: ['/images/shiny_icon.png'], accent: '#f4a229' },
  { value: 'shadow', label: 'Shadow', icons: ['/images/shadow_icon.png'], accent: '#8845b8' },
  { value: 'costume', label: 'Costume', icons: ['/images/costume_icon.png'], accent: '#ef6a8a' },
  { value: 'mega', label: 'Mega', icons: ['/images/mega.png'], accent: '#b551d6' },
  { value: 'dynamax', label: 'Dynamax', icons: ['/images/dynamax-icon.png'], accent: '#d94973' },
  { value: 'gigantamax', label: 'Gigantamax', icons: ['/images/gigantamax-icon.png'], accent: '#d73442' },
  { value: 'fusion', label: 'Fusion', icons: ['/images/fusion_1.png', '/images/fusion_2.png'], accent: '#416ed8' },
];

const COMBO_CATEGORIES: CategoryDefinition[] = [
  { value: 'shiny shadow', label: 'Shiny Shadow', icons: ['/images/shiny_icon.png', '/images/shadow_icon.png'], accent: '#8845b8' },
  { value: 'shiny costume', label: 'Shiny Costume', icons: ['/images/shiny_icon.png', '/images/costume_icon.png'], accent: '#e89a2f' },
  { value: 'shadow costume', label: 'Shadow Costume', icons: ['/images/shadow_icon.png', '/images/costume_icon.png'], accent: '#5a348f' },
  { value: 'shiny mega', label: 'Shiny Mega', icons: ['/images/shiny_icon.png', '/images/mega.png'], accent: '#c768cb' },
  { value: 'shiny dynamax', label: 'Shiny Dynamax', icons: ['/images/shiny_icon.png', '/images/dynamax-icon.png'], accent: '#e76478' },
  { value: 'shiny gigantamax', label: 'Shiny Gigantamax', icons: ['/images/shiny_icon.png', '/images/gigantamax-icon.png'], accent: '#df4651' },
  { value: 'shiny fusion', label: 'Shiny Fusion', icons: ['/images/shiny_icon.png', '/images/fusion_1.png'], accent: '#6676e8' },
];

const BASE_FACETS: FacetDefinition[] = [
  { value: 'lucky', label: 'Lucky', icon: '/images/lucky-icon.png', accent: '#e36c2f' },
  { value: 'purified', label: 'Purified', icon: '/images/purified.png', accent: '#16aeb7' },
  { value: 'xxs', label: 'XXS', icon: '/images/xxs.png', accent: '#4b7be8' },
  { value: 'xxl', label: 'XXL', icon: '/images/xxl.png', accent: '#1767b7' },
  { value: 'perfect', label: '100%', icon: '/images/appraisal_04.png', accent: '#e3303d' },
];

const ADVANCED_FACETS: FacetDefinition[] = [
  ...BASE_FACETS.slice(0, 3),
  { value: 'xs', label: 'XS', icon: '/images/height.png', accent: '#1d4d95' },
  { value: 'xl', label: 'XL', icon: '/images/height.png', accent: '#1a7cc6' },
  ...BASE_FACETS.slice(3),
  { value: 'male', label: 'Male', icon: '/images/male-icon.png', accent: '#2c78d8' },
  { value: 'female', label: 'Female', icon: '/images/female-icon.png', accent: '#ca4bb6' },
];

const DARK_ON_LIGHT_FACET_ICONS = new Set([
  '/images/appraisal_04.png',
  '/images/height.png',
  '/images/lucky-icon.png',
  '/images/xxl.png',
  '/images/xxs.png',
]);

const LIGHT_ACCENTS: Record<string, string> = {
  '#1699c9': '#00627e', '#f4a229': '#8a5200', '#8845b8': '#6c2f98',
  '#ef6a8a': '#a82c4f', '#b551d6': '#81339d', '#d94973': '#a2264f',
  '#d73442': '#a21725', '#416ed8': '#2d52aa', '#e36c2f': '#9a3e0d',
  '#16aeb7': '#00686e', '#4b7be8': '#2b51ac', '#1767b7': '#145693',
  '#e3303d': '#a51220', '#1d4d95': '#1d4d95', '#1a7cc6': '#14578a',
  '#2c78d8': '#1f55a0', '#ca4bb6': '#912580', '#ee4b2b': '#a52f18',
  '#d4af37': '#715800', '#aa0000': '#8f0000', '#8fd2f5': '#385f7a',
  '#1c1c1c': '#1c1c1c', '#637cff': '#334eb3', '#fdb813': '#6f4b00',
  '#0074b8': '#005f97', '#a1a1a1': '#58666f', '#b80000': '#920000',
};

const readableLightAccent = (accent: string): string => (
  LIGHT_ACCENTS[accent.toLocaleLowerCase()] ?? '#005bb5'
);

const absoluteUri = (base: string, value: string | null): string | null => {
  if (!value) return null;
  try { return new URL(value, base).toString(); } catch { return null; }
};

const registrationFacetsFromSelection = (
  facets: NativePokedexFacet[],
): NativePokedexRegistrationFacets => facets.reduce<NativePokedexRegistrationFacets>((draft, facet) => {
  if (facet === 'male') draft.gender = 'Male';
  else if (facet === 'female') draft.gender = 'Female';
  else if (facet === 'perfect') draft.appraisal = '4-star';
  else if (facet === 'lucky' || facet === 'purified') draft[facet] = true;
  else draft.size = facet;
  return draft;
}, {});

const RegionCardBackdrop = ({
  accent,
  light,
  secondary,
  tertiary,
  compact,
}: {
  accent: string;
  light: boolean;
  secondary: string;
  tertiary: string;
  compact: boolean;
}) => {
  const [size, setSize] = useState({ width: 400, height: 168 });
  const { width, height } = size;
  const gradientId = `region-${accent.replace('#', '')}`;
  const glowId = `${gradientId}-glow`;
  const clipId = `${gradientId}-clip`;
  const stripeId = `${gradientId}-stripes`;
  const gridId = `${gradientId}-grid`;
  const fadeId = `${gradientId}-fade`;
  const maskId = `${gradientId}-mask`;
  // Use the card's measured bounds: fitting a 400x132 SVG into a taller card
  // letterboxed the artwork. The Vite panel fills the frame at every size.
  const panelLeft = width * (compact ? 0.3 : 0.34);
  const panelWidth = width - panelLeft;
  const stripeX = Math.sin(112 * Math.PI / 180);
  const stripeY = -Math.cos(112 * Math.PI / 180);
  const stripeLength = panelWidth * stripeX + height * stripeY;
  const stripeCenter = panelLeft + panelWidth / 2;
  return <View
    pointerEvents="none"
    style={StyleSheet.absoluteFill}
    onLayout={({ nativeEvent: { layout } }) => {
      if (layout.width > 0 && layout.height > 0) {
        setSize((current) => current.width === layout.width && current.height === layout.height
          ? current : { width: layout.width, height: layout.height });
      }
    }}
  ><Svg height="100%" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} width="100%">
    <Defs>
      <ClipPath id={clipId}>
        <Polygon points={`${panelLeft + panelWidth * 0.2},0 ${width},0 ${width},${height} ${panelLeft},${height}`} />
      </ClipPath>
      <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
        <Stop offset="0" stopColor={accent} />
        <Stop offset="0.5" stopColor={secondary} />
        <Stop offset="1" stopColor={tertiary} />
      </LinearGradient>
      <RadialGradient cx={panelLeft + panelWidth * 0.8} cy={height * 0.1} gradientUnits="userSpaceOnUse" id={glowId} r={176}>
        <Stop offset="0" stopColor="#ffffff" stopOpacity={light ? 0.28 : 0.38} />
        <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient
        gradientUnits="userSpaceOnUse"
        id={stripeId}
        x1={stripeCenter - stripeX * stripeLength / 2}
        x2={stripeCenter + stripeX * stripeLength / 2}
        y1={height / 2 - stripeY * stripeLength / 2}
        y2={height / 2 + stripeY * stripeLength / 2}
      >
        <Stop offset="0" stopColor={light ? '#f8fff9' : '#fff'} stopOpacity={light ? 0.78 : 0.94} />
        <Stop offset="0.08" stopColor={light ? '#f8fff9' : '#fff'} stopOpacity={light ? 0.78 : 0.94} />
        <Stop offset="0.08" stopColor="#fff" stopOpacity="0" />
        <Stop offset="0.13" stopColor="#fff" stopOpacity="0" />
        <Stop offset="0.13" stopColor={light ? '#e0f0e5' : '#fff'} stopOpacity={light ? 0.58 : 0.78} />
        <Stop offset="0.16" stopColor={light ? '#e0f0e5' : '#fff'} stopOpacity={light ? 0.58 : 0.78} />
        <Stop offset="0.16" stopColor="#fff" stopOpacity="0" />
        <Stop offset="1" stopColor="#fff" stopOpacity="0" />
      </LinearGradient>
      <Pattern height={16} id={gridId} patternUnits="userSpaceOnUse" width={16} x={width * 0.42}>
        <Path d="M 0 0 H 16" stroke={light ? '#f8fff9' : '#fff'} strokeOpacity={light ? 0.22 : 0.16} />
        <Path d="M 0 0 V 16" stroke={light ? '#f8fff9' : '#fff'} strokeOpacity={light ? 0.2 : 0.14} />
      </Pattern>
      <LinearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
        <Stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        <Stop offset="0.48" stopColor="#fff" />
      </LinearGradient>
      <Mask height={height} id={maskId} maskUnits="userSpaceOnUse" width={width} x={0} y={0}>
        <Rect fill={`url(#${fadeId})`} height={height} width={width} />
      </Mask>
    </Defs>
    <G clipPath={`url(#${clipId})`}>
      <Rect fill={`url(#${gradientId})`} height={height} width={panelWidth} x={panelLeft} />
      <Rect fill={`url(#${glowId})`} height={height} width={width} />
      <Rect fill={`url(#${stripeId})`} height={height} width={width} />
    </G>
    <Rect fill={`url(#${gridId})`} height={height} mask={`url(#${maskId})`} width={width} />
  </Svg></View>;
};

export const NativePokedexScreen = ({ assetBaseUrl, entries, error = null, registrationError = null, onDismissRegistrationError, isFocused = true, isLoading = false, isSaving = false, onBack, onOpenEntry, onRetry, onSetRegistrations }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const reduceMotion = useNativeReducedMotion();
  const animateRegionNavigation = !reduceMotion
    && pokedexExperienceParityContract.regionNavigationScrollBehavior.default === 'smooth';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compactRegions = width <= 720;
  const columns = width <= 720 ? 4 : Math.max(4, Math.floor((width - 24) / 150));
  const [categoryTranslation] = useState(() => new Animated.Value(0));
  const categoryMotionStyle = { transform: [{ translateX: categoryTranslation }] };
  const listRef = useRef<FlatList<PokedexListRow>>(null);
  const pendingScrollGenerationRef = useRef<number | null>(null);
  const performanceStartsRef = useRef(new Map<string, number>());
  const beginPerformance = useCallback((event: string) => {
    performanceStartsRef.current.set(event, Date.now());
  }, []);
  const finishPerformance = useCallback((event: string) => {
    const startedAt = performanceStartsRef.current.get(event);
    if (startedAt == null) return;
    performanceStartsRef.current.delete(event);
    markNativeUiPerformanceAfterPaint(event, startedAt);
  }, []);
  const [advanced, setAdvanced] = useState(false);
  const [category, setCategory] = useState<NativePokedexCategory>('pokemon');
  const [facets, setFacets] = useState<NativePokedexFacet[]>([]);
  const [generation, setGeneration] = useState<number | null>(null);
  const [collapsedRegionKeys, setCollapsedRegionKeys] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [bulkConfirmation, setBulkConfirmation] = useState<{
    registered: boolean;
    registrations: NativePokedexManualRegistration[];
  } | null>(null);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bulkConfirmation) setBulkConfirmation(null);
      else if (generation !== null) {
        pendingScrollGenerationRef.current = null;
        setGeneration(null);
        setQuery('');
      } else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [bulkConfirmation, generation, isFocused, onBack]);
  useEffect(() => () => categoryTranslation.stopAnimation(), [categoryTranslation]);
  const categories = advanced ? [...BASE_CATEGORIES, ...COMBO_CATEGORIES] : BASE_CATEGORIES;
  const qualityFacets = advanced ? ADVANCED_FACETS : BASE_FACETS;
  const activeCategory = categories.find(({ value }) => value === category) ?? BASE_CATEGORIES[0];
  const entriesByGeneration = useMemo(() => {
    const grouped = new Map<number, NativePokedexEntry[]>();
    entries.forEach((entry) => {
      const rows = grouped.get(entry.generation) ?? [];
      rows.push(entry);
      grouped.set(entry.generation, rows);
    });
    return grouped;
  }, [entries]);
  const regionStatsByGeneration = useMemo(() => {
    const result = new Map<number, RegionSummary['stats']>();
    const countRegisteredDex = (
      regionEntries: NativePokedexEntry[],
      predicate: (entry: NativePokedexEntry) => boolean,
    ) => new Set(regionEntries.filter(predicate).map(({ pokedexNumber }) => pokedexNumber)).size;

    REGIONS.forEach((region) => {
      const regionEntries = entriesByGeneration.get(region.generation) ?? [];
      const baseEntries = regionEntries.filter(({ category: entryCategory }) => entryCategory === 'pokemon');
      result.set(region.generation, {
        shiny: countRegisteredDex(
          regionEntries,
          (entry) => entry.category === 'shiny' && nativePokedexEntryIsRegistered(entry, 'shiny'),
        ),
        lucky: countRegisteredDex(
          baseEntries,
          (entry) => nativePokedexEntryIsRegistered(entry, 'pokemon', ['lucky']),
        ),
        xxl: countRegisteredDex(
          baseEntries,
          (entry) => nativePokedexEntryIsRegistered(entry, 'pokemon', ['xxl']),
        ),
        xxs: countRegisteredDex(
          baseEntries,
          (entry) => nativePokedexEntryIsRegistered(entry, 'pokemon', ['xxs']),
        ),
        perfect: countRegisteredDex(
          baseEntries,
          (entry) => nativePokedexEntryIsRegistered(entry, 'pokemon', ['perfect']),
        ),
      });
    });
    return result;
  }, [entriesByGeneration]);
  const regionCards = useMemo<RegionSummary[]>(() => REGIONS.map((region) => {
    const regionEntries = filterNativePokedexEntries({
      category,
      entries: entriesByGeneration.get(region.generation) ?? [],
      facets,
      generation: null,
      query: '',
    });
    const previews: NativePokedexEntry[] = [];
    const appendPreview = (entry: NativePokedexEntry | undefined) => {
      if (!entry || previews.some(({ id }) => id === entry.id) || previews.length >= 3) return;
      previews.push(entry);
    };
    region.starters.forEach((dex) => {
      appendPreview(regionEntries.find(({ pokedexNumber }) => pokedexNumber === dex));
    });
    regionEntries.forEach(appendPreview);
    return {
      ...region,
      entries: regionEntries,
      previews,
      registered: regionEntries.filter((entry) => (
        nativePokedexEntryIsRegistered(entry, category, facets)
      )).length,
      totalCount: regionEntries.length,
      stats: regionStatsByGeneration.get(region.generation) ?? {
        lucky: 0,
        perfect: 0,
        shiny: 0,
        xxl: 0,
        xxs: 0,
      },
    };
  }).filter(({ entries: regionEntries }) => regionEntries.length > 0), [
    category,
    entriesByGeneration,
    facets,
    regionStatsByGeneration,
  ]);
  // Regional forms can share a national dex number while belonging to a
  // different generation. The canonical header totals each regional index,
  // rather than collapsing those rows globally across all regions.
  const categoryEntries = useMemo(
    () => regionCards.flatMap(({ entries: regionEntries }) => regionEntries),
    [regionCards],
  );
  const registeredCount = useMemo(
    () => regionCards.reduce((total, region) => total + region.registered, 0),
    [regionCards],
  );
  const selectedRegistrationFacets = useMemo(() => registrationFacetsFromSelection(facets), [facets]);
  const useFemaleImages = facets.includes('female');
  const activeFacetBadges = qualityFacets.filter(({ value }) => facets.includes(value));
  const detailRegions = useMemo<RegionSummary[]>(() => regionCards.flatMap((region) => {
    const visibleEntries = filterNativePokedexEntries({
      category,
      entries: region.entries,
      facets,
      generation: null,
      query: deferredQuery,
    });
    return visibleEntries.length > 0 ? [{ ...region, entries: visibleEntries }] : [];
  }), [category, deferredQuery, facets, regionCards]);
  const visibleRegistrations = useMemo<NativePokedexManualRegistration[]>(() => {
    const byId = new Map<string, NativePokedexManualRegistration>();
    detailRegions.forEach((region) => {
      if (collapsedRegionKeys.has(`${category}:${region.generation}`)) return;
      region.entries.filter(({ released }) => released).forEach((entry) => {
        const registrationId = buildNativePokedexRegistrationId(entry.id, selectedRegistrationFacets);
        byId.set(registrationId, {
          entryId: entry.id,
          facets: selectedRegistrationFacets,
          registrationId,
        });
      });
    });
    return [...byId.values()];
  }, [category, collapsedRegionKeys, detailRegions, selectedRegistrationFacets]);
  const listRows = useMemo<PokedexListRow[]>(() => {
    if (generation == null) return [];
    return detailRegions.flatMap((region) => {
      const key = `${category}:${region.generation}`;
      if (collapsedRegionKeys.has(key)) {
        return [{ key: `region:${key}`, kind: 'region' as const, region }];
      }
      const rows: PokedexListRow[] = [{ key: `region:${key}`, kind: 'region', region }];
      for (let index = 0; index < region.entries.length; index += columns) {
        rows.push({
          entries: region.entries.slice(index, index + columns),
          key: `entries:${key}:${index}`,
          kind: 'entries',
          region,
        });
      }
      return rows;
    });
  }, [category, collapsedRegionKeys, columns, detailRegions, generation]);

  useEffect(() => {
    const pendingScrollGeneration = pendingScrollGenerationRef.current;
    if (pendingScrollGeneration == null || generation == null) return;
    const targetIndex = listRows.findIndex((row) => (
      row.kind === 'region' && row.region.generation === pendingScrollGeneration
    ));
    if (targetIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: animateRegionNavigation, index: targetIndex, viewPosition: 0 });
      pendingScrollGenerationRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [animateRegionNavigation, generation, listRows]);
  useEffect(() => finishPerformance('pokedex_advanced_result_painted'), [advanced, finishPerformance]);
  useEffect(() => finishPerformance('pokedex_category_result_painted'), [category, finishPerformance, regionCards]);
  useEffect(() => finishPerformance('pokedex_facet_result_painted'), [facets, finishPerformance, regionCards]);
  useEffect(() => finishPerformance('pokedex_region_index_painted'), [finishPerformance, generation, listRows]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance('pokedex_search_result_painted');
  }, [deferredQuery, detailRegions, finishPerformance, query]);
  useEffect(() => finishPerformance('pokedex_region_section_painted'), [collapsedRegionKeys, finishPerformance, listRows]);
  useEffect(() => {
    if (bulkConfirmation) finishPerformance('pokedex_bulk_dialog_painted');
  }, [bulkConfirmation, finishPerformance]);
  const toggleFacet = (value: NativePokedexFacet) => {
    beginPerformance('pokedex_facet_result_painted');
    setFacets((current) => {
    if (current.includes(value)) return current.filter((facet) => facet !== value);
    const group = value === 'male' || value === 'female'
      ? 'gender'
      : value === 'xxs' || value === 'xs' || value === 'xl' || value === 'xxl'
        ? 'size'
        : value;
    return [
      ...current.filter((facet) => {
        if (group === 'gender') return facet !== 'male' && facet !== 'female';
        if (group === 'size') return facet !== 'xxs' && facet !== 'xs' && facet !== 'xl' && facet !== 'xxl';
        return true;
      }),
      value,
    ];
    });
  };
  const selectCategory = (value: NativePokedexCategory) => {
    if (value === category) return;
    beginPerformance('pokedex_category_result_painted');
    categoryTranslation.stopAnimation();
    categoryTranslation.setValue(reduceMotion ? 0 : (categories.findIndex(({ value: candidate }) => candidate === value) > categories.findIndex(({ value: candidate }) => candidate === category) ? width : -width));
    setCategory(value);
    if (!reduceMotion) Animated.timing(categoryTranslation, {
      toValue: 0, duration: 300, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (value.includes('shadow')) setFacets((current) => current.filter((facet) => facet !== 'lucky' && facet !== 'purified'));
  };
  const toggleAdvanced = () => {
    beginPerformance('pokedex_advanced_result_painted');
    setAdvanced((current) => {
      if (current && !BASE_CATEGORIES.some(({ value }) => value === category)) setCategory('pokemon');
      if (current) setFacets((selected) => selected.filter((facet) => BASE_FACETS.some(({ value }) => value === facet)));
      return !current;
    });
  };
  const openRegion = (regionGeneration: number) => {
    beginPerformance('pokedex_region_index_painted');
    setGeneration(regionGeneration);
    setQuery('');
    setCollapsedRegionKeys((current) => {
      const key = `${category}:${regionGeneration}`;
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    pendingScrollGenerationRef.current = regionGeneration;
  };
  const showRegions = () => {
    pendingScrollGenerationRef.current = null;
    setGeneration(null);
    setQuery('');
  };
  const toggleRegion = (regionGeneration: number) => {
    beginPerformance('pokedex_region_section_painted');
    if (!reduceMotion) LayoutAnimation.configureNext({
      duration: 260,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    const key = `${category}:${regionGeneration}`;
    setCollapsedRegionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const renderEntryCard = (item: NativePokedexEntry) => {
    const registered = nativePokedexEntryIsRegistered(item, category, facets);
    const imageUri = useFemaleImages ? item.femaleImageUri : item.imageUri;
    const manualRegistration: NativePokedexManualRegistration = {
      entryId: item.id,
      facets: selectedRegistrationFacets,
      registrationId: buildNativePokedexRegistrationId(item.id, selectedRegistrationFacets),
    };
    return <View key={item.id} style={[styles.cardCell, { width: `${100 / columns}%` }]}>
      <View style={styles.cardWrap}>
        <Pressable
          accessibilityLabel={`Open ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !item.released }}
          disabled={!item.released}
          onPress={() => {
            const startedAt = Date.now();
            onOpenEntry(item, selectedRegistrationFacets);
            markNativeUiPerformanceAfterPaint('pokedex_detail_painted', startedAt);
          }}
          style={({ pressed }) => [
            styles.card,
            !light && { borderColor: `${activeCategory.accent}55`, backgroundColor: `${activeCategory.accent}18` },
            light && styles.cardLight,
            registered && { borderColor: activeCategory.accent, backgroundColor: `${activeCategory.accent}34` },
            !item.released && styles.cardUnreleased,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.imageStage}>
            {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={styles.image} /> : null}
            {activeFacetBadges.length > 0 ? <View pointerEvents="none" style={styles.facetBadgeStack}>
              {activeFacetBadges.map((facet) => <View key={facet.value} style={[styles.facetBadge, light && styles.facetBadgeLight]}>
                <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, facet.icon) ?? undefined }} style={[styles.facetBadgeIcon, light && DARK_ON_LIGHT_FACET_ICONS.has(facet.icon) && styles.darkFacetIcon]} />
              </View>)}
            </View> : null}
            {item.maxKind ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, `/images/${item.maxKind}.png`) ?? undefined }} style={styles.maxIcon} /> : null}
          </View>
          <Text style={[styles.dex, light && styles.mutedLight]}>#{String(item.pokedexNumber).padStart(4, '0')}</Text>
          <Text numberOfLines={2} style={[styles.name, light && styles.textLight]}>{item.name}</Text>
          <Text style={[styles.state, registered && { color: activeCategory.accent }, !item.released && styles.stateUnreleased]}>{item.released ? (registered ? 'Registered' : 'Missing') : 'Unreleased'}</Text>
        </Pressable>
        {item.released ? <Pressable
          accessibilityLabel={`${registered ? 'Clear' : 'Register'} ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: registered }}
          disabled={isSaving}
          onPress={() => {
            const startedAt = Date.now();
            onSetRegistrations([manualRegistration], !registered);
            markNativeUiPerformanceAfterPaint('pokedex_registration_result_painted', startedAt);
          }}
          style={[styles.registrationToggle, { borderColor: activeCategory.accent }, registered && { backgroundColor: activeCategory.accent }, isSaving && styles.savingDisabled]}
        ><Text style={[styles.registrationToggleText, registered && styles.registrationToggleTextActive]}>{registered ? '✓' : '+'}</Text></Pressable> : null}
      </View>
    </View>;
  };
  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-pokedex-screen">
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 100 + insets.bottom }}
        data={listRows}
        ref={listRef}
        key={columns}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        keyExtractor={(row) => row.key}
        ListHeaderComponent={<View>
          <View style={styles.topbar}>
            <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, '/images/pokedex-icon.png') ?? undefined }} style={styles.headerIcon} />
            <View style={styles.headerCopy}><Text style={[styles.eyebrow, light && styles.eyebrowLight]}>TRAINER REFERENCE</Text><Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Pokédex</Text><Text style={[styles.headerDetail, light && styles.mutedLight]}>Explore every released species, form, and collectible variant.</Text></View>
          </View>
          <View style={styles.headerTools}>
            <Text style={[styles.registrationTotal, light && styles.textLight]}>Registered: <Text style={{ color: light ? readableLightAccent(activeCategory.accent) : activeCategory.accent }}>{registeredCount}</Text> / {categoryEntries.length}</Text>
            <Pressable aria-checked={advanced} accessibilityLabel="Advanced Pokédex filters" accessibilityRole="switch" accessibilityState={{ checked: advanced }} onPress={toggleAdvanced} style={[styles.advanced, light && styles.chipLight, advanced && styles.advancedActive]}><Text style={[styles.advancedText, light && styles.textLight, advanced && styles.activeText]}>Advanced</Text><View style={[styles.switchTrack, advanced && styles.switchTrackActive]}><View style={[styles.switchThumb, advanced && styles.switchThumbActive]} /></View></Pressable>
          </View>
          <ScrollView accessibilityLabel="Pokédex variant category" accessibilityRole="tablist" contentContainerStyle={styles.railContent} horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((definition) => { const active = category === definition.value; return <Pressable aria-selected={active} accessibilityRole="tab" accessibilityState={{ selected: active }} key={definition.value} onPress={() => selectCategory(definition.value)} style={[styles.categoryChip, light && styles.chipLight, active && { borderColor: definition.accent, backgroundColor: `${definition.accent}35` }]}><View style={styles.iconStack}>{definition.icons.map((icon) => <Image fadeDuration={0} key={icon} source={{ uri: absoluteUri(assetBaseUrl, icon) ?? undefined }} style={styles.categoryIcon} />)}</View><Text style={[styles.chipText, light && styles.textLight, active && { color: light ? readableLightAccent(definition.accent) : definition.accent }]}>{definition.label}</Text></Pressable>; })}
          </ScrollView>
          <ScrollView accessibilityLabel="Pokédex quality facets" contentContainerStyle={styles.qualityRail} horizontal showsHorizontalScrollIndicator={false}>
            {qualityFacets.map((facet) => { const active = facets.includes(facet.value); const disabled = category.includes('shadow') && (facet.value === 'lucky' || facet.value === 'purified'); return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: active }} disabled={disabled} key={facet.value} onPress={() => toggleFacet(facet.value)} style={[styles.facetChip, light && styles.chipLight, active && { borderColor: facet.accent, backgroundColor: `${facet.accent}35` }, disabled && styles.disabled]}><Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, facet.icon) ?? undefined }} style={[styles.facetIcon, light && DARK_ON_LIGHT_FACET_ICONS.has(facet.icon) && styles.darkFacetIcon]} /><Text style={[styles.facetText, light && styles.textLight, active && { color: light ? readableLightAccent(facet.accent) : facet.accent }]}>{facet.label}</Text></Pressable>; })}
          </ScrollView>
          {registrationError ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorTitle}>Registration not saved</Text><Text style={styles.errorText}>{registrationError}</Text><Pressable accessibilityRole="button" onPress={onDismissRegistrationError} style={styles.retry}><Text style={styles.retryText}>Dismiss</Text></Pressable></View> : null}
          {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorTitle}>Pokédex unavailable</Text><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
          {isLoading ? <View style={styles.loading}><ActivityIndicator color="#299cf5" /><Text style={[styles.loadingText, light && styles.mutedLight]}>Opening Pokédex…</Text></View> : null}
          {!isLoading && !error && generation == null ? <Animated.View accessibilityLabel={`${activeCategory.label} regions`} style={[styles.regions, categoryMotionStyle]}>
            {regionCards.map((region) => {
              const complete = region.entries.length > 0 && region.registered >= region.entries.length;
              return <Pressable
                accessibilityLabel={`Open ${region.label}`}
                accessibilityRole="button"
                key={region.label}
                onPress={() => openRegion(region.generation)}
                style={[styles.regionCard, compactRegions && styles.regionCardCompact, light && styles.regionCardLight]}
              >
                <RegionCardBackdrop accent={region.accent} compact={compactRegions} light={light} secondary={region.secondary} tertiary={region.tertiary} />
                <View style={[styles.regionCopy, compactRegions && styles.regionCopyCompact, width > 430 && compactRegions && styles.regionCopyMedium]}>
                  <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.regionName, compactRegions && styles.regionNameCompact, width <= 380 && styles.regionNameNarrow, { color: region.text }]}>{region.label}</Text>
                  <Text style={[styles.regionStatus, compactRegions && styles.regionStatusCompact, light && styles.regionStatusLight]}>{complete ? 'Complete!' : 'In progress'}</Text>
                  <Text style={[styles.regionCount, compactRegions && styles.regionCountCompact, light && styles.regionCountLight]}>{region.registered} / {region.entries.length}</Text>
                  <View style={[styles.regionBadge, compactRegions && styles.regionBadgeCompact, light && styles.regionBadgeLight, { borderColor: `${region.accent}8c` }]}>
                    <Text style={[styles.regionBadgeText, { color: complete ? region.text : '#f0b429' }]}>{complete ? '✓' : '!'}</Text>
                  </View>
                </View>
                <View style={[styles.regionArt, compactRegions && styles.regionArtCompact]}>
                  {Array.from({ length: 3 }, (_, index) => region.previews[index]).map((entry, index) => {
                    if (!entry) return <View key={`empty-${index}`} style={styles.regionPreviewSlot} />;
                    const imageUri = useFemaleImages ? entry.femaleImageUri : entry.imageUri;
                    return <View key={entry.id} style={styles.regionPreviewSlot}>
                      <View style={[styles.regionPreview, { maxWidth: compactRegions ? (width <= 430 ? 92 : 108) + (index === 1 ? 10 : 0) : (index === 1 ? 160 : 148) }]}>
                        {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={styles.regionPokemon} /> : null}
                        {entry.maxKind ? <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, `/images/${entry.maxKind}.png`) ?? undefined }} style={styles.regionMaxIcon} /> : null}
                      </View>
                    </View>;
                  })}
                </View>
              </Pressable>;
            })}
            {regionCards.length === 0 ? <View style={styles.empty}><Text style={[styles.emptyTitle, light && styles.textLight]}>No regions match</Text><Text style={[styles.emptyText, light && styles.mutedLight]}>Try another category or clear a quality filter.</Text></View> : null}
          </Animated.View> : null}
          {generation != null ? <View style={styles.detailToolbar}><View style={styles.detailHeading}><Pressable accessibilityRole="button" onPress={showRegions} style={[styles.regionsBack, { borderColor: `${activeCategory.accent}88` }, light && styles.chipLight]}><Text style={[styles.regionsBackText, light && styles.textLight]}>‹ All regions</Text></Pressable><Text style={[styles.resultsTitle, light && styles.textLight]}>All regions · {activeCategory.label}</Text><Text style={[styles.resultsDetail, light && styles.mutedLight]}>{detailRegions.reduce((total, region) => total + region.entries.filter((entry) => nativePokedexEntryIsRegistered(entry, category, facets)).length, 0)} / {detailRegions.reduce((total, region) => total + region.entries.length, 0)} registered</Text></View><TextInput accessibilityLabel="Search Pokédex" autoCapitalize="none" onChangeText={(value) => { beginPerformance('pokedex_search_result_painted'); setQuery(value); }} placeholder="Pokémon or number" placeholderTextColor="#75838c" style={[styles.search, !light && { borderColor: `${activeCategory.accent}88` }, light && styles.searchLight]} value={query} /><View accessibilityLabel="Visible registration actions" style={[styles.registrationTray, !light && { borderColor: `${activeCategory.accent}88`, backgroundColor: `${activeCategory.accent}14` }, light && styles.registrationTrayLight]}><View style={styles.registrationCopy}><Text style={[styles.registrationLabel, light && styles.mutedLight]}>VISIBLE</Text><Text style={[styles.registrationCount, light && styles.textLight]}>{visibleRegistrations.length}</Text></View><View style={styles.registrationActions}><Pressable accessibilityRole="button" disabled={isSaving || visibleRegistrations.length === 0} onPress={() => { beginPerformance('pokedex_bulk_dialog_painted'); setBulkConfirmation({ registered: true, registrations: visibleRegistrations }); }} style={[styles.bulkButton, { borderColor: activeCategory.accent, backgroundColor: activeCategory.accent }, (isSaving || visibleRegistrations.length === 0) && styles.savingDisabled]}><Text style={styles.bulkRegisterTextThemed}>Register all</Text></Pressable><Pressable accessibilityRole="button" disabled={isSaving || visibleRegistrations.length === 0} onPress={() => { beginPerformance('pokedex_bulk_dialog_painted'); setBulkConfirmation({ registered: false, registrations: visibleRegistrations }); }} style={[styles.bulkButton, styles.bulkClear, (isSaving || visibleRegistrations.length === 0) && styles.savingDisabled]}><Text style={styles.bulkClearText}>Unregister all</Text></Pressable></View></View></View> : null}
        </View>}
        ListEmptyComponent={generation != null && !isLoading && !error ? <View style={styles.empty}><Text style={[styles.emptyTitle, light && styles.textLight]}>No Pokémon match</Text><Text style={[styles.emptyText, light && styles.mutedLight]}>Try another region, category, quality, or search term.</Text></View> : null}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ animated: animateRegionNavigation, offset: Math.max(0, index * 180) });
        }}
        renderItem={({ item }) => item.kind === 'entries'
          ? <Animated.View style={[styles.cardRow, categoryMotionStyle]}>{item.entries.map(renderEntryCard)}</Animated.View>
          : <Animated.View
              accessibilityLabel={`${item.region.label} region section`}
              style={[styles.regionSection, light && styles.cardLight, categoryMotionStyle]}
            >
              <View style={styles.regionSectionHeading}>
                <View><Text style={[styles.regionSectionEyebrow, { color: activeCategory.accent }]}>{activeCategory.label}</Text><Text style={[styles.regionSectionTitle, { color: item.region.text }]}>{item.region.label}</Text></View>
                <NativeLinearGradient colors={[item.region.accent, item.region.secondary, item.region.tertiary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.regionSectionCountPill}><Text style={styles.regionSectionCount}>{item.region.registered} / {item.region.totalCount}</Text></NativeLinearGradient>
                <Pressable
                  accessibilityLabel={`${collapsedRegionKeys.has(`${category}:${item.region.generation}`) ? 'Expand' : 'Collapse'} ${item.region.label} ${activeCategory.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !collapsedRegionKeys.has(`${category}:${item.region.generation}`) }}
                  onPress={() => toggleRegion(item.region.generation)}
                  style={[styles.regionSectionToggle, light && styles.chipLight]}
                ><Text style={[styles.regionSectionToggleText, light && styles.textLight]}>{collapsedRegionKeys.has(`${category}:${item.region.generation}`) ? '⌄' : '⌃'}</Text></Pressable>
              </View>
              {!collapsedRegionKeys.has(`${category}:${item.region.generation}`) ? <View accessibilityLabel={`${item.region.label} registration totals`} style={styles.regionStats}>
                {[['Shiny', item.region.stats.shiny], ['Lucky', item.region.stats.lucky], ['XXL', item.region.stats.xxl], ['XXS', item.region.stats.xxs], ['100%', item.region.stats.perfect]].map(([label, value]) => <View key={label} style={styles.regionStat}><Text style={[styles.regionStatLabel, light && styles.mutedLight]}>{label}</Text><Text style={[styles.regionStatValue, light && styles.textLight]}>{value}</Text></View>)}
              </View> : null}
            </Animated.View>}
      />
      <NativeConfirmationDialog
        body={bulkConfirmation?.registered
          ? `This will mark all ${bulkConfirmation.registrations.length} currently visible entries as registered in your Pokédex.`
          : `This removes only manual registrations from the ${bulkConfirmation?.registrations.length ?? 0} currently visible entries. Your caught Pokémon stay unchanged.`}
        confirmLabel={bulkConfirmation?.registered ? 'Register all' : 'Unregister all'}
        isPending={isSaving}
        onCancel={() => setBulkConfirmation(null)}
        onConfirm={() => {
          if (!bulkConfirmation) return;
          const startedAt = Date.now();
          onSetRegistrations(bulkConfirmation.registrations, bulkConfirmation.registered);
          markNativeUiPerformanceAfterPaint('pokedex_registration_result_painted', startedAt);
          setBulkConfirmation(null);
        }}
        title={bulkConfirmation?.registered ? 'Register every visible entry?' : 'Unregister every visible entry?'}
        tone={bulkConfirmation?.registered ? 'default' : 'danger'}
        visible={Boolean(bulkConfirmation)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d12' }, rootLight: { backgroundColor: '#f8fff9' }, textLight: { color: '#14232a' }, mutedLight: { color: '#5c6c74' },
  topbar: { minHeight: 103, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#43515b', borderRadius: 22, backgroundColor: '#171d22' }, backLight: { borderColor: '#becbd2', backgroundColor: '#fff' }, backText: { marginTop: -4, color: '#fff', fontSize: 38 }, headerIcon: { width: 45, height: 45, resizeMode: 'contain' }, headerCopy: { minWidth: 0, flex: 1 }, eyebrow: { color: '#299cf5', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, eyebrowLight: { color: '#005bb5' }, title: { color: '#fff', fontSize: 28, fontWeight: '900' }, headerDetail: { marginTop: 3, color: '#9ba9b0', fontSize: 14, lineHeight: 20 },
  headerTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, marginBottom: 15 }, registrationTotal: { color: '#fff', fontSize: 12, fontWeight: '800' }, advanced: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#45535c', borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#151b20' }, advancedActive: { borderColor: '#299cf5', backgroundColor: '#123c61' }, advancedText: { color: '#c2cbd0', fontSize: 10, fontWeight: '900' }, activeText: { color: '#fff' }, switchTrack: { width: 27, height: 16, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 2, backgroundColor: '#65727a' }, switchTrackActive: { backgroundColor: '#299cf5' }, switchThumb: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' }, switchThumbActive: { alignSelf: 'flex-end' },
  railContent: { gap: 7, paddingLeft: 12, paddingRight: 12, paddingBottom: 23 }, qualityRail: { gap: 7, paddingLeft: 12, paddingRight: 12, paddingBottom: 52 }, categoryChip: { minHeight: 44, minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#43515a', borderRadius: 999, paddingHorizontal: 14, backgroundColor: '#161c21' }, chipLight: { borderColor: '#bec9cf', backgroundColor: '#fff' }, iconStack: { minWidth: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, categoryIcon: { width: 20, height: 20, marginHorizontal: -1, resizeMode: 'contain' }, chipText: { color: '#bdc7cc', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' }, facetChip: { minHeight: 42, minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#43515a', borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#161c21' }, facetIcon: { width: 22, height: 22, resizeMode: 'contain' }, darkFacetIcon: { tintColor: '#26333a' }, facetText: { color: '#bdc7cc', fontSize: 12.5, fontWeight: '900' }, disabled: { opacity: 0.35 },
  regions: { gap: 16 },
  regionCard: { minHeight: 158, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#abbbb8', borderRadius: 26, backgroundColor: '#222' },
  regionCardCompact: { minHeight: 132, borderWidth: 4, borderRadius: 22 },
  regionCardLight: { borderColor: 'rgba(169, 192, 186, 0.72)', backgroundColor: '#fcfffc' },
  regionCopy: { width: '39%', minWidth: 170, justifyContent: 'center', gap: 7, paddingLeft: 28, paddingRight: 22, paddingTop: 22, paddingBottom: 20 },
  regionCopyCompact: { minWidth: 108, paddingLeft: 18, paddingRight: 0, paddingVertical: 16 },
  regionCopyMedium: { width: '36%', minWidth: 118 },
  regionName: { fontSize: 44.8, lineHeight: 44.8, fontWeight: '900', textTransform: 'uppercase' },
  regionNameCompact: { fontSize: 28, lineHeight: 28 },
  regionNameNarrow: { fontSize: 26 },
  regionStatus: { color: '#abbbb8', fontSize: 22.72, fontWeight: '800' },
  regionStatusCompact: { fontSize: 16, lineHeight: 19 },
  regionStatusLight: { color: '#4b625e' },
  regionCount: { color: '#fff', fontSize: 32, lineHeight: 32, fontWeight: '900' },
  regionCountCompact: { fontSize: 19.2, lineHeight: 19.2 },
  regionCountLight: { color: '#2f4744' },
  regionBadge: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderRadius: 21, backgroundColor: '#111' },
  regionBadgeCompact: { width: 34, height: 34, borderRadius: 17 },
  regionBadgeLight: { backgroundColor: '#f8fff9' },
  regionBadgeText: { fontSize: 16, fontWeight: '900' },
  regionArt: { flex: 1, minWidth: 0, minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 10, paddingBottom: 10 },
  regionArtCompact: { minHeight: 126, paddingHorizontal: 6, paddingBottom: 8 },
  regionPreviewSlot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  regionPreview: { width: '100%', aspectRatio: 1, maxHeight: 150 },
  regionPokemon: { width: '100%', height: '100%' },
  regionMaxIcon: { position: 'absolute', right: '8%', top: '8%', width: '35%', height: '35%', maxWidth: 48, maxHeight: 48, resizeMode: 'contain' },
  detailToolbar: { gap: 10, marginBottom: 8 }, detailHeading: { gap: 4 }, regionsBack: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: '#43515a', borderRadius: 999, paddingHorizontal: 13, backgroundColor: '#161c21' }, regionsBackText: { color: '#fff', fontSize: 11, fontWeight: '900' }, resultsTitle: { color: '#fff', fontSize: 20, fontWeight: '900' }, resultsDetail: { color: '#89989f', fontSize: 10 }, search: { minHeight: 48, borderWidth: 1, borderColor: '#46545d', borderRadius: 12, paddingHorizontal: 14, color: '#fff', backgroundColor: '#161c21', fontSize: 15, fontWeight: '800' }, searchLight: { borderColor: '#b8c6cd', color: '#14232a', backgroundColor: '#fff' }, registrationTray: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#34464e', borderRadius: 13, padding: 9, backgroundColor: '#12191d' }, registrationTrayLight: { borderColor: '#c1ccd1', backgroundColor: '#fff' }, registrationCopy: { minWidth: 46, alignItems: 'center' }, registrationLabel: { color: '#89989f', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, registrationCount: { color: '#fff', fontSize: 17, fontWeight: '900' }, registrationActions: { minWidth: 0, flex: 1, flexDirection: 'row', gap: 7 }, bulkButton: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 9, paddingHorizontal: 8 }, bulkRegister: { borderColor: '#2dc4a6', backgroundColor: '#17483f' }, bulkClear: { borderColor: '#d85b70', backgroundColor: '#54212a' }, bulkRegisterText: { color: '#7df0d9', fontSize: 11, fontWeight: '900' }, bulkRegisterTextThemed: { color: '#15110a', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, bulkClearText: { color: '#ffd4dc', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  regionSection: { gap: 10, marginTop: 14, marginBottom: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#43515a', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#151b20' }, regionSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, regionSectionEyebrow: { color: '#299cf5', fontSize: 8, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }, regionSectionTitle: { color: '#fff', fontSize: 23, fontWeight: '900', textTransform: 'uppercase' }, regionSectionCountPill: { marginLeft: 'auto', overflow: 'hidden', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }, regionSectionCount: { color: '#fff', fontSize: 17, fontWeight: '900' }, regionSectionToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#43515a', borderRadius: 22, backgroundColor: '#11171b' }, regionSectionToggleText: { color: '#fff', fontSize: 23, lineHeight: 25, fontWeight: '700' }, regionStats: { flexDirection: 'row', gap: 4 }, regionStat: { minWidth: 0, flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }, regionStatLabel: { color: '#a9b6bc', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase' }, regionStatValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  cardRow: { flexDirection: 'row' }, cardCell: { padding: 4 }, cardWrap: { position: 'relative' }, card: { minHeight: 150, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#324149', borderRadius: 12, padding: 7, backgroundColor: '#151b20' }, cardLight: { borderColor: '#c2cdd3', backgroundColor: '#fff' }, cardRegistered: { borderColor: '#299cf5' }, cardUnreleased: { opacity: 0.46 }, imageStage: { width: '100%', height: 76, alignItems: 'center', justifyContent: 'center' }, image: { width: '86%', height: '86%' }, facetBadgeStack: { position: 'absolute', left: '2%', top: '2%', zIndex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 2, maxWidth: '68%' }, facetBadge: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#11191fd9' }, facetBadgeLight: { backgroundColor: '#ffffffdd' }, facetBadgeIcon: { width: 16, height: 16, resizeMode: 'contain' }, maxIcon: { position: 'absolute', top: '5%', right: '5%', width: '23%', height: '23%' }, name: { minHeight: 30, color: '#fff', fontSize: 11.5, lineHeight: 15, fontWeight: '900', textAlign: 'center' }, dex: { color: '#b5c4cc', fontSize: 19, fontWeight: '900' }, state: { marginTop: 2, color: '#89979e', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, stateRegistered: { color: '#4ad8c7' }, stateUnreleased: { color: '#b8c0c4' }, registrationToggle: { position: 'absolute', right: 5, top: 5, zIndex: 3, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#50616a', borderRadius: 15, backgroundColor: '#1c252a' }, registrationToggleActive: { borderColor: '#4ad8c7', backgroundColor: '#127a69' }, registrationToggleText: { color: '#fff', fontSize: 18, fontWeight: '900' }, registrationToggleTextActive: { color: '#15110a' }, savingDisabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 20 }, loadingText: { color: '#aab8bf', fontWeight: '700' }, error: { gap: 7, borderWidth: 1, borderColor: '#df5770', borderRadius: 12, padding: 13, backgroundColor: '#39151e' }, errorTitle: { color: '#ffd8df', fontSize: 15, fontWeight: '900' }, errorText: { color: '#ffb8c4', fontSize: 12 }, retry: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 14, backgroundColor: '#df5770' }, retryText: { color: '#fff', fontWeight: '900' }, empty: { alignItems: 'center', gap: 5, padding: 40 }, emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, emptyText: { color: '#9aa8af', textAlign: 'center' },
});
