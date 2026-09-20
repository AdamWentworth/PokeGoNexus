import {
  TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
  TRADE_PREFERENCE_QUALITY_RULE_KEYS,
  type TradePreferenceFilters,
  type TradePreferenceRuleKey,
} from '@pokemongonexus/shared-domain/trade-preferences';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  NativeTradePreferencePokemonCard,
} from '../features/trades/NativeTradePreferencePokemonCard';
import {
  resolveNativeTradePreferenceDraftCandidates,
  type NativeTradePreferenceEntry,
  type NativeTradePreferenceMode,
} from '../features/trades/nativeTradePreferencesModel';
import { useNativeModalAnimation } from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

export type NativeTradePreferenceDraft = {
  filters: TradePreferenceFilters;
  manuallyExcludedIds: string[];
  mirror: boolean;
};

type Props = {
  assetBaseUrl: string;
  entries: Record<NativeTradePreferenceMode, NativeTradePreferenceEntry[]>;
  error?: string | null;
  initialEntryId?: string | null;
  initialMode?: NativeTradePreferenceMode;
  isLoading?: boolean;
  onOpenActivity: () => void;
  pageHeader?: ReactNode;
  onSave: (
    entry: NativeTradePreferenceEntry,
    draft: NativeTradePreferenceDraft,
  ) => Promise<void>;
  showModeTabs?: boolean;
};

const RULES: Record<TradePreferenceRuleKey, { image: string; label: string }> = {
  communityDayFilter: { image: '/images/community_day.png', label: 'Community Day' },
  researchDayFilter: { image: '/images/field_research.png', label: 'Research Day' },
  raidDayFilter: { image: '/images/raid_day.png', label: 'Raid Day' },
  legendaryMythicalUltraBeastRaidFilter: {
    image: '/images/legendary_raid.png',
    label: 'Legendary raid',
  },
  megaRaidFilter: { image: '/images/mega_raid.png', label: 'Mega raid' },
  permaboostedFilter: { image: '/images/permaboosted.png', label: 'Permaboosted' },
  shinyIconFilter: { image: '/images/shiny_icon.png', label: 'Shiny' },
  costumeIconFilter: { image: '/images/costume_icon.png', label: 'Costume' },
  legendaryIconFilter: { image: '/images/legendary.png', label: 'Legendary' },
  regionalIconFilter: { image: '/images/regional.png', label: 'Regional' },
  locationIconFilter: { image: '/images/location.png', label: 'Location card' },
};

const tone = (mode: NativeTradePreferenceMode, light = false) => mode === 'trade'
  ? {
      accent: light ? '#087454' : '#37bf78',
      soft: light ? 'rgba(8,116,84,0.12)' : 'rgba(55,191,120,0.16)',
      label: 'For Trade',
    }
  : {
      accent: light ? '#b0003b' : '#ef5d72',
      soft: light ? 'rgba(176,0,59,0.10)' : 'rgba(239,93,114,0.16)',
      label: 'Wanted',
    };

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const initialManualExclusions = (entry: NativeTradePreferenceEntry): Set<string> => new Set(
  entry.candidates.filter((candidate) => candidate.manuallyExcluded).map(
    (candidate) => candidate.collectionKey,
  ),
);

const filtersEqual = (
  left: TradePreferenceFilters,
  right: TradePreferenceFilters,
): boolean => Object.keys(RULES).every((key) => (
  Boolean(left[key as TradePreferenceRuleKey]) === Boolean(right[key as TradePreferenceRuleKey])
));

const EntrySummary = ({
  assetBaseUrl,
  compact = false,
  entry,
  light,
  mode,
  onPress,
  selected = false,
}: {
  assetBaseUrl: string;
  compact?: boolean;
  entry: NativeTradePreferenceEntry;
  light: boolean;
  mode: NativeTradePreferenceMode;
  onPress: () => void;
  selected?: boolean;
}) => {
  const colors = tone(mode, light);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.entrySummary,
        compact && styles.entrySummaryCompact,
        light && styles.surfaceLight,
        selected && !compact && { borderColor: colors.accent, backgroundColor: colors.soft },
        compact && { borderColor: colors.accent },
      ]}
      testID={`preference-entry-${entry.collectionKey}`}
    >
      <View style={styles.entryImageStage}>
        {entry.row.imageUri ? (
          <Image fadeDuration={0} resizeMode="contain" source={{ uri: entry.row.imageUri }} style={styles.entryImage} />
        ) : null}
        {entry.row.maxKind ? (
          <Image fadeDuration={0}
            accessibilityLabel={entry.row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, `/images/${entry.row.maxKind}.png`) }}
            style={styles.entryMaxBadge}
          />
        ) : null}
      </View>
      <View style={styles.entryCopy}>
        {!compact ? (
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {mode === 'trade' ? 'TRADING AWAY' : 'LOOKING FOR'}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={[styles.entryName, light && styles.textLight]}>
          {entry.displayName ?? entry.row.name}
        </Text>
        <Text style={[styles.entryMeta, light && styles.secondaryLight]}>
          #{String(entry.row.pokedexNumber).padStart(4, '0')}
          {entry.nickname ? ` · ${entry.nickname}` : ''}
          {!compact ? ` · ${entry.allowedCount} ${mode === 'trade' ? 'targets' : 'offers'}` : ''}
        </Text>
      </View>
      <Text style={[compact ? styles.changeLabel : styles.chevron, { color: colors.accent }]}>
        {compact ? 'Change' : '›'}
      </Text>
    </Pressable>
  );
};

const RuleGroup = ({
  assetBaseUrl,
  disabled,
  filters,
  keys,
  light,
  onToggle,
  title,
  description,
  accent,
}: {
  assetBaseUrl: string;
  disabled: boolean;
  filters: TradePreferenceFilters;
  keys: readonly TradePreferenceRuleKey[];
  light: boolean;
  onToggle: (key: TradePreferenceRuleKey) => void;
  title: string;
  description: string;
  accent: string;
}) => (
  <View style={[styles.ruleGroup, light && styles.surfaceLight]}>
    <View style={styles.ruleHeader}>
      <View style={styles.ruleHeaderCopy}>
        <Text style={[styles.ruleTitle, light && styles.textLight]}>{title}</Text>
        <Text style={[styles.ruleDescription, light && styles.secondaryLight]}>{description}</Text>
      </View>
      <Text style={[styles.ruleCount, { color: accent }]}>
        {keys.filter((key) => filters[key]).length} selected
      </Text>
    </View>
    <View style={styles.ruleOptions}>
      {keys.map((key) => {
        const selected = filters[key] === true;
        return (
          <Pressable
            aria-checked={selected}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={key}
            onPress={() => onToggle(key)}
            style={[
              styles.ruleOption,
              light && styles.ruleOptionLight,
              selected && { borderColor: accent, backgroundColor: `${accent}22` },
              disabled && styles.disabled,
            ]}
            testID={`trade-preference-rule-${key}`}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, RULES[key].image) }}
              style={styles.ruleImage}
            />
            <Text numberOfLines={2} style={[styles.ruleLabel, light && styles.textLight]}>
              {RULES[key].label}
            </Text>
            <Text style={[styles.ruleMark, selected && { color: accent }]}>{selected ? '✓' : '+'}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

export const NativeTradePreferencesScreen = ({
  assetBaseUrl,
  entries,
  error = null,
  initialEntryId = null,
  initialMode = 'trade',
  isLoading = false,
  onOpenActivity,
  pageHeader = null,
  onSave,
  showModeTabs = true,
}: Props) => {
  const { width } = useWindowDimensions();
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const fadeAnimation = useNativeModalAnimation('fade');
  const desktop = width >= 760;
  const initialEntry = entries[initialMode].find(
    (entry) => entry.collectionKey === initialEntryId,
  ) ?? entries[initialMode][0] ?? null;
  const [mode, setMode] = useState<NativeTradePreferenceMode>(initialMode);
  const [selectedKeys, setSelectedKeys] = useState<Record<NativeTradePreferenceMode, string | null>>({
    trade: initialMode === 'trade' && initialEntry
      ? initialEntry.collectionKey
      : entries.trade[0]?.collectionKey ?? null,
    wanted: initialMode === 'wanted' && initialEntry
      ? initialEntry.collectionKey
      : entries.wanted[0]?.collectionKey ?? null,
  });
  const [editing, setEditing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAllowedOnly, setShowAllowedOnly] = useState(false);
  const [filters, setFilters] = useState<TradePreferenceFilters>(initialEntry?.filters ?? {});
  const [manualExclusions, setManualExclusions] = useState<Set<string>>(
    initialEntry ? initialManualExclusions(initialEntry) : new Set(),
  );
  const [mirror, setMirror] = useState(initialEntry?.mirror ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingNavigation = useRef<null | (() => void)>(null);
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
  const currentEntries = entries[mode];
  const selectedEntry = currentEntries.find(
    (entry) => entry.collectionKey === selectedKeys[mode],
  ) ?? currentEntries[0] ?? null;
  const deferredFilters = useDeferredValue(filters);
  const deferredMirror = useDeferredValue(mirror);
  const deferredQuery = useDeferredValue(query);
  const deferredSelectedEntry = useDeferredValue(selectedEntry);
  const colors = tone(mode, light);

  const resetDraft = (entry: NativeTradePreferenceEntry | null) => {
    setFilters(entry?.filters ?? {});
    setManualExclusions(entry ? initialManualExclusions(entry) : new Set());
    setMirror(entry?.mirror ?? false);
    setQuery('');
    setShowAllowedOnly(false);
    setAdvancedOpen(Boolean(entry?.activeRuleCount || entry?.mirror));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const selectedEntrySignature = selectedEntry
    ? [
        selectedEntry.collectionKey,
        selectedEntry.instance.last_update,
        selectedEntry.mirror,
        JSON.stringify(selectedEntry.filters),
        [...initialManualExclusions(selectedEntry)].sort().join('|'),
      ].join(':')
    : '';
  const synchronizedEntryRef = useRef(initialEntry ? selectedEntrySignature : '');
  useEffect(() => {
    if (editing || !selectedEntry || synchronizedEntryRef.current === selectedEntrySignature) {
      return;
    }
    synchronizedEntryRef.current = selectedEntrySignature;
    setSelectedKeys((current) => current[mode]
      ? current
      : { ...current, [mode]: selectedEntry.collectionKey });
    setFilters(selectedEntry.filters);
    setManualExclusions(initialManualExclusions(selectedEntry));
    setMirror(selectedEntry.mirror);
    setAdvancedOpen(Boolean(selectedEntry.activeRuleCount || selectedEntry.mirror));
    setQuery('');
    setShowAllowedOnly(false);
    setSaveError(null);
  }, [editing, mode, selectedEntry, selectedEntrySignature]);

  const dirty = Boolean(selectedEntry && (
    !filtersEqual(filters, selectedEntry.filters)
    || mirror !== selectedEntry.mirror
    || [...initialManualExclusions(selectedEntry)].sort().join('|')
      !== [...manualExclusions].sort().join('|')
  ));

  const requestChange = (change: () => void) => {
    if (editing && dirty) {
      beginPerformance('trade_preferences_discard_dialog_painted');
      pendingNavigation.current = change;
      setDiscardOpen(true);
      return;
    }
    change();
  };

  const draftCandidates = useMemo(() => deferredSelectedEntry
    ? resolveNativeTradePreferenceDraftCandidates({
        entry: deferredSelectedEntry,
        filters: deferredFilters,
        manuallyExcludedIds: manualExclusions,
        mirror: deferredMirror,
      })
    : [], [deferredFilters, deferredMirror, deferredSelectedEntry, manualExclusions]);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const visibleCandidates = useMemo(() => draftCandidates.filter((candidate) => {
    if (!editing && !candidate.allowed) return false;
    if (editing && showAllowedOnly && !candidate.allowed) return false;
    if (!normalizedQuery) return true;
    return (candidate.displayName ?? candidate.row.name).toLocaleLowerCase().includes(normalizedQuery)
      || candidate.row.name.toLocaleLowerCase().includes(normalizedQuery)
      || String(candidate.row.pokedexNumber).includes(normalizedQuery);
  }), [draftCandidates, editing, normalizedQuery, showAllowedOnly]);
  const allowedCount = useMemo(
    () => draftCandidates.filter((candidate) => candidate.allowed).length,
    [draftCandidates],
  );
  const activeRuleCount = Object.keys(RULES).filter(
    (key) => filters[key as TradePreferenceRuleKey],
  ).length;
  const requireKeys = mode === 'trade'
    ? TRADE_PREFERENCE_QUALITY_RULE_KEYS
    : TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS;
  const excludeKeys = mode === 'trade'
    ? TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS
    : TRADE_PREFERENCE_QUALITY_RULE_KEYS;
  const horizontalPadding = desktop ? 18 : 12;
  const contentWidth = desktop ? Math.min(width - 318, 820) : width;
  const gridWidth = contentWidth - horizontalPadding * 2;
  const columns = desktop && gridWidth >= 640 ? 4 : 3;
  const gap = 8;
  const cardWidth = Math.max(92, (gridWidth - gap * (columns - 1)) / columns);

  useEffect(() => finishPerformance('trade_preferences_mode_result_painted'), [finishPerformance, mode]);
  useEffect(() => finishPerformance('trade_preferences_selection_result_painted'), [finishPerformance, selectedEntry]);
  useEffect(() => finishPerformance('trade_preferences_edit_result_painted'), [editing, finishPerformance]);
  useEffect(() => finishPerformance('trade_preferences_rules_result_painted'), [advancedOpen, finishPerformance]);
  useEffect(() => finishPerformance('trade_preferences_rule_result_painted'), [filters, finishPerformance, mirror]);
  useEffect(() => finishPerformance('trade_preferences_candidate_result_painted'), [finishPerformance, manualExclusions, showAllowedOnly, visibleCandidates]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance('trade_preferences_query_result_painted');
  }, [deferredQuery, finishPerformance, query, visibleCandidates]);
  useEffect(() => {
    if (discardOpen) finishPerformance('trade_preferences_discard_dialog_painted');
  }, [discardOpen, finishPerformance]);

  const chooseMode = (nextMode: NativeTradePreferenceMode) => {
    beginPerformance('trade_preferences_mode_result_painted');
    requestChange(() => {
      const nextEntry = entries[nextMode].find(
        (entry) => entry.collectionKey === selectedKeys[nextMode],
      ) ?? entries[nextMode][0] ?? null;
      resetDraft(nextEntry);
      setMode(nextMode);
      setEditing(false);
    });
  };
  const chooseEntry = (collectionKey: string) => {
    beginPerformance('trade_preferences_selection_result_painted');
    requestChange(() => {
      const nextEntry = currentEntries.find((entry) => entry.collectionKey === collectionKey) ?? null;
      resetDraft(nextEntry);
      setSelectedKeys((current) => ({ ...current, [mode]: collectionKey }));
      setPickerOpen(false);
      setEditing(false);
    });
  };

  const saveDraft = async () => {
    if (!selectedEntry || saving) return;
    beginPerformance('trade_preferences_save_result_painted');
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave(selectedEntry, {
        filters,
        manuallyExcludedIds: [...manualExclusions],
        mirror,
      });
      setEditing(false);
      setSaveSuccess(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save trade preferences.');
    } finally {
      setSaving(false);
      finishPerformance('trade_preferences_save_result_painted');
    }
  };

  const workspaceHeader = (
    <>
      <View style={styles.heading}>
        <Text style={[styles.pageTitle, light && styles.textLight]}>Trade Preferences</Text>
        <Text style={[styles.pageDescription, light && styles.secondaryLight]}>
          Choose acceptable matches for each For Trade and Wanted Pokémon.
        </Text>
      </View>
      <View accessibilityRole="tablist" style={[styles.modeTabs, light && styles.modeTabsLight]}>
        {(['trade', 'wanted'] as const).map((option) => {
          const optionTone = tone(option, light);
          const active = mode === option;
          return (
            <Pressable
              aria-selected={active}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={option}
              onPress={() => chooseMode(option)}
              style={[
                styles.modeTab,
                active && { backgroundColor: optionTone.soft, borderColor: optionTone.accent },
              ]}
            >
              <Text style={[styles.modeTabLabel, light && styles.modeTabLabelLight, active && { color: optionTone.accent }]}>
                {`${optionTone.label} (${entries[option].length})`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const editorHeader = selectedEntry ? (
    <View>
      {!desktop ? (
        <EntrySummary
          assetBaseUrl={assetBaseUrl}
          compact
          entry={selectedEntry}
          light={light}
          mode={mode}
          onPress={() => {
            const startedAt = Date.now();
            setPickerOpen(true);
            markNativeUiPerformanceAfterPaint('trade_preferences_picker_painted', startedAt);
          }}
          selected
        />
      ) : null}
      {desktop ? (
        <View style={styles.editorTitleRow}>
          <View style={styles.editorTitleCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {mode === 'trade' ? 'DESIRED RETURN' : 'WANTED PREFERENCES'}
            </Text>
            <Text style={[styles.editorTitle, light && styles.textLight]}>
              {mode === 'trade' ? 'Wanted Pokémon' : 'For Trade Pokémon'}
            </Text>
            <Text style={[styles.editorDescription, light && styles.secondaryLight]}>
              {mode === 'trade'
                ? 'Choose the Pokémon you would accept for this listing.'
                : 'Choose which of your For Trade Pokémon can be offered for this wanted entry.'}
            </Text>
          </View>
          {editing ? (
            <View style={[styles.editingChip, { backgroundColor: colors.soft }]}>
              <Text style={[styles.editingChipText, { color: colors.accent }]}>EDITING</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                beginPerformance('trade_preferences_edit_result_painted');
                setSaveSuccess(false);
                setEditing(true);
              }}
              style={[styles.editButton, { borderColor: colors.accent, backgroundColor: colors.soft }]}
              testID="trade-preferences-edit"
            >
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: toAssetUrl(assetBaseUrl, '/images/edit-icon.png') }}
                style={[styles.editButtonIcon, { tintColor: colors.accent }]}
              />
              <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit preferences</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {saveError || error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>SOMETHING WENT WRONG</Text>
          <Text style={styles.errorText}>{saveError ?? error}</Text>
        </View>
      ) : null}

      <View style={!desktop && !editing ? [
        styles.mobileAdvancedRow,
        advancedOpen && styles.mobileAdvancedRowExpanded,
      ] : undefined}>
        <View style={[styles.advanced, !desktop && !editing && styles.mobileAdvanced, light && styles.surfaceLight]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => {
              beginPerformance('trade_preferences_rules_result_painted');
              setAdvancedOpen((open) => !open);
            }}
            style={styles.advancedToggle}
          >
            <View>
              <Text style={[styles.advancedLabel, { color: colors.accent }]}>ADVANCED MATCHING RULES</Text>
              <Text style={[styles.advancedValue, light && styles.textLight]}>
                {mirror ? 'Mirror trade enabled' : activeRuleCount ? `${activeRuleCount} active ${activeRuleCount === 1 ? 'rule' : 'rules'}` : 'No additional rules'}
              </Text>
            </View>
            <Text style={[styles.advancedMark, light && styles.textLight]}>{advancedOpen ? '−' : '+'}</Text>
          </Pressable>
          {advancedOpen ? (
            <View style={styles.ruleGroups}>
            {mode === 'trade' ? (
              <Pressable
                aria-checked={mirror}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: mirror, disabled: !editing }}
                disabled={!editing}
                onPress={() => {
                  beginPerformance('trade_preferences_rule_result_painted');
                  setMirror((value) => !value);
                }}
                style={[
                  styles.mirrorRule,
                  light && styles.ruleOptionLight,
                  mirror && { borderColor: colors.accent, backgroundColor: colors.soft },
                  !editing && styles.disabled,
                ]}
              >
                <Image fadeDuration={0}
                  resizeMode="contain"
                  source={{ uri: toAssetUrl(assetBaseUrl, '/images/mirror.png') }}
                  style={styles.mirrorImage}
                />
                <View style={styles.mirrorCopy}>
                  <Text style={[styles.ruleTitle, light && styles.textLight]}>Mirror trade</Text>
                  <Text style={[styles.ruleDescription, light && styles.secondaryLight]}>
                    Only match this Pokémon with another copy of the same Pokémon.
                  </Text>
                </View>
                <Text style={[styles.ruleMark, mirror && { color: colors.accent }]}>{mirror ? '✓' : '+'}</Text>
              </Pressable>
            ) : null}
            {!mirror ? (
              <>
                <RuleGroup
                  accent={colors.accent}
                  assetBaseUrl={assetBaseUrl}
                  description={mode === 'trade'
                    ? 'Only consider wanted Pokémon with these qualities.'
                    : 'Only consider your offers from these encounter groups.'}
                  disabled={!editing}
                  filters={filters}
                  keys={requireKeys}
                  light={light}
                  onToggle={(key) => {
                    beginPerformance('trade_preferences_rule_result_painted');
                    setFilters((current) => ({ ...current, [key]: !current[key] }));
                  }}
                  title="Must match"
                />
                <RuleGroup
                  accent={colors.accent}
                  assetBaseUrl={assetBaseUrl}
                  description={mode === 'trade'
                    ? 'Remove Pokémon from these common shiny sources.'
                    : 'Remove offers with these qualities.'}
                  disabled={!editing}
                  filters={filters}
                  keys={excludeKeys}
                  light={light}
                  onToggle={(key) => {
                    beginPerformance('trade_preferences_rule_result_painted');
                    setFilters((current) => ({ ...current, [key]: !current[key] }));
                  }}
                  title="Leave out"
                />
              </>
            ) : null}
            </View>
          ) : null}
        </View>
        {!desktop && !editing ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              beginPerformance('trade_preferences_edit_result_painted');
              setSaveSuccess(false);
              setEditing(true);
            }}
            style={[
              styles.editButton,
              styles.mobileEditButton,
              advancedOpen && styles.mobileEditButtonExpanded,
              { borderColor: colors.accent, backgroundColor: colors.soft },
            ]}
            testID="trade-preferences-edit"
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, '/images/edit-icon.png') }}
              style={[styles.editButtonIcon, { tintColor: colors.accent }]}
            />
            <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit preferences</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.listHeadingRow}>
        <View>
          <Text style={[styles.listHeading, { color: colors.accent }]}>
            {mode === 'trade' ? 'WANTED POKÉMON' : 'FOR TRADE POKÉMON'}
          </Text>
          <Text style={[styles.listCount, light && styles.secondaryLight]}>
            {allowedCount} {mode === 'trade' ? 'wanted' : 'available'} · {activeRuleCount === 0
              ? 'no advanced rules'
              : `${activeRuleCount} advanced ${activeRuleCount === 1 ? 'rule' : 'rules'}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !editing }}
          disabled={!editing}
          onPress={() => resetDraft(selectedEntry)}
          style={[
            styles.compactButton,
            light && styles.compactButtonLight,
            !editing && styles.disabled,
          ]}
        >
          <Text style={[styles.compactButtonText, light && styles.textLight]}>↶ Reset</Text>
        </Pressable>
      </View>

      <View style={styles.editTools}>
        <TextInput
          accessibilityLabel="Search preference Pokémon"
          onChangeText={(value) => {
            beginPerformance('trade_preferences_query_result_painted');
            setQuery(value);
          }}
          placeholder="Search Pokémon"
          placeholderTextColor={light ? '#718087' : '#809398'}
          style={[styles.search, light && styles.searchLight]}
          value={query}
        />
        {editing ? (
          <View style={styles.toolButtons}>
            <Pressable accessibilityRole="button"
              onPress={() => {
                beginPerformance('trade_preferences_candidate_result_painted');
                setShowAllowedOnly((value) => !value);
              }}
              style={[styles.toolButton, showAllowedOnly && { borderColor: colors.accent }]}
            >
              <Text style={[styles.toolButtonText, light && styles.textLight]}>Allowed only</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={() => {
                beginPerformance('trade_preferences_candidate_result_painted');
                setManualExclusions(new Set());
              }}
              style={styles.toolButton}
            >
              <Text style={[styles.toolButtonText, light && styles.textLight]}>Allow all</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={() => {
                beginPerformance('trade_preferences_candidate_result_painted');
                setManualExclusions(new Set(
                  draftCandidates.filter((candidate) => !candidate.excludedByRule).map(
                    (candidate) => candidate.collectionKey,
                  ),
                ));
              }}
              style={styles.toolButton}
            >
              <Text style={[styles.toolButtonText, light && styles.textLight]}>Clear all</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  ) : null;

  const topTabs = showModeTabs ? (
    <View accessibilityRole="tablist" style={[styles.topTabs, light && styles.topTabsLight]}>
      <Pressable aria-selected accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.topTab}>
        <Text style={[styles.topTabText, light && styles.textLight]}>Trade Preferences</Text>
      </Pressable>
      <Pressable aria-selected={false} accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={onOpenActivity} style={[styles.topTab, styles.topTabInactive]}>
        <Text style={[styles.topTabText, styles.topTabInactiveText, light && styles.secondaryLight]}>Trade Activity</Text>
      </Pressable>
    </View>
  ) : null;

  const saveFeedback = saveSuccess && !editing ? (
    <View accessibilityLiveRegion="polite" style={styles.saveSuccess} testID="trade-preferences-save-success">
      <Text style={styles.saveSuccessMark}>✓</Text>
      <Text style={styles.saveSuccessText}>Preferences saved.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss saved message" onPress={() => setSaveSuccess(false)}>
        <Text style={styles.saveSuccessDismiss}>×</Text>
      </Pressable>
    </View>
  ) : null;

  const editActions = editing && selectedEntry ? (
    <View style={[styles.editActions, light && styles.editActionsLight]}>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => {
          resetDraft(selectedEntry);
          setEditing(false);
        }}
        style={[styles.stickyCancel, saving && styles.disabled]}
      >
        <Text style={[styles.stickyCancelText, light && styles.textLight]}>Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void saveDraft()}
        style={[styles.stickySave, { backgroundColor: colors.accent }, saving && styles.disabled]}
        testID="trade-preferences-save"
      >
        <Text style={styles.stickySaveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </View>
  ) : null;

  const candidateList = (
    <FlatList
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      contentContainerStyle={[
        styles.editorContent,
        { paddingHorizontal: horizontalPadding, paddingBottom: 150 + insets.bottom },
      ]}
      data={isLoading || !selectedEntry ? [] : visibleCandidates}
      key={`${mode}:${columns}`}
      keyExtractor={(candidate) => candidate.collectionKey}
      keyboardShouldPersistTaps="always"
      ListEmptyComponent={isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#31cfd1" size="large" />
          <Text style={[styles.emptyTitle, light && styles.textLight]}>Loading trade preferences</Text>
          <Text style={[styles.emptyBody, light && styles.secondaryLight]}>
            Reading your For Trade and Wanted Pokémon…
          </Text>
        </View>
      ) : !selectedEntry ? (
        <View style={styles.noListings}>
          <Text style={[styles.emptyTitle, light && styles.textLight]}>
            No {colors.label} Pokémon yet
          </Text>
          <Text style={[styles.emptyBody, light && styles.secondaryLight]}>
            Add Pokémon to {colors.label} from your collection before setting preferences.
          </Text>
        </View>
      ) : (
        <View style={[styles.empty, light && styles.surfaceLight]}>
          <Text style={[styles.emptyTitle, light && styles.textLight]}>
            {query ? 'No Pokémon match this search' : 'No Pokémon available'}
          </Text>
          <Text style={[styles.emptyBody, light && styles.secondaryLight]}>
            {editing
              ? 'Adjust the matching rules or allow another Pokémon.'
              : 'Edit preferences to change which Pokémon appear here.'}
          </Text>
        </View>
      )}
      ListHeaderComponent={(
        <>
          {!desktop ? pageHeader : null}
          {!desktop ? topTabs : null}
          {!desktop ? workspaceHeader : null}
          {editorHeader}
        </>
      )}
      ListFooterComponent={!desktop ? (
        <>
          {saveFeedback}
          {editActions}
        </>
      ) : null}
      numColumns={columns}
      nestedScrollEnabled
      renderItem={({ item }) => (
        <NativeTradePreferencePokemonCard
          assetBaseUrl={assetBaseUrl}
          candidate={item}
          editing={editing}
          light={light}
          onPress={() => {
            beginPerformance('trade_preferences_candidate_result_painted');
            setManualExclusions((current) => {
              const next = new Set(current);
              if (next.has(item.collectionKey)) next.delete(item.collectionKey);
              else next.add(item.collectionKey);
              return next;
            });
          }}
          tone={mode}
          width={cardWidth}
        />
      )}
      showsVerticalScrollIndicator={false}
      style={styles.editorList}
    />
  );

  return (
    <View style={[styles.safe, light && styles.safeLight]} testID="native-trade-preferences-screen">
      {desktop ? pageHeader : null}
      {desktop ? topTabs : null}
      {desktop ? workspaceHeader : null}
      <View style={styles.workspace}>
        {desktop ? (
          <ScrollView contentContainerStyle={styles.entryRail} keyboardShouldPersistTaps="always" nestedScrollEnabled style={[styles.entryRailViewport, light && styles.railLight]}>
            <Text style={[styles.railHeading, { color: colors.accent }]}>{colors.label.toLocaleUpperCase()}</Text>
            {currentEntries.map((entry) => (
              <EntrySummary
                assetBaseUrl={assetBaseUrl}
                entry={entry}
                key={entry.collectionKey}
                light={light}
                mode={mode}
                onPress={() => chooseEntry(entry.collectionKey)}
                selected={entry.collectionKey === selectedEntry?.collectionKey}
              />
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.editorPane, desktop && styles.editorPaneDesktop]}>{candidateList}</View>
      </View>
      {desktop ? saveFeedback : null}
      {desktop ? editActions : null}

      <Modal animationType="none" onRequestClose={() => setPickerOpen(false)} visible={pickerOpen}>
        <SafeAreaView style={[styles.picker, light && styles.safeLight]}>
          <View style={[styles.pickerHeader, light && styles.pickerHeaderLight]}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>SELECT A LISTING</Text>
              <Text style={[styles.pickerTitle, light && styles.textLight]}>{colors.label} Pokémon</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close listing picker" onPress={() => setPickerOpen(false)} style={styles.close} testID="trade-preference-picker-close">
              <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.pickerList}
            data={currentEntries}
            keyExtractor={(entry) => entry.collectionKey}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            renderItem={({ item }) => (
              <EntrySummary
                assetBaseUrl={assetBaseUrl}
                entry={item}
                light={light}
                mode={mode}
                onPress={() => chooseEntry(item.collectionKey)}
                selected={item.collectionKey === selectedEntry?.collectionKey}
              />
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal animationType={fadeAnimation} onRequestClose={() => setDiscardOpen(false)} transparent visible={discardOpen}>
        <View style={styles.modalScrim}>
          <View style={[styles.confirm, light && styles.confirmLight]}>
            <Text style={[styles.confirmEyebrow, { color: colors.accent }]}>UNSAVED PREFERENCES</Text>
            <Text style={[styles.confirmTitle, light && styles.textLight]}>Discard your changes?</Text>
            <Text style={[styles.confirmBody, light && styles.secondaryLight]}>
              Your current changes have not been saved.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" onPress={() => setDiscardOpen(false)} style={styles.cancelButton}>
                <Text style={[styles.cancelText, light && styles.textLight]}>Keep editing</Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                onPress={() => {
                  setDiscardOpen(false);
                  resetDraft(selectedEntry);
                  setEditing(false);
                  pendingNavigation.current?.();
                  pendingNavigation.current = null;
                }}
                style={[styles.discardButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.discardText}>Discard changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071012' },
  safeLight: { backgroundColor: '#f8fff9' },
  topTabs: {
    marginHorizontal: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#24464b',
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    backgroundColor: '#0b1618',
  },
  topTabsLight: { backgroundColor: '#fff' },
  topTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#31cfd1' },
  topTabInactive: { backgroundColor: 'transparent' },
  topTabText: { color: '#071012', fontSize: 14, fontWeight: '900' },
  topTabInactiveText: { color: '#a7b4b6' },
  heading: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 18 },
  pageTitle: { color: '#f5fafb', fontSize: 32, lineHeight: 37, fontWeight: '900' },
  pageDescription: { marginTop: 5, color: '#9db0b4', fontSize: 14, lineHeight: 19, textAlign: 'center', maxWidth: 520 },
  textLight: { color: '#122328' },
  secondaryLight: { color: '#52656a' },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    margin: 10,
    marginTop: 20,
    marginBottom: 29,
    padding: 4,
    backgroundColor: '#0b1618',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#213a3f',
  },
  modeTabsLight: { backgroundColor: '#fff' },
  modeTab: { flex: 1, minHeight: 45, borderRadius: 9, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modeTabLabel: { color: '#a8b5b7', fontSize: 14, fontWeight: '900' },
  modeTabLabelLight: { color: '#566467' },
  modeCount: { minWidth: 23, height: 23, borderRadius: 12, backgroundColor: '#243337', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  modeCountText: { color: '#a8b5b7', fontSize: 11, fontWeight: '900' },
  activeCountText: { color: '#06110d' },
  workspace: { flex: 1, minHeight: 0, flexDirection: 'row' },
  entryRailViewport: { width: 300, borderRightWidth: 1, borderRightColor: '#20373b', backgroundColor: '#091416' },
  railLight: { backgroundColor: '#f7fafb' },
  entryRail: { padding: 12, gap: 9, paddingBottom: 80 },
  railHeading: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 2 },
  editorPane: { flex: 1, minWidth: 0 },
  editorPaneDesktop: { alignItems: 'center' },
  editorList: { flex: 1, width: '100%' },
  editorContent: { flexGrow: 1, gap: 8, paddingBottom: 150, alignSelf: 'center', width: '100%', maxWidth: 856 },
  entrySummary: { minHeight: 58, borderRadius: 10, borderWidth: 1, borderColor: '#2a4145', backgroundColor: '#101c1e', flexDirection: 'row', alignItems: 'center', padding: 7, gap: 8, marginBottom: 8 },
  entrySummaryCompact: { minHeight: 58, backgroundColor: 'transparent' },
  surfaceLight: { backgroundColor: '#fff' },
  entryImageStage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#1b2a2d', alignItems: 'center', justifyContent: 'center' },
  entryImage: { width: 40, height: 40 },
  entryMaxBadge: { position: 'absolute', width: 16, height: 16, right: 1, top: 1 },
  entryCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.2 },
  entryName: { color: '#f4f9fa', fontSize: 14, lineHeight: 17, fontWeight: '900' },
  entryMeta: { color: '#9bb0b4', fontSize: 11, marginTop: 2 },
  chevron: { fontSize: 28, fontWeight: '400' },
  changeLabel: {
    width: 56,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
    paddingRight: 2,
  },
  editorTitleRow: { paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  editorTitleCopy: { flex: 1, minWidth: 0 },
  editorTitle: { color: '#f6fafb', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  editorDescription: { color: '#9db0b4', fontSize: 13, lineHeight: 17, maxWidth: 520 },
  editButton: { flexShrink: 0, minHeight: 44, maxWidth: 148, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  editButtonIcon: { width: 20, height: 20 },
  editButtonText: { fontSize: 13, fontWeight: '900' },
  editingChip: { minHeight: 34, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  editingChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  errorBanner: { marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ef5d72', backgroundColor: 'rgba(239,93,114,0.13)' },
  errorTitle: { color: '#ff7084', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  errorText: { color: '#f8dfe4', marginTop: 3, fontSize: 13 },
  advanced: { borderWidth: 1, borderColor: '#29494d', borderRadius: 12, backgroundColor: '#0e191b', overflow: 'hidden' },
  mobileAdvancedRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  mobileAdvancedRowExpanded: { flexDirection: 'column' },
  mobileAdvanced: { flex: 1, minWidth: 0 },
  mobileEditButton: { flexBasis: 148, maxWidth: 148 },
  mobileEditButtonExpanded: { flexBasis: 'auto', maxWidth: '100%', width: '100%' },
  advancedToggle: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  advancedValue: { color: '#f2f7f8', fontSize: 14, fontWeight: '800', marginTop: 2 },
  advancedMark: { color: '#f2f7f8', fontSize: 20 },
  ruleGroups: { padding: 10, paddingTop: 0, gap: 9 },
  ruleGroup: { borderRadius: 10, borderWidth: 1, borderColor: '#2b4145', backgroundColor: '#111e20', padding: 10 },
  ruleHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  ruleHeaderCopy: { flex: 1 },
  ruleTitle: { color: '#eff6f7', fontSize: 14, fontWeight: '900' },
  ruleDescription: { color: '#9cafb3', fontSize: 11, lineHeight: 15 },
  ruleCount: { fontSize: 10, fontWeight: '800' },
  ruleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ruleOption: { width: '31.5%', minHeight: 72, borderWidth: 1, borderColor: '#35494c', borderRadius: 9, padding: 7, alignItems: 'center', justifyContent: 'center' },
  ruleOptionLight: { backgroundColor: '#f5f8f9' },
  ruleImage: { width: 27, height: 27 },
  ruleLabel: { color: '#e6edef', fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  ruleMark: { position: 'absolute', right: 5, top: 3, color: '#8fa2a6', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.58 },
  mirrorRule: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: '#35494c', flexDirection: 'row', alignItems: 'center', padding: 9, gap: 9 },
  mirrorImage: { width: 38, height: 38 },
  mirrorCopy: { flex: 1 },
  listHeadingRow: { marginTop: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHeading: { fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  listCount: { color: '#9db0b4', fontSize: 12, marginTop: 1 },
  compactButton: { minHeight: 38, borderWidth: 1, borderColor: '#3b5054', borderRadius: 9, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  compactButtonLight: { backgroundColor: '#fff' },
  compactButtonText: { color: '#d7e2e4', fontSize: 12, fontWeight: '800' },
  editTools: { gap: 8, marginBottom: 9 },
  search: { height: 44, borderWidth: 1, borderColor: '#345156', borderRadius: 10, color: '#f5fafb', paddingHorizontal: 12, backgroundColor: '#0d181a' },
  searchLight: { backgroundColor: '#fff', color: '#132429' },
  toolButtons: { flexDirection: 'row', gap: 7 },
  toolButton: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: '#3b5155', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  toolButtonText: { color: '#e0e9eb', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#345257', borderRadius: 12, padding: 24, alignItems: 'center', marginTop: 8 },
  emptyTitle: { color: '#f3f8f9', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: '#9eb0b4', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  noListings: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 30 },
  saveSuccess: { flexShrink: 0, minHeight: 50, marginHorizontal: 10, marginBottom: 8, borderWidth: 1, borderColor: '#37bf78', borderRadius: 11, backgroundColor: '#173b2d', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  saveSuccessMark: { color: '#53db94', fontSize: 18, fontWeight: '900' },
  saveSuccessText: { flex: 1, color: '#f2fff8', fontSize: 13, fontWeight: '900' },
  saveSuccessDismiss: { color: '#f2fff8', fontSize: 23, lineHeight: 26 },
  editActions: { minHeight: 72, flexDirection: 'row', gap: 9, marginTop: 9, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#28464b', backgroundColor: '#071012' },
  editActionsLight: { backgroundColor: '#ffffff' },
  stickyCancel: { flex: 0.8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#4a6065', alignItems: 'center', justifyContent: 'center' },
  stickyCancelText: { color: '#e7eff0', fontWeight: '900' },
  stickySave: { flex: 1.2, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stickySaveText: { color: '#07100d', fontWeight: '900' },
  picker: { flex: 1, backgroundColor: '#071012' },
  pickerHeader: { minHeight: 70, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#294348' },
  pickerHeaderLight: { backgroundColor: '#fff' },
  pickerTitle: { color: '#f3f8f9', fontSize: 21, fontWeight: '900' },
  pickerList: { padding: 12, paddingBottom: 80 },
  close: { width: 44, height: 44, borderWidth: 1, borderColor: '#526367', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#f5fafb', fontSize: 26, lineHeight: 28 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  confirm: { width: '100%', maxWidth: 410, borderRadius: 17, borderWidth: 1, borderColor: '#3b5b60', backgroundColor: '#111d1f', padding: 18 },
  confirmLight: { backgroundColor: '#fff' },
  confirmEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  confirmTitle: { color: '#f5fafb', fontSize: 22, fontWeight: '900', marginTop: 3 },
  confirmBody: { color: '#a0b1b5', fontSize: 14, marginTop: 5 },
  confirmActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#4b5e62', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#e9f0f1', fontWeight: '900' },
  discardButton: { flex: 1.2, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  discardText: { color: '#09100d', fontWeight: '900' },
});
