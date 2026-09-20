import type { PartnerInfo } from '@pokemongonexus/shared-contracts/trades';
import * as Clipboard from 'expo-clipboard';
import {
  TRADE_ACTIVITY_FILTERS,
  type TradeActivityFilter,
} from '@pokemongonexus/shared-domain/trade-activity';
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  NativePokemonLocationBackdrop,
} from '../features/collection/parity/NativePokemonLocationBackdrop';
import type { NativeInstanceDetail } from '../features/collection/collectionModel';
import type { NativeTradeActivityRow } from '../features/trades/nativeTradeActivityRows';
import type {
  NativeTradeActivityActionModel,
  NativeTradeActivityModel,
} from '../features/trades/nativeTradeActivityModel';
import { useNativeModalAnimation, useNativeReducedMotion } from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  error: string | null;
  isLoading: boolean;
  onAction: (
    model: NativeTradeActivityModel,
    action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>,
  ) => Promise<void>;
  onOpenPreferences: () => void;
  onRetry: () => void;
  onRevealPartner: (tradeId: string) => Promise<PartnerInfo>;
  pageHeader?: ReactNode;
  rows: NativeTradeActivityRow[];
  showModeTabs?: boolean;
};

const FILTER_LABELS: Record<TradeActivityFilter, { full: string; compact: string }> = {
  Accepting: { full: 'Needs response', compact: 'Offers' },
  Proposed: { full: 'Sent', compact: 'Sent' },
  Pending: { full: 'Active', compact: 'Active' },
  Completed: { full: 'Completed', compact: 'Done' },
  Cancelled: { full: 'Closed', compact: 'Closed' },
};

const FILTER_TONES: Record<TradeActivityFilter, { border: string; surface: string; accent: string }> = {
  Accepting: { border: '#a44d57', surface: '#3a2226', accent: '#dd5260' },
  Proposed: { border: '#34794b', surface: '#173223', accent: '#3aa85f' },
  Pending: { border: '#966b35', surface: '#392a18', accent: '#e39a3b' },
  Completed: { border: '#376da8', surface: '#192b41', accent: '#438de0' },
  Cancelled: { border: '#5e686c', surface: '#272e31', accent: '#808c91' },
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const formatDate = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

type CopiedPartnerField = 'trainer-code' | 'pokemon-go-name' | 'coordination-handle';

export const formatNativeTrainerCode = (value?: string | null): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(' ') : value;
};

const coordinationLabel = (method: PartnerInfo['coordinationMethod']): string => {
  if (method === 'campfire') return 'Campfire';
  if (method === 'discord') return 'Discord';
  if (method === 'other') return 'Other community or app';
  return 'No external method shared';
};

const confirmationCopy = (
  action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>,
): { title: string; body: string; confirm: string } => {
  switch (action) {
    case 'accept':
      return {
        title: 'Accept this offer?',
        body: 'The trade becomes active and coordination details may become available.',
        confirm: 'Accept offer',
      };
    case 'deny':
      return {
        title: 'Deny this offer?',
        body: 'This closes the proposal without changing either Pokémon.',
        confirm: 'Deny offer',
      };
    case 'cancel':
      return {
        title: 'Cancel this trade?',
        body: 'The proposal or active trade will move to Closed.',
        confirm: 'Cancel trade',
      };
    case 'complete':
      return {
        title: 'Confirm the exchange happened?',
        body: 'Only confirm after the Pokémon Go trade is complete. Both trainers must confirm before ownership changes here.',
        confirm: 'Confirm complete',
      };
    case 'repropose':
      return {
        title: 'Re-propose this trade?',
        body: 'The server will revalidate both Pokémon before sending a new proposal.',
        confirm: 'Re-propose',
      };
    case 'satisfy':
      return {
        title: 'Mark this trade as satisfying?',
        body: 'Your feedback is stored only for this completed exchange.',
        confirm: 'Save feedback',
      };
  }
};

const PokemonCard = ({
  assetBaseUrl,
  detail,
  heading,
  isLuckyTrade,
  light,
  username,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail | null;
  heading: string;
  isLuckyTrade: boolean;
  light: boolean;
  username: string;
}) => {
  const reduceMotion = useNativeReducedMotion();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const gender = detail?.stats.find((stat) => stat.label === 'Gender')?.value ?? null;
  const dimensions = detail?.stats.filter((stat) => (
    stat.label === 'Weight' || stat.label === 'Height'
  )) ?? [];
  const provenance = detail?.provenance.filter((item) => (
    item.label === 'Caught near' || item.label === 'Caught on'
  )) ?? [];
  const hasAdditionalDetails = Boolean(
    dimensions.length || detail?.moves.length || detail?.ivs.length || provenance.length,
  );
  const toggleDetails = () => {
    const startedAt = Date.now();
    if (!reduceMotion) {
      LayoutAnimation.configureNext({
        duration: 180,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
    setDetailsVisible((visible) => !visible);
    markNativeUiPerformanceAfterPaint('trade_activity_details_result_painted', startedAt);
  };

  return (
  <View style={[styles.pokemonCard, light && styles.surfaceLight]} testID={`trade-pokemon-card-${detail?.row.id ?? 'unknown'}`}>
    <View style={styles.partyHeader}>
      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.partyUsername, light && styles.secondaryLight]}>
        {username}
      </Text>
      <Text maxFontSizeMultiplier={1.25} numberOfLines={2} style={[styles.partyLabel, light && styles.accentLight]}>
        {heading}
      </Text>
    </View>
    <View style={styles.pokemonStage}>
      {detail?.row.locationBackgroundUri ? (
        <NativePokemonLocationBackdrop uri={detail.row.locationBackgroundUri} />
      ) : null}
      {isLuckyTrade ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
          style={styles.luckyBackdrop}
        />
      ) : null}
      {detail?.row.imageUri ? (
        <Image fadeDuration={0}
          accessibilityLabel={detail.row.name}
          resizeMode="contain"
          source={{ uri: detail.row.imageUri }}
          style={styles.pokemonImage}
        />
      ) : (
        <Text style={[styles.missingPokemon, light && styles.secondaryLight]}>No image</Text>
      )}
      {detail?.row.maxKind ? (
        <Image fadeDuration={0}
          accessibilityLabel={detail.row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, `/images/${detail.row.maxKind}.png`) }}
          style={styles.maxBadge}
        />
      ) : null}
      {gender === 'Female' ? <Text accessibilityLabel="Female" style={styles.genderFemale}>♀</Text> : null}
      {gender === 'Male' ? <Text accessibilityLabel="Male" style={styles.genderMale}>♂</Text> : null}
    </View>
    <Text
      maxFontSizeMultiplier={1.25}
      numberOfLines={3}
      style={[styles.pokemonName, light && styles.textLight]}
    >
      {detail?.row.name ?? 'Unknown Pokémon'}
    </Text>
    {detail?.row.typeIconUris.length ? (
      <View accessibilityLabel="Pokémon types" style={styles.pokemonTypes}>
        {detail.row.typeIconUris.map((uri, index) => (
          <Image
            accessibilityLabel={`Type ${index + 1}`}
            fadeDuration={0}
            key={uri}
            resizeMode="contain"
            source={{ uri }}
            style={styles.typeIcon}
          />
        ))}
      </View>
    ) : null}
    {detail ? (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsVisible }}
        onPress={toggleDetails}
        style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        testID={`trade-pokemon-details-${detail.row.id}`}
      >
        <Text style={[styles.detailsButtonText, light && styles.textLight]}>
          {detailsVisible ? 'Hide Details' : 'Show Details'}
        </Text>
      </Pressable>
    ) : null}
    {detailsVisible ? (
      <View style={[styles.detailsPanel, light && styles.detailsPanelLight]} testID={`trade-pokemon-details-panel-${detail?.row.id ?? 'unknown'}`}>
        {hasAdditionalDetails ? (
          <>
            {dimensions.length ? (
              <View style={styles.detailStatGrid}>
                {dimensions.map((stat) => (
                  <View key={stat.label} style={styles.detailStat}>
                    <Text style={[styles.detailStatValue, light && styles.textLight]}>{stat.value}</Text>
                    <Text style={[styles.detailLabel, light && styles.secondaryLight]}>{stat.label.toLocaleUpperCase()}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {detail?.moves.length ? (
              <View style={styles.detailGroup}>
                {detail.moves.map((move) => (
                  <View key={move.label} style={styles.moveRow}>
                    {move.typeIconUri ? <Image fadeDuration={0} source={{ uri: move.typeIconUri }} style={styles.moveTypeIcon} /> : null}
                    <View style={styles.moveCopy}>
                      <Text numberOfLines={2} style={[styles.detailValue, light && styles.textLight]}>{move.value}</Text>
                      <Text style={[styles.detailLabel, light && styles.secondaryLight]}>
                        {move.label.toLocaleUpperCase()}{move.legacy ? ' · LEGACY' : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {detail?.ivs.length ? (
              <View accessibilityLabel="Individual values" style={styles.ivGrid}>
                {detail.ivs.map((iv) => (
                  <View key={iv.label} style={styles.ivCell}>
                    <Text style={[styles.ivValue, light && styles.textLight]}>{iv.value}</Text>
                    <Text style={[styles.detailLabel, light && styles.secondaryLight]}>
                      {iv.label === 'HP' ? 'STAMINA' : iv.label.toLocaleUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {provenance.map((item) => (
              <Text key={item.label} style={[styles.provenance, light && styles.secondaryLight]}>
                <Text style={[styles.provenanceLabel, light && styles.textLight]}>
                  {item.label === 'Caught near' ? 'Location Caught' : 'Date Caught'}:
                </Text>{' '}{item.value}
              </Text>
            ))}
          </>
        ) : (
          <Text style={[styles.noDetails, light && styles.secondaryLight]}>No additional details available.</Text>
        )}
      </View>
    ) : null}
  </View>
  );
};

const TradeConditions = ({
  assetBaseUrl,
  model,
  light,
}: {
  assetBaseUrl: string;
  model: NativeTradeActivityModel;
  light: boolean;
}) => (
  <View style={[styles.conditions, light && styles.conditionsLight]}>
    <View style={styles.friendshipGroup}>
      <Text style={[styles.conditionLabel, light && styles.accentLight]}>FRIENDSHIP</Text>
      <View
        accessibilityLabel={`${model.friendshipLevel} of 5 friendship hearts${model.isRemoteTrade ? ', remote trade available' : ''}`}
        style={styles.conditionIcons}
      >
        <View style={styles.hearts}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Image fadeDuration={0}
              accessibilityElementsHidden
              key={level}
              resizeMode="contain"
              source={{
                uri: toAssetUrl(
                  assetBaseUrl,
                  `/images/${level <= model.friendshipLevel ? 'heart-filled' : 'heart-unfilled'}.png`,
                ),
              }}
              style={styles.heart}
            />
          ))}
        </View>
        <View style={styles.conditionIconTile}>
          <Image fadeDuration={0}
            accessibilityLabel={model.isLuckyTrade ? 'Lucky trade' : 'Not a Lucky trade'}
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky_friend_icon.png') }}
            style={[styles.conditionIcon, !model.isLuckyTrade && styles.inactive]}
          />
        </View>
        <View style={styles.conditionIconTile}>
          <Image fadeDuration={0}
            accessibilityLabel={model.isRemoteTrade ? 'Remote trade available' : 'Remote trade unavailable'}
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, '/images/remote_trade_icon.png') }}
            style={[styles.conditionIcon, !model.isRemoteTrade && styles.inactive]}
          />
        </View>
      </View>
    </View>
    <View style={styles.exchangeIconWrap}>
      <Image fadeDuration={0}
        accessibilityLabel="Trade exchange"
        resizeMode="contain"
        source={{ uri: toAssetUrl(assetBaseUrl, '/images/pogo_trade_icon.png') }}
        style={styles.exchangeIcon}
      />
    </View>
    <View style={styles.costGroup}>
      <Text style={[styles.conditionLabel, light && styles.accentLight]}>STARDUST</Text>
      <View style={styles.costValue}>
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/stardust.png') }}
          style={styles.stardust}
        />
        <Text maxFontSizeMultiplier={1.2} style={[styles.costText, light && styles.textLight]}>
          {model.stardustCost?.toLocaleString() ?? '—'}
        </Text>
      </View>
    </View>
  </View>
);

const TradeCard = ({
  assetBaseUrl,
  light,
  onRequestAction,
  onRevealPartner,
  row,
  workingAction,
}: {
  assetBaseUrl: string;
  light: boolean;
  onRequestAction: (
    row: NativeTradeActivityRow,
    action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>,
  ) => void;
  onRevealPartner: (row: NativeTradeActivityRow) => void;
  row: NativeTradeActivityRow;
  workingAction: string | null;
}) => {
  const { model } = row;
  const completed = model.activityFilter === 'Completed';
  const leftPokemon = completed ? row.partnerPokemon : row.currentUserPokemon;
  const rightPokemon = completed ? row.currentUserPokemon : row.partnerPokemon;
  const leftUsername = completed ? model.partnerUsername : model.currentUsername;
  const rightUsername = completed ? model.currentUsername : model.partnerUsername;
  const headings = model.activityFilter === 'Accepting'
    ? ['FOR TRADE', 'OFFERED']
    : model.activityFilter === 'Proposed'
      ? ['OFFERED', 'FOR TRADE']
      : model.activityFilter === 'Completed'
        ? ['RECEIVED POKÉMON', 'TRADED POKÉMON']
        : ['YOUR POKÉMON', "TRADE PARTNER'S POKÉMON"];
  const coordinateAction = model.actions.find(({ action }) => action === 'coordinate');
  const commandActions = model.actions.filter(
    (action): action is NativeTradeActivityActionModel & {
      action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>;
    } => action.action !== 'coordinate',
  );
  return (
    <View style={[styles.tradeCard, light && styles.cardLight]} testID={`trade-card-${model.tradeId}`}>
      <View style={styles.tradeHeader}>
        <View style={styles.tradeHeaderCopy}>
          <Text style={[styles.statusLabel, light && styles.accentLight]}>{model.label.toLocaleUpperCase()}</Text>
          <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={[styles.tradeTitle, light && styles.textLight]}>
            {model.title}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={[styles.tradeDescription, light && styles.secondaryLight]}>
            {model.description}
          </Text>
        </View>
        <Text style={[styles.date, light && styles.secondaryLight]}>{formatDate(model.displayTimestamp)}</Text>
      </View>

      {coordinateAction ? (
        <View style={styles.coordinateRow}>
          <Pressable
            accessibilityRole="button"
            disabled={workingAction !== null}
            onPress={() => onRevealPartner(row)}
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryAction,
              styles.coordinateAction,
              pressed && workingAction === null && styles.pressed,
              workingAction !== null && styles.disabled,
            ]}
            testID={`trade-action-coordinate-${model.tradeId}`}
          >
            {workingAction === `${model.tradeId}:coordinate` ? <ActivityIndicator color="#ffffff" size="small" /> : null}
            <Text style={[styles.actionText, light && styles.textLight]}>{coordinateAction.label}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.exchange}>
        <PokemonCard
          assetBaseUrl={assetBaseUrl}
          detail={leftPokemon}
          heading={headings[0]}
          isLuckyTrade={model.isLuckyTrade}
          light={light}
          username={leftUsername}
        />
        <PokemonCard
          assetBaseUrl={assetBaseUrl}
          detail={rightPokemon}
          heading={headings[1]}
          isLuckyTrade={model.isLuckyTrade}
          light={light}
          username={rightUsername}
        />
      </View>

      <TradeConditions assetBaseUrl={assetBaseUrl} light={light} model={model} />
      {completed ? (
        <Text style={[styles.satisfactionCopy, light && styles.secondaryLight]}>
          {model.currentUserSatisfaction ? 'Thanks for the feedback!' : 'Satisfied with your trade?'}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {commandActions.map((action) => {
          const actionKey = `${model.tradeId}:${action.action}`;
          const disabled = workingAction !== null || action.disabled === true;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: action.selected === true }}
              disabled={disabled}
              key={action.action}
              onPress={() => action.disabled ? undefined : onRequestAction(row, action.action)}
              style={({ pressed }) => [
                styles.actionButton,
                action.tone === 'primary' && styles.primaryAction,
                action.tone === 'secondary' && styles.secondaryAction,
                action.tone === 'destructive' && styles.destructiveAction,
                action.selected && styles.selectedAction,
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
              testID={`trade-action-${action.action}-${model.tradeId}`}
            >
              {workingAction === actionKey ? <ActivityIndicator color="#ffffff" size="small" /> : null}
              {action.action === 'satisfy' && workingAction !== actionKey ? <Text style={styles.satisfactionIcon}>👍</Text> : null}
              <Text style={[styles.actionText, action.tone === 'secondary' && light && styles.textLight]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export const NativeTradeActivityScreen = ({
  assetBaseUrl,
  error,
  isLoading,
  onAction,
  onOpenPreferences,
  onRetry,
  onRevealPartner,
  pageHeader = null,
  rows,
  showModeTabs = true,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const fadeAnimation = useNativeModalAnimation('fade');
  const slideAnimation = useNativeModalAnimation('slide');
  const [selectedFilter, setSelectedFilter] = useState<TradeActivityFilter>('Accepting');
  const [pending, setPending] = useState<{
    row: NativeTradeActivityRow;
    action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>;
  } | null>(null);
  const [partner, setPartner] = useState<{ username: string; info: PartnerInfo } | null>(null);
  const [copiedPartnerField, setCopiedPartnerField] = useState<CopiedPartnerField | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const rowsByFilter = useMemo(() => {
    const grouped: Record<TradeActivityFilter, NativeTradeActivityRow[]> = {
      Accepting: [],
      Proposed: [],
      Pending: [],
      Completed: [],
      Cancelled: [],
    };
    for (const row of rows) grouped[row.model.activityFilter].push(row);
    return grouped;
  }, [rows]);
  const counts = useMemo(() => Object.fromEntries(TRADE_ACTIVITY_FILTERS.map((filter) => [
    filter,
    rowsByFilter[filter].length,
  ])) as Record<TradeActivityFilter, number>, [rowsByFilter]);
  const visibleRows = rowsByFilter[selectedFilter];
  useEffect(() => {
    if (!copiedPartnerField) return undefined;
    const timer = setTimeout(() => setCopiedPartnerField(null), 1_800);
    return () => clearTimeout(timer);
  }, [copiedPartnerField]);
  const closePartner = () => {
    setPartner(null);
    setCopiedPartnerField(null);
  };
  const copyPartnerValue = async (field: CopiedPartnerField, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedPartnerField(field);
    } catch {
      setCopiedPartnerField(null);
    }
  };
  const runAction = async (
    row: NativeTradeActivityRow,
    action: Exclude<NativeTradeActivityActionModel['action'], 'coordinate'>,
  ) => {
    const startedAt = Date.now();
    setPending(null);
    setFeedback(null);
    setWorkingAction(`${row.model.tradeId}:${action}`);
    try {
      await onAction(row.model, action);
      setFeedback({ tone: 'success', text: 'Trade updated from the server response.' });
      markNativeUiPerformanceAfterPaint('trade_activity_action_result_painted', startedAt);
    } catch (actionError) {
      setFeedback({
        tone: 'error',
        text: actionError instanceof Error
          ? actionError.message
          : 'The trade could not be updated. Please try again.',
      });
    } finally {
      setWorkingAction(null);
    }
  };
  const runPendingAction = async () => {
    if (!pending) return;
    await runAction(pending.row, pending.action);
  };
  const revealPartner = async (row: NativeTradeActivityRow) => {
    const startedAt = Date.now();
    setFeedback(null);
    setWorkingAction(`${row.model.tradeId}:coordinate`);
    try {
      const info = await onRevealPartner(row.model.tradeId);
      setPartner({ username: row.model.partnerUsername, info });
      markNativeUiPerformanceAfterPaint('trade_activity_partner_result_painted', startedAt);
    } catch (revealError) {
      setFeedback({
        tone: 'error',
        text: revealError instanceof Error
          ? revealError.message
          : 'Coordination details could not be loaded.',
      });
    } finally {
      setWorkingAction(null);
    }
  };

  return (
    <View style={[styles.screen, light && styles.screenLight]} testID="native-trade-activity-screen">
      <FlatList
        contentContainerStyle={[
          visibleRows.length && !isLoading ? styles.listContent : styles.emptyListContent,
          { paddingBottom: 150 + insets.bottom },
        ]}
        data={isLoading ? [] : visibleRows}
        initialNumToRender={4}
        keyExtractor={(row) => row.model.tradeId}
        keyboardShouldPersistTaps="always"
        maxToRenderPerBatch={4}
        nestedScrollEnabled
        ListHeaderComponent={(
          <>
            {pageHeader}
            {showModeTabs ? (
              <View accessibilityRole="tablist" style={[styles.modeTabs, light && styles.modeTabsLight]}>
                <Pressable aria-selected={false} accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={onOpenPreferences} style={styles.modeTab}>
                  <Text style={[styles.modeTabText, light && styles.secondaryLight]}>Trade Preferences</Text>
                </Pressable>
                <View aria-selected accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.modeTab, styles.activeModeTab]}>
                  <Text style={styles.activeModeText}>Trade Activity</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.pageHeading}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.25} style={[styles.pageTitle, light && styles.textLight]}>
                Your trades
              </Text>
              <Text maxFontSizeMultiplier={1.25} style={[styles.pageDescription, light && styles.secondaryLight]}>
                Respond to offers, track active trades, and revisit past exchanges.
              </Text>
            </View>

            <View accessibilityRole="tablist" style={[styles.statusTabs, light && styles.statusTabsLight]}>
              {TRADE_ACTIVITY_FILTERS.map((filter) => {
                const selected = filter === selectedFilter;
                const filterTone = FILTER_TONES[filter];
                return (
                  <Pressable
                    aria-selected={selected}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    key={filter}
                    onPress={() => {
                      const startedAt = Date.now();
                      setFeedback(null);
                      setSelectedFilter(filter);
                      markNativeUiPerformanceAfterPaint('trade_activity_status_result_painted', startedAt);
                    }}
                    style={[
                      styles.statusTab,
                      selected && styles.activeStatusTab,
                      selected && { borderColor: filterTone.border, backgroundColor: filterTone.surface },
                    ]}
                    testID={`trade-filter-${filter}`}
                  >
                    <Text
                      maxFontSizeMultiplier={1.15}
                      numberOfLines={2}
                      style={[styles.statusTabText, light && styles.secondaryLight, selected && styles.activeStatusText]}
                    >
                      {FILTER_LABELS[filter].compact}
                    </Text>
                    <View style={[styles.countBadge, selected && { backgroundColor: filterTone.accent }]}>
                      <Text style={styles.countText}>{counts[filter]}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {feedback ? (
              <View
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
                style={[styles.feedback, feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError]}
                testID="trade-activity-feedback"
              >
                <Text style={styles.feedbackText}>{feedback.text}</Text>
                <Pressable accessibilityLabel="Dismiss message" accessibilityRole="button" onPress={() => setFeedback(null)}>
                  <Text style={styles.feedbackDismiss}>×</Text>
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <View accessibilityRole="alert" style={[styles.feedback, styles.feedbackError]}>
                <View style={styles.errorCopy}>
                  <Text style={styles.feedbackTitle}>Trades unavailable</Text>
                  <Text style={styles.feedbackText}>{error}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
        ListEmptyComponent={isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#36c181" size="large" />
            <Text style={[styles.stateTitle, light && styles.textLight]}>Loading trades</Text>
            <Text style={[styles.stateBody, light && styles.secondaryLight]}>Checking the server for your current activity…</Text>
          </View>
        ) : error ? null : (
          <View style={[styles.emptyState, light && styles.cardLight]}>
            <View style={styles.emptyIcon}><NativeUiIcon color="#36c181" name="trade" size={17} /></View>
            <Text style={[styles.stateTitle, light && styles.textLight]}>No trades here</Text>
            <Text style={[styles.stateBody, light && styles.secondaryLight]}>
              {selectedFilter === 'Accepting'
                ? 'New offers will appear here.'
                : selectedFilter === 'Proposed'
                  ? 'Sent proposals will appear here.'
                  : selectedFilter === 'Pending'
                    ? 'Accepted trades will stay here until completion.'
                    : selectedFilter === 'Completed'
                      ? 'Completed trades will appear here.'
                      : 'Cancelled and denied trades appear here.'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TradeCard
            assetBaseUrl={assetBaseUrl}
            light={light}
            onRequestAction={(row, action) => {
              if (action === 'satisfy') {
                void runAction(row, action);
                return;
              }
              const startedAt = Date.now();
              setPending({ row, action });
              markNativeUiPerformanceAfterPaint('trade_activity_confirmation_painted', startedAt);
            }}
            onRevealPartner={(row) => void revealPartner(row)}
            row={item}
            workingAction={workingAction}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.activityList}
        testID="trade-activity-list"
        updateCellsBatchingPeriod={0}
      />

      <Modal animationType={fadeAnimation} onRequestClose={() => setPending(null)} transparent visible={Boolean(pending)}>
        <View style={styles.modalOverlay}>
          {pending ? (
            <View style={[styles.modalCard, light && styles.modalCardLight]} testID="trade-action-confirmation">
              <Text style={styles.modalEyebrow}>TRAINER ACTION</Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.modalTitle, light && styles.textLight]}>
                {confirmationCopy(pending.action).title}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.modalBody, light && styles.secondaryLight]}>
                {confirmationCopy(pending.action).body}
              </Text>
              <View style={styles.modalActions}>
                <Pressable accessibilityRole="button" onPress={() => setPending(null)} style={styles.modalCancel}>
                  <Text style={[styles.modalCancelText, light && styles.textLight]}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void runPendingAction()} style={styles.modalConfirm}>
                  <Text style={styles.modalConfirmText}>{confirmationCopy(pending.action).confirm}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal animationType={slideAnimation} onRequestClose={closePartner} transparent visible={Boolean(partner)}>
        <View style={styles.modalOverlay}>
          {partner ? (
            <ScrollView
              contentContainerStyle={[styles.partnerCard, light && styles.modalCardLight]}
              showsVerticalScrollIndicator={false}
              style={styles.partnerScroller}
              testID="trade-partner-information"
            >
              <Pressable
                accessibilityLabel="Close trade coordination"
                accessibilityRole="button"
                hitSlop={10}
                onPress={closePartner}
                style={styles.partnerClose}
                testID="trade-partner-close"
              >
                <Text style={[styles.partnerCloseText, light && styles.textLight]}>×</Text>
              </Pressable>
              <Text style={styles.modalEyebrow}>ACCEPTED TRADE</Text>
              <Text style={[styles.modalTitle, light && styles.textLight]}>Coordinate the exchange</Text>
              <Text style={[styles.modalBody, light && styles.secondaryLight]}>
                Pokémon Go Nexus matches the trade. You and {partner.info.pokemonGoName || partner.username || 'your trade partner'} arrange the details externally, then complete it in Pokémon GO.
              </Text>
              {partner.info.sharingEnabled ? (
                <>
                  <View accessibilityLabel="Trade coordination steps" style={styles.partnerSteps}>
                    {['Add trainer', 'Message externally', 'Trade in Pokémon GO'].map((step, index) => (
                      <View key={step} style={styles.partnerStep}>
                        <View style={styles.partnerStepNumber}><Text style={styles.partnerStepNumberText}>{index + 1}</Text></View>
                        <Text style={[styles.partnerStepText, light && styles.textLight]}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.partnerIdentityGrid}>
                    {([
                      ['pokemon-go-name', 'Pokémon GO name', partner.info.pokemonGoName || ''],
                      ['trainer-code', 'Trainer Code', formatNativeTrainerCode(partner.info.trainerCode)],
                    ] as const).map(([field, label, value]) => (
                      <View key={field} style={[styles.partnerDetailCard, light && styles.partnerDetailCardLight]}>
                        <Text style={[styles.partnerDetailLabel, light && styles.accentLight]}>{label}</Text>
                        <Text style={[styles.partnerDetailValue, light && styles.textLight]}>{value || 'Not provided'}</Text>
                        {value ? (
                          <Pressable
                            accessibilityLabel={`Copy ${label.toLocaleLowerCase()}`}
                            accessibilityRole="button"
                            onPress={() => void copyPartnerValue(field, value)}
                            style={styles.partnerCopyButton}
                            testID={`trade-copy-${field}`}
                          >
                            <NativeUiIcon color="#071411" name={copiedPartnerField === field ? 'check' : 'share'} size={13} />
                            <Text style={styles.partnerCopyText}>{copiedPartnerField === field ? 'Copied' : 'Copy'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  <View style={[styles.partnerMethodCard, light && styles.partnerDetailCardLight]}>
                    <View style={styles.partnerMethodIcon}><NativeUiIcon color="#061411" name="link" size={18} /></View>
                    <View style={styles.partnerMethodCopy}>
                      <Text style={[styles.partnerDetailLabel, light && styles.accentLight]}>Preferred contact</Text>
                      <Text style={[styles.partnerDetailValue, light && styles.textLight]}>{coordinationLabel(partner.info.coordinationMethod)}</Text>
                      <Text style={[styles.partnerMethodHint, light && styles.secondaryLight]}>
                        {partner.info.coordinationHandle
                          ? `@${partner.info.coordinationHandle}`
                          : partner.info.coordinationMethod === 'campfire'
                            ? 'Add the Trainer Code first, then find your new Niantic friend in Campfire.'
                            : 'No username was provided. Use the Trainer Code to connect if available.'}
                      </Text>
                    </View>
                    <View style={styles.partnerMethodActions}>
                      {partner.info.coordinationHandle ? (
                        <Pressable
                          accessibilityLabel="Copy coordination username"
                          accessibilityRole="button"
                          onPress={() => void copyPartnerValue('coordination-handle', partner.info.coordinationHandle || '')}
                          style={styles.partnerOutlineButton}
                          testID="trade-copy-coordination-handle"
                        >
                          <Text style={[styles.partnerOutlineText, light && styles.textLight]}>{copiedPartnerField === 'coordination-handle' ? 'Copied' : 'Copy username'}</Text>
                        </Pressable>
                      ) : null}
                      {partner.info.coordinationMethod === 'campfire' || partner.info.coordinationMethod === 'discord' ? (
                        <Pressable
                          accessibilityRole="link"
                          onPress={() => void Linking.openURL(partner.info.coordinationMethod === 'campfire'
                            ? 'https://campfire.nianticlabs.com/'
                            : 'https://discord.com/app')}
                          style={styles.partnerExternalButton}
                        >
                          <Text style={styles.partnerExternalText}>Open {coordinationLabel(partner.info.coordinationMethod)}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {partner.info.location ? (
                    <Text style={[styles.partnerLocation, light && styles.secondaryLight]}>
                      <Text style={[styles.partnerLocationLabel, light && styles.textLight]}>General location:</Text> {partner.info.location}
                    </Text>
                  ) : null}
                </>
              ) : (
                <View style={[styles.partnerUnavailable, light && styles.partnerDetailCardLight]}>
                  <NativeUiIcon color="#45c9aa" name="shield" size={24} />
                  <View style={styles.partnerUnavailableCopy}>
                    <Text style={[styles.partnerDetailValue, light && styles.textLight]}>
                      {partner.info.pokemonGoName || partner.username || 'Your trade partner'} has not shared coordination details.
                    </Text>
                    <Text style={[styles.partnerMethodHint, light && styles.secondaryLight]}>
                      The trade remains active, but you will need an existing way to contact them.
                    </Text>
                  </View>
                </View>
              )}
              <View style={[styles.partnerSafety, light && styles.partnerSafetyLight]}>
                <NativeUiIcon color="#45c9aa" name="shield" size={20} />
                <Text style={[styles.partnerSafetyText, light && styles.secondaryLight]}>
                  Messaging and the in-game exchange happen outside Pokémon Go Nexus. Protect your privacy, confirm the trainer and Pokémon, and never send money or account credentials.
                </Text>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07100f' },
  screenLight: { backgroundColor: '#f8fff9' },
  activityList: { flex: 1 },
  modeTabs: { flexDirection: 'row', marginHorizontal: 8, borderWidth: 1, borderColor: '#1d4a43', borderRadius: 10, padding: 4, backgroundColor: '#081312' },
  modeTabsLight: { borderColor: '#9db8b2', backgroundColor: '#e8efed' },
  modeTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 8 },
  activeModeTab: { backgroundColor: '#36c5a4' },
  modeTabText: { color: '#9eb8b3', fontWeight: '800', textAlign: 'center' },
  activeModeText: { color: '#041411', fontWeight: '900' },
  pageHeading: { alignItems: 'center', gap: 3, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 18 },
  pageTitle: { color: '#f4faf8', fontSize: 30, lineHeight: 35, fontWeight: '900', textAlign: 'center' },
  pageDescription: { maxWidth: 420, color: '#9db6b2', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  statusTabs: { flexDirection: 'row', marginHorizontal: 8, borderWidth: 1, borderColor: '#1b403b', borderRadius: 12, padding: 4, backgroundColor: '#071211' },
  statusTabsLight: { borderColor: '#abc1bc', backgroundColor: '#eef3f2' },
  statusTab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 8, paddingHorizontal: 2 },
  activeStatusTab: { borderWidth: 1 },
  statusTabText: { color: '#a4b8b4', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  activeStatusText: { color: '#ffffff' },
  countBadge: { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#182725' },
  countText: { color: '#e7f4f1', fontSize: 11, fontWeight: '900' },
  // Leave every terminal action scrollable above the persistent action-menu
  // anchor. Without this clearance, the anchor can intercept a press on the
  // final card action even though that action is technically visible.
  listContent: { gap: 12, paddingTop: 7, paddingHorizontal: 8, paddingBottom: 150 },
  emptyListContent: { flexGrow: 1, gap: 9, paddingTop: 7, paddingHorizontal: 8, paddingBottom: 150 },
  tradeCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#24554d', borderRadius: 13, backgroundColor: '#111b1a' },
  cardLight: { borderColor: '#9ab7b0', backgroundColor: '#ffffff' },
  tradeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, borderLeftWidth: 4, borderLeftColor: '#36c181', borderBottomWidth: 1, borderBottomColor: '#204640', padding: 11 },
  tradeHeaderCopy: { flex: 1, gap: 1 },
  statusLabel: { color: '#42d492', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  accentLight: { color: '#087454' },
  tradeTitle: { color: '#f7fbfa', fontSize: 16, fontWeight: '900' },
  tradeDescription: { color: '#9fb7b2', fontSize: 12, lineHeight: 16 },
  date: { flexShrink: 0, color: '#99b3ae', fontSize: 11 },
  coordinateRow: { alignItems: 'stretch', paddingTop: 8, paddingHorizontal: 8 },
  coordinateAction: { width: '100%' },
  exchange: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 8 },
  pokemonCard: { flex: 1, minWidth: 0, minHeight: 205, alignItems: 'center', borderWidth: 1, borderColor: '#2b5a53', borderRadius: 11, padding: 7, backgroundColor: '#071514' },
  surfaceLight: { borderColor: '#a8bdb8', backgroundColor: '#f5f9f8' },
  partyHeader: { width: '100%', minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  partyUsername: { color: '#9fb7b2', fontSize: 9, lineHeight: 11, textAlign: 'center' },
  partyLabel: {
    width: '100%',
    minHeight: 13,
    color: '#62d7bd',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.55,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  pokemonStage: { width: '100%', height: 124, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  luckyBackdrop: { position: 'absolute', width: 138, height: 138, opacity: 0.88 },
  pokemonImage: { width: 112, height: 112 },
  maxBadge: { position: 'absolute', top: 7, right: 6, width: 32, height: 32 },
  missingPokemon: { color: '#9fb7b2', fontSize: 12 },
  pokemonName: { minHeight: 38, color: '#ffffff', fontSize: 14, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  pokemonTypes: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  typeIcon: { width: 20, height: 20 },
  genderFemale: { position: 'absolute', right: 5, bottom: 3, color: '#ff3b87', fontSize: 24, fontWeight: '900' },
  genderMale: { position: 'absolute', right: 5, bottom: 3, color: '#30a7ff', fontSize: 24, fontWeight: '900' },
  detailsButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: 5, borderWidth: 1, borderColor: '#315b54', borderRadius: 7, paddingHorizontal: 9, backgroundColor: '#142522' },
  detailsButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  detailsPanel: { alignSelf: 'stretch', gap: 8, marginTop: 8, borderWidth: 1, borderColor: '#315b54', borderRadius: 8, padding: 8, backgroundColor: '#142522' },
  detailsPanelLight: { borderColor: '#a8bdb8', backgroundColor: '#ffffff' },
  detailStatGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  detailStat: { minWidth: 56, alignItems: 'center' },
  detailStatValue: { color: '#ffffff', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  detailLabel: { color: '#8da7a2', fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.45 },
  detailGroup: { gap: 6 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moveTypeIcon: { width: 18, height: 18 },
  moveCopy: { flex: 1, minWidth: 0 },
  detailValue: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  ivGrid: { flexDirection: 'row', justifyContent: 'space-around', gap: 3 },
  ivCell: { flex: 1, alignItems: 'center', borderRadius: 6, paddingVertical: 5, backgroundColor: '#ffffff0a' },
  ivValue: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  provenance: { color: '#9fb7b2', fontSize: 10, lineHeight: 14 },
  provenanceLabel: { color: '#ffffff', fontWeight: '900' },
  noDetails: { color: '#9fb7b2', fontSize: 11, lineHeight: 15, textAlign: 'center' },
  exchangeIconWrap: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#193632' },
  exchangeIcon: { width: 29, height: 29 },
  conditions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 8, borderWidth: 1, borderColor: '#244b45', borderRadius: 10, padding: 9, backgroundColor: '#0a1715' },
  conditionsLight: { borderColor: '#a8bdb8', backgroundColor: '#eef5f3' },
  friendshipGroup: { flex: 1, minWidth: 0, gap: 3 },
  costGroup: { flexShrink: 0, alignItems: 'flex-end', gap: 3 },
  conditionLabel: { color: '#69ceb6', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  conditionIcons: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 3 },
  hearts: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' },
  heart: { width: 22, height: 22, marginRight: -1 },
  conditionIconTile: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#193632' },
  conditionIcon: { width: 30, height: 30 },
  inactive: { opacity: 0.25 },
  costValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stardust: { width: 20, height: 34 },
  costText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 8 },
  actionButton: { flexGrow: 1, minWidth: '46%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, paddingHorizontal: 10 },
  primaryAction: { backgroundColor: '#287e52' },
  secondaryAction: { borderWidth: 1, borderColor: '#64817b', backgroundColor: 'transparent' },
  destructiveAction: { backgroundColor: '#a44250' },
  selectedAction: { borderWidth: 1, borderColor: '#77e6c8', backgroundColor: '#16664c' },
  actionText: { color: '#ffffff', fontWeight: '900', textAlign: 'center' },
  satisfactionCopy: { marginTop: 9, color: '#9fb7b2', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  satisfactionIcon: { fontSize: 15 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  feedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginHorizontal: 8, borderWidth: 1, borderRadius: 10, padding: 11 },
  feedbackSuccess: { borderColor: '#2fbd79', backgroundColor: '#13372b' },
  feedbackError: { borderColor: '#ef5b72', backgroundColor: '#3a1820' },
  feedbackTitle: { color: '#ffffff', fontWeight: '900' },
  feedbackText: { flex: 1, color: '#ffffff', lineHeight: 19 },
  feedbackDismiss: { color: '#ffffff', fontSize: 24, lineHeight: 26 },
  errorCopy: { flex: 1, gap: 2 },
  retryButton: { minHeight: 40, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 14, backgroundColor: '#ef5b72' },
  retryText: { color: '#ffffff', fontWeight: '900' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 26 },
  emptyState: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2b5a53', borderRadius: 13, padding: 22, backgroundColor: '#111b1a' },
  emptyIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#19302d' },
  emptyIconText: { color: '#42d4c4', fontSize: 22 },
  stateTitle: { color: '#ffffff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  stateBody: { maxWidth: 340, color: '#9fb7b2', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#000000b8' },
  modalCard: { width: '100%', maxWidth: 440, gap: 10, borderWidth: 1, borderColor: '#36c5a4', borderRadius: 18, padding: 18, backgroundColor: '#10201e' },
  modalCardLight: { borderColor: '#428f80', backgroundColor: '#ffffff' },
  modalEyebrow: { color: '#42d4c4', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: '#ffffff', fontSize: 23, fontWeight: '900' },
  modalBody: { color: '#b0c5c0', fontSize: 15, lineHeight: 21 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalCancel: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#617a75', borderRadius: 24 },
  modalCancelText: { color: '#ffffff', fontWeight: '900' },
  modalConfirm: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingHorizontal: 15, backgroundColor: '#36c5a4' },
  modalConfirmText: { color: '#041411', fontWeight: '900', textAlign: 'center' },
  partnerScroller: { width: '100%', maxWidth: 460, maxHeight: '92%' },
  partnerCard: { gap: 11, borderWidth: 1, borderColor: '#36c5a4', borderRadius: 18, padding: 18, backgroundColor: '#10201e' },
  partnerClose: { position: 'absolute', zIndex: 2, top: 8, right: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#ffffff10' },
  partnerCloseText: { color: '#ffffff', fontSize: 28, lineHeight: 30 },
  partnerSteps: { flexDirection: 'row', gap: 5 },
  partnerStep: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5, borderRadius: 9, padding: 8, backgroundColor: '#ffffff08' },
  partnerStepNumber: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#36c5a4' },
  partnerStepNumberText: { color: '#061411', fontSize: 11, fontWeight: '900' },
  partnerStepText: { color: '#ffffff', fontSize: 10, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  partnerIdentityGrid: { flexDirection: 'row', gap: 7 },
  partnerDetailCard: { flex: 1, minWidth: 0, gap: 5, borderWidth: 1, borderColor: '#315750', borderRadius: 11, padding: 10, backgroundColor: '#0b1917' },
  partnerDetailCardLight: { borderColor: '#a8bdb8', backgroundColor: '#f5f9f8' },
  partnerDetailLabel: { color: '#69ceb6', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  partnerDetailValue: { color: '#ffffff', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  partnerCopyButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 7, backgroundColor: '#36c5a4' },
  partnerCopyText: { color: '#071411', fontSize: 11, fontWeight: '900' },
  partnerMethodCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderColor: '#315750', borderRadius: 11, padding: 11, backgroundColor: '#0b1917' },
  partnerMethodIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#36c5a4' },
  partnerMethodCopy: { flex: 1, minWidth: 0, gap: 2 },
  partnerMethodHint: { color: '#9fb7b2', fontSize: 11, lineHeight: 15 },
  partnerMethodActions: { gap: 6 },
  partnerOutlineButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#64817b', borderRadius: 7, paddingHorizontal: 8 },
  partnerOutlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  partnerExternalButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 8, backgroundColor: '#36c5a4' },
  partnerExternalText: { color: '#071411', fontSize: 10, fontWeight: '900' },
  partnerLocation: { color: '#9fb7b2', fontSize: 12, lineHeight: 17 },
  partnerLocationLabel: { color: '#ffffff', fontWeight: '900' },
  partnerUnavailable: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#315750', borderRadius: 11, padding: 12, backgroundColor: '#0b1917' },
  partnerUnavailableCopy: { flex: 1, gap: 3 },
  partnerSafety: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderColor: '#315750', borderRadius: 11, padding: 11, backgroundColor: '#091513' },
  partnerSafetyLight: { borderColor: '#a8bdb8', backgroundColor: '#eef5f3' },
  partnerSafetyText: { flex: 1, color: '#9fb7b2', fontSize: 11, lineHeight: 15 },
  textLight: { color: '#13201e' },
  secondaryLight: { color: '#526762' },
});
