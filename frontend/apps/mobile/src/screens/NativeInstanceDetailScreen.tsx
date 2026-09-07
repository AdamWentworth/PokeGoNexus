import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PanGestureHandler } from 'react-native-gesture-handler';
import type {
  NativeInstanceBackgroundOption,
  NativeInstanceDetail,
  NativeInstanceMoveOption,
} from '../features/collection/collectionModel';
import type {
  NativeInstanceDetailPatch,
} from '../features/collection/nativeInstanceDetailMutation';
import { NativeUiIcon } from '../components/NativeUiIcon';
import type {
  PokemonSizeClass,
  WantedSizePreferences,
  WantedSizeRange,
} from '@pokemongonexus/shared-contracts/instances';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import {
  NativePokemonLocationBackdrop,
} from '../features/collection/parity/NativePokemonLocationBackdrop';
import {
  useNativeOverlaySwipeNavigation,
} from '../features/collection/parity/useNativeOverlaySwipeNavigation';
import { getNativeLocationSuggestions } from '../services/locationApi';
import { getPokemonLevelArcProgress } from '@pokemongonexus/shared-domain/combat-power';
import {
  getPokemonShadowMoveBonus,
  type PokemonMoveDamageMode,
} from '@pokemongonexus/shared-domain/moves';
import {
  calculateNativeDraftCp,
  firstNativeCombatError,
  validateNativeCombatDraft,
} from '../features/collection/nativeCombatPower';
import {
  useNativeModalAnimation,
  useNativeReducedMotion,
} from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
} from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl?: string;
  detail: NativeInstanceDetail | null;
  isLoading: boolean;
  error: string | null;
  cachedAt: number | null;
  movesWarning: string | null;
  saveNotice: string | null;
  saveError: string | null;
  isSaving: boolean;
  onRetry: () => void;
  onBack: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onOpenTarget?: (instanceId: string) => void;
  onToggleFavorite: (favorite: boolean) => void;
  /** @deprecated Native editing is handled by onSaveDetails. */
  onEditInCurrentApp?: () => void;
  onEditPreferences?: () => void;
  onSaveDetails?: (patch: NativeInstanceDetailPatch) => Promise<unknown>;
  canEdit?: boolean;
};

type NativeInstanceLocationBackdropStatus = 'caught' | 'trade' | 'wanted';

export const resolveNativeInstanceLocationBackdropLayout = (
  viewportWidth: number,
  status: NativeInstanceLocationBackdropStatus,
) => {
  const contract = collectionExperienceParityContract.locationBackdrop;
  const wantedStageSize = viewportWidth <= contract.wantedStage.narrowMaxWidth
    ? contract.wantedStage.narrowSize
    : viewportWidth <= contract.wantedStage.phoneMaxWidth
      ? contract.wantedStage.phoneSize
      : contract.wantedStage.wideSize;
  const stageSize = status === 'wanted'
    ? wantedStageSize
    : contract.standardStageSize;
  const stageLift = status === 'wanted'
    ? viewportWidth <= contract.wantedStage.phoneMaxWidth
      ? contract.wantedStage.phoneLift
      : contract.wantedStage.wideLift
    : contract.standardStageLift;

  return {
    backdropHeight: stageSize + Math.abs(contract.topOffset),
    backdropTop: contract.topOffset,
    backdropWidth: Math.min(
      viewportWidth * contract.viewportWidthRatio,
      contract.maxWidth,
    ),
    maxBadgeSize: stageSize * 0.35,
    pokemonSize: stageSize * 0.98,
    purifiedBadgeSize: stageSize * 0.2,
    stageLift,
    stageSize,
  };
};

type NativeInstanceEditDraft = {
  nickname: string;
  cp: string;
  level: string;
  gender: string | null;
  weight: string;
  height: string;
  attackIv: string;
  defenseIv: string;
  staminaIv: string;
  locationCaught: string;
  dateCaught: string;
  friendship: number;
  prefLucky: boolean;
  mostWanted: boolean;
  fastMove: number | null;
  chargedMove1: number | null;
  chargedMove2: number | null;
  weightSize: PokemonSizeClass | null;
  heightSize: PokemonSizeClass | null;
  locationCard: string | null;
  lucky: boolean;
  isTraded: boolean;
  originalTrainerId: string | null;
  originalTrainerName: string;
  tradedDate: string;
  pokeball: string | null;
  shadow: boolean;
  purified: boolean;
  maxAttack: number | null;
  maxGuard: number | null;
  maxSpirit: number | null;
  megaRegistered: boolean;
  megaEnabled: boolean;
  megaForm: string | null;
  crowned: boolean;
  crownForm: string | null;
  fused: boolean;
  fusionId: number | null;
  fusionForm: string | null;
  fusedWith: string | null;
};

const editableNumber = (value: unknown): string => (
  typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
);

// Historic collection rows may contain zero for an unknown physical
// measurement. The canonical overlay treats that as missing metadata, not as
// a literal zero-kilogram or zero-metre Pokémon.
const editablePhysicalMeasurement = (value: unknown): string => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(value) : ''
);

const resolveWantedSizeClass = (
  detail: NativeInstanceDetail,
  metric: 'weight' | 'height',
): PokemonSizeClass | null => {
  const stored = detail.instance?.wanted_size_preferences?.[metric]?.category;
  if (stored) return stored;
  const value = detail.instance?.[metric];
  const sizes = detail.sizeThresholds;
  if (value == null || value <= 0 || !sizes) return null;
  if (value < sizes[`${metric}_xxs_threshold`]) return 'XXS';
  if (value < sizes[`${metric}_xs_threshold`]) return 'XS';
  if (value > sizes[`${metric}_xxl_threshold`]) return 'XXL';
  if (value > sizes[`${metric}_xl_threshold`]) return 'XL';
  return null;
};

const hasPotentialMaxMoveAccess = (detail: NativeInstanceDetail): boolean => Boolean(
  detail.row.maxKind
  || detail.specialMaxBaseEligible
  || (detail.crownOptions?.length ?? 0) > 0,
);

const createEditDraft = (detail: NativeInstanceDetail): NativeInstanceEditDraft => ({
  nickname: detail.instance?.nickname
    ?? detail.row.name.trim().split(/\s+/).at(-1)
    ?? detail.row.name,
  cp: editableNumber(detail.instance?.cp),
  level: editableNumber(detail.instance?.level),
  gender: detail.instance?.gender ?? null,
  weight: editablePhysicalMeasurement(detail.instance?.weight),
  height: editablePhysicalMeasurement(detail.instance?.height),
  attackIv: editableNumber(detail.instance?.attack_iv),
  defenseIv: editableNumber(detail.instance?.defense_iv),
  staminaIv: editableNumber(detail.instance?.stamina_iv),
  locationCaught: detail.instance?.location_caught ?? '',
  dateCaught: detail.instance?.date_caught?.slice(0, 10) ?? '',
  friendship: friendshipLevelFor(detail),
  prefLucky: Boolean(detail.instance?.pref_lucky),
  mostWanted: Boolean(detail.instance?.most_wanted),
  fastMove: detail.instance?.fast_move_id ?? null,
  chargedMove1: detail.instance?.charged_move1_id ?? null,
  chargedMove2: detail.instance?.charged_move2_id ?? null,
  weightSize: resolveWantedSizeClass(detail, 'weight'),
  heightSize: resolveWantedSizeClass(detail, 'height'),
  locationCard: detail.instance?.location_card ?? null,
  lucky: Boolean(detail.instance?.lucky),
  isTraded: Boolean(detail.instance?.is_traded || detail.instance?.lucky),
  originalTrainerId: detail.instance?.original_trainer_id ?? null,
  originalTrainerName: detail.instance?.original_trainer_name ?? '',
  tradedDate: detail.instance?.traded_date?.slice(0, 10) ?? '',
  pokeball: detail.instance?.pokeball ?? null,
  shadow: Boolean(detail.instance?.shadow && !detail.instance?.purified),
  purified: Boolean(detail.instance?.purified),
  maxAttack: hasPotentialMaxMoveAccess(detail)
    ? Number(detail.instance?.max_attack ?? 1)
    : null,
  maxGuard: hasPotentialMaxMoveAccess(detail)
    ? Number(detail.instance?.max_guard ?? 0)
    : null,
  maxSpirit: hasPotentialMaxMoveAccess(detail)
    ? Number(detail.instance?.max_spirit ?? 0)
    : null,
  megaRegistered: Boolean(detail.instance?.mega || detail.instance?.is_mega),
  megaEnabled: Boolean(detail.instance?.is_mega),
  megaForm: detail.instance?.mega_form ?? detail.megaOptions?.[0]?.form ?? null,
  crowned: Boolean(detail.instance?.crown),
  crownForm: detail.instance?.fusion_form ?? detail.crownOptions?.[0]?.form ?? null,
  fused: Boolean(detail.instance?.is_fused),
  fusionId: detail.instance?.is_fused
    ? detail.fusionOptions?.find((option) => option.name === detail.instance?.fusion_form)?.id ?? null
    : null,
  fusionForm: detail.instance?.is_fused ? detail.instance.fusion_form : null,
  fusedWith: detail.instance?.is_fused ? detail.instance.fused_with : null,
});

const BALL_OPTIONS = [
  ['poke_ball', 'POKE BALL'],
  ['great_ball', 'GREAT BALL'],
  ['ultra_ball', 'ULTRA BALL'],
  ['premier_ball', 'PREMIER BALL'],
  ['master_ball', 'MASTER BALL'],
  ['safari_ball', 'SAFARI BALL'],
  ['beast_ball', 'BEAST BALL'],
] as const;

const BALL_IMAGE_FILES: Record<string, string> = {
  poke_ball: 'pokeball.png',
  great_ball: 'greatball.png',
  ultra_ball: 'ultraball.png',
  premier_ball: 'premierball.png',
  master_ball: 'masterball.png',
  safari_ball: 'safariball.png',
  beast_ball: 'beastball.png',
};

const nullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
};

const buildWantedSizeRange = (
  category: PokemonSizeClass | null,
  sizes: NativeInstanceDetail['sizeThresholds'],
  metric: 'weight' | 'height',
): WantedSizeRange | null => {
  if (!category || !sizes) return null;
  const xxs = sizes[`${metric}_xxs_threshold`];
  const xs = sizes[`${metric}_xs_threshold`];
  const xl = sizes[`${metric}_xl_threshold`];
  const xxl = sizes[`${metric}_xxl_threshold`];
  if (category === 'XXS') {
    return { category, min: null, max: xxs, min_inclusive: false, max_inclusive: false };
  }
  if (category === 'XS') {
    return { category, min: xxs, max: xs, min_inclusive: true, max_inclusive: false };
  }
  if (category === 'XL') {
    return { category, min: xl, max: xxl, min_inclusive: false, max_inclusive: true };
  }
  return { category, min: xxl, max: null, min_inclusive: false, max_inclusive: false };
};

const buildWantedSizePreferences = (
  draft: NativeInstanceEditDraft,
  sizes: NativeInstanceDetail['sizeThresholds'],
): WantedSizePreferences | null => {
  const preferences = {
    weight: buildWantedSizeRange(draft.weightSize, sizes, 'weight'),
    height: buildWantedSizeRange(draft.heightSize, sizes, 'height'),
  };
  return preferences.weight || preferences.height ? preferences : null;
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const primaryTypeName = (
  detail: NativeInstanceDetail,
  typeIconUris = detail.row.typeIconUris,
): string => {
  const match = typeIconUris[0]?.match(/\/([^/?]+)\.png(?:\?|$)/i);
  return match?.[1]?.toLowerCase() ?? 'normal';
};

const typeNamesFromIconUris = (typeIconUris: string[]): string[] => (
  typeIconUris.map((uri) => uri.match(/\/([^/?]+)\.png(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'unknown')
);

const pokemonTypesAccessibilityLabel = (typeIconUris: string[]): string => (
  `Pokémon types: ${typeNamesFromIconUris(typeIconUris).join(' and ') || 'unknown'}`
);

const pokemonTypesTestId = (typeIconUris: string[]): string => (
  `native-instance-types-${typeNamesFromIconUris(typeIconUris).join('-') || 'unknown'}`
);

const backgroundPath = (
  detail: NativeInstanceDetail,
  overrides?: {
    lucky?: boolean;
    shadow?: boolean;
    purified?: boolean;
    typeIconUris?: string[];
  },
): string => {
  const instance = detail.instance;
  const shadow = overrides?.shadow ?? instance?.shadow;
  const purified = overrides?.purified ?? instance?.purified;
  if (shadow && !purified) return '/images/backgrounds/bg_shadow.png';
  const canonicalLucky = Boolean(
    detail.row.lucky || instance?.lucky || (instance?.is_wanted && instance.pref_lucky),
  );
  if (overrides?.lucky ?? canonicalLucky) {
    return '/images/backgrounds/bg_lucky.png';
  }
  return `/images/backgrounds/bg_${primaryTypeName(detail, overrides?.typeIconUris)}.png`;
};

const STATUS = {
  caught: { accent: '#58c7eb', label: null },
  trade: { accent: '#53d39a', label: 'FOR TRADE' },
  wanted: { accent: '#ff7189', label: 'WANTED' },
} as const;

const LIGHT_STATUS = {
  caught: { accent: '#005bb5', label: null },
  trade: { accent: '#087454', label: 'FOR TRADE' },
  wanted: { accent: '#b0003b', label: 'WANTED' },
} as const;

const LevelArc = ({ level }: { level: number }) => {
  const angle = Math.PI - getPokemonLevelArcProgress(level) * Math.PI;
  const pointX = 150 + (126 * Math.cos(angle));
  const pointY = 136 - (126 * Math.sin(angle));
  return (
    <Svg height={146} viewBox="0 0 300 146" width={300}>
      <Path
        d="M24 136 A126 126 0 0 1 276 136"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth={3}
      />
      <Circle cx={pointX} cy={pointY} fill="#ffffff" r={6} />
    </Svg>
  );
};

const friendshipLevelFor = (detail: NativeInstanceDetail): number => {
  const stored = Number(detail.instance?.friendship_level);
  if (Number.isFinite(stored)) return Math.max(0, Math.min(5, Math.trunc(stored)));
  const summary = detail.preferences.find((row) => row.label === 'Friendship')?.value;
  const parsed = Number.parseInt(summary ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 0;
};

const FriendshipConditions = ({
  assetBaseUrl,
  detail,
  palette,
  onEdit,
  editing,
  draft,
  onDraftChange,
  canPickBackground,
  onOpenBackground,
  canEdit,
  accent,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  palette: typeof LIGHT;
  onEdit: () => void;
  editing: boolean;
  draft: NativeInstanceEditDraft;
  onDraftChange: (patch: Partial<NativeInstanceEditDraft>) => void;
  canPickBackground: boolean;
  onOpenBackground: () => void;
  canEdit: boolean;
  accent: string;
}) => {
  const friendship = editing ? draft.friendship : friendshipLevelFor(detail);
  const luckyRequested = editing
    ? draft.prefLucky
    : Boolean(detail.instance?.pref_lucky)
      || detail.preferences.some((row) => row.label === 'Lucky trade');
  const mostWanted = editing ? draft.mostWanted : detail.row.mostWanted;
  return (
    <View style={[styles.conditionsPanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <View style={styles.conditionsHeadingRow}>
        {canEdit ? (
          <Pressable
            accessibilityLabel={editing ? 'Save wanted listing' : 'Edit wanted listing'}
            accessibilityRole="button"
            onPress={onEdit}
            style={styles.conditionEditButton}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, editing ? '/images/save-icon.png' : '/images/edit-icon.png') }}
              style={[styles.conditionEditImage, { tintColor: palette.text }]}
            />
          </Pressable>
        ) : null}
        <View style={styles.conditionsHeadingCopy}>
          <Text style={[styles.conditionsTitle, { color: accent }]}>WANTED CONDITIONS</Text>
          <Text style={[styles.conditionsSubtitle, { color: palette.secondary }]}>Friendship and eligibility</Text>
        </View>
        {editing && canPickBackground ? (
          <Pressable
            accessibilityLabel="Choose location background"
            accessibilityRole="button"
            onPress={onOpenBackground}
            style={styles.conditionBackgroundButton}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, '/images/location.png') }}
              style={[styles.conditionBackgroundImage, { tintColor: palette.text }]}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={mostWanted ? 'Remove Most Wanted' : 'Mark as Most Wanted'}
          accessibilityRole="button"
          disabled={!editing}
          onPress={() => onDraftChange({ mostWanted: !mostWanted })}
          style={[styles.priorityBadge, mostWanted && styles.priorityBadgeActive]}
        >
          <Text style={[styles.priorityBadgeText, mostWanted && styles.priorityBadgeTextActive]}>
            {mostWanted ? '★ Most Wanted' : '☆ Most Wanted'}
          </Text>
        </Pressable>
      </View>

      <View
        accessibilityLabel={`${friendship} of 5 friendship hearts`}
        style={styles.friendshipIcons}
      >
        <View style={styles.hearts}>
          {Array.from({ length: 5 }, (_, index) => (
            <Pressable
              accessibilityLabel={`Set friendship to ${index + 1} hearts`}
              accessibilityRole="button"
              disabled={!editing}
              key={index}
              onPress={() => onDraftChange({ friendship: index + 1 })}
            >
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{
                  uri: toAssetUrl(
                    assetBaseUrl,
                    `/images/${index < friendship ? 'heart-filled' : 'heart-unfilled'}.png`,
                  ),
                }}
                style={styles.heart}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityLabel={luckyRequested ? 'Lucky trade requested' : 'Lucky trade not requested'}
          accessibilityRole="button"
          disabled={!editing}
          onPress={() => onDraftChange({ prefLucky: !luckyRequested })}
        >
          <Image fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky_friend_icon.png') }}
            style={[styles.friendshipBadgeIcon, !luckyRequested && styles.inactiveConditionIcon]}
          />
        </Pressable>
        <Image fadeDuration={0}
          accessibilityLabel={friendship >= 5 ? 'Remote trade available' : 'Remote trade unavailable'}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/remote_trade_icon.png') }}
          style={[
            styles.remoteTradeIcon,
            { tintColor: palette.text },
            friendship < 5 && styles.inactiveConditionIcon,
          ]}
        />
      </View>

      <View style={styles.friendshipStatus}>
        <View style={[styles.conditionChip, { borderColor: palette.border }]}>
          <Text style={[styles.conditionChipText, { color: palette.secondary }]}>
            {friendship === 5 ? 'Remote trade available' : `${friendship}/5 hearts`}
          </Text>
        </View>
        <View style={[styles.conditionChip, { borderColor: palette.border }]}>
          <Text style={[styles.conditionChipText, { color: palette.secondary }]}>
            {luckyRequested
              ? 'Lucky trade requested'
              : friendship >= 4
                ? 'Lucky Friends eligible'
                : 'Lucky unlocks at 4 hearts'}
          </Text>
        </View>
      </View>
      {editing ? (
        <Slider
          accessibilityLabel="Friendship level"
          maximumTrackTintColor={palette.border}
          maximumValue={5}
          minimumTrackTintColor="#58cfc1"
          minimumValue={0}
          onValueChange={(friendshipValue) => onDraftChange({
            friendship: Math.round(friendshipValue),
          })}
          step={1}
          style={styles.friendshipSlider}
          thumbTintColor="#58cfc1"
          value={friendship}
        />
      ) : null}
    </View>
  );
};

const TargetCard = ({
  assetBaseUrl,
  row,
  palette,
  onPress,
}: {
  assetBaseUrl: string;
  row: NativeInstanceDetail['row'];
  palette: typeof LIGHT;
  onPress?: () => void;
}) => (
  <Pressable
    accessibilityLabel={`Open ${row.name}`}
    accessibilityRole={onPress ? 'button' : undefined}
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => [
      styles.targetCard,
      { borderColor: palette.border, backgroundColor: palette.targetCard },
      pressed && styles.targetCardPressed,
    ]}
  >
    <View style={styles.targetImageStage}>
      {row.lucky ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
          style={styles.targetLuckyBackdrop}
        />
      ) : null}
      {row.imageUri ? (
        <Image fadeDuration={0}
          accessibilityLabel={row.name}
          resizeMode="contain"
          source={{ uri: row.imageUri }}
          style={styles.targetImage}
        />
      ) : null}
      {row.maxKind ? (
        <Image fadeDuration={0}
          accessibilityLabel={row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, `/images/${row.maxKind}.png`) }}
          style={styles.targetMaxBadge}
        />
      ) : null}
    </View>
    <Text numberOfLines={3} style={[styles.targetName, { color: palette.text }]}>{row.name}</Text>
    <Text style={[styles.targetDex, { color: palette.secondary }]}>#{String(row.pokedexNumber).padStart(4, '0')}</Text>
  </Pressable>
);

const TargetSummary = ({
  assetBaseUrl,
  detail,
  palette,
  onEdit,
  onOpenTarget,
  canEdit,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  palette: typeof LIGHT;
  onEdit: () => void;
  onOpenTarget?: (instanceId: string) => void;
  canEdit: boolean;
}) => {
  const rows = detail.targetRows ?? [];
  if (detail.row.status === 'caught') return null;
  return (
    <>
      <View
        style={[
          styles.targetsPanel,
          detail.row.status === 'trade' && styles.targetsPanelTrade,
          {
            borderColor: detail.row.status === 'wanted' ? '#98505e' : '#3f8068',
            backgroundColor: palette.targetPanel,
          },
        ]}
      >
        <View style={styles.targetsHeading}>
          <Text style={[styles.targetsTitle, { color: palette.text }]}>
            {detail.row.status === 'wanted' ? 'For Trade Pokémon' : 'Wanted Pokémon'}
          </Text>
          <View style={[styles.targetCount, { backgroundColor: detail.row.status === 'wanted' ? '#75404a' : '#2d6a51' }]}>
            <Text style={styles.targetCountText}>{rows.length}</Text>
          </View>
        </View>
        {rows.length > 0 ? (
          <View style={[styles.targetGridViewport, styles.targetGrid]} testID="native-instance-target-list">
            {rows.map((row) => (
              <TargetCard
                assetBaseUrl={assetBaseUrl}
                key={row.id}
                onPress={onOpenTarget ? () => onOpenTarget(row.id) : undefined}
                palette={palette}
                row={row}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.noTargets, { color: palette.secondary }]}>No matching targets are configured.</Text>
        )}
      </View>
      {canEdit ? (
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={[
            styles.editPreferencesButton,
            { backgroundColor: detail.row.status === 'wanted' ? '#f25770' : '#31b777' },
          ]}
        >
          <Text style={styles.editPreferencesText}>Edit preferences</Text>
        </Pressable>
      ) : null}
    </>
  );
};

const DetailRows = ({
  rows,
  secondaryColor,
  textColor,
}: {
  rows: { label: string; value: string }[];
  secondaryColor: string;
  textColor: string;
}) => (
  <View style={styles.detailRows}>
    {rows.map((row) => (
      <View key={row.label} style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: secondaryColor }]}>{row.label}</Text>
        <Text style={[styles.detailValue, { color: textColor }]}>{row.value}</Text>
      </View>
    ))}
  </View>
);

const NativeMoveModeTabs = ({
  mode,
  onChange,
  palette,
}: {
  mode: PokemonMoveDamageMode;
  onChange: (mode: PokemonMoveDamageMode) => void;
  palette: typeof LIGHT;
}) => (
  <View accessibilityLabel="Move battle mode" accessibilityRole="tablist" style={styles.moveTabs}>
    {([
      ['raid', 'GYMS & RAIDS'],
      ['pvp', 'TRAINER BATTLES'],
    ] as const).map(([value, label]) => {
      const selected = mode === value;
      return (
        <Pressable
          aria-selected={selected}
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          key={value}
          onPress={() => onChange(value)}
          style={styles.moveTabButton}
        >
          <Text style={[selected ? styles.moveTabActive : styles.moveTab, {
            color: selected ? palette.text : palette.secondary,
            borderBottomColor: selected ? palette.text : 'transparent',
          }]}
          >
            {label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const NativeMovesPanel = ({
  assetBaseUrl,
  isShadow,
  moves,
  palette,
}: {
  assetBaseUrl: string;
  isShadow: boolean;
  moves: NativeInstanceDetail['moves'];
  palette: typeof LIGHT;
}) => {
  const reduceMotion = useNativeReducedMotion();
  const [mode, setMode] = useState<PokemonMoveDamageMode>('raid');
  const [slide] = useState(() => new Animated.Value(0));
  const changeMode = (nextMode: PokemonMoveDamageMode) => {
    if (nextMode === mode) return;
    slide.stopAnimation();
    setMode(nextMode);
    if (reduceMotion) {
      slide.setValue(0);
      return;
    }
    slide.setValue(nextMode === 'pvp' ? 18 : -18);
    Animated.timing(slide, {
      duration: 220,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View accessibilityLabel="Pokémon moves" style={styles.nativeMovesPanel}>
      <NativeMoveModeTabs mode={mode} onChange={changeMode} palette={palette} />
      <Animated.View style={{ transform: [{ translateX: slide }] }}>
        {moves.map((move) => {
          const power = mode === 'raid' ? move.raidPower : move.pvpPower;
          const shadowBonus = isShadow && power != null
            ? getPokemonShadowMoveBonus(power)
            : null;
          return (
            <View key={move.label} style={styles.nativeMoveBlock}>
              <View accessibilityLabel={`${move.label}: ${move.value}`} style={styles.nativeMoveRow}>
                <View style={styles.nativeMoveIdentity}>
                  {move.typeIconUri ? (
                    <Image fadeDuration={0}
                      accessibilityLabel={`${move.typeName ?? 'Normal'} type`}
                      source={{ uri: move.typeIconUri }}
                      style={styles.nativeMoveTypeIcon}
                    />
                  ) : null}
                  <Text numberOfLines={1} style={[styles.nativeMoveName, { color: palette.text }]}>
                    {move.value}{move.legacy ? '*' : ''}
                  </Text>
                </View>
                <Text style={[styles.nativeMovePower, { color: palette.text }]}>
                  {power ?? '-'}
                  {shadowBonus != null ? <Text style={styles.nativeMovePowerBonus}>+{shadowBonus}</Text> : null}
                </Text>
              </View>
              {isShadow ? (
                <View accessibilityLabel="Shadow bonus" style={styles.nativeShadowBonusRow}>
                  <View style={styles.nativeShadowBonusIconBadge}>
                    <Image fadeDuration={0}
                      accessibilityElementsHidden
                      source={{ uri: toAssetUrl(assetBaseUrl, '/media/images/shadow_icon.png') }}
                      style={styles.nativeShadowBonusIcon}
                    />
                  </View>
                  <Text style={styles.nativeShadowBonusText}>SHADOW BONUS</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const NativeMoveSelector = ({
  damageMode,
  label,
  options,
  palette,
  value,
  onChange,
}: {
  damageMode: PokemonMoveDamageMode;
  label: string;
  options: NonNullable<NativeInstanceDetail['moveOptions']>;
  palette: typeof LIGHT;
  value: number | null;
  onChange: (value: number | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const animationType = useNativeModalAnimation('slide');
  const selected = options.find((option) => option.id === value);
  const selectorTestId = `native-move-selector-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <>
      <View style={styles.choiceFieldRow}>
        {selected?.typeIconUri ? (
          <Image fadeDuration={0}
            accessibilityLabel={`${selected.typeName} type`}
            source={{ uri: selected.typeIconUri }}
            style={styles.choiceFieldTypeIcon}
          />
        ) : <View style={styles.choiceFieldTypeSpacer} />}
        <Pressable
          accessibilityLabel={`Choose ${label.toLowerCase()}`}
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={[styles.choiceField, { backgroundColor: palette.input, borderColor: palette.border }]}
          testID={selectorTestId}
        >
          <Text numberOfLines={1} style={[styles.choiceFieldValue, { color: palette.text }]}>
            {selected?.name ?? 'Unselected move'}
          </Text>
        </Pressable>
        <Text style={[styles.choiceFieldPower, { color: palette.text }]}>
          {selected ? (damageMode === 'raid' ? selected.raidPower : selected.pvpPower) ?? '-' : '-'}
        </Text>
      </View>
      <Modal
        animationType={animationType}
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View accessibilityViewIsModal style={styles.choiceModalBackdrop}>
          <View style={[styles.choiceModalSheet, { backgroundColor: palette.panel, borderColor: palette.border }]}>
            <View style={styles.choiceModalHeader}>
              <View>
                <Text style={styles.choiceModalEyebrow}>MOVE SELECTOR</Text>
                <Text style={[styles.choiceModalTitle, { color: palette.text }]}>{label}</Text>
              </View>
              <Pressable
                accessibilityLabel={`Close ${label.toLowerCase()} selector`}
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={[styles.choiceModalClose, { borderColor: palette.border }]}
              >
                <Text style={[styles.choiceModalCloseText, { color: palette.text }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.choiceList}>
              <Pressable
                accessibilityRole="button"
                onPress={() => { onChange(null); setOpen(false); }}
                style={[styles.choiceOption, { borderColor: palette.border }]}
              >
                <Text style={[styles.choiceOptionName, { color: palette.text }]}>Unselected move</Text>
              </Pressable>
              {options.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.id}
                  onPress={() => { onChange(option.id); setOpen(false); }}
                  style={[
                    styles.choiceOption,
                    { borderColor: value === option.id ? '#2e9eff' : palette.border },
                    value === option.id && styles.choiceOptionSelected,
                  ]}
                >
                  {option.typeIconUri ? (
                    <Image fadeDuration={0}
                      accessibilityLabel={`${option.typeName} type`}
                      source={{ uri: option.typeIconUri }}
                      style={styles.choiceOptionTypeIcon}
                    />
                  ) : null}
                  <View style={styles.choiceOptionCopy}>
                    <Text style={[styles.choiceOptionName, { color: palette.text }]}>{option.name}</Text>
                    <Text style={[styles.choiceOptionMeta, { color: palette.secondary }]}>
                      {option.typeName}{option.legacy ? ' · Legacy' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.choiceOptionPower, { color: palette.text }]}>
                    {(damageMode === 'raid' ? option.raidPower : option.pvpPower) ?? '-'}
                  </Text>
                  {value === option.id ? <Text style={styles.choiceCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const NativeWantedSizeControls = ({
  assetBaseUrl,
  draft,
  palette,
  onChange,
}: {
  assetBaseUrl: string;
  draft: NativeInstanceEditDraft;
  palette: typeof LIGHT;
  onChange: (patch: Partial<NativeInstanceEditDraft>) => void;
}) => (
  <View style={styles.wantedSizeGrid}>
    {([
      ['WEIGHT', 'weightSize'],
      ['HEIGHT', 'heightSize'],
    ] as const).map(([label, field]) => (
      <View key={field} style={styles.sizePreferenceRow}>
        <View style={styles.sizePreferenceHeading}>
          <Image
            fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, `/images/${label.toLowerCase()}.png`) }}
            style={styles.sizePreferenceIcon}
          />
          <Text style={[styles.editFieldLabel, styles.sizePreferenceLabel, { color: palette.secondary }]}>{label}</Text>
        </View>
        <View accessibilityLabel={`Wanted ${label.toLowerCase()}`} style={styles.sizeOptions}>
          {(['XXS', 'XS', null, 'XL', 'XXL'] as const).map((option) => {
            const selected = draft[field] === option;
            const optionLabel = option ?? 'Any';
            return (
              <Pressable
                accessibilityLabel={`${optionLabel} ${label.toLowerCase()}`}
                accessibilityRole="button"
                key={optionLabel}
                onPress={() => onChange({ [field]: option })}
                style={[
                  styles.sizeOption,
                  { borderColor: selected ? '#ff617d' : palette.border },
                  selected && styles.sizeOptionSelected,
                ]}
              >
                <Text style={[styles.sizeOptionText, { color: palette.text }]}>{optionLabel}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ))}
  </View>
);

const NativeBackgroundPicker = ({
  assetBaseUrl,
  open,
  options,
  palette,
  selectedId,
  onChange,
  onClose,
}: {
  assetBaseUrl: string;
  open: boolean;
  options: NativeInstanceBackgroundOption[];
  palette: typeof LIGHT;
  selectedId: string | null;
  onChange: (value: string | null) => void;
  onClose: () => void;
}) => {
  const animationType = useNativeModalAnimation('slide');
  return (
  <Modal
    animationType={animationType}
    onRequestClose={onClose}
    statusBarTranslucent
    transparent
    visible={open}
  >
    <View accessibilityViewIsModal style={styles.choiceModalBackdrop}>
      <View style={[styles.choiceModalSheet, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.choiceModalHeader}>
          <View>
            <Text style={styles.choiceModalEyebrow}>LOCATION CARD</Text>
            <Text style={[styles.choiceModalTitle, { color: palette.text }]}>Choose a background</Text>
          </View>
          <Pressable
            accessibilityLabel="Close background selector"
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.choiceModalClose, { borderColor: palette.border }]}
          >
            <Text style={[styles.choiceModalCloseText, { color: palette.text }]}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.backgroundGrid}>
          <Pressable
            accessibilityLabel="No location background"
            accessibilityRole="button"
            onPress={() => { onChange(null); onClose(); }}
            style={[
              styles.backgroundOption,
              { backgroundColor: palette.input, borderColor: selectedId == null ? '#38a9ff' : palette.border },
            ]}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, '/images/location.png') }}
              style={[styles.noBackgroundIcon, { tintColor: palette.secondary }]}
            />
            <Text style={[styles.backgroundOptionName, { color: palette.text }]}>None</Text>
          </Pressable>
          {options.map((option) => (
            <Pressable
              accessibilityLabel={`Use ${option.name} background`}
              accessibilityRole="button"
              key={option.id}
              onPress={() => { onChange(String(option.id)); onClose(); }}
              style={[
                styles.backgroundOption,
                { borderColor: selectedId === String(option.id) ? '#38a9ff' : palette.border },
              ]}
            >
              <NativePokemonLocationBackdrop uri={option.imageUri} />
              <View style={styles.backgroundOptionCaption}>
                <Text numberOfLines={2} style={[styles.backgroundOptionName, styles.backgroundOptionImageName]}>
                  {option.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
  );
};

const NativeToggleGroup = ({
  label,
  options,
  palette,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: boolean; disabled?: boolean }[];
  palette: typeof LIGHT;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <View style={styles.editFieldGroup}>
    <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>{label}</Text>
    <View accessibilityLabel={label} style={styles.booleanOptions}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={`${label.replace(/:$/, '')}: ${option.label}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: option.disabled, selected }}
            disabled={option.disabled}
            key={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.booleanOption,
              { borderColor: selected ? palette.text : palette.border },
              selected && styles.booleanOptionSelected,
              option.disabled && styles.disabledOption,
            ]}
          >
            <Text style={[styles.booleanOptionText, { color: palette.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const NativeCaughtMetadataControls = ({
  assetBaseUrl,
  draft,
  isCaught,
  palette,
  onChange,
  onRequestLocationVisibility,
}: {
  assetBaseUrl: string;
  draft: NativeInstanceEditDraft;
  isCaught: boolean;
  palette: typeof LIGHT;
  onChange: (patch: Partial<NativeInstanceEditDraft>) => void;
  onRequestLocationVisibility: (target: number) => void;
}) => {
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [locationSuggestionError, setLocationSuggestionError] = useState<string | null>(null);
  const [isLoadingLocationSuggestions, setIsLoadingLocationSuggestions] = useState(false);
  const locationRequestRef = useRef(0);
  const locationInputTargetRef = useRef<number | null>(null);
  const acceptedLocationRef = useRef<string | null>(null);
  const locationLookupRequestedRef = useRef(false);
  const inputStyle = [
    styles.editInput,
    { backgroundColor: palette.input, borderColor: palette.border, color: palette.text },
  ];
  const isShadow = Boolean(draft.shadow && !draft.purified);
  const ballImageFile = draft.pokeball ? BALL_IMAGE_FILES[draft.pokeball] : null;
  const hasCaughtSummary = Boolean(draft.locationCaught || draft.dateCaught || ballImageFile);

  useEffect(() => {
    // Vite only asks for suggestions after the trainer changes the field.
    // Opening an editor with a saved location must not start network work.
    if (!locationLookupRequestedRef.current) return undefined;
    const query = draft.locationCaught.trim();
    const requestId = ++locationRequestRef.current;

    if (acceptedLocationRef.current === draft.locationCaught) {
      acceptedLocationRef.current = null;
      return undefined;
    }

    if (query.length < 3) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setIsLoadingLocationSuggestions(true);
      void getNativeLocationSuggestions(query)
        .then((suggestions) => {
          if (requestId !== locationRequestRef.current) return;
          setLocationSuggestions(suggestions.map(({ displayName }) => displayName));
          setLocationSuggestionError(null);
        })
        .catch(() => {
          if (requestId !== locationRequestRef.current) return;
          setLocationSuggestions([]);
          setLocationSuggestionError('Location suggestions are unavailable. You can still enter a location manually.');
        })
        .finally(() => {
          if (requestId === locationRequestRef.current) {
            setIsLoadingLocationSuggestions(false);
          }
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [draft.locationCaught]);

  useEffect(() => {
    if (locationSuggestions.length === 0 || locationInputTargetRef.current == null) return undefined;
    const frame = requestAnimationFrame(() => {
      if (locationInputTargetRef.current != null) {
        onRequestLocationVisibility(locationInputTargetRef.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [locationSuggestions.length, onRequestLocationVisibility]);

  const selectLocationSuggestion = (displayName: string) => {
    locationRequestRef.current += 1;
    locationLookupRequestedRef.current = false;
    acceptedLocationRef.current = displayName;
    setLocationSuggestions([]);
    setLocationSuggestionError(null);
    setIsLoadingLocationSuggestions(false);
    onChange({ locationCaught: displayName });
  };

  return (
    <View style={styles.editMetaPanel}>
      {hasCaughtSummary ? (
        <>
          <View style={styles.editMetaSummary}>
            <View style={styles.editMetaSummaryCopy}>
              <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>CAUGHT</Text>
              {draft.locationCaught ? (
                <Text style={[styles.editMetaSummaryValue, { color: palette.text }]}>{draft.locationCaught}</Text>
              ) : null}
              {draft.dateCaught ? (
                <Text style={[styles.editMetaSummaryDate, { color: palette.secondary }]}>{draft.dateCaught}</Text>
              ) : null}
            </View>
            {ballImageFile ? (
              <Image
                fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: toAssetUrl(assetBaseUrl, `/media/images/balls/${ballImageFile}`) }}
                style={[
                  styles.editMetaBall,
                  draft.pokeball === 'beast_ball' || draft.pokeball === 'safari_ball'
                    ? styles.editMetaBallLarge
                    : null,
                ]}
              />
            ) : null}
          </View>
          <View style={[styles.editMetaDivider, { backgroundColor: palette.divider }]} />
        </>
      ) : null}

      {isCaught ? (
        <>
          <NativeToggleGroup
            label="TRADED:"
            onChange={(isTraded) => onChange({ isTraded })}
            options={[
              { label: 'YES', value: true, disabled: isShadow },
              { label: 'NO', value: false, disabled: draft.lucky },
            ]}
            palette={palette}
            value={draft.isTraded}
          />
          {isShadow ? (
            <Text style={[styles.editHelpText, { color: palette.secondary }]}>Shadow Pokémon cannot be traded until purified.</Text>
          ) : null}
          {draft.lucky ? (
            <Text style={[styles.editHelpText, { color: palette.secondary }]}>Lucky Pokémon are always traded.</Text>
          ) : null}
          {draft.isTraded ? (
            <View style={styles.editFieldGroup}>
              <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>ORIGINAL TRAINER NAME:</Text>
              <TextInput
                accessibilityLabel="Original trainer name"
                autoCapitalize="none"
                onChangeText={(originalTrainerName) => onChange({
                  originalTrainerName,
                  originalTrainerId: null,
                })}
                placeholder="Optional"
                placeholderTextColor={palette.secondary}
                style={inputStyle}
                value={draft.originalTrainerName}
              />
              <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>TRADED DATE:</Text>
              <TextInput
                accessibilityLabel="Traded date"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                onChangeText={(tradedDate) => onChange({ tradedDate })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.secondary}
                style={inputStyle}
                value={draft.tradedDate}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.editFieldGroup}>
        <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>LOCATION CAUGHT:</Text>
        <View style={styles.locationInputWrapper}>
          {locationSuggestions.length > 0 ? (
            <ScrollView
              accessibilityLabel="Location suggestions"
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              showsVerticalScrollIndicator={locationSuggestions.length > 4}
              style={[styles.locationSuggestions, { backgroundColor: palette.panel, borderColor: palette.border }]}
            >
              {locationSuggestions.map((displayName) => (
                <Pressable
                  accessibilityLabel={`Use location ${displayName}`}
                  accessibilityRole="button"
                  key={displayName}
                  onPress={() => selectLocationSuggestion(displayName)}
                  style={({ pressed }) => [
                    styles.locationSuggestion,
                    { borderBottomColor: palette.border },
                    pressed && styles.locationSuggestionPressed,
                  ]}
                >
                  <NativeUiIcon color="#38a9ff" name="map" size={17} />
                  <Text style={[styles.locationSuggestionText, { color: palette.text }]}>{displayName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <TextInput
            accessibilityLabel="Caught location"
            autoCapitalize="words"
            autoComplete="off"
            onChangeText={(locationCaught) => {
              locationRequestRef.current += 1;
              locationLookupRequestedRef.current = true;
              acceptedLocationRef.current = null;
              setLocationSuggestions([]);
              setLocationSuggestionError(null);
              setIsLoadingLocationSuggestions(false);
              onChange({ locationCaught });
            }}
            onFocus={(event) => {
              locationInputTargetRef.current = event.nativeEvent.target;
              onRequestLocationVisibility(event.nativeEvent.target);
            }}
            placeholder="Location caught"
            placeholderTextColor={palette.secondary}
            style={inputStyle}
            value={draft.locationCaught}
          />
        </View>
        {isLoadingLocationSuggestions ? (
          <View accessibilityLabel="Loading location suggestions" style={styles.locationSuggestionStatus}>
            <ActivityIndicator color="#38a9ff" size="small" />
            <Text style={[styles.locationSuggestionStatusText, { color: palette.secondary }]}>Finding locations…</Text>
          </View>
        ) : null}
        {locationSuggestionError ? (
          <Text accessibilityRole="alert" style={styles.locationSuggestionError}>{locationSuggestionError}</Text>
        ) : null}
        <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>DATE CAUGHT:</Text>
        <TextInput
          accessibilityLabel="Caught date"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          onChangeText={(dateCaught) => onChange({ dateCaught })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.secondary}
          style={inputStyle}
          value={draft.dateCaught}
        />
      </View>

      <View style={styles.editFieldGroup}>
        <Text style={[styles.ballCaughtLabel, { color: palette.text }]}>Ball Caught</Text>
        <View accessibilityLabel="Ball Caught" style={styles.ballOptions}>
          {[...BALL_OPTIONS, [null, 'UNKNOWN'] as const].map(([value, label]) => {
            const selected = draft.pokeball === value;
            return (
              <Pressable
                accessibilityLabel={`Ball caught: ${label}`}
                accessibilityRole="button"
                key={label}
                onPress={() => onChange({ pokeball: value })}
                style={[
                  styles.ballOption,
                  { borderColor: selected ? palette.text : palette.border },
                  selected && styles.booleanOptionSelected,
                ]}
              >
                <Text style={[styles.ballOptionText, { color: palette.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const MaxMoveLevelPicker = ({
  label,
  lockedAllowed,
  value,
  palette,
  onChange,
}: {
  label: string;
  lockedAllowed: boolean;
  value: number | null;
  palette: typeof LIGHT;
  onChange: (value: number) => void;
}) => {
  const options = lockedAllowed ? [0, 1, 2, 3] : [1, 2, 3];
  return (
    <View style={styles.maxMoveRow}>
      <Text style={[styles.maxMoveLabel, { color: palette.text }]}>{label}</Text>
      <View accessibilityLabel={`${label} level`} style={styles.maxMoveOptions}>
        {options.map((option) => {
          const selected = value === option;
          const optionLabel = option === 0 ? 'Locked' : String(option);
          return (
            <Pressable
              accessibilityLabel={`${label}: ${optionLabel}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.maxMoveOption,
                { borderColor: selected ? '#d6298f' : palette.border },
                selected && styles.maxMoveOptionSelected,
              ]}
            >
              <Text style={[styles.maxMoveOptionText, { color: palette.text }]}>{optionLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const PowerFormOption = ({
  disabled = false,
  imageUri,
  label,
  selected,
  palette,
  onPress,
}: {
  disabled?: boolean;
  imageUri: string | null;
  label: string;
  selected: boolean;
  palette: typeof LIGHT;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={`Power form: ${label}`}
    accessibilityRole="button"
    accessibilityState={{ disabled, selected }}
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.powerFormOption,
      { borderColor: selected ? '#5faeff' : palette.border },
      selected && styles.powerFormOptionSelected,
      disabled && styles.powerFormOptionDisabled,
    ]}
  >
    {imageUri ? (
      <Image fadeDuration={0}
        accessibilityElementsHidden
        resizeMode="contain"
        source={{ uri: imageUri }}
        style={styles.powerFormImage}
      />
    ) : null}
    <Text numberOfLines={2} style={[styles.powerFormLabel, { color: palette.text }]}>{label}</Text>
  </Pressable>
);

const NativePowerControls = ({
  assetBaseUrl,
  detail,
  draft,
  isCaught,
  isWanted,
  palette,
  onChange,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  draft: NativeInstanceEditDraft;
  isCaught: boolean;
  isWanted: boolean;
  palette: typeof LIGHT;
  onChange: (patch: Partial<NativeInstanceEditDraft>) => void;
}) => {
  const [showMaxOptions, setShowMaxOptions] = useState(false);
  const supportsMega = !isWanted
    && !draft.shadow
    && !draft.fused
    && (detail.megaOptions?.length ?? 0) > 0
    && !detail.row.name.toLowerCase().includes('clone');
  const supportsCrown = !isWanted
    && !draft.shadow
    && !draft.fused
    && (detail.crownOptions?.length ?? 0) > 0;
  const supportsFusion = isCaught
    && !draft.shadow
    && !draft.megaEnabled
    && !draft.crowned
    && (detail.fusionOptions?.length ?? 0) > 0;
  const supportsMaxMoves = !isWanted
    && Boolean(detail.row.maxKind || detail.specialMaxBaseEligible || draft.crowned)
    && !draft.shadow
    && !draft.purified
    && detail.instance?.costume_id == null;
  const selectedFusion = detail.fusionOptions?.find((option) => option.id === draft.fusionId) ?? null;
  const compatibleMovePatch = (options: NativeInstanceMoveOption[] | undefined) => {
    const supports = (id: number | null, kind: NativeInstanceMoveOption['kind']) => (
      id == null || Boolean(options?.some((move) => move.id === id && move.kind === kind))
    );
    return {
      fastMove: supports(draft.fastMove, 'fast') ? draft.fastMove : null,
      chargedMove1: supports(draft.chargedMove1, 'charged') ? draft.chargedMove1 : null,
      chargedMove2: supports(draft.chargedMove2, 'charged') ? draft.chargedMove2 : null,
    };
  };
  const compatibleBackgroundPatch = (options: NativeInstanceBackgroundOption[] | undefined) => ({
    locationCard: draft.locationCard == null
      || options?.some((background) => String(background.id) === draft.locationCard)
      ? draft.locationCard
      : null,
  });
  const nextMegaState = () => {
    const megaOptions = detail.megaOptions ?? [];
    if (!draft.megaEnabled) {
      const next = megaOptions[0] ?? null;
      return { enabled: Boolean(next), form: next?.form ?? null, option: next };
    }
    const currentIndex = megaOptions.findIndex((option) => option.form === draft.megaForm);
    const nextIndex = (Math.max(0, currentIndex) + 1) % (megaOptions.length + 1);
    const next = nextIndex < megaOptions.length ? megaOptions[nextIndex] : null;
    return { enabled: Boolean(next), form: next?.form ?? null, option: next };
  };
  const nextMega = nextMegaState();
  const activeCrown = detail.crownOptions?.find((option) => option.form === draft.crownForm)
    ?? detail.crownOptions?.[0]
    ?? null;
  if (!supportsMega && !supportsCrown && !supportsFusion && !supportsMaxMoves) return null;

  return (
    <View style={[styles.powerPanel, { borderColor: palette.divider }]}>
      <View style={styles.powerActionRow}>
        {supportsMaxMoves ? (
          <Pressable
            accessibilityLabel={`${showMaxOptions ? 'Close' : 'Open'} Max Move upgrades`}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMaxOptions }}
            onPress={() => setShowMaxOptions((current) => !current)}
            style={styles.maxPowerButton}
          >
            <Image
              fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, `/images/${detail.row.maxKind === 'gigantamax' ? 'gigantamax-icon' : 'dynamax-icon'}.png`) }}
              style={styles.maxPowerIcon}
            />
          </Pressable>
        ) : null}
        {supportsMega ? (
          <Pressable
            accessibilityLabel={draft.megaEnabled ? 'Change Mega form' : 'Mega Evolve'}
            accessibilityRole="button"
            onPress={() => onChange({
              megaRegistered: draft.megaRegistered || nextMega.enabled,
              megaEnabled: nextMega.enabled,
              megaForm: nextMega.form,
              fused: false,
              fusionId: null,
              fusionForm: null,
              fusedWith: null,
            })}
            style={styles.powerActionPill}
          >
            <Image
              fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{
                uri: toAssetUrl(
                  assetBaseUrl,
                  nextMega.enabled ? '/media/images/mega.png' : '/images/default_pokemon.png',
                ),
              }}
              style={styles.powerActionGlyph}
            />
            <Text style={styles.powerActionText}>{draft.megaEnabled ? 'CHANGE FORM' : 'MEGA EVOLVE'}</Text>
            {nextMega.option?.imageUri ? (
              <Image
                fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: nextMega.option.imageUri }}
                style={styles.powerActionTarget}
              />
            ) : null}
          </Pressable>
        ) : null}
        {supportsCrown && activeCrown ? (
          <Pressable
            accessibilityLabel={`Power form: ${draft.crowned ? 'Hero form' : activeCrown.label}`}
            accessibilityRole="button"
            onPress={() => onChange({
              crowned: !draft.crowned,
              crownForm: draft.crowned ? null : activeCrown.form,
              fused: false,
              fusionId: null,
              fusionForm: null,
              fusedWith: null,
              ...compatibleMovePatch(draft.crowned
                ? detail.moveOptions
                : activeCrown.moveOptions ?? detail.moveOptions),
            })}
            style={styles.powerActionPill}
          >
            <Image
              fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{
                uri: (draft.crowned ? detail.row.imageUri : activeCrown.imageUri)
                  ?? toAssetUrl(assetBaseUrl, '/images/default_pokemon.png'),
              }}
              style={styles.powerActionTarget}
            />
            <Text style={styles.powerActionText}>CHANGE FORM</Text>
          </Pressable>
        ) : null}
      </View>
      {supportsFusion ? (
        <View style={styles.editFieldGroup}>
          <View style={styles.powerFormOptions}>
            <PowerFormOption
              imageUri={detail.appearanceImageUris?.base ?? detail.row.imageUri}
              label="Base form"
              onPress={() => onChange({
                fused: false,
                fusionId: null,
                fusionForm: null,
                fusedWith: null,
                ...compatibleMovePatch(detail.moveOptions),
                ...compatibleBackgroundPatch(detail.backgroundOptions),
              })}
              palette={palette}
              selected={!draft.fused}
            />
            {(detail.fusionOptions ?? []).map((option) => {
              const firstPartner = option.partnerRows[0] ?? null;
              return (
                <PowerFormOption
                  disabled={!firstPartner}
                  imageUri={option.imageUri}
                  key={option.id}
                  label={firstPartner ? option.name : `${option.name} · partner needed`}
                  onPress={() => onChange({
                    fused: true,
                    fusionId: option.id,
                    fusionForm: option.name,
                    fusedWith: firstPartner?.id ?? null,
                    megaEnabled: false,
                    megaForm: null,
                    crowned: false,
                    ...compatibleMovePatch(option.moveOptions),
                    ...compatibleBackgroundPatch(option.backgroundOptions),
                  })}
                  palette={palette}
                  selected={draft.fused && draft.fusionId === option.id}
                />
              );
            })}
          </View>
          {draft.fused && selectedFusion ? (
            <View style={styles.fusionPartnerPanel}>
              <Text style={[styles.editFieldLabel, { color: palette.secondary }]}>FUSION PARTNER</Text>
              <View style={styles.powerFormOptions}>
                {selectedFusion.partnerRows.map((partner) => (
                  <PowerFormOption
                    imageUri={partner.imageUri}
                    key={partner.id}
                    label={partner.name}
                    onPress={() => onChange({ fusedWith: partner.id })}
                    palette={palette}
                    selected={draft.fusedWith === partner.id}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {supportsMaxMoves && showMaxOptions ? (
        <View style={styles.maxMovesPanel}>
          <View style={styles.maxMovesHeading}>
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, `/images/${detail.row.maxKind ?? 'dynamax'}.png`) }}
              style={styles.maxMovesIcon}
            />
            <View>
              <Text style={[styles.powerTitle, { color: palette.text }]}>Max Move Levels</Text>
              <Text style={[styles.editHelpText, { color: palette.secondary }]}>Set the levels unlocked in Pokémon GO.</Text>
            </View>
          </View>
          <MaxMoveLevelPicker
            label="Max Attack"
            lockedAllowed={false}
            onChange={(maxAttack) => onChange({ maxAttack })}
            palette={palette}
            value={draft.maxAttack}
          />
          <MaxMoveLevelPicker
            label="Max Guard"
            lockedAllowed
            onChange={(maxGuard) => onChange({ maxGuard })}
            palette={palette}
            value={draft.maxGuard}
          />
          <MaxMoveLevelPicker
            label="Max Spirit"
            lockedAllowed
            onChange={(maxSpirit) => onChange({ maxSpirit })}
            palette={palette}
            value={draft.maxSpirit}
          />
        </View>
      ) : null}
    </View>
  );
};

const nextEditableGender = (gender: string | null): string | null => {
  const options: (string | null)[] = ['Male', 'Female', null];
  const currentIndex = options.indexOf(gender);
  return options[(currentIndex + 1) % options.length] ?? null;
};

const NativeInlineInstanceEditor = ({
  assetBaseUrl,
  detail,
  draft,
  isCaught,
  isWanted,
  palette,
  typeIconUris,
  onChange,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  draft: NativeInstanceEditDraft;
  isCaught: boolean;
  isWanted: boolean;
  palette: typeof LIGHT;
  typeIconUris: string[];
  onChange: (patch: Partial<NativeInstanceEditDraft>) => void;
}) => {
  const isShadow = Boolean(draft.shadow && !draft.purified);
  const canToggleLucky = isCaught && !isShadow && detail.rarity !== 'Mythic';
  const genderIcon = draft.gender === 'Male'
    ? '/images/male-icon.png'
    : draft.gender === 'Female'
      ? '/images/female-icon.png'
      : '/images/neutral-icon.png';
  const measurementInputStyle = [
    styles.inlineMeasurementInput,
    { borderColor: palette.border, color: palette.text },
  ];
  const [nameInputWidth, setNameInputWidth] = useState(() => (
    Math.max(50, Math.min(274, (draft.nickname.length * 13) + 8))
  ));

  return (
    <View accessibilityLabel="Pokémon inline identity editor" style={styles.inlineEditor}>
      <View style={styles.inlineIdentityRow}>
        <View style={[styles.inlineIdentitySide, styles.inlineIdentitySideLeft]}>
          {canToggleLucky ? (
            <Pressable
              accessibilityLabel="LUCKY: YES"
              accessibilityRole="button"
              onPress={() => onChange({
                lucky: !draft.lucky,
                isTraded: !draft.lucky || draft.isTraded,
              })}
              style={styles.inlineIdentityButton}
            >
              <Image
                fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky-icon.png') }}
                style={[styles.inlineIdentityIcon, !draft.lucky && styles.inlineIconInactive]}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.inlineNameSlot}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={(event) => {
              const measuredWidth = Math.ceil(event.nativeEvent.layout.width) + 12;
              setNameInputWidth(Math.max(50, Math.min(274, measuredWidth)));
            }}
            pointerEvents="none"
            style={styles.inlineNameMeasure}
          >
            {draft.nickname || detail.row.name}
          </Text>
          <TextInput
            accessibilityLabel="Pokémon nickname"
            autoCapitalize="words"
            maxLength={12}
            onChangeText={(nickname) => onChange({ nickname })}
            placeholder={detail.row.name}
            placeholderTextColor={palette.text}
            selectTextOnFocus
            style={[
              styles.inlineNameInput,
              { borderColor: palette.border, color: palette.text, width: nameInputWidth },
            ]}
            value={draft.nickname}
          />
        </View>
        <View style={[styles.inlineIdentitySide, styles.inlineIdentitySideRight]}>
          {isCaught && (draft.shadow || draft.purified) ? (
            <Pressable
              accessibilityLabel={draft.purified ? 'Shadow state: Shadow' : 'Shadow state: Purified'}
              accessibilityRole="button"
              onPress={() => onChange(draft.purified
                ? {
                    purified: false,
                    shadow: true,
                    lucky: false,
                    isTraded: false,
                    originalTrainerId: null,
                    originalTrainerName: '',
                    tradedDate: '',
                  }
                : { purified: true, shadow: false })}
              style={styles.inlineIdentityButton}
            >
              <Image
                fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{
                  uri: toAssetUrl(
                    assetBaseUrl,
                    draft.purified ? '/images/shadow_icon_middle_ground.png' : '/images/purify.png',
                  ),
                }}
                style={styles.inlineIdentityIcon}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.inlineLevelGenderRow}>
        {!isWanted ? (
          <View style={styles.inlineLevelControl}>
            <Text style={[styles.inlineLevelLabel, { color: palette.secondary }]}>LEVEL:</Text>
            <TextInput
              accessibilityLabel="Pokémon level"
              keyboardType="decimal-pad"
              onChangeText={(level) => onChange({ level })}
              onEndEditing={() => {
                if (!draft.level.trim()) return;
                const parsed = Number(draft.level);
                if (!Number.isFinite(parsed)) return;
                const level = Math.min(51, Math.max(1, Math.round(parsed * 2) / 2));
                onChange({ level: String(level) });
              }}
              placeholder="1-51 (0.5 steps)"
              placeholderTextColor={palette.secondary}
              selectTextOnFocus
              style={[styles.inlineLevelInput, { borderColor: palette.border, color: palette.text }]}
              value={draft.level}
            />
          </View>
        ) : null}
        <Pressable
          accessibilityLabel={`Gender: ${draft.gender ?? (isWanted ? 'Any' : 'Unspecified')}`}
          accessibilityRole="button"
          onPress={() => onChange({ gender: nextEditableGender(draft.gender) })}
          style={styles.inlineGenderButton}
        >
          <Image
            fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, genderIcon) }}
            style={styles.inlineGenderIcon}
          />
        </Pressable>
      </View>

      {isWanted ? (
        <NativeWantedSizeControls
          assetBaseUrl={assetBaseUrl}
          draft={draft}
          onChange={onChange}
          palette={palette}
        />
      ) : (
        <View style={styles.inlineMeasurementsRow}>
          <View style={styles.inlineMeasurement}>
            <View style={styles.inlineMeasurementValue}>
              <TextInput
                accessibilityLabel="Pokémon weight"
                keyboardType="decimal-pad"
                onChangeText={(weight) => onChange({ weight })}
                selectTextOnFocus
                style={measurementInputStyle}
                value={draft.weight}
              />
              <Text style={[styles.inlineMeasurementSuffix, { color: palette.text }]}>kg</Text>
            </View>
            <Text style={[styles.inlineMeasurementLabel, { color: palette.secondary }]}>WEIGHT</Text>
          </View>
          {isCaught ? (
            <>
              <View style={[styles.inlinePipe, { backgroundColor: palette.divider }]} />
              <View
                accessibilityLabel={pokemonTypesAccessibilityLabel(typeIconUris)}
                accessible
                style={styles.inlineTypes}
                testID={pokemonTypesTestId(typeIconUris)}
              >
                {typeIconUris.map((uri) => (
                  <Image
                    fadeDuration={0}
                    accessibilityLabel={`${uri.match(/\/([^/?]+)\.png(?:\?|$)/i)?.[1] ?? 'Pokémon'} type`}
                    key={uri}
                    source={{ uri }}
                    style={styles.inlineTypeIcon}
                  />
                ))}
              </View>
              <View style={[styles.inlinePipe, { backgroundColor: palette.divider }]} />
            </>
          ) : null}
          <View style={styles.inlineMeasurement}>
            <View style={styles.inlineMeasurementValue}>
              <TextInput
                accessibilityLabel="Pokémon height"
                keyboardType="decimal-pad"
                onChangeText={(height) => onChange({ height })}
                selectTextOnFocus
                style={measurementInputStyle}
                value={draft.height}
              />
              <Text style={[styles.inlineMeasurementSuffix, { color: palette.text }]}>m</Text>
            </View>
            <Text style={[styles.inlineMeasurementLabel, { color: palette.secondary }]}>HEIGHT</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const NativeInstanceEditFields = ({
  assetBaseUrl,
  detail,
  draft,
  isCaught,
  isWanted,
  palette,
  onChange,
  onRequestLocationVisibility,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  draft: NativeInstanceEditDraft;
  isCaught: boolean;
  isWanted: boolean;
  palette: typeof LIGHT;
  onChange: (patch: Partial<NativeInstanceEditDraft>) => void;
  onRequestLocationVisibility: (target: number) => void;
}) => {
  const [moveDamageMode, setMoveDamageMode] = useState<PokemonMoveDamageMode>('raid');
  const selectedFusionMoves = draft.fused
    ? detail.fusionOptions?.find((option) => option.id === draft.fusionId)?.moveOptions
    : null;
  const selectedCrownMoves = draft.crowned
    ? detail.crownOptions?.find((option) => option.form === draft.crownForm)?.moveOptions
    : null;
  const editMoveOptions = selectedFusionMoves ?? selectedCrownMoves ?? detail.moveOptions ?? [];
  const hasPowerPanel = Boolean(
    (!isWanted && !draft.shadow && !draft.fused && (detail.megaOptions?.length ?? 0) > 0)
    || (!isWanted && !draft.shadow && !draft.fused && (detail.crownOptions?.length ?? 0) > 0)
    || (isCaught && !draft.shadow && !draft.megaEnabled && !draft.crowned
      && (detail.fusionOptions?.length ?? 0) > 0)
    || (!isWanted && Boolean(detail.row.maxKind || detail.specialMaxBaseEligible || draft.crowned)
      && !draft.shadow && !draft.purified && detail.instance?.costume_id == null),
  );
  const availableSecondChargedMove = editMoveOptions.find((move) => (
    move.kind === 'charged' && move.id !== draft.chargedMove1
  )) ?? null;
  return (
    <View accessibilityLabel="Pokémon detail editor" style={styles.editFields}>
      <NativePowerControls
        assetBaseUrl={assetBaseUrl}
        detail={detail}
        draft={draft}
        isCaught={isCaught}
        isWanted={isWanted}
        onChange={onChange}
        palette={palette}
      />

      <View style={[
        styles.editFieldGroup,
        styles.editMovesGroup,
        !hasPowerPanel && { borderTopColor: palette.divider, borderTopWidth: 2 },
        { borderBottomColor: palette.divider },
      ]}>
        <NativeMoveModeTabs
          mode={moveDamageMode}
          onChange={setMoveDamageMode}
          palette={palette}
        />
        <NativeMoveSelector
          damageMode={moveDamageMode}
          label="Fast move"
          onChange={(fastMove) => onChange({ fastMove })}
          options={editMoveOptions.filter((move) => move.kind === 'fast')}
          palette={palette}
          value={draft.fastMove}
        />
        <NativeMoveSelector
          damageMode={moveDamageMode}
          label="Charged move"
          onChange={(chargedMove1) => onChange({ chargedMove1 })}
          options={editMoveOptions.filter((move) => move.kind === 'charged')}
          palette={palette}
          value={draft.chargedMove1}
        />
        {draft.chargedMove2 != null ? (
          <NativeMoveSelector
            damageMode={moveDamageMode}
            label="Second charged move"
            onChange={(chargedMove2) => onChange({ chargedMove2 })}
            options={editMoveOptions.filter((move) => move.kind === 'charged')}
            palette={palette}
            value={draft.chargedMove2}
          />
        ) : (
          <Pressable
            accessibilityLabel="Add second charged move"
            accessibilityRole="button"
            accessibilityState={{ disabled: availableSecondChargedMove == null }}
            disabled={availableSecondChargedMove == null}
            onPress={() => onChange({ chargedMove2: availableSecondChargedMove?.id ?? null })}
            style={styles.addMoveButton}
          >
            <Text style={[styles.addMoveText, { color: palette.text }]}>+</Text>
          </Pressable>
        )}
      </View>

      {!isWanted ? (
        <>
          <View style={styles.editFieldGroup}>
            <View style={styles.editIvRows}>
              {[
                { label: 'Attack', key: 'attackIv' as const },
                { label: 'Defense', key: 'defenseIv' as const },
                { label: 'HP', key: 'staminaIv' as const },
              ].map((field) => {
                const value = Math.max(0, Math.min(15, Number(draft[field.key]) || 0));
                const full = value >= 15;
                const ivTextColor = full
                  ? palette === LIGHT ? '#9b2e2e' : '#ef8582'
                  : palette === LIGHT ? '#8a4b00' : '#ef9219';
                return (
                  <View key={field.key} style={styles.editIvRow}>
                    <Text style={[styles.editIvLabel, { color: ivTextColor }]}>{field.label}</Text>
                    <View style={[styles.editIvTrack, { backgroundColor: palette.track }]}>
                      <View style={[
                        styles.ivFill,
                        full && styles.ivFillFull,
                        { width: `${value / 15 * 100}%` },
                      ]} />
                      <View style={styles.ivThird} />
                      <View style={styles.ivTwoThirds} />
                    </View>
                    <TextInput
                      accessibilityLabel={`${field.label} IV`}
                      keyboardType="number-pad"
                      maxLength={2}
                      onChangeText={(nextValue) => {
                        if (nextValue.trim() === '') {
                          onChange({ [field.key]: '' });
                          return;
                        }
                        const parsed = Number.parseInt(nextValue, 10);
                        onChange({
                          [field.key]: Number.isNaN(parsed)
                            ? ''
                            : String(Math.min(15, Math.max(0, parsed))),
                        });
                      }}
                      selectTextOnFocus
                      style={[styles.editIvInput, { borderColor: palette.border, color: ivTextColor }]}
                      value={draft[field.key]}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <NativeCaughtMetadataControls
            assetBaseUrl={assetBaseUrl}
            draft={draft}
            isCaught={isCaught}
            onChange={onChange}
            onRequestLocationVisibility={onRequestLocationVisibility}
            palette={palette}
          />
        </>
      ) : null}
    </View>
  );
};

const NativeInstanceReadOnlyDetailSections = memo(function NativeInstanceReadOnlyDetailSections({
  assetBaseUrl,
  canEdit,
  caughtDate,
  detail,
  light,
  movesWarning,
  onEditPreferences,
  onOpenTarget,
  palette,
  statusAccent,
}: {
  assetBaseUrl: string;
  canEdit: boolean;
  caughtDate: string | null;
  detail: NativeInstanceDetail;
  light: boolean;
  movesWarning: string | null;
  onEditPreferences?: () => void;
  onOpenTarget?: (instanceId: string) => void;
  palette: typeof LIGHT;
  statusAccent: string;
}) {
  const instance = detail.instance;
  const isWanted = detail.row.status === 'wanted';
  return (
    <>
      {detail.moves.length || movesWarning ? (
        <View style={[styles.section, { borderTopColor: palette.divider }]}>
          {detail.moves.length ? (
            <NativeMovesPanel
              assetBaseUrl={assetBaseUrl}
              isShadow={Boolean(detail.instance?.shadow)}
              moves={detail.moves}
              palette={palette}
            />
          ) : null}
          {movesWarning ? <Text style={styles.warningText}>{movesWarning}</Text> : null}
        </View>
      ) : null}

      {!isWanted && detail.ivs.length ? (
        <View style={[styles.section, { borderTopColor: palette.divider }]}>
          {detail.ivs.map((iv) => {
            const full = iv.value >= 15;
            const ivTextColor = full
              ? light ? '#9b2e2e' : '#ef8582'
              : light ? '#8a4b00' : '#ef9219';
            return (
              <View key={iv.label} style={styles.ivRow}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}
                  numberOfLines={1}
                  style={[styles.ivLabel, { color: ivTextColor }]}
                >
                  {iv.label}
                </Text>
                <View style={[styles.ivTrack, { backgroundColor: palette.track }]}>
                  <View style={[
                    styles.ivFill,
                    full && styles.ivFillFull,
                    { width: `${Math.max(0, Math.min(15, iv.value)) / 15 * 100}%` },
                  ]} />
                  <View style={styles.ivThird} />
                  <View style={styles.ivTwoThirds} />
                </View>
                <Text style={[styles.ivNumber, { color: ivTextColor }]}>{iv.value}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {!isWanted && detail.preferences.length ? (
        <View style={[styles.preferencePanel, { borderColor: statusAccent }]}>
          <Text style={[styles.preferenceTitle, { color: statusAccent }]}>
            {detail.row.status === 'wanted' ? 'WANTED CONDITIONS' : 'TRADE CONDITIONS'}
          </Text>
          <DetailRows
            rows={detail.preferences}
            secondaryColor={palette.secondary}
            textColor={palette.text}
          />
        </View>
      ) : null}

      {detail.provenance.length ? (
        <View style={[styles.metaSection, { borderTopColor: palette.divider }]}>
          <View style={[styles.metaPanel, { backgroundColor: palette.meta }]}>
            {instance?.original_trainer_name ? (
              <View style={styles.metaSummaryBlock}>
                <Text style={[styles.metaSummaryLabel, { color: palette.secondary }]}>OBTAINED IN A TRADE</Text>
                <Text style={[styles.metaSummaryValue, { color: palette.text }]}>{instance.original_trainer_name}</Text>
              </View>
            ) : null}
            {instance?.location_caught || caughtDate ? (
              <View style={styles.metaSummaryBlock}>
                <Text style={[styles.metaSummaryLabel, { color: palette.secondary }]}>CAUGHT</Text>
                {instance?.location_caught ? (
                  <Text style={[styles.metaSummaryValue, { color: palette.text }]}>{instance.location_caught}</Text>
                ) : null}
                {caughtDate ? (
                  <Text style={[styles.metaSummaryLabel, { color: palette.secondary }]}>{caughtDate}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <TargetSummary
        assetBaseUrl={assetBaseUrl}
        canEdit={canEdit}
        detail={detail}
        onEdit={() => onEditPreferences?.()}
        onOpenTarget={onOpenTarget}
        palette={palette}
      />
    </>
  );
});

const NativeInstanceSwipeFrame = memo(function NativeInstanceSwipeFrame({
  activeItemKey,
  background,
  children,
  disabled,
  onNext,
  onPrevious,
  onTargetCommitted,
  onTransitionEnd,
  onTransitionStart,
}: {
  activeItemKey: string;
  background: ReactNode;
  children: ReactNode;
  disabled: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onTargetCommitted?: () => void;
  onTransitionEnd?: () => void;
  onTransitionStart?: () => void;
}) {
  const overlaySwipe = useNativeOverlaySwipeNavigation({
    activeItemKey,
    disabled,
    onNext,
    onPrevious,
    onTargetCommitted,
    onTransitionEnd,
    onTransitionStart,
  });
  const axisLockDelta = collectionExperienceParityContract.instanceOverlaySwipe.axisLockDelta;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.backgroundLayer, overlaySwipe.backgroundMotionStyle]}
        testID="native-instance-background-layer"
      >
        {background}
      </Animated.View>
      <View pointerEvents="none" style={styles.backgroundTint} />
      <PanGestureHandler
        activeOffsetX={[-axisLockDelta, axisLockDelta]}
        enabled={overlaySwipe.panEnabled}
        failOffsetY={[-axisLockDelta, axisLockDelta]}
        onGestureEvent={overlaySwipe.panGestureEvent}
        onHandlerStateChange={overlaySwipe.onPanHandlerStateChange}
      >
        <Animated.View
          style={[styles.motionLayer, overlaySwipe.motionStyle]}
          testID="native-instance-motion-layer"
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
      {onPrevious ? (
        <Pressable
          accessibilityLabel="Previous Pokémon"
          accessibilityRole="button"
          accessibilityState={{ disabled: overlaySwipe.isAnimating }}
          disabled={overlaySwipe.isAnimating}
          onPress={overlaySwipe.navigatePrevious}
          style={[styles.instanceNavigation, styles.previousInstance, { bottom: 24 }]}
          testID="native-instance-previous"
        >
          <Text style={styles.instanceNavigationIcon}>◀</Text>
        </Pressable>
      ) : null}
      {onNext ? (
        <Pressable
          accessibilityLabel="Next Pokémon"
          accessibilityRole="button"
          accessibilityState={{ disabled: overlaySwipe.isAnimating }}
          disabled={overlaySwipe.isAnimating}
          onPress={overlaySwipe.navigateNext}
          style={[styles.instanceNavigation, styles.nextInstance, { bottom: 24 }]}
          testID="native-instance-next"
        >
          <Text style={styles.instanceNavigationIcon}>▶</Text>
        </Pressable>
      ) : null}
    </>
  );
});

export const NativeInstanceDetailScreen = ({
  assetBaseUrl = 'https://pokegonexus.com',
  detail,
  isLoading,
  error,
  cachedAt,
  movesWarning,
  saveNotice,
  saveError,
  isSaving,
  onRetry,
  onBack,
  onNext,
  onPrevious,
  onOpenTarget,
  onToggleFavorite,
  onEditInCurrentApp,
  onEditPreferences,
  onSaveDetails,
  canEdit = true,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktopLayout = width >= 768;
  const shellWidth = Math.min(width * 0.95, 500);
  const palette = light ? LIGHT : DARK;
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editorReadyInstanceId, setEditorReadyInstanceId] = useState<string | null>(null);
  const editInteractionStartedAtRef = useRef<number | null>(null);
  const [draftState, setDraftState] = useState<{
    instanceId: string;
    value: NativeInstanceEditDraft;
  } | null>(null);
  const [editErrorState, setEditErrorState] = useState<{
    instanceId: string;
    message: string;
  } | null>(null);
  const [backgroundPickerInstanceId, setBackgroundPickerInstanceId] = useState<string | null>(null);
  const [frozenLowerDetail, setFrozenLowerDetail] = useState<NativeInstanceDetail | null>(null);
  const lowerDetailReleaseFrameRef = useRef<number | null>(null);
  const onEditPreferencesRef = useRef(onEditPreferences);
  const onOpenTargetRef = useRef(onOpenTarget);
  const settledScrollOffsetRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    onEditPreferencesRef.current = onEditPreferences;
    onOpenTargetRef.current = onOpenTarget;
  }, [onEditPreferences, onOpenTarget]);
  const editPreferences = useCallback(() => onEditPreferencesRef.current?.(), []);
  const openTarget = useCallback((instanceId: string) => {
    onOpenTargetRef.current?.(instanceId);
  }, []);
  const rememberSettledScrollOffset = useCallback((
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    settledScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);
  const releaseLowerDetail = useCallback(() => {
    if (lowerDetailReleaseFrameRef.current !== null) return;
    lowerDetailReleaseFrameRef.current = requestAnimationFrame(() => {
      lowerDetailReleaseFrameRef.current = null;
      startTransition(() => setFrozenLowerDetail(null));
    });
  }, []);
  const beginInstanceTransition = useCallback(() => {
    if (detail && Math.abs(settledScrollOffsetRef.current) <= 8) {
      setFrozenLowerDetail(detail);
    }
  }, [detail]);
  useEffect(() => () => {
    if (lowerDetailReleaseFrameRef.current !== null) {
      cancelAnimationFrame(lowerDetailReleaseFrameRef.current);
    }
  }, []);
  useEffect(() => {
    if (!editingInstanceId) return undefined;
    // Paint the Save affordance first, then mount the expensive editor tree on
    // the next frame. The tap therefore receives immediate visual feedback
    // even on Android devices with a busy JavaScript thread.
    const frame = requestAnimationFrame(() => {
      setEditorReadyInstanceId(editingInstanceId);
      if (editInteractionStartedAtRef.current != null) {
        const startedAt = editInteractionStartedAtRef.current;
        editInteractionStartedAtRef.current = null;
        markNativeUiPerformanceAfterPaint('instance_edit_result_painted', startedAt);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editingInstanceId]);
  const requestKeyboardFieldVisibility = useCallback((target: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        target,
        230,
        true,
      );
    });
  }, []);
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.fallbackBackground }]}>
        <ActivityIndicator color="#5ed8ff" size="large" />
        <Text style={{ color: palette.secondary }}>Loading Pokémon details…</Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.fallbackBackground }]}>
        <Text accessibilityRole="header" style={[styles.errorTitle, { color: palette.text }]}>Pokémon unavailable</Text>
        <Text style={[styles.errorBody, { color: palette.secondary }]}>{error ?? 'This instance was not found.'}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={[styles.secondaryButton, { borderColor: palette.border }]}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Back to collection</Text>
        </Pressable>
      </View>
    );
  }

  const instance = detail.instance;
  const status = (light ? LIGHT_STATUS : STATUS)[detail.row.status];
  const isCaught = detail.row.status === 'caught';
  const isTrade = detail.row.status === 'trade';
  const isWanted = detail.row.status === 'wanted';
  const locationBackdropLayout = resolveNativeInstanceLocationBackdropLayout(
    width,
    detail.row.status,
  );
  const caughtDate = !isWanted && detail.instance?.date_caught
    ? detail.instance.date_caught.slice(0, 10)
    : null;
  const caughtDateParts = caughtDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? null;
  const level = instance?.level ?? Number(
    detail.stats.find((row) => row.label === 'Level')?.value ?? Number.NaN,
  );
  const cp = instance?.cp ?? detail.row.cp;
  const weight = typeof instance?.weight === 'number' && instance.weight > 0
    ? instance.weight
    : null;
  const height = typeof instance?.height === 'number' && instance.height > 0
    ? instance.height
    : null;
  const gender = instance?.gender;
  const maxBadge = detail.row.maxKind
    ? toAssetUrl(assetBaseUrl, `/images/${detail.row.maxKind}.png`)
    : null;
  const statusLabel = status.label;
  const editing = editingInstanceId === detail.row.id;
  const editorVisible = editing && (
    isWanted || editorReadyInstanceId === detail.row.id
  );
  const activeDraft = draftState?.instanceId === detail.row.id
    ? draftState.value
    : createEditDraft(detail);
  const editError = editErrorState?.instanceId === detail.row.id
    ? editErrorState.message
    : null;
  const displayLevel = editorVisible
    ? activeDraft.level.trim() ? Number(activeDraft.level) : Number.NaN
    : level;
  const showArc = Number.isFinite(displayLevel);
  const backgroundPickerOpen = backgroundPickerInstanceId === detail.row.id;
  const lowerDetail = frozenLowerDetail ?? detail;
  const selectedFusionOption = activeDraft.fused
    ? detail.fusionOptions?.find((option) => option.id === activeDraft.fusionId) ?? null
    : null;
  const selectedMegaOption = activeDraft.megaEnabled
    ? detail.megaOptions?.find((option) => option.form === activeDraft.megaForm) ?? null
    : null;
  const selectedCrownOption = activeDraft.crowned
    ? detail.crownOptions?.find((option) => option.form === activeDraft.crownForm) ?? null
    : null;
  const displayTypeIconUris = editorVisible
    ? selectedFusionOption?.typeIconUris?.length
      ? selectedFusionOption.typeIconUris
      : selectedMegaOption?.typeIconUris?.length
        ? selectedMegaOption.typeIconUris
        : selectedCrownOption?.typeIconUris?.length
          ? selectedCrownOption.typeIconUris
          : detail.row.typeIconUris
    : detail.row.typeIconUris;
  const showPhysicalRow = weight != null
    || height != null
    || (isCaught && displayTypeIconUris.length > 0);
  const activeBackgroundOptions = selectedFusionOption?.backgroundOptions
    ?? detail.backgroundOptions
    ?? [];
  const displayLucky = editorVisible
    ? isWanted ? activeDraft.prefLucky : activeDraft.lucky
    : Boolean(detail.row.lucky || instance?.lucky || (isWanted && instance?.pref_lucky));
  const displayShadow = editorVisible ? activeDraft.shadow : Boolean(instance?.shadow && !instance?.purified);
  const displayPurified = editorVisible ? activeDraft.purified : Boolean(instance?.purified);
  const displayImageUri = editorVisible
    ? activeDraft.fused
      ? detail.fusionOptions?.find((option) => option.id === activeDraft.fusionId)?.imageUri
        ?? detail.row.imageUri
      : activeDraft.megaEnabled
      ? detail.megaOptions?.find((option) => option.form === activeDraft.megaForm)?.imageUri
        ?? detail.megaOptions?.[0]?.imageUri
        ?? detail.row.imageUri
      : activeDraft.crowned
        ? detail.crownOptions?.find((option) => option.form === activeDraft.crownForm)?.imageUri
          ?? detail.crownOptions?.[0]?.imageUri
          ?? detail.row.imageUri
        : displayShadow
      ? detail.appearanceImageUris?.shadow ?? detail.row.imageUri
      : displayPurified
        ? detail.appearanceImageUris?.purified ?? detail.row.imageUri
        : detail.appearanceImageUris?.base ?? detail.row.imageUri
    : detail.row.imageUri;
  const selectedLocationBackgroundUri = editorVisible
    ? (() => {
        const selected = activeBackgroundOptions.find(
          (option) => String(option.id) === activeDraft.locationCard,
        );
        if (!selected || !selectedFusionOption || !activeDraft.fusedWith) {
          return selected?.imageUri ?? null;
        }
        const partnerBackgroundId = selectedFusionOption.partnerBackgroundIds[activeDraft.fusedWith];
        return selectedFusionOption.comboBackgrounds.find((candidate) => (
          candidate.ownBackgroundId === selected.id
          && candidate.partnerBackgroundId === partnerBackgroundId
        ))?.option.imageUri ?? selected.imageUri;
      })()
    : detail.row.locationBackgroundUri;
  const updateDraft = (patch: Partial<NativeInstanceEditDraft>) => {
    setDraftState((current) => {
      const next = {
        ...(current?.instanceId === detail.row.id ? current.value : createEditDraft(detail)),
        ...patch,
      };
      const calculatedCp = isWanted ? null : calculateNativeDraftCp(detail, next);
      return {
        instanceId: detail.row.id,
        value: calculatedCp == null ? next : { ...next, cp: String(calculatedCp) },
      };
    });
    setEditErrorState(null);
  };
  const toggleEdit = async () => {
    if (!canEdit) return;
    if (!onSaveDetails) {
      onEditInCurrentApp?.();
      return;
    }
    if (!editing) {
      editInteractionStartedAtRef.current = captureNativeUiInteractionStart();
      setDraftState({ instanceId: detail.row.id, value: createEditDraft(detail) });
      setEditErrorState(null);
      setEditorReadyInstanceId(null);
      setEditingInstanceId(detail.row.id);
      return;
    }
    const saveInteractionStartedAt = captureNativeUiInteractionStart();
    try {
      const combatValidation = !isWanted && detail.baseStats
        ? validateNativeCombatDraft(detail, activeDraft)
        : null;
      const combatError = combatValidation == null
        ? null
        : firstNativeCombatError(combatValidation);
      if (combatError) {
        setEditErrorState({ instanceId: detail.row.id, message: combatError });
        return;
      }
      const patch: NativeInstanceDetailPatch = isWanted
        ? {
            nickname: !instance?.nickname
              && activeDraft.nickname.trim() === detail.row.name.trim().split(/\s+/).at(-1)
              ? null
              : activeDraft.nickname,
            gender: activeDraft.gender,
            friendship_level: activeDraft.friendship,
            pref_lucky: activeDraft.prefLucky,
            most_wanted: activeDraft.mostWanted,
            fast_move_id: activeDraft.fastMove,
            charged_move1_id: activeDraft.chargedMove1,
            charged_move2_id: activeDraft.chargedMove2,
            location_card: activeDraft.locationCard,
            weight: null,
            height: null,
            wanted_size_preferences: buildWantedSizePreferences(activeDraft, detail.sizeThresholds),
          }
        : {
            nickname: !instance?.nickname
              && activeDraft.nickname.trim() === detail.row.name.trim().split(/\s+/).at(-1)
              ? null
              : activeDraft.nickname,
            cp: combatValidation?.computed.cp ?? nullableNumber(activeDraft.cp),
            level: combatValidation?.computed.level ?? nullableNumber(activeDraft.level),
            gender: activeDraft.gender,
            weight: nullableNumber(activeDraft.weight),
            height: nullableNumber(activeDraft.height),
            attack_iv: combatValidation?.computed.ivs?.attack ?? nullableNumber(activeDraft.attackIv),
            defense_iv: combatValidation?.computed.ivs?.defense ?? nullableNumber(activeDraft.defenseIv),
            stamina_iv: combatValidation?.computed.ivs?.stamina ?? nullableNumber(activeDraft.staminaIv),
            location_caught: activeDraft.locationCaught,
            date_caught: activeDraft.dateCaught,
            fast_move_id: activeDraft.fastMove,
            charged_move1_id: activeDraft.chargedMove1,
            charged_move2_id: activeDraft.chargedMove2,
            location_card: activeDraft.locationCard,
            lucky: isCaught ? activeDraft.lucky : instance?.lucky,
            is_traded: isCaught
              ? activeDraft.lucky || activeDraft.isTraded
              : instance?.is_traded,
            original_trainer_id: isCaught && activeDraft.isTraded
              ? activeDraft.originalTrainerId
              : instance?.original_trainer_id,
            original_trainer_name: isCaught && activeDraft.isTraded
              ? activeDraft.originalTrainerName
              : instance?.original_trainer_name,
            traded_date: isCaught && activeDraft.isTraded
              ? activeDraft.tradedDate
              : instance?.traded_date,
            pokeball: activeDraft.pokeball,
            shadow: isCaught ? activeDraft.shadow : instance?.shadow,
            purified: isCaught ? activeDraft.purified : instance?.purified,
            max_attack: detail.row.maxKind || detail.specialMaxBaseEligible || activeDraft.crowned
              ? activeDraft.maxAttack
              : instance?.max_attack,
            max_guard: detail.row.maxKind || detail.specialMaxBaseEligible || activeDraft.crowned
              ? activeDraft.maxGuard
              : instance?.max_guard,
            max_spirit: detail.row.maxKind || detail.specialMaxBaseEligible || activeDraft.crowned
              ? activeDraft.maxSpirit
              : instance?.max_spirit,
            mega: activeDraft.megaRegistered || activeDraft.megaEnabled,
            is_mega: activeDraft.megaEnabled,
            mega_form: activeDraft.megaEnabled ? activeDraft.megaForm : null,
            crown: activeDraft.fused ? false : activeDraft.crowned,
            is_fused: activeDraft.fused,
            fused_with: activeDraft.fused ? activeDraft.fusedWith : null,
            fusion: activeDraft.fused && activeDraft.fusionId != null
              ? { [activeDraft.fusionId]: true }
              : instance?.fusion,
            fusion_form: activeDraft.fused
              ? activeDraft.fusionForm
              : activeDraft.crowned
                ? activeDraft.crownForm
                : null,
          };
      // Match the web interaction: the Save tap exits edit mode immediately.
      // Persistence is still durable because onSaveDetails queues the complete
      // snapshot locally before resolving. Restore the draft if that local
      // operation fails.
      setEditingInstanceId(null);
      setEditorReadyInstanceId(null);
      setEditErrorState(null);
      markNativeUiPerformanceAfterPaint(
        'instance_save_result_painted',
        saveInteractionStartedAt,
      );
      await onSaveDetails(patch);
    } catch (saveFailure) {
      setEditingInstanceId(detail.row.id);
      setEditErrorState({
        instanceId: detail.row.id,
        message: saveFailure instanceof Error
          ? saveFailure.message
          : 'Pokémon details could not be saved.',
      });
    }
  };

  return (
    <View style={styles.overlay} testID="native-instance-overlay">
      <NativeInstanceSwipeFrame
        activeItemKey={detail.row.id}
        background={(
          <Image fadeDuration={0}
          accessibilityElementsHidden
          blurRadius={3}
          resizeMode="cover"
          source={{
            uri: toAssetUrl(
              assetBaseUrl,
              backgroundPath(detail, editing ? {
                lucky: displayLucky,
                purified: displayPurified,
                shadow: displayShadow,
                typeIconUris: displayTypeIconUris,
              } : undefined),
            ),
          }}
          style={styles.fullBackground}
          testID="native-instance-background"
          />
        )}
        disabled={editingInstanceId === detail.row.id
          || backgroundPickerInstanceId === detail.row.id}
        onNext={onNext}
        onPrevious={onPrevious}
        onTargetCommitted={releaseLowerDetail}
        onTransitionEnd={releaseLowerDetail}
        onTransitionStart={beginInstanceTransition}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + (isTrade ? 0 : isWanted ? 10 : 30),
              paddingBottom: 104 + insets.bottom,
            },
          ]}
          directionalLockEnabled
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          onMomentumScrollEnd={rememberSettledScrollOffset}
          onScrollEndDrag={rememberSettledScrollOffset}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="native-instance-scroll"
        >
          <View
            style={[styles.shell, { width: shellWidth }]}
            testID="native-instance-swipe-surface"
          >
          {cachedAt != null ? (
            <View accessibilityLiveRegion="polite" style={styles.offlineBanner}>
              <Text style={styles.offlineTitle}>Viewing an offline copy</Text>
              <Text style={styles.offlineBody}>Saved changes will synchronize after reconnecting.</Text>
            </View>
          ) : null}

          {isWanted ? (
            <FriendshipConditions
              accent={status.accent}
              assetBaseUrl={assetBaseUrl}
              detail={detail}
              draft={activeDraft}
              editing={editorVisible}
              canPickBackground={activeBackgroundOptions.length > 0}
              onDraftChange={updateDraft}
              onEdit={() => void toggleEdit()}
              onOpenBackground={() => setBackgroundPickerInstanceId(detail.row.id)}
              palette={palette}
              canEdit={canEdit}
            />
          ) : (
            <View style={styles.headerRow}>
              {canEdit ? (
                <Pressable
                  accessibilityLabel={editing ? 'Save Pokémon' : 'Edit Pokémon'}
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void toggleEdit()}
                  style={styles.iconButton}
                >
                  <Image fadeDuration={0}
                    accessibilityElementsHidden
                    resizeMode="contain"
                    source={{
                      uri: toAssetUrl(
                        assetBaseUrl,
                        editing ? '/images/save-icon.png' : '/images/edit-icon.png',
                      ),
                    }}
                    style={[styles.editImage, styles.stageHeaderIcon]}
                  />
                </Pressable>
              ) : <View style={styles.iconButton} />}
              {!isWanted && (cp != null || editorVisible) ? (
                editorVisible ? (
                  <View style={styles.inlineCpEditor}>
                    <Text style={[styles.cpLabel, desktopLayout && styles.cpLabelDesktop]}>CP</Text>
                    <TextInput
                      accessibilityLabel="Combat Power"
                      keyboardType="number-pad"
                      onChangeText={(draftCp) => updateDraft({ cp: draftCp })}
                      selectTextOnFocus
                      style={[
                        styles.inlineCpInput,
                        desktopLayout && styles.inlineCpInputDesktop,
                      ]}
                      value={activeDraft.cp}
                    />
                  </View>
                ) : (
                  <Text style={styles.cpText}>
                    <Text style={[styles.cpLabel, desktopLayout && styles.cpLabelDesktop]}>CP</Text>
                    <Text style={[styles.cpValue, desktopLayout && styles.cpValueDesktop]}>{cp}</Text>
                  </Text>
                )
              ) : <View />}
              {isCaught && canEdit ? (
                <Pressable
                  accessibilityLabel={detail.row.favorite ? 'Remove Favorite' : 'Mark as Favorite'}
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => onToggleFavorite(!detail.row.favorite)}
                  style={styles.iconButton}
                >
                  <Text style={[styles.favoriteIcon, detail.row.favorite && styles.favoriteSelected]}>
                    {detail.row.favorite ? '★' : '☆'}
                  </Text>
                </Pressable>
              ) : editorVisible && activeBackgroundOptions.length > 0 ? (
                  <Pressable
                    accessibilityLabel="Choose location background"
                    accessibilityRole="button"
                    onPress={() => setBackgroundPickerInstanceId(detail.row.id)}
                    style={styles.iconButton}
                  >
                    <Image fadeDuration={0}
                      accessibilityElementsHidden
                      resizeMode="contain"
                      source={{ uri: toAssetUrl(assetBaseUrl, '/images/location.png') }}
                      style={[styles.editImage, styles.stageHeaderIcon]}
                    />
                  </Pressable>
              ) : <View style={styles.iconButton} />}
            </View>
          )}

          {editorVisible && isCaught && activeBackgroundOptions.length > 0 ? (
            <View style={styles.inlineBackgroundRow}>
              <Pressable
                accessibilityLabel="Choose location background"
                accessibilityRole="button"
                onPress={() => setBackgroundPickerInstanceId(detail.row.id)}
                style={styles.iconButton}
              >
                <Image
                  fadeDuration={0}
                  accessibilityElementsHidden
                  resizeMode="contain"
                  source={{ uri: toAssetUrl(assetBaseUrl, '/images/location.png') }}
                  style={[styles.editImage, styles.stageHeaderIcon]}
                />
              </Pressable>
            </View>
          ) : null}

          {!isWanted && showArc ? (
            <View style={styles.arc}>
              <LevelArc level={displayLevel} />
            </View>
          ) : null}

          <View style={[
            styles.imageStage,
            {
              width: locationBackdropLayout.stageSize,
              height: locationBackdropLayout.stageSize,
              marginTop: -locationBackdropLayout.stageLift,
            },
          ]}>
            {selectedLocationBackgroundUri ? (
              <View
                style={[
                  styles.locationBackdrop,
                  {
                    top: locationBackdropLayout.backdropTop,
                    width: locationBackdropLayout.backdropWidth,
                    height: locationBackdropLayout.backdropHeight,
                    transform: [{ translateX: -locationBackdropLayout.backdropWidth / 2 }],
                  },
                ]}
                testID="native-instance-location-backdrop-frame"
              >
                <NativePokemonLocationBackdrop
                  uri={selectedLocationBackgroundUri}
                  variant="instance"
                />
              </View>
            ) : null}
            {displayLucky ? (
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
                style={[
                  styles.luckyBackdrop,
                  {
                    width: locationBackdropLayout.stageSize,
                    height: locationBackdropLayout.stageSize,
                  },
                ]}
              />
            ) : null}
            {displayImageUri ? (
              <Image fadeDuration={0}
                accessibilityLabel={detail.row.name}
                resizeMode="contain"
                source={{ uri: displayImageUri }}
                style={[
                  styles.pokemonImage,
                  {
                    width: locationBackdropLayout.pokemonSize,
                    height: locationBackdropLayout.pokemonSize,
                  },
                ]}
              />
            ) : null}
            {maxBadge ? (
              <Image fadeDuration={0}
                accessibilityLabel={detail.row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
                resizeMode="contain"
                source={{ uri: maxBadge }}
                style={[
                  styles.maxBadge,
                  {
                    top: locationBackdropLayout.stageSize * 0.02,
                    right: locationBackdropLayout.stageSize * 0.02,
                    width: locationBackdropLayout.maxBadgeSize,
                    height: locationBackdropLayout.maxBadgeSize,
                  },
                ]}
              />
            ) : null}
            {displayPurified ? (
              <Image fadeDuration={0}
                accessibilityLabel="Purified"
                resizeMode="contain"
                source={{ uri: toAssetUrl(assetBaseUrl, '/images/purified.png') }}
                style={[
                  styles.purifiedBadge,
                  {
                    bottom: locationBackdropLayout.stageSize * 0.02,
                    left: locationBackdropLayout.stageSize * 0.02,
                    width: locationBackdropLayout.purifiedBadgeSize,
                    height: locationBackdropLayout.purifiedBadgeSize,
                  },
                ]}
              />
            ) : null}
          </View>

          <View style={[
            styles.detailsPanel,
            isWanted && (desktopLayout ? styles.wantedDetailsPanelDesktop : styles.wantedDetailsPanel),
            isTrade && styles.tradeDetailsPanel,
            { backgroundColor: palette.panel },
          ]}>
            {caughtDateParts ? (
              <View
                accessibilityLabel={`Caught on ${caughtDate}`}
                accessible
                style={styles.caughtDateBadge}
              >
                <Image fadeDuration={0}
                  accessibilityElementsHidden
                  source={{ uri: toAssetUrl(assetBaseUrl, '/images/balls/pokeball.png') }}
                  style={styles.caughtDateBall}
                />
                <View>
                  <Text style={styles.caughtDateYear}>{caughtDateParts[1]}</Text>
                  <Text style={styles.caughtDateDay}>{caughtDateParts[2]}-{caughtDateParts[3]}</Text>
                </View>
              </View>
            ) : null}
            {statusLabel ? (
              <Text style={[styles.statusEyebrow, { color: status.accent }]}>{statusLabel}</Text>
            ) : null}
            {editorVisible ? (
              <NativeInlineInstanceEditor
                assetBaseUrl={assetBaseUrl}
                detail={detail}
                draft={activeDraft}
                isCaught={isCaught}
                isWanted={isWanted}
                onChange={updateDraft}
                palette={palette}
                typeIconUris={displayTypeIconUris}
              />
            ) : (
              <Text accessibilityRole="header" style={[
                styles.name,
                desktopLayout && styles.nameDesktop,
                { color: palette.text },
              ]}>
                {detail.row.name}
              </Text>
            )}

            {!editorVisible && ((!isWanted && showArc) || Boolean(gender)) ? (
              <View style={styles.levelGenderRow}>
                <View style={styles.sideSlot} />
                {!isWanted && showArc ? (
                  <Text style={[styles.levelText, { color: palette.secondary }]}>LEVEL: {displayLevel}</Text>
                ) : <View />}
                <Text style={[styles.genderText, { color: gender === 'Female' ? '#ff3b87' : '#30a7ff' }]}>
                  {gender === 'Female' ? '♀' : gender === 'Male' ? '♂' : ''}
                </Text>
              </View>
            ) : null}

            {!editorVisible && !isWanted && showPhysicalRow ? (
              <View style={styles.physicalRow}>
                <View style={styles.physicalValue}>
                  {weight != null ? (
                    <>
                      <Text style={[styles.statValue, { color: palette.text }]}>{weight}kg</Text>
                      <Text style={[styles.statLabel, { color: palette.secondary }]}>WEIGHT</Text>
                    </>
                  ) : null}
                </View>
                {isCaught ? (
                  <>
                    <View style={[styles.pipe, { backgroundColor: palette.divider }]} />
                    <View
                      accessibilityLabel={pokemonTypesAccessibilityLabel(displayTypeIconUris)}
                      accessible
                      style={styles.types}
                      testID={pokemonTypesTestId(displayTypeIconUris)}
                    >
                      {displayTypeIconUris.map((uri) => (
                        <Image fadeDuration={0}
                          accessibilityLabel={`${uri.match(/\/([^/?]+)\.png(?:\?|$)/i)?.[1] ?? 'Pokémon'} type`}
                          key={uri}
                          source={{ uri }}
                          style={styles.typeIcon}
                        />
                      ))}
                    </View>
                    <View style={[styles.pipe, { backgroundColor: palette.divider }]} />
                  </>
                ) : null}
                <View style={styles.physicalValue}>
                  {height != null ? (
                    <>
                      <Text style={[styles.statValue, { color: palette.text }]}>{height}m</Text>
                      <Text style={[styles.statLabel, { color: palette.secondary }]}>HEIGHT</Text>
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {editorVisible ? (
              <NativeInstanceEditFields
                assetBaseUrl={assetBaseUrl}
                detail={detail}
                draft={activeDraft}
                isCaught={isCaught}
                isWanted={isWanted}
                onChange={updateDraft}
                onRequestLocationVisibility={requestKeyboardFieldVisibility}
                palette={palette}
              />
            ) : null}

            {editorVisible && !isCaught ? (
              <TargetSummary
                assetBaseUrl={assetBaseUrl}
                canEdit={canEdit}
                detail={detail}
                onEdit={editPreferences}
                onOpenTarget={openTarget}
                palette={palette}
              />
            ) : null}

            {!editorVisible
              && isCaught
              && !instance?.mega
              && !instance?.is_mega
              && (detail.megaOptions?.length ?? 0) > 0 ? (
                <View accessibilityLabel="Mega Evolution available" accessible style={styles.megaEligibility}>
                  <Image fadeDuration={0}
                    accessibilityElementsHidden
                    source={{ uri: toAssetUrl(assetBaseUrl, '/images/mega.png') }}
                    style={styles.megaEligibilityIcon}
                  />
                  <Text style={styles.megaEligibilityText}>MEGA EVOLVE</Text>
                </View>
              ) : null}

            {!editorVisible ? (
              <NativeInstanceReadOnlyDetailSections
                assetBaseUrl={assetBaseUrl}
                canEdit={canEdit}
                caughtDate={lowerDetail === detail
                  ? caughtDate
                  : !isWanted && lowerDetail.instance?.date_caught
                    ? lowerDetail.instance.date_caught.slice(0, 10)
                    : null}
                detail={lowerDetail}
                light={light}
                movesWarning={movesWarning}
                onEditPreferences={editPreferences}
                onOpenTarget={openTarget}
                palette={palette}
                statusAccent={(light ? LIGHT_STATUS : STATUS)[lowerDetail.row.status].accent}
              />
            ) : null}

            {saveNotice ? (
              <View accessibilityLiveRegion="polite" style={styles.notice}>
                <Text style={styles.noticeText}>{saveNotice}</Text>
              </View>
            ) : null}
            {saveError ? (
              <View accessibilityRole="alert" style={styles.saveError}>
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            ) : null}
            {editError ? (
              <View accessibilityRole="alert" style={styles.saveError}>
                <Text style={styles.saveErrorText}>{editError}</Text>
              </View>
            ) : null}
          </View>
          </View>
        </ScrollView>
      </NativeInstanceSwipeFrame>

      <NativeBackgroundPicker
        assetBaseUrl={assetBaseUrl}
        onChange={(locationCard) => updateDraft({ locationCard })}
        onClose={() => setBackgroundPickerInstanceId(null)}
        open={backgroundPickerOpen}
        options={activeBackgroundOptions}
        palette={palette}
        selectedId={activeDraft.locationCard}
      />

      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onBack}
        style={[styles.closeButton, { bottom: 18 }]}
      >
        <Image fadeDuration={0}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, light ? '/images/close-button-light.png' : '/images/close-button.png') }}
          style={styles.closeImage}
        />
      </Pressable>
    </View>
  );
};

const DARK = {
  border: '#64748b',
  divider: '#808080',
  fallbackBackground: '#0f2b2b',
  meta: 'rgba(255,255,255,0.08)',
  input: '#242b2a',
  panel: '#333333',
  secondary: '#aeb8b5',
  text: '#e0f0e5',
  targetCard: '#152321',
  targetPanel: '#313333',
  track: '#d9dce0',
};

const LIGHT = {
  border: '#6f8883',
  divider: '#8a9b98',
  fallbackBackground: '#e8f6f2',
  meta: 'rgba(23,59,66,0.06)',
  input: '#ffffff',
  panel: '#f7fbf8',
  secondary: '#58716c',
  text: '#173b42',
  targetCard: '#eef6f2',
  targetPanel: '#f0f5f2',
  track: '#d5dfdd',
};

const styles = StyleSheet.create({
  overlay: { flex: 1, overflow: 'hidden', backgroundColor: '#0f2b2b' },
  motionLayer: { flex: 1, overflow: 'hidden' },
  backgroundLayer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  fullBackground: { ...StyleSheet.absoluteFill },
  backgroundTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,43,43,0.08)' },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingTop: 30, paddingBottom: 104 },
  shell: { maxWidth: 500, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  errorBody: { textAlign: 'center' },
  primaryButton: { minWidth: 240, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#147de2' },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
  secondaryButton: { minWidth: 240, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  secondaryButtonText: { fontWeight: '800' },
  offlineBanner: { width: '94%', gap: 2, marginBottom: 8, padding: 9, borderWidth: 1, borderColor: '#a87524', borderRadius: 12, backgroundColor: 'rgba(51,39,20,0.92)' },
  offlineTitle: { color: '#ffe2a8', fontWeight: '900', textAlign: 'center' },
  offlineBody: { color: '#f7d99b', fontSize: 12, textAlign: 'center' },
  headerRow: { zIndex: 7, width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12 },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  editImage: { width: 42, height: 42 },
  stageHeaderIcon: {
    tintColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  cpText: {
    paddingTop: 3,
    color: '#ffffff',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cpLabel: { fontSize: 16, lineHeight: 35 },
  cpLabelDesktop: { fontSize: 24, lineHeight: 50 },
  cpValue: { fontSize: 32, lineHeight: 35 },
  cpValueDesktop: { fontSize: 46, lineHeight: 50 },
  inlineCpEditor: {
    minWidth: 74,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
  },
  inlineCpInput: {
    width: 62,
    height: 34,
    padding: 0,
    borderWidth: 1,
    borderColor: '#a3a3a3',
    borderRadius: 2,
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  inlineCpInputDesktop: { width: 92, height: 50, fontSize: 38, lineHeight: 44 },
  favoriteIcon: { color: '#ffffff', fontSize: 48, lineHeight: 50, fontWeight: '300' },
  favoriteSelected: { color: '#ffd000' },
  inlineBackgroundRow: {
    zIndex: 8,
    width: '100%',
    height: 43,
    alignItems: 'flex-end',
    marginTop: -9,
    paddingHorizontal: 12,
  },
  conditionsPanel: {
    zIndex: 8,
    width: '96.5%',
    gap: 5,
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 11,
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  conditionsHeadingRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  conditionEditButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionEditImage: { width: 35, height: 35 },
  conditionBackgroundButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  conditionBackgroundImage: { width: 32, height: 32 },
  conditionsHeadingCopy: { flex: 1, minWidth: 0, gap: 2 },
  conditionsTitle: { color: '#ff617d', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  conditionsSubtitle: { fontSize: 11, lineHeight: 13 },
  priorityBadge: {
    minHeight: 38,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#77817f',
    borderRadius: 999,
    backgroundColor: 'rgba(53,61,61,0.72)',
  },
  priorityBadgeActive: { borderColor: '#ff704d', backgroundColor: 'rgba(255,112,77,0.10)' },
  priorityBadgeText: { color: '#aab4b2', fontSize: 11, fontWeight: '900' },
  priorityBadgeTextActive: { color: '#ff815d' },
  friendshipIcons: {
    minHeight: 38,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearts: { flexDirection: 'row', flexWrap: 'nowrap' },
  heart: { width: 30, height: 30 },
  friendshipBadgeIcon: { width: 43, height: 43, marginLeft: 3 },
  remoteTradeIcon: { width: 39, height: 39, marginLeft: 2 },
  inactiveConditionIcon: { opacity: 0.32 },
  friendshipStatus: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  friendshipSlider: { width: 280, maxWidth: '100%', height: 25, alignSelf: 'center' },
  conditionChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(239,91,113,0.08)',
  },
  conditionChipText: { fontSize: 11 },
  arc: { position: 'absolute', zIndex: 1, top: 48, alignSelf: 'center' },
  imageStage: { zIndex: 3, width: 296, height: 296, alignItems: 'center', justifyContent: 'center', marginTop: -48 },
  locationBackdrop: { position: 'absolute', left: '50%' },
  luckyBackdrop: { position: 'absolute', zIndex: 2, width: 296, height: 296 },
  pokemonImage: { zIndex: 4, width: 290, height: 290 },
  maxBadge: { position: 'absolute', zIndex: 5, top: 5, right: 5, width: 104, height: 104 },
  purifiedBadge: { position: 'absolute', zIndex: 5, bottom: 5, left: 5, width: 54, height: 54 },
  detailsPanel: { width: '100%', minHeight: 300, alignItems: 'center', marginTop: -51, paddingTop: 64, paddingBottom: 18, borderRadius: 12, overflow: 'hidden' },
  wantedDetailsPanel: { marginTop: -42, paddingTop: 43 },
  wantedDetailsPanelDesktop: { marginTop: -85, paddingTop: 43 },
  tradeDetailsPanel: { marginTop: -60, paddingTop: 67 },
  caughtDateBadge: {
    position: 'absolute',
    zIndex: 4,
    top: 12,
    right: 5,
    minWidth: 67,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#f4be5c',
  },
  caughtDateBall: { width: 19, height: 19 },
  caughtDateYear: { color: '#422b00', fontSize: 12, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  caughtDateDay: { color: '#422b00', fontSize: 10, lineHeight: 11, fontWeight: '800', textAlign: 'center' },
  statusEyebrow: { marginBottom: 4, fontSize: 12, fontWeight: '900', letterSpacing: 1.7 },
  name: { maxWidth: '92%', fontSize: 32, lineHeight: 35, fontWeight: '500', textAlign: 'center' },
  nameDesktop: { fontSize: 52, lineHeight: 55 },
  megaEligibility: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#319779',
  },
  megaEligibilityIcon: { width: 22, height: 22 },
  megaEligibilityText: { color: '#061f17', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  inlineEditor: { width: '100%', alignItems: 'center' },
  inlineIdentityRow: {
    position: 'relative',
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIdentitySide: {
    position: 'absolute',
    top: 2,
    width: 54,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIdentitySideLeft: { left: 0 },
  inlineIdentitySideRight: { right: 0 },
  inlineIdentityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inlineIdentityIcon: { width: 34, height: 34 },
  inlineIconInactive: { opacity: 0.28 },
  inlineNameSlot: { maxWidth: '72%', alignItems: 'center', gap: 2 },
  inlineNameMeasure: {
    position: 'absolute',
    opacity: 0,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
  },
  inlineNameInput: {
    minWidth: 50,
    maxWidth: '100%',
    height: 42,
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: 'transparent',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
    textAlign: 'center',
  },
  inlineLevelGenderRow: {
    width: '100%',
    minHeight: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    paddingHorizontal: 22,
  },
  inlineLevelControl: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inlineLevelLabel: { fontSize: 11, fontWeight: '700' },
  inlineLevelInput: {
    width: 50,
    height: 24,
    padding: 1,
    borderWidth: 1,
    borderRadius: 3,
    backgroundColor: 'transparent',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  inlineGenderButton: {
    position: 'absolute',
    right: 22,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineGenderIcon: { width: 30, height: 30 },
  inlineMeasurementsRow: {
    width: '100%',
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  inlineMeasurement: { flex: 1, alignItems: 'center' },
  inlineMeasurementValue: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  inlineMeasurementInput: {
    width: 45,
    height: 23,
    padding: 1,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: 'transparent',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'right',
  },
  inlineMeasurementSuffix: { marginLeft: -1, fontSize: 15, fontWeight: '500' },
  inlineMeasurementLabel: { marginTop: 1, fontSize: 10, fontWeight: '700' },
  inlinePipe: { width: 2, height: 38 },
  inlineTypes: { minWidth: 82, flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 9 },
  inlineTypeIcon: { width: 24, height: 24 },
  editFields: { width: '94%', gap: 12, paddingTop: 6 },
  editFieldGroup: { width: '100%', gap: 4 },
  editMovesGroup: { paddingTop: 9, paddingBottom: 10, borderBottomWidth: 2 },
  editFieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  editInput: {
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: '400',
  },
  editIvRows: { width: '100%' },
  editIvRow: {
    position: 'relative',
    width: '100%',
    height: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  editIvLabel: { fontSize: 15, fontWeight: '500' },
  editIvTrack: {
    position: 'absolute',
    left: '12.5%',
    bottom: 0,
    width: '75%',
    height: 15,
    overflow: 'hidden',
    borderRadius: 7.5,
  },
  editIvInput: {
    width: 22,
    height: 22,
    padding: 0,
    borderWidth: 1,
    borderRadius: 3,
    backgroundColor: 'transparent',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  addMoveButton: {
    width: 26,
    height: 26,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 13,
  },
  addMoveText: { marginTop: -2, fontSize: 24, lineHeight: 25, fontWeight: '400' },
  booleanOptions: { flexDirection: 'row', gap: 7 },
  booleanOption: {
    minHeight: 27,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
  },
  booleanOptionSelected: { backgroundColor: 'rgba(224,240,229,0.2)' },
  booleanOptionText: { fontSize: 10, fontWeight: '900' },
  disabledOption: { opacity: 0.42 },
  editHelpText: { fontSize: 12, lineHeight: 17 },
  powerPanel: {
    width: '100%',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderBottomWidth: 2,
  },
  powerActionRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  powerActionPill: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#8be39e',
  },
  powerActionText: { color: '#061f17', fontSize: 12, lineHeight: 14, fontWeight: '700', letterSpacing: 0.4 },
  powerActionGlyph: { width: 27, height: 27 },
  powerActionTarget: { width: 34, height: 34 },
  maxPowerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  maxPowerIcon: { width: 35, height: 35 },
  powerTitle: { fontSize: 14, fontWeight: '900' },
  powerFormOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  powerFormOption: {
    minWidth: 148,
    minHeight: 46,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
  },
  powerFormOptionSelected: { backgroundColor: 'rgba(40,137,226,0.18)' },
  powerFormOptionDisabled: { opacity: 0.45 },
  powerFormImage: { width: 34, height: 34 },
  powerFormLabel: { fontSize: 11, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  fusionPartnerPanel: { gap: 7, paddingTop: 2 },
  maxMovesPanel: { width: '100%', gap: 9 },
  maxMovesHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  maxMovesIcon: { width: 34, height: 34 },
  maxMoveRow: { width: '100%', gap: 5 },
  maxMoveLabel: { fontSize: 12, fontWeight: '900' },
  maxMoveOptions: { flexDirection: 'row', gap: 6 },
  maxMoveOption: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 8,
  },
  maxMoveOptionSelected: { backgroundColor: 'rgba(214,41,143,0.18)' },
  maxMoveOptionText: { fontSize: 11, fontWeight: '900' },
  editMetaPanel: {
    width: '100%',
    gap: 9,
    padding: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(170,170,170,0.22)',
  },
  editMetaSummary: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start' },
  editMetaSummaryCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  editMetaSummaryValue: { marginVertical: 3, fontSize: 16, lineHeight: 19 },
  editMetaSummaryDate: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4 },
  editMetaBall: { width: 30, height: 30, marginTop: 1, marginRight: 2 },
  editMetaBallLarge: { transform: [{ scale: 1.4 }] },
  editMetaDivider: { width: '100%', height: StyleSheet.hairlineWidth },
  locationSuggestionStatus: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationSuggestionStatusText: { fontSize: 12, fontWeight: '700' },
  locationSuggestionError: { color: '#ff7188', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  locationInputWrapper: { gap: 6 },
  locationSuggestions: {
    maxHeight: 210,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 9,
  },
  locationSuggestion: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationSuggestionPressed: { backgroundColor: 'rgba(56,169,255,0.14)' },
  locationSuggestionText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  ballOptions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  ballOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
  },
  ballCaughtLabel: { marginBottom: 1, fontSize: 12, textAlign: 'center' },
  ballOptionText: { fontSize: 10, lineHeight: 11, fontWeight: '400', letterSpacing: 0.4 },
  choiceFieldRow: {
    width: '100%',
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceField: {
    width: '70%',
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: 4,
  },
  choiceFieldTypeIcon: { width: 20, height: 20, flexShrink: 0 },
  choiceFieldTypeSpacer: { width: 0, height: 0 },
  choiceFieldValue: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  choiceFieldPower: { minWidth: 44, fontSize: 16, fontWeight: '400', textAlign: 'right' },
  choiceModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.66)' },
  choiceModalSheet: {
    maxHeight: '82%',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  choiceModalHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  choiceModalEyebrow: { color: '#2e9eff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  choiceModalTitle: { fontSize: 23, fontWeight: '900' },
  choiceModalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22 },
  choiceModalCloseText: { fontSize: 28, lineHeight: 30 },
  choiceList: { marginTop: 8 },
  choiceOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  choiceOptionSelected: { backgroundColor: 'rgba(46,158,255,0.13)' },
  choiceOptionTypeIcon: { width: 25, height: 25, flexShrink: 0 },
  choiceOptionCopy: { flex: 1, minWidth: 0 },
  choiceOptionName: { fontSize: 15, fontWeight: '900' },
  choiceOptionMeta: { marginTop: 2, fontSize: 12 },
  choiceOptionPower: { minWidth: 34, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  choiceCheck: { color: '#43c995', fontSize: 22, fontWeight: '900' },
  wantedSizeGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    paddingHorizontal: 10,
  },
  sizePreferenceRow: { flex: 1, minWidth: 0, gap: 5 },
  sizePreferenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  sizePreferenceIcon: { width: 18, height: 18, opacity: 0.78 },
  sizePreferenceLabel: { paddingLeft: 0 },
  sizeOptions: { flexDirection: 'row', gap: 3 },
  sizeOption: { minHeight: 36, flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 7 },
  sizeOptionSelected: { backgroundColor: 'rgba(255,97,125,0.16)' },
  sizeOptionText: { fontSize: 9, fontWeight: '900' },
  backgroundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 10, paddingBottom: 20 },
  backgroundOption: { width: '48.5%', height: 150, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 12 },
  backgroundOptionCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 40, justifyContent: 'center', paddingHorizontal: 7, backgroundColor: 'rgba(0,0,0,0.72)' },
  backgroundOptionName: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  backgroundOptionImageName: { color: '#ffffff' },
  noBackgroundIcon: { width: 54, height: 54, marginBottom: 7 },
  levelGenderRow: { width: '100%', minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  sideSlot: { width: 42 },
  levelText: { fontSize: 12, fontWeight: '800' },
  genderText: { width: 42, fontSize: 34, lineHeight: 36, fontWeight: '500', textAlign: 'right' },
  physicalRow: { width: '100%', minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  physicalValue: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '500' },
  statLabel: { fontSize: 11, fontWeight: '800' },
  pipe: { width: 2, height: 38 },
  types: { minWidth: 94, flexDirection: 'row', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  typeIcon: { width: 24, height: 24 },
  section: { width: '94%', marginTop: 12, paddingTop: 12, borderTopWidth: 2 },
  moveTabs: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 8 },
  moveTabButton: { minHeight: 38, justifyContent: 'flex-end', paddingHorizontal: 4 },
  moveTabActive: { paddingBottom: 4, borderBottomWidth: 2, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  moveTab: { paddingBottom: 6, borderBottomWidth: 2, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  nativeMovesPanel: { width: '100%', overflow: 'hidden' },
  nativeMoveBlock: { width: '100%', marginBottom: 5 },
  nativeMoveRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5 },
  nativeMoveIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nativeMoveTypeIcon: { width: 22, height: 22, flexShrink: 0 },
  nativeMoveName: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600' },
  nativeMovePower: { minWidth: 48, fontSize: 16, fontVariant: ['tabular-nums'], textAlign: 'right' },
  nativeMovePowerBonus: { color: '#4ea5ff', fontWeight: '800' },
  nativeShadowBonusRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 35 },
  nativeShadowBonusIconBadge: { width: 15, height: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4ea5ff', borderRadius: 8 },
  nativeShadowBonusIcon: { width: 11, height: 11 },
  nativeShadowBonusText: { color: '#d07cff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  detailRows: { width: '100%' },
  detailRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  detailLabel: { width: 104, flexShrink: 0, fontSize: 16, fontWeight: '600' },
  detailValue: { minWidth: 0, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  warningText: { color: '#ffd18a', paddingHorizontal: 8, lineHeight: 19 },
  ivRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  ivLabel: { width: 82, fontSize: 16, fontWeight: '700' },
  ivTrack: { flex: 1, height: 14, overflow: 'hidden', borderRadius: 7 },
  ivFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7, backgroundColor: '#ff9d23' },
  ivFillFull: { backgroundColor: '#d96562' },
  ivThird: { position: 'absolute', left: '33.333%', width: 2, top: 0, bottom: 0, backgroundColor: '#ffffff' },
  ivTwoThirds: { position: 'absolute', left: '66.666%', width: 2, top: 0, bottom: 0, backgroundColor: '#ffffff' },
  ivNumber: { width: 24, fontSize: 16, textAlign: 'right' },
  preferencePanel: { width: '94%', marginTop: 14, gap: 4, padding: 10, borderWidth: 1, borderRadius: 12 },
  preferenceTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  metaSection: { width: '94%', marginTop: 16, paddingTop: 18, borderTopWidth: 2 },
  metaPanel: { width: '100%', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  metaSummaryBlock: { width: '100%', alignItems: 'flex-start' },
  metaSummaryLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4 },
  metaSummaryValue: { marginVertical: 3, fontSize: 16, lineHeight: 19 },
  targetsPanel: {
    width: '94%',
    marginTop: 14,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  targetsPanelTrade: { marginTop: 29 },
  targetsHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetsTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  targetCount: { minWidth: 34, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 13 },
  targetCountText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  targetGridViewport: { marginTop: 5 },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 3 },
  targetCard: {
    width: '31.8%',
    minHeight: 161,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  targetCardPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  targetImageStage: { width: '100%', height: 101, alignItems: 'center', justifyContent: 'center' },
  targetLuckyBackdrop: { position: 'absolute', width: 102, height: 102 },
  targetImage: { width: 94, height: 94 },
  targetMaxBadge: { position: 'absolute', top: 0, right: 0, width: 31, height: 31 },
  targetName: { minHeight: 32, fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
  targetDex: { marginTop: 3, fontSize: 10 },
  noTargets: { paddingVertical: 18, textAlign: 'center' },
  editPreferencesButton: { width: '94%', minHeight: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 5, borderRadius: 10 },
  editPreferencesText: { color: '#07130d', fontSize: 14, fontWeight: '900' },
  notice: { width: '94%', marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#338b6b', borderRadius: 10, backgroundColor: '#102e26' },
  noticeText: { color: '#9ff0ca', fontWeight: '700', textAlign: 'center' },
  saveError: { width: '94%', marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#b65b70', borderRadius: 10, backgroundColor: '#3b1722' },
  saveErrorText: { color: '#ffd1da', fontWeight: '700', textAlign: 'center' },
  closeButton: { position: 'absolute', bottom: 18, left: '50%', zIndex: 20, width: 64, height: 64, marginLeft: -32 },
  closeImage: { width: 64, height: 64 },
  instanceNavigation: { position: 'absolute', bottom: 24, zIndex: 19, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  previousInstance: { left: 0 },
  nextInstance: { right: 0 },
  instanceNavigationIcon: { color: '#ffffff', fontSize: 34, lineHeight: 38, textShadowColor: '#00000088', textShadowRadius: 4 },
});
