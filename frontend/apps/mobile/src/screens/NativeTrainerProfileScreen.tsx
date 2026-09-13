import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeBackIcon } from '../components/NativeBackIcon';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { NativeCollectionRow } from '../features/collection/collectionModel';
import {
  NativePokemonLocationBackdrop,
} from '../features/collection/parity/NativePokemonLocationBackdrop';
import type { NativeTrainerProfileModel } from '../features/social/nativeTrainerProfileModel';
import type { NativeTrainerProfileDraft } from '../features/social/nativeTrainerProfileEditorModel';
import { NativeTrainerShowcasePicker } from '../features/social/NativeTrainerShowcasePicker';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import { NativeOptionPicker } from '../components/NativeOptionPicker';
import { NativeTrainerWorkspaceNav } from '../components/NativeTrainerWorkspaceNav';
import { NativeUiIcon, type NativeUiIconName } from '../components/NativeUiIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  TRAINER_TITLE_OPTIONS,
  TRAINER_TITLE_VISUALS,
  type TrainerTitle,
} from '@pokemongonexus/shared-contracts/users';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
  runNativeUiWorkAfterPaint,
} from '../observability/nativeUiInteractionTiming';

export type NativeTrainerProfileAction =
  | 'add'
  | 'accept'
  | 'cancel-request'
  | 'remove-friend'
  | 'block';

type Props = {
  assetBaseUrl: string;
  error?: string | null;
  highlights?: NativeCollectionRow[];
  highlightCandidates?: NativeCollectionRow[];
  isLoading?: boolean;
  isOwner: boolean;
  isRelationshipPending?: boolean;
  isProfileSaving?: boolean;
  model?: NativeTrainerProfileModel | null;
  onBack?: () => void;
  onOpenCollection: (filter?: 'caught' | 'trade' | 'wanted' | 'favorites') => void;
  onOpenFriends?: () => void;
  onRetry?: () => void;
  onRelationshipAction?: (action: NativeTrainerProfileAction) => void;
  feedback?: { tone: 'success' | 'error'; text: string } | null;
  onDismissFeedback?: () => void;
  editorDraft?: NativeTrainerProfileDraft | null;
  onBeginEdit?: () => void;
  onCancelEdit?: () => void;
  onChangeEditorDraft?: (draft: NativeTrainerProfileDraft) => void;
  onSaveProfile?: () => void;
};

const TEAM_COLORS = {
  mystic: { accent: '#5eb1f4', soft: '#18374f' },
  valor: { accent: '#ff6f74', soft: '#4a2429' },
  instinct: { accent: '#f2c94c', soft: '#463d1f' },
  neutral: { accent: '#42d7c6', soft: '#173739' },
} as const;

const LIGHT_TEAM_COLORS = {
  mystic: { accent: '#005bb5', soft: '#18374f' },
  valor: { accent: '#b00020', soft: '#4a2429' },
  instinct: { accent: '#7a5700', soft: '#463d1f' },
  neutral: { accent: '#006a61', soft: '#173739' },
} as const;

const TEAM_OPTIONS = [
  { key: '', label: 'Unaffiliated' },
  { key: 'Mystic', label: 'Mystic' },
  { key: 'Valor', label: 'Valor' },
  { key: 'Instinct', label: 'Instinct' },
];

const trainerTitleFallbackIcon = {
  medal: 'medal',
  ruler: 'ruler',
  users: 'trainers',
} as const satisfies Record<'medal' | 'ruler' | 'users', NativeUiIconName>;

const toAssetUrl = (baseUrl: string, path: string): string => (
  `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const NativeTrainerTitleVisual = ({
  assetBaseUrl,
  color,
  title,
}: {
  assetBaseUrl: string;
  color: string;
  title: TrainerTitle;
}) => {
  const visual = TRAINER_TITLE_VISUALS[title];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.titleVisual}
      testID={`native-trainer-title-icon-${title}`}
    >
      {'masks' in visual ? visual.masks.map((mask, index) => (
        <Image
          fadeDuration={0}
          key={mask}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, mask) }}
          style={[styles.titleVisualImage, { tintColor: color }]}
          testID={`native-trainer-title-image-${title}-${index}`}
        />
      )) : (
        <View testID={`native-trainer-title-fallback-${title}`}>
          <NativeUiIcon color={color} name={trainerTitleFallbackIcon[visual.icon]} size={19} />
        </View>
      )}
    </View>
  );
};

const NativeTrainerTitleChoice = memo(function NativeTrainerTitleChoice({
  assetBaseUrl,
  disabled,
  light,
  onToggle,
  option,
  selected,
  teamColor,
}: {
  assetBaseUrl: string;
  disabled: boolean;
  light: boolean;
  onToggle: (title: TrainerTitle) => void;
  option: (typeof TRAINER_TITLE_OPTIONS)[number];
  selected: boolean;
  teamColor: string;
}) {
  return (
    <Pressable
    accessibilityLabel={`${option.label}. ${option.description}`}
    accessibilityRole="button"
    accessibilityState={{ selected, disabled }}
    aria-pressed={selected}
    disabled={disabled}
    onPress={() => onToggle(option.id)}
    style={[
      styles.titleChoice,
      light && styles.titleChoiceLight,
      selected && styles.titleChoiceSelected,
      disabled && styles.titleChoiceDisabled,
    ]}
  >
    <NativeTrainerTitleVisual assetBaseUrl={assetBaseUrl} color={selected ? '#dff3ff' : teamColor} title={option.id} />
    <Text numberOfLines={2} style={[styles.titleChoiceText, light && styles.textLight, selected && styles.titleChoiceTextSelected]}>
      {option.label}
    </Text>
    </Pressable>
  );
});

const NativeTrainerTitlePicker = ({
  assetBaseUrl,
  light,
  onChange,
  teamColor,
  titles,
}: {
  assetBaseUrl: string;
  light: boolean;
  onChange: (titles: TrainerTitle[]) => void;
  teamColor: string;
  titles: TrainerTitle[];
}) => {
  const [selectedTitles, setSelectedTitles] = useState(() => titles);
  const [limitReached, setLimitReached] = useState(() => titles.length >= 3);
  const selectedTitlesRef = useRef(selectedTitles);

  const toggleTitle = useCallback((title: TrainerTitle) => {
    const startedAt = captureNativeUiInteractionStart();
    const currentTitles = selectedTitlesRef.current;
    const nextTitles = currentTitles.includes(title)
      ? currentTitles.filter((entry) => entry !== title)
      : currentTitles.length >= 3 ? currentTitles : [...currentTitles, title];
    if (nextTitles === currentTitles) return;
    selectedTitlesRef.current = nextTitles;
    setSelectedTitles(nextTitles);
    markNativeUiPerformanceAfterPaint('profile_title_result_painted', startedAt);
    runNativeUiWorkAfterPaint(() => {
      setLimitReached(nextTitles.length >= 3);
      onChange(nextTitles);
    });
  }, [onChange]);

  return (
    <>
      <View style={styles.titlesHeading}>
        <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>PLAY STYLES</Text>
        <Text style={[styles.selectionCount, light && styles.mutedLight]}>{selectedTitles.length}/3 selected</Text>
      </View>
      <View accessibilityLabel="Trainer titles" style={styles.titlePicker}>
        {TRAINER_TITLE_OPTIONS.map((option) => {
          const selected = selectedTitles.includes(option.id);
          const disabled = !selected && limitReached;
          return (
            <NativeTrainerTitleChoice
              assetBaseUrl={assetBaseUrl}
              disabled={disabled}
              key={option.id}
              light={light}
              onToggle={toggleTitle}
              option={option}
              selected={selected}
              teamColor={teamColor}
            />
          );
        })}
      </View>
    </>
  );
};

const NativeDeferredTrainerTitlePicker = (
  props: ComponentProps<typeof NativeTrainerTitlePicker>,
) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    runNativeUiWorkAfterPaint(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.titlesHeading}>
        <Text style={[styles.eyebrow, props.light && styles.eyebrowLight]}>PLAY STYLES</Text>
        <Text style={[styles.selectionCount, props.light && styles.mutedLight]}>{props.titles.length}/3 selected</Text>
      </View>
    );
  }
  return <NativeTrainerTitlePicker {...props} />;
};

const relationshipLabel = (relationship: NativeTrainerProfileModel['relationship']): string | null => ({
  friend: 'Friends',
  incoming: 'Request received',
  outgoing: 'Request sent',
  blocked: 'Blocked',
  none: null,
  self: null,
})[relationship];

const HighlightCard = ({
  assetBaseUrl,
  compact,
  light,
  row,
}: {
  assetBaseUrl: string;
  compact: boolean;
  light: boolean;
  row?: NativeCollectionRow;
}) => (
  <View style={[
    styles.highlight,
    compact && !row && styles.highlightEmptyCompact,
    light && styles.highlightLight,
  ]}>
    {row?.locationBackgroundUri ? <NativePokemonLocationBackdrop uri={row.locationBackgroundUri} /> : null}
    {row?.imageUri ? (
      <Image fadeDuration={0} resizeMode="contain" source={{ uri: row.imageUri }} style={styles.highlightImage} />
    ) : (
      <Text style={[styles.emptyStar, light && styles.mutedLight]}>★</Text>
    )}
    {row?.maxKind ? (
      <Image fadeDuration={0}
        resizeMode="contain"
        source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/${row.maxKind}.png` }}
        style={styles.maxIcon}
      />
    ) : null}
    <Text numberOfLines={2} style={[styles.highlightName, light && styles.textLight]}>
      {row?.name ?? 'Open slot'}
    </Text>
    {row ? (
      <Text style={[styles.highlightDetail, light && styles.mutedLight]}>
        {row.cp ? `CP ${row.cp.toLocaleString('en-US')}` : 'Featured Pokémon'}
      </Text>
    ) : null}
  </View>
);

export const resolveNativeProfileShowcaseDragTarget = ({
  columns,
  fromIndex,
  selectedCount,
  slotHeight,
  slotWidth,
  translationX,
  translationY,
}: {
  columns: number;
  fromIndex: number;
  selectedCount: number;
  slotHeight: number;
  slotWidth: number;
  translationX: number;
  translationY: number;
}): number => {
  if (selectedCount <= 1 || columns <= 0 || slotHeight <= 0 || slotWidth <= 0) return fromIndex;
  const rows = Math.ceil(selectedCount / columns);
  const fromColumn = fromIndex % columns;
  const fromRow = Math.floor(fromIndex / columns);
  const targetColumn = Math.max(
    0,
    Math.min(columns - 1, Math.round(fromColumn + translationX / slotWidth)),
  );
  const targetRow = Math.max(
    0,
    Math.min(rows - 1, Math.round(fromRow + translationY / slotHeight)),
  );
  return Math.min(selectedCount - 1, targetRow * columns + targetColumn);
};

const NativeProfileShowcaseDragSlot = ({
  children,
  columns,
  enabled,
  index,
  onReorder,
  selectedCount,
}: {
  children: ReactNode;
  columns: number;
  enabled: boolean;
  index: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  selectedCount: number;
}) => {
  const [translationX] = useState(() => new Animated.Value(0));
  const [translationY] = useState(() => new Animated.Value(0));
  const slotSizeRef = useRef({ height: 1, width: 1 });
  const onGestureEvent = useMemo(() => Animated.event(
    [{ nativeEvent: { translationX, translationY } }],
    { useNativeDriver: true },
  ), [translationX, translationY]);
  const onHandlerStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;
    const target = resolveNativeProfileShowcaseDragTarget({
      columns,
      fromIndex: index,
      selectedCount,
      slotHeight: slotSizeRef.current.height,
      slotWidth: slotSizeRef.current.width,
      translationX: event.nativeEvent.translationX,
      translationY: event.nativeEvent.translationY,
    });
    translationX.setValue(0);
    translationY.setValue(0);
    if (event.nativeEvent.state === State.END && target !== index) onReorder(index, target);
  }, [columns, index, onReorder, selectedCount, translationX, translationY]);

  return (
    <PanGestureHandler
      enabled={enabled}
      minDist={7}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        onLayout={(event) => {
          slotSizeRef.current = event.nativeEvent.layout;
        }}
        style={{
          transform: [{ translateX: translationX }, { translateY: translationY }],
          width: columns === 3 ? '33.3333%' : '16.6667%',
          zIndex: enabled ? 1 : 0,
        }}
        testID={`native-profile-showcase-drag-slot-${index + 1}`}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
};

export const NativeTrainerProfileScreen = ({
  assetBaseUrl,
  error = null,
  highlights = [],
  highlightCandidates = [],
  isLoading = false,
  isOwner,
  isRelationshipPending = false,
  isProfileSaving = false,
  model = null,
  onBack,
  onOpenCollection,
  onOpenFriends,
  onRetry,
  onRelationshipAction,
  feedback = null,
  onDismissFeedback,
  editorDraft = null,
  onBeginEdit,
  onCancelEdit,
  onChangeEditorDraft,
  onSaveProfile,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const compactHeader = useWindowDimensions().width <= 520;
  const scrollRef = useRef<ScrollView>(null);
  const [confirmation, setConfirmation] = useState<'cancel-request' | 'remove-friend' | 'block' | null>(null);
  const [editingHighlightSlot, setEditingHighlightSlot] = useState<number | null>(null);
  const [pendingHighlightIds, setPendingHighlightIds] = useState<string[] | null>(null);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const feedbackPerformanceRef = useRef<{ event: string; startedAt: number } | null>(null);

  const clearTextInputFocus = () => {
    Keyboard.dismiss();
  };

  useEffect(() => {
    if (!feedback) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const pending = feedbackPerformanceRef.current;
    feedbackPerformanceRef.current = null;
    if (pending) markNativeUiPerformanceAfterPaint(pending.event, pending.startedAt);
  }, [feedback]);

  if (isLoading) {
    return (
      <View style={[styles.state, light && styles.screenLight]}>
        <ActivityIndicator color="#2f9cff" size="large" />
        <Text style={[styles.stateTitle, light && styles.textLight]}>Loading trainer profile</Text>
        <Text style={[styles.stateCopy, light && styles.mutedLight]}>Preparing the trainer card and showcase…</Text>
      </View>
    );
  }

  if (error || !model) {
    return (
      <View style={[styles.state, light && styles.screenLight]}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={[styles.stateTitle, light && styles.textLight]}>Trainer profile unavailable</Text>
        <Text style={[styles.stateCopy, light && styles.mutedLight]}>{error ?? 'This trainer could not be loaded.'}</Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const editingTeam = editorDraft?.team.toLocaleLowerCase();
  const cardTeam = editingTeam === 'mystic' || editingTeam === 'valor' || editingTeam === 'instinct'
    ? editingTeam
    : editorDraft ? 'neutral' : model.team;
  const team = (light ? LIGHT_TEAM_COLORS : TEAM_COLORS)[cardTeam];
  const editingTrainerLevel = Number(editorDraft?.trainerLevel);
  const cardTrainerLevel = editorDraft && Number.isFinite(editingTrainerLevel)
    ? editingTrainerLevel
    : model.trainerLevel;
  const relationship = relationshipLabel(model.relationship);
  const relationshipAction = model.relationship === 'none'
    ? { action: 'add' as const, label: 'Add friend', tone: 'primary' as const }
    : model.relationship === 'incoming'
      ? { action: 'accept' as const, label: 'Accept request', tone: 'primary' as const }
      : model.relationship === 'outgoing'
        ? { action: 'cancel-request' as const, label: 'Request sent', tone: 'secondary' as const }
        : model.relationship === 'friend'
          ? { action: 'remove-friend' as const, label: 'Friends', tone: 'secondary' as const }
          : null;
  const confirmationCopy = confirmation === 'block'
    ? {
        title: `Block ${model.username}?`,
        body: 'Existing friendship and pending requests will be removed. This trainer will no longer be able to interact with you.',
        confirmLabel: 'Block trainer',
      }
    : confirmation === 'remove-friend'
      ? {
          title: `Remove ${model.username}?`,
          body: 'This trainer will be removed from your friends. You can send a new request later.',
          confirmLabel: 'Remove friend',
        }
      : {
          title: 'Cancel friend request?',
          body: `Your pending request to ${model.username} will be canceled.`,
          confirmLabel: 'Cancel request',
        };
  const requestAction = (action: NativeTrainerProfileAction) => {
    clearTextInputFocus();
    if (action === 'cancel-request' || action === 'remove-friend' || action === 'block') {
      const startedAt = Date.now();
      setConfirmation(action);
      markNativeUiPerformanceAfterPaint('profile_relationship_confirmation_painted', startedAt);
      return;
    }
    feedbackPerformanceRef.current = {
      event: 'profile_relationship_result_painted',
      startedAt: Date.now(),
    };
    onRelationshipAction?.(action);
  };
  const selectedHighlightIds = pendingHighlightIds ?? editorDraft?.highlightInstanceIds ?? [];
  const selectedHighlightCount = selectedHighlightIds.filter(Boolean).length;
  const highlightById = new Map([
    ...highlights,
    ...highlightCandidates,
  ].map((row) => [row.id, row]));
  const displayedHighlights = editorDraft
    ? Array.from({ length: 6 }, (_, index) => highlightById.get(selectedHighlightIds[index] ?? ''))
    : highlights;
  const updateHighlightIds = (nextIds: string[]) => {
    if (!editorDraft || !onChangeEditorDraft) return;
    onChangeEditorDraft({ ...editorDraft, highlightInstanceIds: nextIds });
  };
  const stageHighlightIds = (nextIds: string[]) => {
    if (!editorDraft || !onChangeEditorDraft) return;
    setPendingHighlightIds(nextIds);
    runNativeUiWorkAfterPaint(() => {
      onChangeEditorDraft({ ...editorDraft, highlightInstanceIds: nextIds });
      setPendingHighlightIds(null);
    });
  };
  const updateEditorField = <K extends keyof NativeTrainerProfileDraft>(
    field: K,
    value: NativeTrainerProfileDraft[K],
  ) => {
    if (!editorDraft || !onChangeEditorDraft) return;
    onChangeEditorDraft({ ...editorDraft, [field]: value });
  };
  const chooseHighlight = (instanceId: string) => {
    if (editingHighlightSlot === null) return;
    const startedAt = Date.now();
    clearTextInputFocus();
    const nextIds = Array.from({ length: 6 }, (_, index) => selectedHighlightIds[index] ?? '');
    nextIds[editingHighlightSlot] = instanceId;
    stageHighlightIds(nextIds);
    setEditingHighlightSlot(null);
    markNativeUiPerformanceAfterPaint('profile_showcase_selection_result_painted', startedAt);
  };
  const clearHighlight = () => {
    if (editingHighlightSlot === null) return;
    const startedAt = Date.now();
    clearTextInputFocus();
    const compactIds = selectedHighlightIds.filter((id, index) => (
      index !== editingHighlightSlot && Boolean(id)
    ));
    const nextIds = Array.from({ length: 6 }, (_, index) => compactIds[index] ?? '');
    stageHighlightIds(nextIds);
    setEditingHighlightSlot(null);
    markNativeUiPerformanceAfterPaint('profile_showcase_selection_result_painted', startedAt);
  };
  const reorderHighlight = (index: number, destination: number) => {
    if (destination < 0 || destination >= selectedHighlightCount || destination === index) return;
    const startedAt = Date.now();
    const nextIds = Array.from({ length: 6 }, (_, slot) => selectedHighlightIds[slot] ?? '');
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(destination, 0, moved ?? '');
    updateHighlightIds(nextIds);
    markNativeUiPerformanceAfterPaint('profile_showcase_reorder_result_painted', startedAt);
  };
  const moveHighlight = (index: number, direction: -1 | 1) => {
    reorderHighlight(index, index + direction);
  };
  const profileFacts: { icon: NativeUiIconName; label: string; value: string }[] = [
    { icon: 'calendar', label: 'STARTED', value: model.startedLabel },
    { icon: 'map', label: 'LOCATION', value: model.locationLabel },
    { icon: 'id-card', label: 'TRAINER CODE', value: model.trainerCodeLabel },
  ];
  const statIcons: Record<NativeTrainerProfileModel['stats'][number]['key'], NativeUiIconName> = {
    registered: 'catalog',
    caught: 'pokeball',
    trade: 'trade',
    wanted: 'heart',
    favorites: 'star',
  };
  const needsProfileSetup = isOwner
    && model.team === 'neutral'
    && model.trainerLevel === null
    && model.totalXpLabel === 'XP not shared'
    && model.startedLabel === 'Not shared'
    && model.locationLabel === 'Not shared'
    && model.trainerCodeLabel === 'Not shared'
    && model.titles.length === 0
    && highlights.length === 0;

  return (
    <View style={[styles.screenRoot, light && styles.screenLight]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 24 + insets.top, paddingBottom: 116 + insets.bottom }]}
        ref={scrollRef}
        style={styles.screen}
        testID="native-trainer-profile"
      >
      <View style={styles.productHeader}>
        {onBack ? (
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={[styles.backButton, light && styles.backButtonLight]}>
            <NativeBackIcon color={light ? '#172124' : '#f7fbfa'} size={20} />
          </Pressable>
        ) : null}
        <View style={styles.productHeaderCopy}>
          <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{isOwner ? 'YOUR TRAINER CARD' : 'TRAINER PROFILE'}</Text>
          <Text numberOfLines={1} style={[styles.pageTitle, light && styles.textLight]}>{model.username}</Text>
          {!compactHeader ? (
            <Text style={[styles.pageSubtitle, light && styles.mutedLight]}>
              {isOwner ? 'Your Pokémon GO identity and collection showcase.' : `Meet @${model.username} and explore their shared collection.`}
            </Text>
          ) : null}
        </View>
        <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
          {isOwner && onBeginEdit && !editorDraft ? (
            <Pressable
              accessibilityLabel="Edit"
              accessibilityRole="button"
              disabled={isProfileSaving}
              onPress={() => {
                const startedAt = Date.now();
                clearTextInputFocus();
                onBeginEdit();
                markNativeUiPerformanceAfterPaint('profile_edit_result_painted', startedAt);
              }}
              style={[
                styles.headerAction,
                styles.headerActionSecondary,
                light && styles.backButtonLight,
              ]}
            >
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/edit-icon.png` }}
                style={[styles.headerActionIcon, { tintColor: light ? '#172124' : '#f7fbfa' }]}
              />
              <Text style={[styles.headerActionText, light && styles.textLight]}>
                Edit
              </Text>
            </Pressable>
          ) : null}
          {!isOwner && relationshipAction && onRelationshipAction ? (
            <Pressable
              accessibilityRole="button"
              disabled={isRelationshipPending}
              onPress={() => requestAction(relationshipAction.action)}
              testID="native-profile-relationship-action"
              style={[
                styles.headerAction,
                relationshipAction.tone === 'primary' ? styles.headerActionPrimary : styles.headerActionSecondary,
                light && relationshipAction.tone === 'secondary' && styles.backButtonLight,
              ]}
            >
              <Text style={relationshipAction.tone === 'primary' ? styles.primaryButtonText : [styles.headerActionText, light && styles.textLight]}>
                {isRelationshipPending ? 'Working…' : relationshipAction.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {onOpenFriends ? (
        <NativeTrainerWorkspaceNav
          active="profile"
          onOpenFriends={onOpenFriends}
          onOpenProfile={() => undefined}
        />
      ) : null}

      {feedback ? (
        <View accessibilityRole="alert" style={[styles.feedback, feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
          <Text style={styles.feedbackText}>{feedback.text}</Text>
          {onDismissFeedback ? (
            <Pressable accessibilityLabel="Dismiss message" accessibilityRole="button" onPress={onDismissFeedback}>
              <Text style={styles.feedbackDismiss}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[styles.card, { borderColor: team.accent }, light && styles.cardLight]}
        testID={editorDraft ? 'native-profile-editor' : undefined}
      >
        <View style={[styles.identity, { backgroundColor: light ? `${team.accent}18` : team.soft, borderColor: `${team.accent}88` }]}>
          <Text style={[styles.cardLabel, { color: team.accent }]}>TRAINER CARD</Text>
          <View style={styles.identityMain}>
            <View style={styles.portraitWrap}>
              <View style={[styles.portrait, { borderColor: team.accent }]}>
                <Text style={styles.portraitText}>{model.avatarLabel}</Text>
              </View>
              <View style={[styles.levelBadge, { backgroundColor: team.accent }, light && styles.levelBadgeLight]}>
                <Text style={[styles.levelLabel, light && styles.primaryButtonTextLight]}>LEVEL</Text>
                {editorDraft && onChangeEditorDraft ? (
                  <TextInput
                    accessibilityLabel="Trainer level"
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={(value) => updateEditorField('trainerLevel', value)}
                    selectionColor="#071516"
                    style={styles.levelInput}
                    value={editorDraft.trainerLevel}
                  />
                ) : (
                  <Text style={[styles.levelValue, light && styles.primaryButtonTextLight]}>{model.trainerLevel ?? '–'}</Text>
                )}
              </View>
            </View>
            <View style={styles.identityCopy}>
              {editorDraft && onChangeEditorDraft ? (
                <TextInput
                  accessibilityLabel="Pokemon GO name"
                  autoCapitalize="none"
                  maxLength={64}
                  onChangeText={(value) => updateEditorField('pokemonGoName', value)}
                  placeholder={model.username}
                  placeholderTextColor={light ? '#52666a' : '#8da4a5'}
                  selectionColor="#35a8ff"
                  style={[styles.identityInput, light && styles.identityInputLight]}
                  value={editorDraft.pokemonGoName}
                />
              ) : (
                <Text numberOfLines={1} style={[styles.pogoName, light && styles.textLight]}>{model.pokemonGoName}</Text>
              )}
              <Text numberOfLines={1} style={[styles.username, light && styles.mutedLight]}>@{model.username}</Text>
              <View style={styles.teamBlock}>
                {editorDraft && onChangeEditorDraft ? (
                  <>
                    <Pressable
                      accessibilityLabel={`Team, ${editorDraft.team || 'Unaffiliated'}`}
                      accessibilityRole="button"
                      onPress={() => {
                        clearTextInputFocus();
                        setTeamPickerOpen(true);
                      }}
                      style={[styles.teamSelect, light && styles.teamSelectLight]}
                    >
                      <Text style={[styles.teamName, { color: team.accent }]}>{(editorDraft.team || 'Unaffiliated').toLocaleUpperCase()}</Text>
                      <Text style={[styles.teamSelectCue, light && styles.mutedLight]}>⌄</Text>
                    </Pressable>
                    <TextInput
                      accessibilityLabel="Total XP"
                      keyboardType="number-pad"
                      onChangeText={(value) => updateEditorField('totalXp', value)}
                      placeholder="Total XP"
                      placeholderTextColor={light ? '#52666a' : '#8da4a5'}
                      selectionColor="#35a8ff"
                      style={[styles.xpInput, light && styles.identityInputLight]}
                      value={editorDraft.totalXp}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.teamName, { color: team.accent }]}>{model.teamLabel.toLocaleUpperCase()}</Text>
                    <Text style={[styles.xp, light && styles.textLight]}>{model.totalXpLabel}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
          <View style={[styles.levelTrack, light && styles.levelTrackLight]}>
            <View style={[styles.levelTrackFill, { backgroundColor: team.accent, width: `${Math.min(100, Math.max(0, ((cardTrainerLevel ?? 0) / 80) * 100))}%` }]} />
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={[styles.cardHeading, light && styles.dividerLight]}>
            <View>
              <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>POKÉMON GO NEXUS</Text>
              <Text style={[styles.sectionTitle, light && styles.textLight]}>Trainer card</Text>
            </View>
            <View style={styles.memberBlock}>
              <Text style={[styles.memberLabel, light && styles.mutedLight]}>MEMBER SINCE</Text>
              <Text style={[styles.memberValue, light && styles.textLight]}>{model.memberSinceLabel}</Text>
            </View>
          </View>

          <View accessibilityLabel="Featured Pokémon" style={styles.showcase}>
            {Array.from({ length: 6 }, (_, index) => {
              const slot = (
                <View
                  key={!editorDraft ? `highlight-${index + 1}` : undefined}
                  style={[
                    !editorDraft && (compactHeader ? styles.showcaseSlotCompact : styles.showcaseSlot),
                    compactHeader && index % 3 !== 2 && styles.gridRightBorder,
                    compactHeader && index < 3 && styles.gridBottomBorder,
                    !compactHeader && index < 5 && styles.gridRightBorder,
                    light && styles.gridBorderLight,
                  ]}
                >
                  {editorDraft ? (
                    <Pressable
                      accessibilityLabel={`${displayedHighlights[index]?.name ?? 'Open slot'}, edit showcase slot ${index + 1}`}
                      accessibilityRole="button"
                      onPress={() => {
                        const startedAt = Date.now();
                        clearTextInputFocus();
                        setEditingHighlightSlot(index);
                        markNativeUiPerformanceAfterPaint('profile_showcase_picker_painted', startedAt);
                      }}
                      style={styles.highlightEditButton}
                      testID={`native-profile-showcase-slot-${index + 1}`}
                    >
                      <HighlightCard assetBaseUrl={assetBaseUrl} compact={compactHeader} light={light} row={displayedHighlights[index]} />
                      <Text style={styles.highlightEditCue}>EDIT · SLOT {index + 1}</Text>
                    </Pressable>
                  ) : (
                    <HighlightCard assetBaseUrl={assetBaseUrl} compact={compactHeader} light={light} row={displayedHighlights[index]} />
                  )}
                  {editorDraft && displayedHighlights[index] ? (
                    <View style={styles.highlightOrderActions}>
                      <Pressable
                        accessibilityLabel={`Move showcase slot ${index + 1} left`}
                        accessibilityRole="button"
                        disabled={index === 0}
                        onPress={() => moveHighlight(index, -1)}
                        style={[styles.highlightOrderButton, index === 0 && styles.highlightOrderDisabled]}
                      >
                        <Text style={styles.highlightOrderText}>‹</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move showcase slot ${index + 1} right`}
                        accessibilityRole="button"
                        disabled={index >= selectedHighlightCount - 1}
                        onPress={() => moveHighlight(index, 1)}
                        style={[styles.highlightOrderButton, index >= selectedHighlightCount - 1 && styles.highlightOrderDisabled]}
                      >
                        <Text style={styles.highlightOrderText}>›</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
              if (!editorDraft) return slot;
              return (
                <NativeProfileShowcaseDragSlot
                  columns={compactHeader ? 3 : 6}
                  enabled={Boolean(displayedHighlights[index])}
                  index={index}
                  key={`highlight-${index + 1}`}
                  onReorder={reorderHighlight}
                  selectedCount={selectedHighlightCount}
                >
                  {slot}
                </NativeProfileShowcaseDragSlot>
              );
            })}
          </View>

          {editingHighlightSlot !== null ? (
            <NativeTrainerShowcasePicker
              assetBaseUrl={assetBaseUrl}
              candidates={highlightCandidates}
              onClear={clearHighlight}
              onClose={() => { clearTextInputFocus(); setEditingHighlightSlot(null); }}
              onSelect={chooseHighlight}
              selectedIds={selectedHighlightIds}
              slotIndex={editingHighlightSlot}
              visible
            />
          ) : null}

          <View style={[styles.facts, compactHeader && styles.factsCompact, light && styles.dividerLight]}>
            {profileFacts.map(({ icon, label, value }, index) => (
              <View
                key={label}
                style={[
                  styles.fact,
                  compactHeader && styles.factCompact,
                  compactHeader && index < profileFacts.length - 1 && styles.gridBottomBorder,
                  !compactHeader && index < profileFacts.length - 1 && styles.gridRightBorder,
                  light && styles.gridBorderLight,
                ]}
              >
                <NativeUiIcon color={team.accent} name={icon} size={18} />
                <View style={styles.factCopy}>
                  <Text style={[styles.factLabel, light && styles.mutedLight]}>{label}</Text>
                  {editorDraft && onChangeEditorDraft ? (
                    <TextInput
                      accessibilityLabel={label === 'STARTED' ? 'Started playing' : label === 'LOCATION' ? 'Location' : 'Trainer code'}
                      autoCapitalize={label === 'LOCATION' ? 'words' : 'none'}
                      keyboardType={label === 'TRAINER CODE' ? 'number-pad' : 'default'}
                      maxLength={label === 'TRAINER CODE' ? 14 : label === 'STARTED' ? 10 : 255}
                      onChangeText={(nextValue) => {
                        if (label === 'STARTED') updateEditorField('startedOn', nextValue);
                        else if (label === 'LOCATION') updateEditorField('location', nextValue);
                        else updateEditorField('trainerCode', nextValue);
                      }}
                      placeholder={label === 'STARTED' ? 'YYYY-MM-DD' : label === 'LOCATION' ? 'City or region' : '0000 0000 0000'}
                      placeholderTextColor={light ? '#66777d' : '#718087'}
                      selectionColor="#35a8ff"
                      style={[styles.factInput, light && styles.factInputLight]}
                      value={label === 'STARTED' ? editorDraft.startedOn : label === 'LOCATION' ? editorDraft.location : editorDraft.trainerCode}
                    />
                  ) : (
                    <Text numberOfLines={2} style={[styles.factValue, light && styles.textLight]}>{value}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View accessibilityLabel="Collection summary" style={[styles.stats, light && styles.dividerLight]}>
            {model.stats.map((stat, index) => {
              const filter = stat.key === 'registered' ? undefined : stat.key;
              const canOpen = !editorDraft && model.canViewCollection && filter !== undefined;
              const compactBottomRow = compactHeader && index >= 3;
              const hasRightDivider = compactHeader
                ? (index < 2 || index === 3)
                : index < model.stats.length - 1;
              return (
                <Pressable
                  accessibilityLabel={canOpen
                    ? `View ${isOwner ? 'your' : `${model.username}'s`} ${stat.label.toLocaleLowerCase()} Pokémon`
                    : undefined}
                  accessibilityRole={canOpen ? 'button' : undefined}
                  disabled={!canOpen}
                  key={stat.key}
                  onPress={() => filter && onOpenCollection(filter)}
                  style={[
                    styles.stat,
                    compactHeader ? (compactBottomRow ? styles.statCompactBottom : styles.statCompactTop) : styles.statWide,
                    hasRightDivider && styles.gridRightBorder,
                    compactHeader && index < 3 && styles.gridBottomBorder,
                    light && styles.gridBorderLight,
                    canOpen && styles.statInteractive,
                  ]}
                >
                  <NativeUiIcon color={team.accent} name={statIcons[stat.key]} size={21} />
                  <View style={styles.statCopy}>
                    <Text numberOfLines={1} style={[styles.statLabel, light && styles.mutedLight]}>{stat.label}</Text>
                    <Text style={[styles.statValue, { color: team.accent }]}>{stat.value.toLocaleString('en-US')}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <View style={styles.titlesBlock}>
              {editorDraft && onChangeEditorDraft ? (
                <NativeDeferredTrainerTitlePicker
                  assetBaseUrl={assetBaseUrl}
                  light={light}
                  onChange={(trainerTitles) => updateEditorField('trainerTitles', trainerTitles)}
                  teamColor={team.accent}
                  titles={editorDraft.trainerTitles}
                />
              ) : (
                <>
                  <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>PLAY STYLES</Text>
                  <View style={styles.titles}>
                    {model.titles.length ? model.titles.map((title) => (
                      <View key={title.id} style={[styles.titleBadge, light && styles.titleBadgeLight, { borderColor: `${team.accent}88` }]}>
                        <NativeTrainerTitleVisual
                          assetBaseUrl={assetBaseUrl}
                          color={team.accent}
                          title={title.id}
                        />
                        <Text style={[styles.titleBadgeText, light && styles.textLight]}>{title.label}</Text>
                      </View>
                    )) : <Text style={[styles.noTitles, light && styles.mutedLight]}>No play styles selected</Text>}
                  </View>
                </>
              )}
            </View>
            {!editorDraft && relationship ? (
              <View style={[styles.relationship, { borderColor: `${team.accent}88` }]}>
                <Text style={[styles.relationshipText, { color: team.accent }]}>{relationship}</Text>
              </View>
            ) : null}
            <View style={styles.profileCommands}>
              {editorDraft && onCancelEdit && onSaveProfile ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isProfileSaving}
                    onPress={() => {
                      clearTextInputFocus();
                      onCancelEdit();
                    }}
                    style={[styles.cancelButton, light && styles.cancelButtonLight]}
                  >
                    <Text style={[styles.cancelButtonText, light && styles.textLight]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isProfileSaving}
                    onPress={() => {
                      clearTextInputFocus();
                      feedbackPerformanceRef.current = {
                        event: 'profile_save_result_painted',
                        startedAt: Date.now(),
                      };
                      onSaveProfile();
                    }}
                    style={[styles.saveButton, isProfileSaving && styles.titleChoiceDisabled]}
                  >
                    <Text style={styles.saveButtonText}>{isProfileSaving ? 'Saving…' : 'Save profile'}</Text>
                  </Pressable>
                </>
              ) : model.canViewCollection ? (
                <Pressable accessibilityRole="button" onPress={() => onOpenCollection()} style={[styles.primaryButton, styles.footerPrimaryButton, { backgroundColor: team.accent }]}>
                  <Text style={[styles.primaryButtonText, light && styles.primaryButtonTextLight]}>View Pokémon</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {!isOwner && model.relationship !== 'blocked' && onRelationshipAction ? (
            <Pressable
              accessibilityLabel="Block trainer"
              accessibilityRole="button"
              disabled={isRelationshipPending}
              onPress={() => requestAction('block')}
              style={styles.blockButton}
              testID="native-profile-block-trainer"
            >
              <Text style={styles.blockButtonText}>Block trainer</Text>
            </Pressable>
          ) : null}
          {needsProfileSetup && !editorDraft && onBeginEdit ? (
            <View style={[styles.setup, light && styles.setupLight]}>
              <View style={styles.setupCopy}>
                <Text style={styles.eyebrow}>START HERE</Text>
                <Text style={[styles.setupTitle, light && styles.textLight]}>Make this trainer profile yours</Text>
                <Text style={[styles.stateCopy, styles.setupBody, light && styles.mutedLight]}>
                  Add your trainer details and choose Pokémon from your collection to feature.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const startedAt = Date.now();
                  onBeginEdit();
                  markNativeUiPerformanceAfterPaint('profile_edit_result_painted', startedAt);
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Customize profile</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      </ScrollView>
      <NativeConfirmationDialog
        body={confirmationCopy.body}
        confirmLabel={confirmationCopy.confirmLabel}
        isPending={isRelationshipPending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          feedbackPerformanceRef.current = {
            event: 'profile_relationship_result_painted',
            startedAt: Date.now(),
          };
          onRelationshipAction?.(confirmation);
          setConfirmation(null);
        }}
        title={confirmationCopy.title}
        visible={Boolean(confirmation)}
      />
      <NativeOptionPicker
        onClose={() => setTeamPickerOpen(false)}
        onSelect={(entry) => {
          updateEditorField('team', entry.key as NativeTrainerProfileDraft['team']);
          setTeamPickerOpen(false);
        }}
        options={TEAM_OPTIONS}
        selectedKey={editorDraft?.team ?? ''}
        title="Team"
        visible={teamPickerOpen && Boolean(editorDraft)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: '#081012' },
  screen: { flex: 1 },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingHorizontal: 14, gap: 14 },
  productHeader: { minHeight: 62, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 11 },
  productHeaderCopy: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerActionsCompact: { width: '100%', justifyContent: 'flex-start' },
  headerAction: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 9 },
  headerActionIcon: { width: 17, height: 17 },
  headerActionPrimary: { backgroundColor: '#36c5a4' },
  headerActionSecondary: { borderWidth: 1, borderColor: '#536467', backgroundColor: '#171c1d' },
  headerActionText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  eyebrow: { color: '#35a8ff', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.3 },
  eyebrowLight: { color: '#005bb5' },
  pageTitle: { color: '#f7fbfa', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  pageSubtitle: { maxWidth: 620, color: '#9db5b4', fontSize: 13, lineHeight: 19 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#315052', borderRadius: 10, backgroundColor: '#171c1d' },
  backButtonLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  card: { overflow: 'hidden', borderWidth: 1, borderRadius: 10, backgroundColor: '#171c1d' },
  cardLight: { backgroundColor: '#f3faf5' },
  identity: { padding: 14, borderBottomWidth: 1 },
  cardLabel: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  identityMain: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 10 },
  identityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  portraitWrap: { width: 80, height: 80, flexShrink: 0 },
  portrait: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 38, backgroundColor: '#173436' },
  portraitText: { color: '#ffffff', fontSize: 38, fontWeight: '900' },
  levelBadge: { position: 'absolute', right: 0, bottom: 0, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#171c1d', borderRadius: 21 },
  levelBadgeLight: { borderColor: '#f3faf5' },
  levelLabel: { color: '#071516', fontSize: 8, lineHeight: 10, fontWeight: '900' },
  levelValue: { color: '#071516', fontSize: 16, lineHeight: 18, fontWeight: '900' },
  levelInput: { width: 34, height: 22, padding: 0, color: '#071516', fontSize: 16, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
  pogoName: { maxWidth: '100%', color: '#f7fbfa', fontSize: 21, lineHeight: 25, fontWeight: '900' },
  identityInput: { width: '100%', minHeight: 39, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#6f9295', borderRadius: 7, backgroundColor: '#132427', color: '#f7fbfa', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  identityInputLight: { borderColor: '#77979b', backgroundColor: '#ffffff', color: '#172124' },
  username: { color: '#9db5b4', fontSize: 13 },
  teamBlock: { alignItems: 'flex-start', gap: 2, marginTop: 6 },
  teamName: { fontSize: 13, fontWeight: '900' },
  teamSelect: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderWidth: 1, borderColor: '#6f9295', borderRadius: 6, backgroundColor: '#132427' },
  teamSelectLight: { borderColor: '#77979b', backgroundColor: '#ffffff' },
  teamSelectCue: { color: '#9db5b4', fontSize: 14, fontWeight: '900' },
  xp: { color: '#f7fbfa', fontSize: 13, fontWeight: '800' },
  xpInput: { minWidth: 108, minHeight: 32, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#6f9295', borderRadius: 6, backgroundColor: '#132427', color: '#f7fbfa', fontSize: 12, fontWeight: '800' },
  levelTrack: { width: '100%', height: 6, overflow: 'hidden', marginTop: 9, borderRadius: 3, backgroundColor: '#52626366' },
  levelTrackLight: { backgroundColor: '#aebbbc66' },
  levelTrackFill: { height: '100%', borderRadius: 3 },
  cardBody: { padding: 16 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#315052' },
  sectionTitle: { color: '#f7fbfa', fontSize: 22, fontWeight: '900' },
  memberBlock: { maxWidth: '45%', alignItems: 'flex-end' },
  memberLabel: { color: '#9db5b4', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  memberValue: { color: '#f7fbfa', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  showcase: { minHeight: 112, flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: '#315052' },
  showcaseSlot: { width: '16.6667%' },
  showcaseSlotCompact: { width: '33.3333%' },
  gridRightBorder: { borderRightWidth: 1, borderRightColor: '#315052' },
  gridBottomBorder: { borderBottomWidth: 1, borderBottomColor: '#315052' },
  gridBorderLight: { borderColor: '#9bb8b1' },
  highlightEditButton: { width: '100%' },
  highlight: { position: 'relative', width: '100%', minHeight: 112, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 9 },
  highlightEmptyCompact: { minHeight: 54, paddingVertical: 2 },
  highlightLight: {},
  highlightImage: { width: '100%', maxWidth: 74, height: 64, marginBottom: 2 },
  maxIcon: { position: 'absolute', top: 7, right: 7, width: 22, height: 22 },
  emptyStar: { marginBottom: 1, color: '#669ab4', fontSize: 22, lineHeight: 24 },
  highlightName: { color: '#f7fbfa', fontSize: 11, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  highlightDetail: { color: '#9db5b4', fontSize: 9, lineHeight: 12, textAlign: 'center' },
  highlightEditCue: { position: 'absolute', top: 5, left: 5, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: '#1780c9', color: '#ffffff', fontSize: 7, fontWeight: '900' },
  highlightOrderActions: { flexDirection: 'row', gap: 4 },
  highlightOrderButton: { minHeight: 34, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#456265', borderRadius: 6, backgroundColor: '#172526' },
  highlightOrderDisabled: { opacity: 0.3 },
  highlightOrderText: { color: '#ffffff', fontSize: 24, lineHeight: 24, fontWeight: '900' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: '#315052' },
  factsCompact: { flexDirection: 'column' },
  fact: { width: '33.3333%', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 13 },
  factCompact: { width: '100%', minHeight: 58, paddingVertical: 8 },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: { color: '#9db5b4', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  factValue: { color: '#f7fbfa', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  factInput: { width: '100%', minHeight: 39, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#456265', borderRadius: 7, backgroundColor: '#11191a', color: '#f7fbfa', fontSize: 12, fontWeight: '800' },
  factInputLight: { borderColor: '#91a5a8', backgroundColor: '#ffffff', color: '#172124' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: '#315052' },
  stat: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 10 },
  statWide: { width: '20%' },
  statCompactTop: { width: '33.3333%' },
  statCompactBottom: { width: '50%' },
  statInteractive: { backgroundColor: '#2f9cff0a' },
  statCopy: { minWidth: 0, gap: 2 },
  statLabel: {
    color: '#9db5b4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  statValue: { fontSize: 19, lineHeight: 21, fontWeight: '900' },
  footer: { gap: 10, paddingTop: 13 },
  titlesBlock: { gap: 7 },
  titlesHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectionCount: { color: '#9db5b4', fontSize: 10, fontWeight: '900' },
  titles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  titlePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  titleChoice: { width: '48.8%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: '#456265', borderRadius: 7, backgroundColor: '#11191a' },
  titleChoiceLight: { borderColor: '#aababc', backgroundColor: '#ffffff' },
  titleChoiceSelected: { borderColor: '#35a8ff', backgroundColor: '#153b5c' },
  titleChoiceDisabled: { opacity: 0.44 },
  titleChoiceText: { flex: 1, color: '#f7fbfa', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  titleChoiceTextSelected: { color: '#dff3ff' },
  titleBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 9, borderWidth: 1, borderRadius: 6, backgroundColor: '#11191a' },
  titleBadgeLight: { backgroundColor: '#e3efe8' },
  titleBadgeText: { color: '#f7fbfa', fontSize: 11, fontWeight: '800' },
  titleVisual: { width: 20, height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  titleVisualImage: { width: 19, height: 19 },
  noTitles: { color: '#9db5b4', fontSize: 12 },
  relationship: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 16 },
  relationshipText: { fontSize: 11, fontWeight: '900' },
  profileCommands: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  cancelButton: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#536467', borderRadius: 8, backgroundColor: '#171c1d' },
  cancelButtonLight: { borderColor: '#acbabc', backgroundColor: '#ffffff' },
  cancelButtonText: { color: '#f7fbfa', fontSize: 13, fontWeight: '900' },
  saveButton: { minHeight: 46, flex: 1.35, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#2f9cff' },
  saveButtonText: { color: '#061617', fontSize: 13, fontWeight: '900' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#2f9cff' },
  footerPrimaryButton: { flexGrow: 0, marginTop: 0 },
  primaryButtonText: { color: '#061617', fontSize: 14, fontWeight: '900' },
  primaryButtonTextLight: { color: '#ffffff' },
  blockButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#a9434d', borderRadius: 8, backgroundColor: '#6c252d' },
  blockButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  setup: { gap: 10, marginTop: 14, padding: 14, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#11191a' },
  setupLight: { borderColor: '#9bb8b1', backgroundColor: '#eaf4ed' },
  setupCopy: { gap: 3 },
  setupTitle: { color: '#f7fbfa', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  setupBody: { maxWidth: undefined, textAlign: 'left' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderWidth: 1, borderRadius: 10 },
  feedbackSuccess: { borderColor: '#2fbd79', backgroundColor: '#13372b' },
  feedbackError: { borderColor: '#ef5b72', backgroundColor: '#3a1820' },
  feedbackText: { flex: 1, color: '#ffffff', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  feedbackDismiss: { color: '#ffffff', fontSize: 24, lineHeight: 25 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 28, backgroundColor: '#081012' },
  stateTitle: { color: '#f7fbfa', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateCopy: { maxWidth: 420, color: '#9db5b4', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorIcon: { color: '#ff7082', fontSize: 30, fontWeight: '900' },
  dividerLight: { borderColor: '#9bb8b1' },
  textLight: { color: '#2f4744' },
  mutedLight: { color: '#4b625e' },
});
