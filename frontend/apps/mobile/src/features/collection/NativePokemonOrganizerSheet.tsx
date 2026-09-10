import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type {
  CreateCustomTagRequest,
  CustomTagDefinition,
  CustomTagParent,
} from '@pokemongonexus/shared-contracts/users';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import type { NativeCollectionRow, NativeTagSummary } from './collectionModel';
import type { NativeCatalogDestination, NativeCatalogOrganizerRequest } from './nativeCatalogMutation';
import { NativeCatalogFormPicker } from './NativeCatalogFormPicker';
import { isNativeCatalogFormVariant } from './nativeCatalogFormModel';
import type { NativeOrganizerTagChanges } from './nativeExistingOrganizerMutation';
import type { NativePokemonOrganizerRequest } from './useNativePokemonOrganizerMutation';
import { NativeCollectionPriorityStar } from './parity/NativeCollectionPriorityStar';
import { normalizeNativeTagIds } from './nativeInstanceNormalization';
import { NativeCustomTagEditorSheet } from './NativeCustomTagEditorSheet';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

type Props = {
  catalog?: BasePokemon[];
  assetBaseUrl?: string;
  inventoryTags: NativeTagSummary[];
  wishlistTags: NativeTagSummary[];
  instances: Record<string, PokemonInstance>;
  isSaving: boolean;
  rows: NativeCollectionRow[];
  error: string | null;
  onApply: (request: NativePokemonOrganizerRequest) => Promise<void>;
  onCreateTag?: (request: CreateCustomTagRequest) => Promise<unknown>;
  onClose: () => void;
  visible: boolean;
};

type OrganizerStage = 'main' | 'wanted-copy' | 'caught-conversion' | 'remove';
type BuiltInKey = 'favorite' | 'forTrade' | 'mostWanted';
type ToggleState = 'checked' | 'mixed' | 'unchecked';

const countState = (count: number, total: number): ToggleState => {
  if (total === 0) return 'unchecked';
  if (count === 0) return 'unchecked';
  return count === total ? 'checked' : 'mixed';
};

const CustomTagChoice = ({
  state,
  tag,
  onPress,
  light,
}: {
  state: ToggleState;
  tag: NativeTagSummary;
  onPress: () => void;
  light: boolean;
}) => (
  <Pressable
    aria-checked={state === 'mixed' ? 'mixed' : state === 'checked'}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: state === 'mixed' ? 'mixed' : state === 'checked' }}
    onPress={onPress}
    style={[
      styles.tagChoice,
      light && styles.controlLight,
      { borderColor: state !== 'unchecked' ? tag.color : light ? '#a9c0ba' : '#53615e' },
      state !== 'unchecked' ? { backgroundColor: `${tag.color}2e` } : null,
    ]}
  >
    <View style={[styles.swatch, { backgroundColor: tag.color }]} />
    <Text numberOfLines={2} style={[styles.choiceTitle, light && styles.textLight]}>{tag.name}</Text>
    <View style={[styles.check, { borderColor: tag.color }]}>
      <Text style={[styles.checkText, { color: tag.color }]}>
        {state === 'checked' ? '✓' : state === 'mixed' ? '−' : ''}
      </Text>
    </View>
  </Pressable>
);

export const NativePokemonOrganizerSheet = ({
  catalog = [],
  assetBaseUrl = '',
  inventoryTags,
  wishlistTags,
  instances,
  isSaving,
  rows,
  error,
  onApply,
  onCreateTag,
  onClose,
  visible,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const [formRequest, setFormRequest] = useState<NativeCatalogOrganizerRequest | null>(null);
  if (!visible && formRequest) setFormRequest(null);
  useEffect(() => {
    if (!visible || isSaving || formRequest || Platform.OS === 'web') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [formRequest, isSaving, onClose, visible]);
  const isCatalog = rows.length > 0 && rows.every((row) => row.source === 'catalog');
  const selectedInstances = useMemo(() => rows.flatMap((row) => {
    if (row.source === 'catalog') return [];
    const key = resolveInstanceCollectionKey(instances, row.id);
    return key && instances[key] && !instances[key].disabled ? [instances[key]] : [];
  }), [instances, rows]);
  const caughtInstances = useMemo(
    () => selectedInstances.filter((instance) => instance.is_caught && !instance.is_wanted),
    [selectedInstances],
  );
  const wantedInstances = useMemo(
    () => selectedInstances.filter((instance) => instance.is_wanted),
    [selectedInstances],
  );
  const caughtSelectionState = useMemo(() => {
    const tagCounts = new Map<string, number>();
    let favorite = 0;
    let forTrade = 0;
    caughtInstances.forEach((instance) => {
      if (instance.favorite) favorite += 1;
      if (instance.is_for_trade) forTrade += 1;
      normalizeNativeTagIds(instance.caught_tags).forEach((tagId) => {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      });
    });
    return { favorite, forTrade, tagCounts };
  }, [caughtInstances]);
  const wantedSelectionState = useMemo(() => {
    const tagCounts = new Map<string, number>();
    let mostWanted = 0;
    wantedInstances.forEach((instance) => {
      if (instance.most_wanted) mostWanted += 1;
      normalizeNativeTagIds(instance.wanted_tags).forEach((tagId) => {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      });
    });
    return { mostWanted, tagCounts };
  }, [wantedInstances]);
  const selectionKind = isCatalog
    ? 'catalog'
    : caughtInstances.length > 0 && wantedInstances.length > 0
      ? 'mixed'
      : wantedInstances.length > 0
        ? 'wanted'
        : 'caught';
  const [stage, setStage] = useState<OrganizerStage>('main');
  const [destination, setDestination] = useState<NativeCatalogDestination>('caught');
  const [conversionDestination, setConversionDestination] = useState<'caught' | 'trade'>('caught');
  const [builtInChanges, setBuiltInChanges] = useState<Partial<Record<BuiltInKey, boolean>>>({});
  const [customChanges, setCustomChanges] = useState<NativeOrganizerTagChanges>({});
  const [creatingParent, setCreatingParent] = useState<CustomTagParent | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [createdTags, setCreatedTags] = useState<NativeTagSummary[]>([]);

  const resetChoices = () => {
    setBuiltInChanges({});
    setCustomChanges({});
  };
  const openStage = (next: OrganizerStage) => {
    resetChoices();
    setStage(next);
  };
  const chooseDestination = (next: NativeCatalogDestination) => {
    setDestination(next);
    resetChoices();
  };
  const chooseConversionDestination = (next: 'caught' | 'trade') => {
    setConversionDestination(next);
    resetChoices();
  };

  const isProspectiveParent = (parent: 'caught' | 'wanted'): boolean =>
    (selectionKind === 'catalog' && stage === 'main'
      && (parent === 'wanted' ? destination === 'wanted' : destination !== 'wanted'))
    || (stage === 'wanted-copy' && parent === 'wanted')
    || (stage === 'caught-conversion' && parent === 'caught');

  const getBuiltInState = (key: BuiltInKey): ToggleState => {
    if (builtInChanges[key] !== undefined) {
      return builtInChanges[key] ? 'checked' : 'unchecked';
    }
    const parent = key === 'mostWanted' ? 'wanted' : 'caught';
    if (isProspectiveParent(parent)) return 'unchecked';
    if (key === 'favorite') {
      return countState(caughtSelectionState.favorite, caughtInstances.length);
    }
    if (key === 'forTrade') {
      return countState(caughtSelectionState.forTrade, caughtInstances.length);
    }
    return countState(wantedSelectionState.mostWanted, wantedInstances.length);
  };

  const setBuiltIn = (key: BuiltInKey) => {
    const next = getBuiltInState(key) !== 'checked';
    setBuiltInChanges((current) => ({ ...current, [key]: next }));
  };

  const customTags = (parent: 'caught' | 'wanted') => {
    const supplied = (parent === 'wanted' ? wishlistTags : inventoryTags)
      .filter((tag) => tag.tone === 'custom' && tag.key.startsWith('custom:'));
    const suppliedKeys = new Set(supplied.map((tag) => tag.key));
    return [
      ...supplied,
      ...createdTags.filter((tag) => tag.parent === parent && !suppliedKeys.has(tag.key)),
    ];
  };

  const customTagState = (parent: 'caught' | 'wanted', tagId: string): ToggleState => {
    if (customChanges[tagId] !== undefined) {
      return customChanges[tagId] ? 'checked' : 'unchecked';
    }
    if (isProspectiveParent(parent)) return 'unchecked';
    const selected = parent === 'wanted' ? wantedInstances : caughtInstances;
    const tagCounts = parent === 'wanted'
      ? wantedSelectionState.tagCounts
      : caughtSelectionState.tagCounts;
    return countState(tagCounts.get(tagId) ?? 0, selected.length);
  };

  const toggleCustomTag = (parent: 'caught' | 'wanted', tagId: string) => {
    const next = customTagState(parent, tagId) !== 'checked';
    setCustomChanges((current) => ({ ...current, [tagId]: next }));
  };

  const changesForParent = (parent: 'caught' | 'wanted'): NativeOrganizerTagChanges => {
    const valid = new Set(customTags(parent).map((tag) => tag.key.slice('custom:'.length)));
    return Object.fromEntries(Object.entries(customChanges).filter(([tagId]) => valid.has(tagId)));
  };

  const selectedTagIds = (parent: 'caught' | 'wanted'): string[] => customTags(parent).flatMap((tag) => {
    const tagId = tag.key.slice('custom:'.length);
    return customChanges[tagId] === true ? [tagId] : [];
  });

  const renderCustomTags = (parent: 'caught' | 'wanted') => {
    const tags = customTags(parent);
    return (
      <View style={styles.customTags}>
        <View style={styles.tagHeading}>
          <View>
            <Text style={[styles.tagHeadingTitle, light && styles.textLight]}>Your tags</Text>
            <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>
              {parent === 'wanted' ? 'Wanted Pokémon only' : 'Caught Pokémon only'}
            </Text>
          </View>
          {onCreateTag ? (
            <Pressable
              accessibilityLabel={`New ${parent === 'wanted' ? 'wanted' : 'inventory'} tag`}
              accessibilityRole="button"
              onPress={() => setCreatingParent(parent)}
              style={[styles.newTag, light && styles.controlLight]}
            >
              <Text style={[styles.newTagText, light && styles.textLight]}>+ New tag</Text>
            </Pressable>
          ) : null}
        </View>
        {tags.length ? (
          <View style={styles.tagGrid}>
            {tags.map((tag) => {
              const id = tag.key.slice('custom:'.length);
              return (
                <CustomTagChoice
                  key={tag.key}
                  light={light}
                  onPress={() => toggleCustomTag(parent, id)}
                  state={customTagState(parent, id)}
                  tag={tag}
                />
              );
            })}
          </View>
        ) : (
          <Text style={[styles.emptyTags, light && styles.secondaryLight]}>No custom tags in this section yet.</Text>
        )}
      </View>
    );
  };

  const renderBuiltIn = ({
    keyName,
    label,
    detail,
    tone,
  }: {
    keyName: BuiltInKey;
    label: string;
    detail: string;
    tone: 'favorite' | 'trade' | 'most-wanted';
  }) => {
    const state = getBuiltInState(keyName);
    const counterpart = keyName === 'favorite'
      ? getBuiltInState('forTrade')
      : keyName === 'forTrade'
        ? getBuiltInState('favorite')
        : 'unchecked';
    const disabled = (keyName === 'favorite' || keyName === 'forTrade')
      && state !== 'checked' && counterpart !== 'unchecked';
    const resolvedDetail = disabled
      ? keyName === 'favorite' ? 'Remove For Trade first.' : 'Remove Favorite first.'
      : detail;
    const accent = tone === 'favorite' ? '#facc15' : tone === 'trade' ? '#22c55e' : '#f05a45';
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: state === 'mixed' ? 'mixed' : state === 'checked',
          disabled,
        }}
        disabled={disabled}
        onPress={() => setBuiltIn(keyName)}
        style={[
          styles.builtInChoice,
          light && styles.controlLight,
          state !== 'unchecked' ? { borderColor: accent, backgroundColor: `${accent}29` } : null,
          disabled && styles.disabled,
        ]}
      >
        {tone === 'trade' ? (
          <Text accessibilityElementsHidden style={[styles.tradeIcon, { color: accent }]}>↔</Text>
        ) : (
          <NativeCollectionPriorityStar
            size={25}
            style={styles.priorityIcon}
            tone={tone === 'favorite' ? 'favorite' : 'most-wanted'}
          />
        )}
        <View style={styles.choiceCopy}>
          <Text style={[styles.choiceTitle, light && styles.textLight]}>{label}</Text>
          <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>{resolvedDetail}</Text>
        </View>
        <View style={[styles.check, { borderColor: accent }]}>
          <Text style={[styles.checkText, { color: accent }]}>
            {state === 'checked' ? '✓' : state === 'mixed' ? '−' : ''}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderCaughtChoices = (includeForTrade: boolean, includeFavorite = true) => (
    <View style={[styles.section, styles.caughtSection, light && styles.sectionLight]}>
      <Text style={[styles.sectionEyebrow, { color: '#4ade80' }]}>CAUGHT POKÉMON</Text>
      {includeFavorite ? renderBuiltIn({
        keyName: 'favorite', label: 'Favorite',
        detail: 'Keep important catches easy to find.', tone: 'favorite',
      }) : null}
      {includeForTrade ? renderBuiltIn({
        keyName: 'forTrade', label: 'For Trade',
        detail: 'Make these available in trade matching.', tone: 'trade',
      }) : null}
      {renderCustomTags('caught')}
    </View>
  );

  const renderWantedChoices = () => (
    <View style={[styles.section, styles.wantedSection, light && styles.sectionLight]}>
      <Text style={[styles.sectionEyebrow, { color: '#fb7185' }]}>WANTED POKÉMON</Text>
      {renderBuiltIn({
        keyName: 'mostWanted', label: 'Most Wanted',
        detail: 'Highlight your highest-priority wishlist entries.', tone: 'most-wanted',
      })}
      {renderCustomTags('wanted')}
    </View>
  );

  const apply = async () => {
    if (selectionKind === 'catalog') {
      const request: NativeCatalogOrganizerRequest = {
        variantIds: rows.map((row) => row.id),
        destination,
        customTagIds: selectedTagIds(destination === 'wanted' ? 'wanted' : 'caught'),
        favorite: destination === 'caught' && Boolean(builtInChanges.favorite),
        mostWanted: destination === 'wanted' && Boolean(builtInChanges.mostWanted),
      };
      if (destination === 'caught' && request.variantIds.some(isNativeCatalogFormVariant)) {
        setFormRequest(request);
      } else {
        await onApply({ operation: 'create', ...request });
      }
      return;
    }
    if (stage === 'wanted-copy') {
      await onApply({
        operation: 'clone-wanted',
        instanceIds: caughtInstances.map((instance) => instance.instance_id!),
        customTagIds: selectedTagIds('wanted'),
        mostWanted: Boolean(builtInChanges.mostWanted),
      });
      return;
    }
    if (stage === 'caught-conversion') {
      await onApply({
        operation: 'convert-caught',
        instanceIds: wantedInstances.map((instance) => instance.instance_id!),
        destination: conversionDestination,
        customTagIds: selectedTagIds('caught'),
        favorite: conversionDestination === 'caught' && Boolean(builtInChanges.favorite),
      });
      return;
    }
    if (stage === 'remove') {
      await onApply({
        operation: 'remove',
        instanceIds: selectedInstances.map((instance) => instance.instance_id!),
      });
      return;
    }
    await onApply({
      operation: 'update',
      instanceIds: selectedInstances.map((instance) => instance.instance_id!),
      ...(builtInChanges.favorite !== undefined ? { favorite: builtInChanges.favorite } : {}),
      ...(builtInChanges.forTrade !== undefined ? { forTrade: builtInChanges.forTrade } : {}),
      ...(builtInChanges.mostWanted !== undefined ? { mostWanted: builtInChanges.mostWanted } : {}),
      caughtTagChanges: changesForParent('caught'),
      wantedTagChanges: changesForParent('wanted'),
    });
  };

  const title = selectionKind === 'catalog'
    ? 'Add Pokémon'
    : stage === 'wanted-copy'
      ? 'Create Wanted copies'
      : stage === 'caught-conversion'
        ? 'Mark as Caught'
        : stage === 'remove'
          ? selectionKind === 'wanted' ? 'Remove from Wanted' : 'Transfer Pokémon'
          : 'Organize Pokémon';
  const actionLabel = selectionKind === 'catalog'
    ? `Add (${rows.length})`
    : stage === 'wanted-copy'
      ? `Create ${caughtInstances.length} Wanted ${caughtInstances.length === 1 ? 'copy' : 'copies'}`
      : stage === 'caught-conversion'
        ? `Move ${wantedInstances.length} to ${conversionDestination === 'trade' ? 'For Trade' : 'Caught'}`
        : stage === 'remove'
          ? selectionKind === 'wanted' ? 'Remove from Wanted' : 'Transfer selected'
          : `Apply to ${selectedInstances.length}`;

  if (visible && formRequest) return (
    <View style={styles.inlineRoot}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { height: '94%' }]}>
          <NativeCatalogFormPicker assetBaseUrl={assetBaseUrl} catalog={catalog} instances={instances}
            error={error} isSaving={isSaving} request={formRequest}
            onCancel={() => setFormRequest(null)}
            onConfirm={(request) => onApply({ operation: 'create', ...request })} />
        </View>
      </View>
    </View>
  );

  return (
    <View
      accessibilityElementsHidden={!visible}
      accessibilityViewIsModal
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      role="dialog"
      style={[styles.inlineRoot, !visible && styles.hiddenInline]}
      testID="native-pokemon-organizer"
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, light && styles.sheetLight]}>
          <View style={[styles.header, light && styles.dividerLight]}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>POKÉMON ORGANIZER</Text>
              <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>{title}</Text>
              <Text style={[styles.subtitle, light && styles.secondaryLight]}>{rows.length} selected</Text>
            </View>
            <Pressable
              accessibilityLabel="Close Pokémon organizer"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onClose}
              style={[styles.close, light && styles.controlLight]}
            >
              <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {selectionKind === 'catalog' ? (
              <View style={[styles.section, light && styles.sectionLight]}>
                <Text style={[styles.sectionEyebrow, light && styles.labelLight]}>CREATE AS</Text>
                <View style={styles.destinations}>
                  {([
                    ['caught', 'Caught', 'Add new collection instances.'],
                    ['trade', 'For Trade', 'Add caught instances listed for trade.'],
                    ['wanted', 'Wanted', 'Add new wishlist entries.'],
                  ] as const).map(([key, label, detail]) => {
                    const selected = destination === key;
                    return (
                      <Pressable
                        aria-checked={selected}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        key={key}
                        onPress={() => chooseDestination(key)}
                        style={[
                          styles.destination,
                          light && styles.controlLight,
                          selected && styles.destinationSelected,
                        ]}
                      >
                        <Text style={[styles.destinationTitle, light && styles.textLight]}>{label}</Text>
                        <Text style={[styles.destinationDetail, light && styles.secondaryLight]}>{detail}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {stage === 'caught-conversion' ? (
              <View style={[styles.section, light && styles.sectionLight]}>
                <Text style={[styles.sectionEyebrow, light && styles.labelLight]}>CAUGHT STATUS</Text>
                <View style={styles.destinations}>
                  {([
                    ['caught', 'Caught', 'Add to your collection.'],
                    ['trade', 'Caught and For Trade', 'Add to your collection and trade listings.'],
                  ] as const).map(([key, label, detail]) => (
                    <Pressable
                      aria-checked={conversionDestination === key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: conversionDestination === key }}
                      key={key}
                      onPress={() => chooseConversionDestination(key)}
                      style={[
                        styles.destination,
                        light && styles.controlLight,
                        conversionDestination === key && styles.destinationSelected,
                      ]}
                    >
                      <Text style={[styles.destinationTitle, light && styles.textLight]}>{label}</Text>
                      <Text style={[styles.destinationDetail, light && styles.secondaryLight]}>{detail}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {(stage === 'wanted-copy'
              || (selectionKind === 'catalog' && destination === 'wanted')
              || (stage === 'main' && wantedInstances.length > 0))
              ? renderWantedChoices()
              : null}
            {(stage === 'caught-conversion'
              || (selectionKind === 'catalog' && destination !== 'wanted')
              || (stage === 'main' && caughtInstances.length > 0))
              ? renderCaughtChoices(
                  selectionKind !== 'catalog' && stage === 'main',
                  !(
                    (selectionKind === 'catalog' && destination === 'trade')
                    || (stage === 'caught-conversion' && conversionDestination === 'trade')
                  ),
                )
              : null}

            {stage === 'main' && selectionKind !== 'catalog' ? (
              <View style={[styles.section, light && styles.sectionLight]}>
                <View style={styles.tagHeading}>
                  <View>
                    <Text style={[styles.tagHeadingTitle, light && styles.textLight]}>Other actions</Text>
                    <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>Create, convert, or remove instances.</Text>
                  </View>
                </View>
                {caughtInstances.length > 0 ? (
                  <Pressable accessibilityRole="button" onPress={() => openStage('wanted-copy')} style={[styles.lifecycleAction, light && styles.controlLight]}>
                    <View style={styles.choiceCopy}>
                      <Text style={[styles.choiceTitle, light && styles.textLight]}>Create Wanted {caughtInstances.length === 1 ? 'copy' : 'copies'}</Text>
                      <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>Your caught Pokémon remain unchanged.</Text>
                    </View>
                    <Text style={[styles.lifecycleArrow, light && styles.textLight]}>›</Text>
                  </Pressable>
                ) : null}
                {wantedInstances.length > 0 ? (
                  <Pressable accessibilityRole="button" onPress={() => openStage('caught-conversion')} style={[styles.lifecycleAction, light && styles.controlLight]}>
                    <View style={styles.choiceCopy}>
                      <Text style={[styles.choiceTitle, light && styles.textLight]}>Mark as Caught</Text>
                      <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>Convert the existing Wanted {wantedInstances.length === 1 ? 'entry' : 'entries'}.</Text>
                    </View>
                    <Text style={[styles.lifecycleArrow, light && styles.textLight]}>›</Text>
                  </Pressable>
                ) : null}
                {selectionKind !== 'mixed' ? (
                  <Pressable accessibilityRole="button" onPress={() => openStage('remove')} style={[styles.lifecycleAction, styles.dangerAction]}>
                    <View style={styles.choiceCopy}>
                      <Text style={styles.dangerTitle}>{selectionKind === 'wanted' ? 'Remove from Wanted' : 'Transfer selected'}</Text>
                      <Text style={styles.dangerDetail}>{selectionKind === 'wanted' ? 'Delete these wishlist entries.' : 'Remove these caught instances from your collection.'}</Text>
                    </View>
                    <Text style={styles.dangerIcon}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {stage === 'remove' ? (
              <View accessibilityRole="alert" style={styles.removeConfirmation}>
                <Text style={styles.removeTitle}>This cannot be undone from this screen.</Text>
                <Text style={styles.removeDetail}>
                  {selectionKind === 'wanted'
                    ? `Remove ${wantedInstances.length} selected ${wantedInstances.length === 1 ? 'entry' : 'entries'} from Wanted?`
                    : `Transfer ${caughtInstances.length} selected Pokémon?`}
                </Text>
              </View>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>

          {isSaving ? (
            <View accessibilityLiveRegion="assertive" style={styles.saving}>
              <ActivityIndicator color="#ffffff" />
              <View style={styles.choiceCopy}>
                <Text style={styles.savingTitle}>{selectionKind === 'catalog' ? 'Creating your Pokémon…' : 'Saving your changes…'}</Text>
                <Text style={styles.savingDetail}>Keep this window open. Your collection will update automatically.</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.footer, light && styles.dividerLight]}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={stage === 'main' ? onClose : () => openStage('main')}
              style={[styles.cancel, light && styles.controlLight]}
            >
              <Text style={[styles.cancelText, light && styles.secondaryLight]}>{stage === 'main' ? 'Cancel' : 'Back'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void apply()}
              style={[styles.apply, stage === 'remove' && styles.removeApply]}
            >
              {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.applyText}>{actionLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
      {visible && creatingParent && onCreateTag ? (
        <NativeCustomTagEditorSheet
          isSaving={isCreatingTag}
          key={`organizer-new:${creatingParent}`}
          onClose={() => setCreatingParent(null)}
          onCreate={async (request) => {
            setIsCreatingTag(true);
            try {
              const created = await onCreateTag(request);
              if (isCustomTagDefinition(created)) {
                setCreatedTags((current) => [...current, {
                  key: `custom:${created.tag_id}`,
                  parent: created.parent,
                  name: created.name,
                  color: created.color,
                  tone: 'custom',
                  rows: [],
                }]);
                setCustomChanges((current) => ({ ...current, [created.tag_id]: true }));
              }
            } finally {
              setIsCreatingTag(false);
            }
          }}
          onDelete={async () => undefined}
          onUpdate={async () => undefined}
          parent={creatingParent}
          visible
        />
      ) : null}
    </View>
  );
};

const isCustomTagDefinition = (value: unknown): value is CustomTagDefinition => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CustomTagDefinition>;
  return typeof candidate.tag_id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.color === 'string';
};

const styles = StyleSheet.create({
  inlineRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    elevation: 80,
  },
  hiddenInline: { opacity: 0, transform: [{ translateY: 10_000 }] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', maxHeight: '94%', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#171c1d', overflow: 'hidden' },
  sheetLight: { backgroundColor: '#f8fff9' },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#315052', padding: 14 },
  headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: '#42b9ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#ffffff', fontSize: 23, fontWeight: '900' },
  subtitle: { color: '#aaaaaa', fontSize: 13 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#53615e', borderRadius: 22, backgroundColor: '#202728' },
  closeText: { color: '#ffffff', fontSize: 28, lineHeight: 31 },
  body: { gap: 10, padding: 10, paddingBottom: 16 },
  section: { gap: 10, borderWidth: 1, borderColor: '#315052', borderRadius: 14, padding: 11, backgroundColor: '#111718' },
  sectionLight: { backgroundColor: '#edf5f1', borderColor: '#9bb8b1' },
  caughtSection: { borderColor: '#22c55e55' },
  wantedSection: { borderColor: '#fb718555' },
  sectionEyebrow: { color: '#8fc6cb', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  labelLight: { color: '#28636a' },
  destinations: { gap: 8 },
  destination: { minHeight: 58, justifyContent: 'center', borderWidth: 1, borderColor: '#53615e', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#202728' },
  destinationSelected: { borderColor: '#2196f3', backgroundColor: '#2196f32e' },
  destinationTitle: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  destinationDetail: { color: '#aaaaaa', fontSize: 12, lineHeight: 16 },
  builtInChoice: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#53615e', borderRadius: 10, padding: 9, backgroundColor: '#202728' },
  disabled: { opacity: 0.48 },
  priorityIcon: { width: 31, alignItems: 'center' },
  tradeIcon: { width: 31, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  choiceCopy: { minWidth: 0, flex: 1 },
  choiceTitle: { minWidth: 0, flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '900' },
  choiceDetail: { color: '#aaaaaa', fontSize: 11, lineHeight: 15 },
  tagHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagHeadingTitle: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  newTag: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: '#53615e', borderRadius: 9, paddingHorizontal: 11, backgroundColor: '#202728' },
  newTagText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  customTags: { gap: 8 },
  tagGrid: { gap: 7 },
  tagChoice: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 10, padding: 9, backgroundColor: '#202728' },
  swatch: { width: 15, height: 15, borderRadius: 8 },
  check: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 7 },
  checkText: { fontSize: 16, fontWeight: '900' },
  emptyTags: { color: '#aaaaaa', fontSize: 13 },
  lifecycleAction: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#53615e', borderRadius: 10, padding: 10, backgroundColor: '#202728' },
  lifecycleArrow: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  dangerAction: { borderColor: '#ef5b72', backgroundColor: '#ef5b7218' },
  dangerTitle: { color: '#ff8da0', fontSize: 14, fontWeight: '900' },
  dangerDetail: { color: '#d9a9b1', fontSize: 11, lineHeight: 15 },
  dangerIcon: { color: '#ff8da0', fontSize: 28, fontWeight: '900' },
  removeConfirmation: { gap: 6, borderWidth: 1, borderColor: '#ef5b72', borderRadius: 12, padding: 13, backgroundColor: '#ef5b7218' },
  removeTitle: { color: '#ff8da0', fontSize: 15, fontWeight: '900' },
  removeDetail: { color: '#f3c6ce', fontSize: 13, lineHeight: 18 },
  error: { borderWidth: 1, borderColor: '#ef5b72', borderRadius: 10, padding: 10, color: '#ff91a2', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  saving: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginBottom: 6, borderRadius: 10, padding: 11, backgroundColor: '#1d6593' },
  savingTitle: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  savingDetail: { color: '#d8efff', fontSize: 11 },
  footer: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#315052', padding: 10, paddingBottom: 14, backgroundColor: '#171c1d' },
  dividerLight: { borderColor: '#9bb8b1', backgroundColor: '#f8fff9' },
  cancel: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#53615e', borderRadius: 10 },
  cancelText: { color: '#aaaaaa', fontWeight: '900' },
  apply: { minHeight: 48, flex: 1.35, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#007bff' },
  removeApply: { backgroundColor: '#b62f47' },
  applyText: { color: '#ffffff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  controlLight: { borderColor: '#a9c0ba', backgroundColor: '#ffffff' },
  textLight: { color: '#405753' },
  secondaryLight: { color: '#4b625e' },
});
