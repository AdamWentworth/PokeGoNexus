import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeBackIcon } from '../components/NativeBackIcon';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativePokedexEvolutionLine,
  buildNativePokedexCombinationSections,
  buildNativePokedexRegistrationSlots,
  filterNativePokedexCombinations,
  getNativePokedexMoveEnergyBarCount,
  getNativePokedexMoves,
  getNativePokedexComboSectionForSlot,
  getNativePokedexTypeEffectiveness,
  toggleNativePokedexComboFilter,
  type NativePokedexComboFilter,
  type NativePokedexCombination,
  type NativePokedexDetailSectionKey,
  type NativePokedexRegistrationSlot,
} from '../features/tools/nativePokedexDetailModel';
import type {
  NativePokedexEntry,
  NativePokedexManualRegistration,
} from '../features/tools/nativePokedexModel';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type DetailTab = 'registered' | 'info' | 'battle' | 'more';

type Props = {
  allEntries: NativePokedexEntry[];
  allPokemon: BasePokemon[];
  assetBaseUrl: string;
  entry: NativePokedexEntry | null;
  error?: string | null;
  initialGender?: 'Male' | 'Female';
  isLoading?: boolean;
  isSaving?: boolean;
  onBack: () => void;
  onOpenEntry: (entry: NativePokedexEntry, gender?: 'Male' | 'Female') => void;
  onSetRegistrations: (registrations: NativePokedexManualRegistration[], registered: boolean) => void;
  onToggleRegistration: (registration: NativePokedexManualRegistration, registered: boolean) => void;
  pokemon: BasePokemon | null;
};

type BulkConfirmation = {
  action: 'register' | 'unregister';
  registrations: NativePokedexManualRegistration[];
  scope: 'combinations' | 'registered';
};

const TABS: [DetailTab, string][] = [
  ['registered', 'Registered'],
  ['info', 'Info'],
  ['battle', 'Battle'],
  ['more', 'More'],
];

const SECTION_ORDER: [NativePokedexDetailSectionKey, string][] = [
  ['registered', 'Registered'],
  ['costume', 'Costumes'],
  ['shadow', 'Shadow'],
  ['mega', 'Mega forms'],
  ['max', 'Max forms'],
  ['fusion', 'Fusion forms'],
  ['special', 'Other forms'],
];

const COMBO_FILTERS: { key: NativePokedexComboFilter; label: string }[] = [
  { key: 'registered', label: 'Registered' }, { key: 'missing', label: 'Missing' },
  { key: 'pokemon', label: 'Pokémon' }, { key: 'shiny', label: 'Shiny' },
  { key: 'male', label: 'Male' }, { key: 'female', label: 'Female' },
  { key: 'xxs', label: 'XXS' }, { key: 'xs', label: 'XS' },
  { key: 'xl', label: 'XL' }, { key: 'xxl', label: 'XXL' },
  { key: 'lucky', label: 'Lucky' }, { key: 'perfect', label: '100%' },
];

const DARK_ON_LIGHT = new Set([
  '/images/appraisal_04.png', '/images/height.png', '/images/lucky-icon.png',
  '/images/weight.png', '/images/xxl.png', '/images/xxs.png',
]);

const THEME_COLORS: Record<string, [string, string]> = {
  pokemon: ['#168fc4', '#42cdbf'], shiny: ['#e8941d', '#f3ca43'], shadow: ['#5c2a91', '#a45ae5'],
  costume: ['#d95075', '#5eb9df'], mega: ['#9f41bd', '#e66ab7'], dynamax: ['#c43e65', '#ef8198'],
  gigantamax: ['#bd303d', '#ef684d'], fusion: ['#365ec0', '#55bfe7'],
  lucky: ['#d84e24', '#ff9a3d'], purified: ['#16aeb7', '#8ce9e1'],
  xxs: ['#102f70', '#4b7be8'], xs: ['#1d4d95', '#6996ff'],
  xl: ['#1a7cc6', '#6fc6ff'], xxl: ['#1767b7', '#5ba8ff'],
  perfect: ['#e3303d', '#ff727c'],
};

const categoryTheme = (entry: NativePokedexEntry): [string, string] => {
  const category = entry.category;
  const base = category.includes('gigantamax') ? 'gigantamax'
    : category.includes('dynamax') ? 'dynamax'
      : category.includes('fusion') ? 'fusion'
        : category.includes('mega') ? 'mega'
          : category.includes('costume') ? 'costume'
            : category.includes('shadow') ? 'shadow'
              : category.includes('shiny') ? 'shiny' : 'pokemon';
  return THEME_COLORS[base] ?? THEME_COLORS.pokemon;
};

const slotTheme = (
  slot: NativePokedexRegistrationSlot | undefined,
  fallback: NativePokedexEntry,
): [string, string] => {
  if (!slot) return categoryTheme(fallback);
  if (slot.facets.purified) return THEME_COLORS.purified;
  if (slot.facets.lucky) return THEME_COLORS.lucky;
  if (slot.facets.appraisal) return THEME_COLORS.perfect;
  if (slot.facets.size && slot.facets.size !== 'normal') return THEME_COLORS[slot.facets.size];
  return categoryTheme(slot.entry);
};

const imageScale = (size: NativePokedexRegistrationSlot['facets']['size']) => {
  if (size === 'xxs') return 0.78;
  if (size === 'xs') return 0.9;
  if (size === 'xl') return 1.1;
  if (size === 'xxl') return 1.2;
  return 1;
};

const entryImageUri = (
  entry: NativePokedexEntry,
  gender: 'Male' | 'Female' | undefined,
  purified = false,
) => {
  if (purified) {
    return gender === 'Female'
      ? entry.femalePurifiedImageUri ?? entry.purifiedImageUri ?? entry.femaleImageUri ?? entry.imageUri
      : entry.purifiedImageUri ?? entry.imageUri;
  }
  return gender === 'Female' ? entry.femaleImageUri ?? entry.imageUri : entry.imageUri;
};

const titleCase = (value: string) => value
  .split(/[\s_-]+/)
  .filter(Boolean)
  .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`)
  .join(' ');

const formatReleaseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(parsed);
};

const absoluteUri = (base: string, value: string | null): string | null => {
  if (!value) return null;
  try { return new URL(value, base).toString(); } catch { return null; }
};

const formatValue = (value: number | null | undefined, digits = 2): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const genderOptions = (pokemon: Pick<BasePokemon, 'gender_rate'>): ('Male' | 'Female')[] => {
  const rate = String(pokemon.gender_rate ?? '').trim().toLocaleUpperCase();
  if (!rate) return ['Male', 'Female'];
  const maleRate = rate.match(/(\d+)M/)?.[1];
  const femaleRate = rate.match(/(\d+)F/)?.[1];
  if (maleRate !== undefined || femaleRate !== undefined) {
    const supported: ('Male' | 'Female')[] = [];
    if (Number(maleRate ?? 0) > 0) supported.push('Male');
    if (Number(femaleRate ?? 0) > 0) supported.push('Female');
    return supported;
  }
  if (rate === 'GENDERLESS' || rate === 'NONE') return [];
  if (rate === 'M/M') return ['Male'];
  if (rate === 'F/F') return ['Female'];
  return ['Male', 'Female'];
};

const facetBadges = (combo: NativePokedexCombination): { icon: string; label: string }[] => [
  combo.facets.gender ? { label: combo.facets.gender, icon: `/images/${combo.facets.gender.toLocaleLowerCase()}-icon.png` } : null,
  combo.facets.size ? { label: combo.facets.size.toLocaleUpperCase(), icon: combo.facets.size === 'xxs' ? '/images/xxs.png' : combo.facets.size === 'xxl' ? '/images/xxl.png' : '/images/height.png' } : null,
  combo.facets.lucky ? { label: 'Lucky', icon: '/images/lucky-icon.png' } : null,
  combo.facets.appraisal ? { label: '100%', icon: '/images/appraisal_04.png' } : null,
].filter((badge): badge is { icon: string; label: string } => Boolean(badge));

const HeroBackdrop = ({ colors, light }: { colors: [string, string]; light: boolean }) => (
  <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" width="100%">
    <Defs><LinearGradient id="pokedex-detail-hero" x1="0%" x2="100%" y1="0%" y2="100%"><Stop offset="0" stopColor={colors[0]} stopOpacity={light ? 0.58 : 0.9} /><Stop offset="100%" stopColor={colors[1]} stopOpacity={light ? 0.42 : 0.72} /></LinearGradient></Defs>
    <Rect fill="url(#pokedex-detail-hero)" height="100" width="100" x="0" y="0" />
    <Path
      d="M-50 0L0 100M-25 0L25 100M0 0L50 100M25 0L75 100M50 0L100 100M75 0L125 100M100 0L150 100M0 0L-50 100M25 0L-25 100M50 0L0 100M75 0L25 100M100 0L50 100M125 0L75 100M150 0L100 100"
      fill="none"
      opacity={light ? 0.3 : 0.2}
      stroke="#ffffff"
      strokeWidth="0.7"
    />
  </Svg>
);

const BaseStatRow = ({ colors, label, light, value }: {
  colors: [string, string];
  label: string;
  light: boolean;
  value: number | null | undefined;
}) => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const percentage = Math.max(0, Math.min(100, (numericValue / ({ Attack: 450, Defense: 400, Stamina: 500 }[label] ?? 500)) * 100));
  return <View accessibilityLabel={`${label} ${formatValue(value, 0)}`} style={styles.baseStatRow}>
    <Text style={[styles.baseStatLabel, light && styles.mutedLight]}>{label}</Text>
    <View style={[styles.baseStatTrack, light && styles.baseStatTrackLight]}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 8" width="100%">
        <Defs><LinearGradient id={`pokedex-stat-${label}`} x1="0" x2="1"><Stop offset="0" stopColor={colors[0]} /><Stop offset="1" stopColor={colors[1]} /></LinearGradient></Defs>
        <Rect fill={`url(#pokedex-stat-${label})`} height="8" rx="4" width={percentage} x="0" y="0" />
      </Svg>
    </View>
    <Text style={[styles.baseStatValue, light && styles.textLight]}>{formatValue(value, 0)}</Text>
  </View>;
};

const TypePill = ({ assetBaseUrl, light, type }: { assetBaseUrl: string; light: boolean; type: string }) => (
  <View style={[styles.typePill, light && styles.softLight]}>
    <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, `/images/types/${type.toLocaleLowerCase()}.png`) ?? undefined }} style={styles.typePillIcon} />
    <Text style={[styles.typePillLabel, light && styles.textLight]}>{titleCase(type)}</Text>
  </View>
);

const MoveRow = ({ assetBaseUrl, colors, light, move }: { assetBaseUrl: string; colors: [string, string]; light: boolean; move: Move }) => {
  const energyBars = getNativePokedexMoveEnergyBarCount(move);
  return <View style={[styles.moveRow, !light && { backgroundColor: `${colors[0]}12` }, light && styles.softLight]}>
    <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, `/images/types/${move.type_name?.toLocaleLowerCase()}.png`) ?? undefined }} style={styles.moveType} />
    <View style={styles.moveCopy}>
      <Text style={[styles.moveName, light && styles.textLight]}>{move.name}{move.legacy ? '*' : ''}</Text>
      {energyBars > 0 ? <View accessibilityLabel={`${energyBars} energy bars`} style={styles.energyBars}>{Array.from({ length: energyBars }).map((_, index) => <View key={index} style={[styles.energyBar, { backgroundColor: colors[1] }]} />)}</View> : null}
    </View>
    <View style={styles.moveNumbers}>
      <Text style={[styles.movePower, light && styles.textLight]}>{move.pvp_power || '—'}</Text><Text style={[styles.moveMeta, light && styles.mutedLight]}>PvP</Text>
      <Text style={[styles.movePower, light && styles.textLight]}>{move.raid_power || '—'}</Text><Text style={[styles.moveMeta, light && styles.mutedLight]}>Raid</Text>
    </View>
  </View>;
};

const SizeRangeCard = ({ assetBaseUrl, average, icon, light, thresholds, title, unit }: {
  assetBaseUrl: string;
  average: number | null | undefined;
  icon: string;
  light: boolean;
  thresholds: { xl: number | null | undefined; xs: number | null | undefined; xxl: number | null | undefined; xxs: number | null | undefined };
  title: string;
  unit: string;
}) => {
  const withUnit = (value: number | null | undefined) => `${formatValue(value)} ${unit}`;
  const bands = [
    ['XXS', `< ${withUnit(thresholds.xxs)}`],
    ['XS', `≥ ${withUnit(thresholds.xxs)} and < ${withUnit(thresholds.xs)}`],
    ['Normal', `${withUnit(thresholds.xs)} – ${withUnit(thresholds.xl)}`],
    ['XL', `> ${withUnit(thresholds.xl)} and ≤ ${withUnit(thresholds.xxl)}`],
    ['XXL', `> ${withUnit(thresholds.xxl)}`],
  ];
  return <View style={[styles.sizeCard, light && styles.softLight]}>
    <View style={styles.sizeHeader}><Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, icon) ?? undefined }} style={[styles.sizeIcon, light && styles.darkIconLight]} /><View><Text style={[styles.sizeTitle, light && styles.textLight]}>{title}</Text><Text style={[styles.sizeValue, light && styles.mutedLight]}>Normal average {withUnit(average)}</Text></View></View>
    <View style={styles.sizeAverage}><Text style={[styles.sizeValue, light && styles.mutedLight]}>Average</Text><Text style={[styles.sizeAverageValue, light && styles.textLight]}>{withUnit(average)}</Text></View>
    {bands.map(([label, range]) => <View key={label} style={styles.sizeBand}><Text style={[styles.sizeBandLabel, light && styles.textLight]}>{label}</Text><Text style={[styles.sizeValue, light && styles.mutedLight]}>{range}</Text></View>)}
  </View>;
};

const RegistrationCard = ({ assetBaseUrl, colors, gender, light, onOpen, onToggle, saving, selected = false, slot }: {
  assetBaseUrl: string; colors: [string, string]; gender?: 'Male' | 'Female'; light: boolean; onOpen: () => void; onToggle: () => void;
  saving: boolean; selected?: boolean; slot: NativePokedexRegistrationSlot;
}) => {
  const imageUri = entryImageUri(slot.entry, gender, slot.facets.purified);
  const releaseDate = formatReleaseDate(slot.releaseDate);
  return <View style={[styles.variantCard, !light && { borderColor: `${colors[0]}58`, backgroundColor: `${colors[0]}18` }, light && styles.softLight, slot.registered && { borderColor: colors[1] }, selected && styles.variantCardSelected]}>
    <Pressable accessibilityLabel={`View ${slot.label}`} accessibilityRole="button" onPress={onOpen} style={styles.variantOpen}>
      <View style={styles.variantStage}>
        {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={[styles.variantImage, !slot.registered && styles.variantCardMissing, { transform: [{ scale: imageScale(slot.facets.size) }] }]} /> : null}
        {slot.icon ? <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, slot.icon) ?? undefined }} style={[styles.variantIcon, light && DARK_ON_LIGHT.has(slot.icon) && styles.darkIconLight]} /> : null}
      </View>
      <Text numberOfLines={2} style={[styles.variantName, light && styles.textLight]}>{slot.label}</Text>
      {releaseDate ? <Text style={[styles.variantDate, light && styles.mutedLight]}>{releaseDate}</Text> : null}
      <Text style={[styles.variantState, light && styles.variantStateLight, slot.registered && { color: colors[1] }, light && slot.registered && styles.variantStateRegisteredLight]}>{slot.lockedByInstance ? 'In collection' : slot.registered ? 'Registered' : 'Missing'}</Text>
    </Pressable>
    <Pressable accessibilityLabel={`${slot.registered ? 'Clear' : 'Register'} ${slot.label}`} accessibilityRole="button" disabled={slot.lockedByInstance || saving} onPress={onToggle} style={[styles.registrationToggle, { borderColor: colors[1] }, slot.registered && { backgroundColor: colors[1] }, slot.lockedByInstance && styles.registrationToggleDisabled]}><Text style={[styles.registrationToggleText, slot.registered && styles.registrationToggleTextActive]}>{slot.registered ? '✓' : '+'}</Text></Pressable>
  </View>;
};

const CombinationCard = ({ assetBaseUrl, colors, combo, gender, light, onToggle, saving }: {
  assetBaseUrl: string; colors: [string, string]; combo: NativePokedexCombination; gender?: 'Male' | 'Female'; light: boolean; onToggle: () => void;
  saving: boolean;
}) => {
  const comboGender = combo.facets.gender ?? gender;
  const imageUri = entryImageUri(combo.entry, comboGender, combo.facets.purified);
  return <Pressable accessibilityLabel={`${combo.registered ? 'Unregister' : 'Register'} ${combo.label}`} accessibilityRole="button" accessibilityState={{ checked: combo.registered, disabled: combo.lockedByInstance }} disabled={combo.lockedByInstance || saving} onPress={onToggle} style={[styles.comboCard, !light && { borderColor: `${colors[0]}58`, backgroundColor: `${colors[0]}18` }, light && styles.softLight, combo.registered && { borderColor: colors[1], backgroundColor: `${colors[0]}38` }, light && combo.registered && styles.comboCardRegisteredLight, combo.lockedByInstance && styles.registrationToggleDisabled]}>
    <View style={styles.comboStage}>
      {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={[styles.comboImage, !combo.registered && styles.comboCardMissing, { transform: [{ scale: imageScale(combo.facets.size) }] }]} /> : null}
      <View style={styles.comboBadges}>{facetBadges(combo).map((badge) => <Image fadeDuration={0} accessibilityLabel={badge.label} key={`${combo.id}-${badge.label}`} source={{ uri: absoluteUri(assetBaseUrl, badge.icon) ?? undefined }} style={[styles.comboBadge, light && DARK_ON_LIGHT.has(badge.icon) && styles.darkIconLight]} />)}</View>
    </View>
    <Text numberOfLines={2} style={[styles.comboLabel, light && styles.textLight]}>{combo.label}</Text>
    <Text style={[styles.comboState, light && styles.variantStateLight, combo.registered && { color: colors[1] }, light && combo.registered && styles.variantStateRegisteredLight]}>{combo.lockedByInstance ? 'In collection' : combo.registered ? 'Registered' : 'Missing'}</Text>
  </Pressable>;
};

export const NativePokedexDetailScreen = ({ allEntries, allPokemon, assetBaseUrl, entry, error = null, initialGender, isLoading = false, isSaving = false, onBack, onOpenEntry: _onOpenEntry, onSetRegistrations, onToggleRegistration, pokemon }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
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
  const [tab, setTab] = useState<DetailTab>('registered');
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | undefined>(initialGender);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [comboSectionId, setComboSectionId] = useState<string | null>(null);
  const [comboQuery, setComboQuery] = useState('');
  const [comboFilters, setComboFilters] = useState<NativePokedexComboFilter[]>([]);
  const [bulkConfirmation, setBulkConfirmation] = useState<BulkConfirmation | null>(null);
  const slots = useMemo(() => entry ? buildNativePokedexRegistrationSlots(allEntries, entry.pokemonId) : [], [allEntries, entry]);
  const comboSections = useMemo(() => pokemon ? buildNativePokedexCombinationSections(allEntries, pokemon) : [], [allEntries, pokemon]);
  const deferredComboFilters = useDeferredValue(comboFilters);
  const deferredComboQuery = useDeferredValue(comboQuery);
  const groupedSlots = useMemo(
    () => SECTION_ORDER
      .map(([key, label]) => ({
        key,
        label,
        slots: slots.filter((slot) => slot.section === key),
      }))
      .filter((section) => section.slots.length > 0),
    [slots],
  );
  const selectedSlot = useMemo(
    () => slots.find(({ id }) => id === selectedSlotId) ?? slots[0],
    [selectedSlotId, slots],
  );
  const heroPokemon = selectedSlot?.entry.variant ?? pokemon;
  const genders = useMemo(() => heroPokemon ? genderOptions(heroPokemon) : [], [heroPokemon]);
  const movePool = useMemo(() => getNativePokedexMoves(heroPokemon), [heroPokemon]);
  const activeComboSection = useMemo(
    () => comboSections.find(({ id }) => id === comboSectionId),
    [comboSectionId, comboSections],
  );
  const filteredCombos = useMemo(
    () => filterNativePokedexCombinations(
      activeComboSection?.combinations ?? [],
      deferredComboQuery,
      deferredComboFilters,
    ),
    [activeComboSection, deferredComboFilters, deferredComboQuery],
  );
  const registeredCount = useMemo(
    () => slots.filter(({ registered }) => registered).length,
    [slots],
  );
  const fastMoves = useMemo(
    () => movePool.filter((move) => move.is_fast === 1),
    [movePool],
  );
  const chargedMoves = useMemo(
    () => movePool.filter((move) => move.is_fast === 0),
    [movePool],
  );
  const evolutionPokemon = useMemo(
    () => pokemon ? buildNativePokedexEvolutionLine(allPokemon, pokemon) : [],
    [allPokemon, pokemon],
  );
  useEffect(() => finishPerformance('pokedex_detail_slot_result_painted'), [finishPerformance, selectedSlot]);
  useEffect(() => finishPerformance('pokedex_detail_gender_result_painted'), [finishPerformance, selectedGender]);
  useEffect(() => finishPerformance('pokedex_detail_tab_result_painted'), [finishPerformance, tab]);
  useEffect(() => finishPerformance('pokedex_detail_combo_section_painted'), [activeComboSection, finishPerformance]);
  useEffect(() => {
    if (comboQuery === deferredComboQuery) finishPerformance('pokedex_detail_combo_query_result_painted');
  }, [comboQuery, deferredComboQuery, filteredCombos.length, finishPerformance]);
  useEffect(() => {
    if (comboFilters === deferredComboFilters) finishPerformance('pokedex_detail_combo_filter_result_painted');
  }, [comboFilters, deferredComboFilters, filteredCombos.length, finishPerformance]);
  useEffect(() => {
    if (bulkConfirmation) finishPerformance('pokedex_detail_bulk_dialog_painted');
  }, [bulkConfirmation, finishPerformance]);
  if (isLoading && (!entry || !pokemon)) return <View style={[styles.centered, light && styles.rootLight]}><ActivityIndicator color="#299cf5" size="large" /><Text style={[styles.body, light && styles.mutedLight]}>Opening Pokédex entry…</Text></View>;
  if (!entry || !pokemon || !heroPokemon) return <View style={[styles.centered, light && styles.rootLight]}><Text style={[styles.title, light && styles.textLight]}>Pokémon unavailable</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable accessibilityRole="button" onPress={onBack} style={styles.primary}><Text style={styles.primaryText}>Back to Pokédex</Text></Pressable></View>;

  const stats = [['Attack', heroPokemon.attack], ['Defense', heroPokemon.defense], ['Stamina', heroPokemon.stamina], ['CP 40', heroPokemon.cp40], ['CP 50', heroPokemon.cp50]] as const;
  const heroEntry = selectedSlot?.entry ?? entry;
  const colors = slotTheme(selectedSlot, heroEntry);
  const themedPanel = light ? null : { borderColor: `${colors[0]}58`, backgroundColor: `${colors[0]}18` };
  const themedInner = light ? null : { backgroundColor: `${colors[0]}12` };
  const visibleGender = selectedGender && genders.includes(selectedGender)
    ? selectedGender
    : initialGender && genders.includes(initialGender)
      ? initialGender
      : genders[0];
  const heroImageUri = entryImageUri(heroEntry, visibleGender, selectedSlot?.facets.purified);
  const heroVariantTitle = pokemon.name;
  const typeEffectiveness = getNativePokedexTypeEffectiveness(heroPokemon);
  const selectCombinationSection = (id: string | null) => {
    beginPerformance('pokedex_detail_combo_section_painted');
    if (id !== comboSectionId) {
      setComboQuery('');
      setComboFilters([]);
    }
    setComboSectionId(id);
  };
  const selectSlot = (slot: NativePokedexRegistrationSlot) => {
    beginPerformance('pokedex_detail_slot_result_painted');
    setSelectedSlotId(slot.id);
    selectCombinationSection(getNativePokedexComboSectionForSlot(slot, comboSections)?.id ?? null);
  };

  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-pokedex-detail-screen">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8 + insets.top, paddingBottom: 100 + insets.bottom }]} keyboardShouldPersistTaps="always" nestedScrollEnabled>
        <View style={styles.topbar}><Pressable accessibilityLabel="Back to Pokédex" accessibilityRole="button" onPress={onBack} style={[styles.back, light && styles.backLight]}><NativeBackIcon color={light ? '#172124' : '#ffffff'} size={20} /></Pressable><Text style={[styles.topTitle, light && styles.textLight]}>Pokédex entry</Text><View style={styles.backPlaceholder} /></View>
        <View style={[styles.hero, { borderColor: `${colors[0]}99` }, light && styles.heroLight]}>
          <HeroBackdrop colors={colors} light={light} />
          <View style={styles.heroTop}><Text style={styles.dex}>#{String(entry.pokedexNumber).padStart(4, '0')}</Text><Text style={styles.heroVariant}>{selectedSlot?.label ?? heroEntry.category.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())}</Text></View>
          <View style={styles.imageStage}>{heroImageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, heroImageUri) ?? undefined }} style={[styles.image, { transform: [{ scale: imageScale(selectedSlot?.facets.size) }] }]} testID="native-pokedex-detail-hero-image" /> : null}{heroEntry.maxKind ? <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, `/images/${heroEntry.maxKind}.png`) ?? undefined }} style={styles.maxIcon} /> : null}</View>
          <Text accessibilityRole="header" style={styles.heroTitle}>#{String(entry.pokedexNumber).padStart(4, '0')} {heroVariantTitle}</Text>
          <View style={styles.traits}>{genders.length > 0 ? genders.map((gender) => <Pressable accessibilityLabel={`Show ${gender} ${pokemon.name}`} accessibilityRole="button" accessibilityState={{ selected: visibleGender === gender }} key={gender} onPress={() => { beginPerformance('pokedex_detail_gender_result_painted'); setSelectedGender(gender); }} style={[styles.gender, gender === 'Male' ? styles.genderMale : styles.genderFemale, visibleGender === gender && styles.genderSelected]}><Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, `/images/${gender.toLocaleLowerCase()}-icon.png`) ?? undefined }} style={styles.genderIcon} /></Pressable>) : <Text style={styles.genderless}>Genderless</Text>}{heroEntry.typeIconUris.map((uri, index) => <View key={uri} style={styles.typeChip}><Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, uri) ?? undefined }} style={styles.type} /><Text style={styles.typeLabel}>{index === 0 ? heroPokemon.type1_name : heroPokemon.type2_name}</Text></View>)}</View>
          <View style={styles.registrationPill}><View style={styles.registrationPillCell}><Text style={styles.registrationPillLabel}>Registered</Text><Text style={styles.registrationPillValue}>{registeredCount}</Text></View><View style={styles.registrationPillDivider} /><View style={styles.registrationPillCell}><Text style={styles.registrationPillLabel}>Available</Text><Text style={styles.registrationPillValue}>{slots.length}</Text></View></View>
        </View>

        <View accessibilityRole="tablist" style={[styles.tabs, themedPanel, light && styles.cardLight]}>{TABS.map(([value, label]) => <Pressable aria-selected={tab === value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} key={value} onPress={() => { beginPerformance('pokedex_detail_tab_result_painted'); setTab(value); }} style={styles.tab}><Text style={[styles.tabText, light && styles.textLight, tab === value && styles.tabTextActive, light && tab === value && styles.tabTextActiveLight]}>{label}</Text>{value === 'more' ? <Text numberOfLines={1} style={[styles.tabDetail, tab === value && { color: colors[1] }, light && styles.mutedLight]}>{activeComboSection?.label ?? 'Index'}</Text> : null}{tab === value ? <View style={[styles.tabIndicator, { backgroundColor: colors[0] }]} /> : null}</Pressable>)}</View>
        {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
        {isSaving ? <View style={styles.saving}><ActivityIndicator color={colors[0]} /><Text style={[styles.savingText, light && styles.mutedLight]}>Updating Pokédex…</Text></View> : null}

        {tab === 'registered' ? <View style={styles.tabPanel}>
          <View accessibilityLabel="Registered tab bulk actions" style={styles.bulkRow}><Pressable accessibilityRole="button" disabled={slots.length === 0 || isSaving} onPress={() => { beginPerformance('pokedex_detail_bulk_dialog_painted'); setBulkConfirmation({ action: 'register', registrations: slots.map(({ registration }) => registration), scope: 'registered' }); }} style={[styles.bulkButton, { borderColor: colors[1], backgroundColor: colors[1] }, slots.length === 0 && styles.registrationToggleDisabled]}><Text style={styles.bulkRegisterTextThemed}>Register all</Text></Pressable><Pressable accessibilityRole="button" disabled={slots.length === 0 || isSaving} onPress={() => { beginPerformance('pokedex_detail_bulk_dialog_painted'); setBulkConfirmation({ action: 'unregister', registrations: slots.map(({ registration }) => registration), scope: 'registered' }); }} style={[styles.bulkButton, styles.bulkRemove, slots.length === 0 && styles.registrationToggleDisabled]}><Text style={styles.bulkRemoveText}>Unregister all</Text></Pressable></View>
          {groupedSlots.map((section) => <View key={section.key} style={styles.slotSection}><Text style={[styles.slotSectionTitle, light && styles.textLight]}>{section.label}</Text><View style={styles.variantGrid}>{section.slots.map((slot) => <RegistrationCard assetBaseUrl={assetBaseUrl} colors={colors} gender={visibleGender} key={slot.id} light={light} onOpen={() => selectSlot(slot)} onToggle={() => { const startedAt = Date.now(); onToggleRegistration(slot.registration, !slot.registered); markNativeUiPerformanceAfterPaint('pokedex_detail_registration_result_painted', startedAt); }} saving={isSaving} selected={slot.id === selectedSlot?.id} slot={slot} />)}</View></View>)}
        </View> : null}

        {tab === 'info' ? <View style={styles.tabPanel}>
          <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Base stats</Text><View style={[styles.baseStatCard, themedInner, light && styles.softLight]}>{stats.slice(0, 3).map(([label, value]) => <BaseStatRow colors={colors} key={label} label={label} light={light} value={value} />)}</View><View style={[styles.cpCard, themedInner, light && styles.softLight]}><Text style={[styles.cpTitle, light && styles.textLight]}>Max CP</Text><View style={styles.cpValues}>{stats.slice(3).map(([label, value]) => <View key={label} style={[styles.cpValue, !light && { backgroundColor: `${colors[0]}22` }]}><Text style={[styles.cpLabel, light && styles.mutedLight]}>{label.replace('CP ', 'Level ')}</Text><Text style={[styles.cpNumber, { color: light ? colors[0] : colors[1] }]}>{formatValue(value, 0)}</Text></View>)}</View></View></View>
          {heroPokemon.sizes ? <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Size ranges</Text><View style={styles.sizeGrid}><SizeRangeCard assetBaseUrl={assetBaseUrl} average={heroPokemon.sizes.pokedex_weight} icon="/images/weight.png" light={light} thresholds={{ xxs: heroPokemon.sizes.weight_xxs_threshold, xs: heroPokemon.sizes.weight_xs_threshold, xl: heroPokemon.sizes.weight_xl_threshold, xxl: heroPokemon.sizes.weight_xxl_threshold }} title="Weight" unit="kg" /><SizeRangeCard assetBaseUrl={assetBaseUrl} average={heroPokemon.sizes.pokedex_height} icon="/images/height.png" light={light} thresholds={{ xxs: heroPokemon.sizes.height_xxs_threshold, xs: heroPokemon.sizes.height_xs_threshold, xl: heroPokemon.sizes.height_xl_threshold, xxl: heroPokemon.sizes.height_xxl_threshold }} title="Height" unit="m" /></View></View> : null}
          <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Evolution</Text><View style={styles.evolutionRail}>{evolutionPokemon.map((candidate, index) => { const candidateEntry = allEntries.find((possibleEntry) => possibleEntry.category === 'pokemon' && possibleEntry.pokemonId === candidate.pokemon_id); const imageUri = visibleGender === 'Female' ? candidateEntry?.femaleImageUri ?? candidateEntry?.imageUri : candidateEntry?.imageUri; return <View key={candidate.pokemon_id} style={styles.evolutionStep}>{index > 0 ? <Text style={[styles.evolutionArrow, light && styles.textLight]}>→</Text> : null}<View style={[styles.evolutionCard, themedInner, light && styles.softLight]}>{imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={styles.evolutionImage} /> : null}<Text style={[styles.evolutionName, light && styles.textLight]}>{candidate.name}</Text></View></View>; })}</View></View>
          <Pressable accessibilityRole="button" onPress={() => { beginPerformance('pokedex_detail_tab_result_painted'); setTab('more'); }} style={[styles.primary, { backgroundColor: colors[0] }]}><Text style={styles.primaryText}>See all {pokemon.name}</Text></Pressable>
        </View> : null}

        {tab === 'battle' ? <View style={styles.tabPanel}>
          <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Type effectiveness</Text><View style={styles.typePillRow}>{[heroPokemon.type1_name, heroPokemon.type2_name].filter((type): type is string => Boolean(type)).map((type) => <TypePill assetBaseUrl={assetBaseUrl} key={type} light={light} type={type} />)}</View><View style={[styles.effectivenessGroup, themedInner, light && styles.softLight]}><Text style={[styles.effectivenessTitle, light && styles.textLight]}>Resistant to</Text><View style={styles.typePillRow}>{typeEffectiveness.resistantTo.map((type) => <TypePill assetBaseUrl={assetBaseUrl} key={type} light={light} type={type} />)}</View></View><View style={[styles.effectivenessGroup, themedInner, light && styles.softLight]}><Text style={[styles.effectivenessTitle, light && styles.textLight]}>Weak to</Text><View style={styles.typePillRow}>{typeEffectiveness.weakTo.map((type) => <TypePill assetBaseUrl={assetBaseUrl} key={type} light={light} type={type} />)}</View></View></View>
          <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Fast attack</Text>{fastMoves.length > 0 ? fastMoves.map((move) => <MoveRow assetBaseUrl={assetBaseUrl} colors={colors} key={move.move_id} light={light} move={move} />) : <Text style={[styles.body, light && styles.mutedLight]}>No fast attack listed.</Text>}</View>
          <View style={[styles.cardSection, themedPanel, light && styles.cardLight]}><Text style={[styles.cardSectionTitle, light && styles.textLight]}>Charged attack</Text>{chargedMoves.length > 0 ? chargedMoves.map((move) => <MoveRow assetBaseUrl={assetBaseUrl} colors={colors} key={move.move_id} light={light} move={move} />) : <Text style={[styles.body, light && styles.mutedLight]}>No charged attack listed.</Text>}</View>
        </View> : null}

        {tab === 'more' ? <View style={styles.tabPanel}>
          <View style={[styles.comboHeader, themedPanel, light && styles.cardLight]}>{activeComboSection?.entries[0] ? <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, entryImageUri(activeComboSection.slot.entry, visibleGender, activeComboSection.slot.facets.purified)) ?? undefined }} style={styles.comboHeaderImage} /> : null}<View><Text style={[styles.sectionTitle, light && styles.textLight]}>Variant combinations</Text><Text style={[styles.body, { color: light ? colors[0] : colors[1] }]}>{activeComboSection ? `${activeComboSection.registeredCount} / ${activeComboSection.combinations.length}` : `${comboSections.length} variants`}</Text></View></View>
          <View style={styles.comboSections}>{comboSections.map((section) => {
            const imageUri = entryImageUri(section.slot.entry, visibleGender, section.slot.facets.purified);
            const isOpen = section.id === activeComboSection?.id;
            return <View key={section.id} style={styles.comboSection}>
              <Pressable accessibilityLabel={`Open combination group ${section.label}`} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => { beginPerformance('pokedex_detail_combo_section_painted'); setSelectedSlotId(section.slot.id); selectCombinationSection(comboSectionId === section.id ? null : section.id); }} style={[styles.comboSectionButton, !light && { borderColor: `${colors[0]}58`, backgroundColor: `${colors[0]}12` }, light && styles.cardLight, isOpen && { borderColor: colors[0], backgroundColor: `${colors[0]}2f` }, light && isOpen && styles.comboSectionButtonActiveLight]}>{imageUri ? <Image fadeDuration={0} source={{ uri: absoluteUri(assetBaseUrl, imageUri) ?? undefined }} style={styles.comboSectionImage} /> : null}<Text numberOfLines={2} style={[styles.comboSectionLabel, light && styles.textLight]}>{section.label}</Text><Text style={[styles.comboSectionCount, { color: light ? colors[0] : colors[1], borderColor: `${colors[1]}88`, backgroundColor: `${colors[0]}24` }]}>{section.registeredCount} / {section.combinations.length}</Text></Pressable>
              {isOpen ? <View style={styles.comboSectionBody}>
                <View style={[styles.comboControls, themedPanel, light && styles.cardLight]}>
                  <Text style={[styles.eyebrow, { color: light ? colors[0] : colors[1] }]}>SEARCH COMBINATIONS</Text>
                  <TextInput accessibilityLabel="Search combinations" autoCapitalize="none" onChangeText={(value) => { beginPerformance('pokedex_detail_combo_query_result_painted'); setComboQuery(value); }} placeholder="Search shiny, female, XXL, lucky, 100%…" placeholderTextColor={light ? '#64757d' : '#7f8e95'} style={[styles.comboSearch, !light && { borderColor: `${colors[0]}88` }, light && styles.comboSearchLight]} value={comboQuery} />
                  <View style={styles.comboStatusRow}><Text style={[styles.comboShowing, light && styles.mutedLight]}>Showing {filteredCombos.length} of {activeComboSection?.combinations.length ?? 0}</Text>{comboQuery || comboFilters.length > 0 ? <Pressable accessibilityRole="button" onPress={() => { setComboQuery(''); setComboFilters([]); }} style={styles.clearIndex}><Text style={styles.clearIndexText}>Clear</Text></Pressable> : null}</View>
                  <ScrollView accessibilityLabel="Combination filters" contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>{COMBO_FILTERS.map((filter) => <Pressable accessibilityLabel={`Filter ${filter.label}`} accessibilityRole="button" accessibilityState={{ selected: comboFilters.includes(filter.key) }} key={filter.key} onPress={() => { beginPerformance('pokedex_detail_combo_filter_result_painted'); setComboFilters((current) => toggleNativePokedexComboFilter(current, filter.key)); }} style={[styles.filterChip, !light && { borderColor: `${colors[0]}72` }, light && styles.filterChipLight, comboFilters.includes(filter.key) && { borderColor: colors[1], backgroundColor: colors[0] }]}><Text style={[styles.filterChipText, light && styles.textLight, comboFilters.includes(filter.key) && styles.filterChipTextActive]}>{filter.label}</Text></Pressable>)}</ScrollView>
                  <View accessibilityLabel="Shown combination actions" style={styles.bulkRow}><Pressable accessibilityRole="button" disabled={filteredCombos.length === 0 || isSaving} onPress={() => { beginPerformance('pokedex_detail_bulk_dialog_painted'); setBulkConfirmation({ action: 'register', registrations: filteredCombos.map(({ registration }) => registration), scope: 'combinations' }); }} style={[styles.bulkButton, { borderColor: colors[1], backgroundColor: colors[1] }, filteredCombos.length === 0 && styles.registrationToggleDisabled]}><Text style={styles.bulkRegisterTextThemed}>Register all</Text></Pressable><Pressable accessibilityRole="button" disabled={filteredCombos.length === 0 || isSaving} onPress={() => { beginPerformance('pokedex_detail_bulk_dialog_painted'); setBulkConfirmation({ action: 'unregister', registrations: filteredCombos.map(({ registration }) => registration), scope: 'combinations' }); }} style={[styles.bulkButton, styles.bulkRemove, filteredCombos.length === 0 && styles.registrationToggleDisabled]}><Text style={styles.bulkRemoveText}>Unregister all</Text></Pressable></View>
                </View>
                {filteredCombos.length > 0 ? <View style={styles.comboGrid}>{filteredCombos.map((combo) => <CombinationCard assetBaseUrl={assetBaseUrl} colors={colors} combo={combo} gender={visibleGender} key={combo.id} light={light} onToggle={() => { const startedAt = Date.now(); onToggleRegistration(combo.registration, !combo.registered); markNativeUiPerformanceAfterPaint('pokedex_detail_registration_result_painted', startedAt); }} saving={isSaving} />)}</View> : <View style={[styles.empty, themedPanel, light && styles.cardLight]}><Text style={[styles.body, light && styles.mutedLight]}>No combinations match this index.</Text></View>}
              </View> : null}
            </View>;
          })}</View>
        </View> : null}
      </ScrollView>
      <NativeConfirmationDialog
        body={bulkConfirmation?.scope === 'registered'
          ? bulkConfirmation.action === 'register'
            ? `This will mark all ${bulkConfirmation.registrations.length} entries in the Registered tab as registered in your Pokédex.`
            : `This removes only manual registrations from all ${bulkConfirmation.registrations.length} entries in the Registered tab. Your caught Pokémon stay unchanged.`
          : bulkConfirmation?.action === 'register'
            ? `This will mark all ${bulkConfirmation.registrations.length} shown combinations as registered in your Pokédex.`
            : `This removes only manual registrations from all ${bulkConfirmation?.registrations.length ?? 0} shown combinations. Your caught Pokémon stay unchanged.`}
        confirmLabel={bulkConfirmation?.action === 'register' ? 'Register all' : 'Unregister all'}
        isPending={isSaving}
        onCancel={() => setBulkConfirmation(null)}
        onConfirm={() => {
          if (!bulkConfirmation) return;
          const startedAt = Date.now();
          onSetRegistrations(bulkConfirmation.registrations, bulkConfirmation.action === 'register');
          markNativeUiPerformanceAfterPaint('pokedex_detail_registration_result_painted', startedAt);
          setBulkConfirmation(null);
        }}
        title={bulkConfirmation?.action === 'register' ? 'Register all entries?' : 'Unregister all entries?'}
        tone={bulkConfirmation?.action === 'unregister' ? 'danger' : 'default'}
        visible={Boolean(bulkConfirmation)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d12' }, rootLight: { backgroundColor: '#f8fff9' }, content: { gap: 12, paddingHorizontal: 12 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, backgroundColor: '#090d12' }, title: { color: '#fff', fontSize: 24, fontWeight: '900' }, textLight: { color: '#14232a' }, mutedLight: { color: '#586b74' }, cardLight: { borderColor: '#c2cdd3', backgroundColor: '#fff' }, softLight: { backgroundColor: '#eef4f7' }, darkIconLight: { tintColor: '#26363e' },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#43515a', borderRadius: 22, backgroundColor: '#171d22' }, backLight: { borderColor: '#c1ccd2', backgroundColor: '#fff' }, backPlaceholder: { width: 44, height: 44 }, topTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  hero: { minHeight: 336, alignItems: 'center', gap: 9, overflow: 'hidden', borderWidth: 1, borderColor: '#5c7180', borderRadius: 18, backgroundColor: '#153144' }, heroLight: { borderColor: '#a9bdc7', backgroundColor: '#fff' }, heroTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 14 }, dex: { color: '#fff', fontSize: 12, fontWeight: '900' }, heroVariant: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, imageStage: { width: 146, height: 138, alignItems: 'center', justifyContent: 'center' }, image: { width: '100%', height: '100%' }, maxIcon: { position: 'absolute', right: 0, top: 0, width: 38, height: 38, resizeMode: 'contain' }, heroTitle: { color: '#fff', fontSize: 27, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' }, traits: { minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7 }, gender: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', borderRadius: 18 }, genderMale: { backgroundColor: '#377ed7' }, genderFemale: { backgroundColor: '#e34b71' }, genderSelected: { borderColor: '#ffffff', shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 4, transform: [{ scale: 1.08 }] }, genderIcon: { width: 20, height: 20, tintColor: '#fff' }, genderless: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, typeChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: '#fff', borderRadius: 18, paddingHorizontal: 7, backgroundColor: '#ffffff33' }, type: { width: 22, height: 22 }, typeLabel: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, registrationPill: { width: '84%', maxWidth: 360, height: 54, flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderRadius: 13, backgroundColor: '#ffffff36' }, registrationPillCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, registrationPillDivider: { width: 1, height: 34, backgroundColor: '#ffffff66' }, registrationPillLabel: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, registrationPillValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: '#34424a', borderRadius: 14, backgroundColor: '#141a1f' }, tab: { position: 'relative', minHeight: 55, flex: 1, alignItems: 'center', justifyContent: 'center' }, tabText: { color: '#aeb9bf', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, tabDetail: { maxWidth: '90%', color: '#85939a', fontSize: 7, fontWeight: '800' }, tabTextActive: { color: '#fff' }, tabTextActiveLight: { color: '#14232a' }, tabIndicator: { position: 'absolute', right: '18%', bottom: 0, left: '18%', height: 4, borderRadius: 3 }, tabPanel: { gap: 14 },
  bulkRow: { flexDirection: 'row', gap: 8 }, bulkButton: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8 }, bulkRegister: { borderColor: '#31925f', backgroundColor: '#dff7e9' }, bulkRemove: { borderColor: '#ae4d5e', backgroundColor: '#55262d' }, bulkRegisterText: { color: '#1c7247', fontSize: 10, fontWeight: '900' }, bulkRegisterTextThemed: { color: '#15110a', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, bulkRemoveText: { color: '#ffd4da', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, slotSection: { gap: 9 }, slotSectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' }, variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, variantCard: { width: '23%', minHeight: 154, overflow: 'hidden', borderWidth: 1, borderColor: '#3b4850', borderRadius: 11, backgroundColor: '#10161a' }, variantCardMissing: { opacity: 0.72 }, variantCardRegistered: { borderColor: '#299cf5' }, variantCardSelected: { borderWidth: 2, borderColor: '#ffffff', opacity: 1 }, variantOpen: { flex: 1, alignItems: 'center', padding: 4 }, variantStage: { width: '100%', height: 96, alignItems: 'center', justifyContent: 'center' }, variantImage: { width: '92%', height: '86%' }, variantIcon: { position: 'absolute', left: 5, top: 5, width: 21, height: 21, resizeMode: 'contain' }, variantName: { minHeight: 28, color: '#fff', fontSize: 8.5, lineHeight: 11, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }, variantDate: { color: '#8e9ca3', fontSize: 7, fontWeight: '800', textTransform: 'uppercase' }, variantState: { color: '#8e9ca3', fontSize: 7, fontWeight: '800', textTransform: 'uppercase' }, variantStateLight: { color: '#52656a' }, variantStateRegistered: { color: '#299cf5' }, variantStateRegisteredLight: { color: '#005bb5' }, registrationToggle: { position: 'absolute', right: 4, top: 4, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14, backgroundColor: '#11171b' }, registrationToggleActive: { backgroundColor: '#b8445a' }, registrationToggleDisabled: { opacity: 0.42 }, registrationToggleText: { color: '#fff', fontSize: 17, fontWeight: '900' }, registrationToggleTextActive: { color: '#15110a' },
  cardSection: { gap: 12, borderWidth: 1, borderColor: '#34424a', borderRadius: 15, padding: 12, backgroundColor: '#171d21' }, cardSectionTitle: { color: '#fff', fontSize: 17, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }, eyebrow: { color: '#299cf5', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textTransform: 'uppercase' }, body: { color: '#b2bec5', fontSize: 12, lineHeight: 18 }, baseStatCard: { gap: 11, borderRadius: 12, padding: 12, backgroundColor: '#11171b' }, baseStatRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }, baseStatLabel: { width: 58, color: '#94a2aa', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, baseStatTrack: { minWidth: 0, height: 8, flex: 1, overflow: 'hidden', borderRadius: 4, backgroundColor: '#31363a' }, baseStatTrackLight: { backgroundColor: '#d8e0e4' }, baseStatValue: { width: 34, color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'right' }, cpCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, backgroundColor: '#11171b' }, cpTitle: { color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' }, cpValues: { minWidth: 0, flex: 1, flexDirection: 'row', gap: 8 }, cpValue: { flex: 1, alignItems: 'center', gap: 3, borderRadius: 9, padding: 8 }, cpLabel: { color: '#94a2aa', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, cpNumber: { fontSize: 18, fontWeight: '900' }, sizeGrid: { gap: 8 }, sizeCard: { gap: 8, borderRadius: 11, padding: 11, backgroundColor: '#11171b' }, sizeHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, sizeIcon: { width: 30, height: 30, resizeMode: 'contain' }, sizeTitle: { color: '#fff', fontSize: 14, fontWeight: '900' }, sizeValue: { color: '#9eabb2', fontSize: 10.5 }, sizeAverage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, padding: 8, backgroundColor: '#172127' }, sizeAverageValue: { color: '#fff', fontSize: 14, fontWeight: '900' }, sizeBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#2d3940', paddingTop: 7 }, sizeBandLabel: { minWidth: 52, color: '#fff', fontSize: 10, fontWeight: '900' }, evolutionRail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, evolutionStep: { flexDirection: 'row', alignItems: 'center', gap: 8 }, evolutionArrow: { color: '#fff', fontSize: 18, fontWeight: '900' }, evolutionCard: { width: 104, alignItems: 'center', borderRadius: 11, padding: 8, backgroundColor: '#11171b' }, evolutionImage: { width: 82, height: 82, resizeMode: 'contain' }, evolutionName: { color: '#fff', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  typePillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 }, typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#11171b' }, typePillIcon: { width: 22, height: 22 }, typePillLabel: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, effectivenessGroup: { gap: 10, borderRadius: 12, padding: 12, backgroundColor: '#11171b' }, effectivenessTitle: { marginTop: 4, color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }, moveRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, padding: 9, backgroundColor: '#11171b' }, moveType: { width: 30, height: 30 }, moveCopy: { minWidth: 0, flex: 1, gap: 5 }, moveName: { color: '#fff', fontSize: 12, fontWeight: '900' }, moveMeta: { color: '#8e9ba2', fontSize: 8.5 }, moveNumbers: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 4 }, movePower: { color: '#fff', fontSize: 14, fontWeight: '900' }, energyBars: { flexDirection: 'row', gap: 3 }, energyBar: { width: 18, height: 4, borderRadius: 2, backgroundColor: '#299cf5', transform: [{ skewX: '-16deg' }] },
  comboHeader: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#34424a', borderRadius: 15, padding: 11, backgroundColor: '#171d21' }, comboHeaderImage: { width: 62, height: 62, resizeMode: 'contain' }, comboSections: { gap: 8 }, comboSection: { gap: 8 }, comboSectionBody: { gap: 9, borderTopWidth: 1, borderTopColor: '#ffffff20', paddingTop: 9, paddingLeft: 6 }, comboSectionButton: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#34424a', borderRadius: 13, padding: 8, backgroundColor: '#171d21' }, comboSectionButtonActive: { borderColor: '#299cf5', backgroundColor: '#12314a' }, comboSectionButtonActiveLight: { backgroundColor: '#dcedf8' }, comboSectionImage: { width: 52, height: 52, resizeMode: 'contain' }, comboSectionLabel: { minWidth: 0, flex: 1, color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }, comboSectionCount: { overflow: 'hidden', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9, color: '#9ba7ad', fontSize: 9, fontWeight: '900' }, comboControls: { gap: 9, borderWidth: 1, borderColor: '#34424a', borderRadius: 15, padding: 10, backgroundColor: '#171d21' }, comboSearch: { minHeight: 46, borderWidth: 1, borderColor: '#4a5961', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#0f1519', color: '#fff', fontSize: 12, fontWeight: '800' }, comboSearchLight: { borderColor: '#aebdc5', backgroundColor: '#f7fafb', color: '#14232a' }, comboStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, comboShowing: { color: '#9ba7ad', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, clearIndex: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#176aa9' }, clearIndexText: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, filterRow: { gap: 7, paddingVertical: 2 }, filterChip: { minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#42515a', borderRadius: 18, paddingHorizontal: 11, backgroundColor: '#11171b' }, filterChipLight: { borderColor: '#b8c5cc', backgroundColor: '#eef4f7' }, filterChipActive: { borderColor: '#299cf5', backgroundColor: '#176aa9' }, filterChipText: { color: '#e8e8e8', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, filterChipTextActive: { color: '#fff' }, comboGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, comboCard: { width: '31.8%', minHeight: 158, alignItems: 'center', borderWidth: 1, borderColor: '#34424a', borderRadius: 11, padding: 5, backgroundColor: '#10161a' }, comboCardMissing: { opacity: 0.72 }, comboCardRegistered: { borderColor: '#299cf5', backgroundColor: '#12314a' }, comboCardRegisteredLight: { backgroundColor: '#dcedf8' }, comboStage: { width: '100%', height: 100, alignItems: 'center', justifyContent: 'center' }, comboImage: { width: '90%', height: '90%' }, comboBadges: { position: 'absolute', top: 1, left: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 2, maxWidth: '70%' }, comboBadge: { width: 17, height: 17, resizeMode: 'contain' }, comboLabel: { minHeight: 29, color: '#fff', fontSize: 8.5, lineHeight: 11, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }, comboState: { color: '#8e9ca3', fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }, empty: { alignItems: 'center', borderWidth: 1, borderColor: '#34424a', borderStyle: 'dashed', borderRadius: 14, padding: 22, backgroundColor: '#171d21' },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 18, backgroundColor: '#168ced' }, primaryText: { color: '#fff', fontWeight: '900' }, saving: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, padding: 10, backgroundColor: '#152a39' }, savingText: { color: '#aebac0', fontSize: 10, fontWeight: '800' }, error: { borderWidth: 1, borderColor: '#df5770', borderRadius: 10, padding: 10, backgroundColor: '#39151e' }, errorText: { color: '#ffc2cc', fontSize: 11, fontWeight: '800' },
});
