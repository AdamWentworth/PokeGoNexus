import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type {
  CreateCustomTagRequest,
  CustomTagDefinition,
  CustomTagParent,
  PokemonTagOrderKey,
  UpdateCustomTagRequest,
} from '@pokemongonexus/shared-contracts/users';
import { collectionParityTokens } from '@pokemongonexus/shared-ui-tokens';
import type { NativeTagSummary } from '../features/collection/collectionModel';
import {
  NativePokemonHubHeader,
  type NativePokemonHubView,
} from '../features/collection/NativePokemonHubHeader';
import { NativeCustomTagEditorSheet } from '../features/collection/NativeCustomTagEditorSheet';
import {
  NativeCollectionPriorityStar,
} from '../features/collection/parity/NativeCollectionPriorityStar';
import {
  useOptionalNativeDevicePreferences,
} from '../features/settings/NativeDevicePreferencesProvider';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  toNativeCollectionAssetUrl,
  toNativeCollectionImageSource,
} from '../features/collection/parity/nativeCollectionImageSource';
import {
  createNativeCollectionImageRevealController,
  type NativeCollectionImageRevealController,
  useNativeCollectionImageReveal,
} from '../features/collection/parity/nativeCollectionImageRevealController';
import { runAfterNativeUiInteractions } from '../interaction/nativeUiInteractionScheduler';
import { useNativeScrollInteractionReservation } from '../interaction/useNativeScrollInteractionReservation';

type Props = {
  activeTagName: string | null;
  assetBaseUrl: string;
  collectionCount: number;
  error: string | null;
  warning?: string | null;
  isLoading: boolean;
  isActive?: boolean;
  parent: CustomTagParent;
  tags: NativeTagSummary[];
  onActionMenuPress?: () => void;
  onRetry: () => void;
  onSelectTag: (tag: NativeTagSummary) => void;
  onPreviewTag?: (tag: NativeTagSummary) => void;
  onCancelPreviewTag?: (tag: NativeTagSummary) => void;
  onViewChange: (view: NativePokemonHubView) => void;
  onCreateTag?: (request: CreateCustomTagRequest) => Promise<unknown>;
  onDeleteTag?: (tagId: string) => Promise<unknown>;
  onSaveOrder?: (parent: CustomTagParent, tagKeys: PokemonTagOrderKey[]) => Promise<unknown>;
  onUpdateTag?: (tagId: string, request: UpdateCustomTagRequest) => Promise<unknown>;
  isEditable?: boolean;
  isSaving?: boolean;
  showHeader?: boolean;
};

type TagGradient = readonly [string, string, string];
type TagPreview = {
  rows: NativeTagSummary['rows'];
  sources: NativeTagSummary['rows'];
  offset: number;
};
const VITE_TAG_PREVIEW_SOURCE_LIMIT = 18;
export const NATIVE_TAG_PREVIEW_PRESS_DELAY_MS = 16;
// Core Image on Android can decode these remote sprites on HWUI's render
// path. The browser is free to finish several <img> decodes independently,
// but admitting the same three-source burst on each retained native tag page
// can put six new bitmaps into one display frame while the user is scrolling
// or while a page animation is about to begin. One source per panel/frame
// preserves the warm retained galleries without manufacturing a recurring
// render-thread spike that Vite does not have.
export const NATIVE_TAG_PREVIEW_REVEAL_BATCH = 1;
// Cold mount priority mirrors what a browser's image scheduler effectively
// gives Vite: paint the visible collection, then warm the retained search
// controls, and only then decode sprites in the two offscreen tag panels.
const TAG_PREVIEW_BACKGROUND_DELAY_MS = 1_200;
const TAG_PREVIEW_REVEAL_PERIOD_MS = 16;
const requestedTagResultAssets = new Set<string>();

const prefetchTagResultAsset = (uri: string): void => {
  if (requestedTagResultAssets.has(uri)) return;
  requestedTagResultAssets.add(uri);
  void Promise.resolve(Image.prefetch(uri)).catch(() => {
    // A transient failure should not permanently suppress a later retry.
    requestedTagResultAssets.delete(uri);
  });
};

const SYSTEM_TAG_GRADIENTS: Record<Exclude<NativeTagSummary['tone'], 'custom'>, TagGradient> = {
  favorites: ['#ffd77a', '#fff1aa', '#fff9dc'],
  trade: ['#3aa85f', '#7fdc9e', '#eaf8f1'],
  caught: ['#3f89ff', '#9bc5ff', '#e6f1ff'],
  'most-wanted': ['#ff6f61', '#ff9b89', '#ffe4dc'],
  wanted: ['#dd5260', '#fd9090', '#ffc5cc'],
};

const mixHex = (foreground: string, background: string, foregroundWeight: number): string => {
  const parse = (value: string): [number, number, number] | null => {
    const match = /^#([0-9a-f]{6})$/i.exec(value);
    if (!match) return null;
    const packed = Number.parseInt(match[1], 16);
    return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
  };
  const front = parse(foreground);
  const back = parse(background);
  if (!front || !back) return background;
  const channel = (index: number) => Math.round(
    front[index] * foregroundWeight + back[index] * (1 - foregroundWeight),
  ).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

const tagGradient = (tag: NativeTagSummary, cardSurface: string): TagGradient => {
  if (tag.tone !== 'custom') return SYSTEM_TAG_GRADIENTS[tag.tone];
  return [
    mixHex(tag.color, cardSurface, 0.62),
    mixHex(tag.color, cardSurface, 0.24),
    cardSurface,
  ];
};

const NativeTagPreviewBackground = ({ colors, testID }: {
  colors: TagGradient;
  testID: string;
}) => (
  <LinearGradient
    colors={colors}
    end={{ x: 0.5, y: 1 }}
    locations={[0, 0.45, 1]}
    pointerEvents="none"
    start={{ x: 0.5, y: 0 }}
    style={StyleSheet.absoluteFill}
    testID={testID}
  />
);

const NativeTagPreviewSprite = memo(function NativeTagPreviewSprite({
  assetBaseUrl,
  controller,
  controllerIndex,
  row,
  widePreview,
}: {
  assetBaseUrl: string;
  controller: NativeCollectionImageRevealController;
  controllerIndex: number;
  row: NativeTagSummary['rows'][number];
  widePreview: boolean;
}) {
  const imagesEnabled = useNativeCollectionImageReveal({
    controller,
    index: controllerIndex,
  });
  return (
    <View
      style={[
        styles.previewCell,
        widePreview ? styles.previewCellWide : styles.previewCellNarrow,
      ]}
    >
      {imagesEnabled && row.imageUri ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={toNativeCollectionImageSource(assetBaseUrl, row.imageUri)}
          style={widePreview ? styles.previewImageWide : styles.previewImageNarrow}
        />
      ) : null}
      {imagesEnabled && row.maxKind ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          resizeMethod="resize"
          source={toNativeCollectionImageSource(
            assetBaseUrl,
            row.maxKind === 'gigantamax'
              ? '/images/gigantamax.png'
              : '/images/dynamax.png',
          )}
          style={styles.previewMaxBadge}
          testID={`native-tag-preview-${row.maxKind}`}
        />
      ) : null}
    </View>
  );
});

const NativeTagCard = memo(function NativeTagCard({
  assetBaseUrl,
  light,
  tag,
  onPressTag,
  onPressInTag,
  onPressOutTag,
  onEditTag,
  reorder,
  reduceMotion,
  imageRevealController,
  preview,
  widePreview,
}: {
  assetBaseUrl: string;
  light: boolean;
  tag: NativeTagSummary;
  onPressTag: (tag: NativeTagSummary) => void;
  onPressInTag?: (tag: NativeTagSummary) => void;
  onPressOutTag?: (tag: NativeTagSummary) => void;
  onEditTag?: (tag: NativeTagSummary) => void;
  reduceMotion: boolean;
  imageRevealController: NativeCollectionImageRevealController;
  preview: TagPreview;
  widePreview: boolean;
  reorder?: {
    index: number;
    count: number;
    onMove: (sourceIndex: number, targetIndex: number) => void;
  };
}) {
  const palette = light
    ? collectionParityTokens.colors.light
    : collectionParityTokens.colors.dark;
  const cardSurface = palette.tagSurface;
  const titleColor = palette.tagTitle;
  const subtitleColor = palette.tagSubtitle;
  const previewRows = preview.rows;
  useEffect(() => {
    // Vite creates eighteen <img> sources for every tag, then CSS hides the
    // third six-image row on a phone. Those hidden sources warm the remainder
    // of its first result viewport. Preserve that useful behavior without
    // mounting clipped native Image views into the page-animation texture.
    for (const row of preview.sources.slice(previewRows.length)) {
      if (!row.imageUri) continue;
      prefetchTagResultAsset(toNativeCollectionAssetUrl(assetBaseUrl, row.imageUri));
    }
    // Preview cards do not render type glyphs, but result cards do. Warm the
    // small shared set used by the same first eighteen rows so Android does not
    // start image-cache lookups for those glyphs on the transition frame.
    const typeIconUris = new Set(preview.sources.flatMap((row) => row.typeIconUris));
    for (const uri of typeIconUris) {
      prefetchTagResultAsset(toNativeCollectionAssetUrl(assetBaseUrl, uri));
    }
  }, [assetBaseUrl, preview.sources, previewRows.length]);
  const previewGradientTestId = `native-tag-gradient-${tag.key.replace(/[^a-z0-9_-]/gi, '-')}`;
  const [cardDragY] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);
  const cardContents = (
    <>
      <View
        style={[
          styles.preview,
          widePreview ? styles.previewWide : styles.previewNarrow,
        ]}
        pointerEvents="none"
      >
        <NativeTagPreviewBackground
          colors={tagGradient(tag, cardSurface)}
          testID={previewGradientTestId}
        />
        {previewRows.length ? previewRows.map((row, previewIndex) => (
          <NativeTagPreviewSprite
            assetBaseUrl={assetBaseUrl}
            controller={imageRevealController}
            controllerIndex={preview.offset + previewIndex}
            key={row.id}
            row={row}
            widePreview={widePreview}
          />
        )) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>No Pokémon in this tag.</Text>
          </View>
        )}
      </View>
      <View style={styles.tagFooter}>
        <View style={styles.tagIdentity}>
          {tag.tone === 'custom' ? (
            <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
          ) : null}
          <View style={styles.tagCopy}>
            <Text numberOfLines={1} style={[styles.tagName, { color: titleColor }]}>{tag.name}</Text>
            <Text style={[styles.tagCount, { color: subtitleColor }]}>
              {tag.rows.length} Pokémon have this tag.
            </Text>
          </View>
        </View>
        {reorder ? (
          <NativeTagDragGrip
            count={reorder.count}
            dragY={cardDragY}
            index={reorder.index}
            onDragEnd={() => setDragging(false)}
            onDragStart={() => setDragging(true)}
            onMove={reorder.onMove}
            reduceMotion={reduceMotion}
            tagKey={tag.key}
            tagName={tag.name}
          />
        ) : tag.tone === 'custom' && onEditTag ? (
          <View style={styles.editButtonSpacer} />
        ) : tag.tone === 'favorites' ? (
          <NativeCollectionPriorityStar size={22} tone="favorite" />
        ) : null}
      </View>
    </>
  );
  return (
    <Animated.View
      style={[
        styles.tagCard,
        {
          backgroundColor: cardSurface,
          shadowColor: '#000000',
          shadowOpacity: light ? 0.22 : 0.42,
          elevation: 5,
        },
        tag.tone === 'custom' ? { borderColor: `${tag.color}7a`, borderWidth: 1 } : null,
        reorder ? { transform: [{ translateY: cardDragY }] } : null,
        dragging && styles.draggingCard,
      ]}
    >
      {reorder ? (
        <View>{cardContents}</View>
      ) : (
        <>
          <Pressable
            accessibilityLabel={`Open ${tag.name}, ${tag.rows.length} Pokémon`}
            accessibilityRole="button"
            onPress={() => onPressTag(tag)}
            onPressIn={onPressInTag ? () => onPressInTag(tag) : undefined}
            onPressOut={onPressOutTag ? () => onPressOutTag(tag) : undefined}
            // Let a vertical drag establish itself before doing hidden-grid
            // staging. A normal tap still leaves ample finger-down time for
            // the destination commit, while tag-list scrolling stays inert.
            unstable_pressDelay={onPressInTag ? NATIVE_TAG_PREVIEW_PRESS_DELAY_MS : undefined}
          >
            {cardContents}
          </Pressable>
          {tag.tone === 'custom' && onEditTag ? (
            <Pressable
              accessibilityLabel={`Edit ${tag.name}`}
              accessibilityRole="button"
              onPress={() => onEditTag(tag)}
              style={[
                styles.editButton,
                styles.editButtonOverlay,
                { borderColor: `${tag.color}8f`, backgroundColor: `${tag.color}24` },
              ]}
            >
              <Text style={[styles.editText, { color: titleColor }]}>Edit</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Animated.View>
  );
});

const NativeTagDragGrip = ({
  count,
  dragY,
  index,
  onDragEnd,
  onDragStart,
  onMove,
  reduceMotion,
  tagKey,
  tagName,
}: {
  count: number;
  dragY: Animated.Value;
  index: number;
  onDragEnd: () => void;
  onDragStart: () => void;
  onMove: (sourceIndex: number, targetIndex: number) => void;
  reduceMotion: boolean;
  tagKey: PokemonTagOrderKey;
  tagName: string;
}) => {
  const settle = useCallback(() => {
    // Reset the lifted card before changing the list order. If the reorder
    // state is applied while the old card is still carrying its drag
    // translation, React Native can recycle that view into the new slot and
    // leave it visibly suspended after the finger has been released.
    dragY.stopAnimation();
    dragY.setValue(0);
    onDragEnd();
  }, [dragY, onDragEnd]);
  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(2)
    .runOnJS(true)
    .onBegin(() => {
      dragY.setValue(0);
      onDragStart();
    })
    .onUpdate((event) => {
      dragY.setValue(event.translationY);
    })
    .onEnd((event) => {
      const targetIndex = Math.max(0, Math.min(count - 1, index + Math.round(event.translationY / TAG_CARD_STRIDE)));
      settle();
      if (targetIndex !== index) {
        if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onMove(index, targetIndex);
      }
    })
    .onFinalize((_event, success) => {
      if (!success) settle();
    }), [count, dragY, index, onDragStart, onMove, reduceMotion, settle]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'decrement' as const, label: 'Move tag earlier' }] : []),
          ...(index < count - 1 ? [{ name: 'increment' as const, label: 'Move tag later' }] : []),
        ]}
        accessibilityHint="Press and drag to move this tag"
        accessibilityLabel={`Reorder ${tagName}, position ${index + 1} of ${count}`}
        hitSlop={8}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'decrement' && index > 0) {
            onMove(index, index - 1);
          }
          if (event.nativeEvent.actionName === 'increment' && index < count - 1) {
            onMove(index, index + 1);
          }
        }}
        accessibilityRole="adjustable"
        style={styles.dragGrip}
        testID={`native-tag-drag-${tagKey}`}
      >
        <Text style={styles.dragGripText}>⠿</Text>
      </Animated.View>
    </GestureDetector>
  );
};

const TAG_CARD_STRIDE = 208;

const definitionFromSummary = (tag: NativeTagSummary): CustomTagDefinition | null => {
  if (tag.tone !== 'custom' || !tag.key.startsWith('custom:')) return null;
  return {
    tag_id: tag.key.slice('custom:'.length),
    parent: tag.parent,
    name: tag.name,
    color: tag.color,
    sort: 0,
    created_at: '',
  };
};

export const NativeTagsPanelScreen = memo(function NativeTagsPanelScreen({
  activeTagName,
  assetBaseUrl,
  collectionCount,
  error,
  warning = null,
  isLoading,
  isActive = true,
  parent,
  tags,
  onActionMenuPress,
  onRetry,
  onSelectTag,
  onPreviewTag,
  onCancelPreviewTag,
  onViewChange,
  onCreateTag,
  onDeleteTag,
  onSaveOrder,
  onUpdateTag,
  isEditable = false,
  isSaving = false,
  showHeader = true,
}: Props) {
  const light = useNativeColorScheme() === 'light';
  const { width } = useWindowDimensions();
  const widePreview = width >= 767;
  const visiblePreviewLimit = widePreview
    ? collectionParityTokens.tags.previewColumnsWide * collectionParityTokens.tags.previewRows
    : collectionParityTokens.tags.previewColumnsNarrow * collectionParityTokens.tags.previewRows;
  const reduceMotion = useOptionalNativeDevicePreferences()?.shouldReduceMotion ?? false;
  const palette = light
    ? collectionParityTokens.colors.light
    : collectionParityTokens.colors.dark;
  const background = palette.page;
  const text = palette.textPrimary;
  const secondary = palette.textSecondary;
  const [reordering, setReordering] = useState(false);
  const [draftKeys, setDraftKeys] = useState<PokemonTagOrderKey[]>([]);
  const [editingTag, setEditingTag] = useState<CustomTagDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [previewImageRevealController] = useState(
    () => createNativeCollectionImageRevealController(Platform.OS === 'web' ? null : 0),
  );
  const revealedImageCount = useRef(0);
  const scrollInteraction = useNativeScrollInteractionReservation();
  const orderedTags = useMemo(() => {
    if (!reordering) return tags;
    const byKey = new Map(tags.map((tag) => [tag.key, tag]));
    return draftKeys.flatMap((key) => {
      const tag = byKey.get(key);
      return tag ? [tag] : [];
    });
  }, [draftKeys, reordering, tags]);
  const previewLayout = useMemo(() => {
    const byKey = new Map<PokemonTagOrderKey, TagPreview>();
    let count = 0;
    for (const tag of orderedTags) {
      const sources: NativeTagSummary['rows'] = [];
      for (const row of tag.rows) {
        if (row.imageUri) sources.push(row);
        if (sources.length === VITE_TAG_PREVIEW_SOURCE_LIMIT) break;
      }
      const rows = sources.slice(0, visiblePreviewLimit);
      byKey.set(tag.key, { rows, sources, offset: count });
      count += rows.length;
    }
    return { byKey, count };
  }, [orderedTags, visiblePreviewLimit]);
  useEffect(() => {
    // Browsers schedule image loading themselves. Native retains its bounded
    // decode budget, but a visible panel need not wait behind cold-start warming
    // or spend frames on empty/clipped cells. Keep already revealed images warm.
    if (Platform.OS === 'web') {
      previewImageRevealController.setRevealCount(null);
      return;
    }
    const target = previewLayout.count;
    let revealed = Math.min(target, revealedImageCount.current);
    revealedImageCount.current = revealed;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: ReturnType<typeof runAfterNativeUiInteractions> | null = null;
    const revealNext = () => {
      interactionTask = runAfterNativeUiInteractions(() => {
        interactionTask = null;
        if (cancelled) return;
        revealed = Math.min(target, revealed + NATIVE_TAG_PREVIEW_REVEAL_BATCH);
        revealedImageCount.current = revealed;
        previewImageRevealController.setRevealCount(revealed);
        if (revealed < target) {
          timer = setTimeout(revealNext, TAG_PREVIEW_REVEAL_PERIOD_MS);
        }
      }, { preferIdle: !isActive });
    };
    previewImageRevealController.setRevealCount(revealed);
    if (revealed < target) {
      if (isActive) revealNext();
      else timer = setTimeout(revealNext, TAG_PREVIEW_BACKGROUND_DELAY_MS);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      interactionTask?.cancel();
    };
  }, [isActive, previewLayout.count, previewImageRevealController]);
  const openTagEditor = useCallback((tag: NativeTagSummary) => {
    setEditingTag(definitionFromSummary(tag));
  }, []);

  const startReordering = () => {
    setOperationError(null);
    setDraftKeys(tags.map((tag) => tag.key));
    setReordering(true);
  };
  const moveTag = (sourceIndex: number, targetIndex: number) => {
    setDraftKeys((current) => {
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      if (!moved) return current;
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };
  const saveOrder = async () => {
    if (!onSaveOrder) return;
    setOperationError(null);
    try {
      await onSaveOrder(parent, draftKeys);
      setReordering(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Could not save your tag order.');
    }
  };
  return (
    <View style={[styles.screen, { backgroundColor: background }]} testID={`native-${parent}-tags-screen`}>
      {showHeader ? (
        <NativePokemonHubHeader
          activeTag={activeTagName}
          activeTagParent={parent}
          activeView={parent === 'caught' ? 'inventory' : 'wishlist'}
          backgroundColor={background}
          collectionCount={collectionCount}
          inactiveTextColor={palette.headerInactive}
          onViewChange={onViewChange}
          secondaryTextColor={secondary}
          textColor={text}
        />
      ) : null}
      <FlatList
        accessibilityLabel={parent === 'caught' ? 'Inventory tags' : 'Wanted tags'}
        contentContainerStyle={styles.list}
        data={orderedTags}
        initialNumToRender={3}
        keyExtractor={(tag) => tag.key}
        nestedScrollEnabled
        maxToRenderPerBatch={3}
        onMomentumScrollBegin={scrollInteraction.onMomentumScrollBegin}
        onMomentumScrollEnd={scrollInteraction.onMomentumScrollEnd}
        onScrollBeginDrag={scrollInteraction.onScrollBeginDrag}
        onScrollEndDrag={scrollInteraction.onScrollEndDrag}
        removeClippedSubviews
        updateCellsBatchingPeriod={48}
        windowSize={3}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.toolbar}>
              <Text style={[styles.total, { color: secondary }]}>
                {parent === 'caught'
                  ? collectionCount
                  : tags.find((tag) => tag.key === 'system:wanted')?.rows.length ?? 0} Pokémon
              </Text>
              {isEditable ? reordering ? (
                <View style={styles.orderActions}>
                  <Pressable accessibilityRole="button" onPress={() => setReordering(false)} style={[styles.toolbarButton, { borderColor: secondary }]}>
                    <Text style={[styles.toolbarButtonText, { color: text }]}>× Cancel</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void saveOrder()} style={[styles.toolbarButton, styles.saveOrderButton]}>
                    <Text style={styles.saveOrderText}>{isSaving ? 'Saving…' : '✓ Save order'}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={startReordering} style={[styles.toolbarButton, { borderColor: secondary }]}>
                  <Text style={[styles.toolbarButtonText, { color: text }]}>↕ Arrange</Text>
                </Pressable>
              ) : null}
            </View>
            {reordering ? <Text style={[styles.orderHelp, { color: secondary }]}>Press and drag a grip to move its tag.</Text> : null}
            {operationError ? <Text accessibilityRole="alert" style={styles.operationError}>{operationError}</Text> : null}
            {warning ? (
              <View accessibilityRole="alert" style={styles.warningCard}>
                <Text style={styles.warningTitle}>Custom tags are temporarily unavailable</Text>
                <Text style={styles.warningBody}>Your collection and system tags are still ready to use.</Text>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator color="#42d4c4" size="large" /> : null}
            <Text style={[styles.emptyTitle, { color: text }]}>
              {error ? 'Tags unavailable' : isLoading ? 'Loading your tags…' : 'No tags found'}
            </Text>
            {error ? <Text style={[styles.emptyBody, { color: secondary }]}>{error}</Text> : null}
            {error ? (
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <NativeTagCard
            assetBaseUrl={assetBaseUrl}
            imageRevealController={previewImageRevealController}
            light={light}
            onPressTag={onSelectTag}
            onPressInTag={onPreviewTag}
            onPressOutTag={onCancelPreviewTag}
            onEditTag={item.tone === 'custom' ? openTagEditor : undefined}
            reduceMotion={reduceMotion}
            preview={previewLayout.byKey.get(item.key)!}
            widePreview={widePreview}
            reorder={reordering ? {
              index: orderedTags.findIndex((tag) => tag.key === item.key),
              count: orderedTags.length,
              onMove: moveTag,
            } : undefined}
            tag={item}
          />
        )}
        ListFooterComponent={isEditable && !reordering ? (
          <Pressable
            accessibilityLabel={`New ${parent === 'wanted' ? 'wanted' : 'inventory'} tag`}
            accessibilityRole="button"
            onPress={() => setCreating(true)}
            style={[styles.createButton, parent === 'wanted' && styles.createButtonWanted]}
          >
            <Text style={[styles.createButtonText, { color: text }]}>+ New {parent === 'wanted' ? 'wanted' : 'inventory'} tag</Text>
          </Pressable>
        ) : null}
      />
      {onActionMenuPress ? (
        <Pressable
          accessibilityLabel="Open action menu"
          accessibilityRole="button"
          onPress={onActionMenuPress}
          style={styles.actionMenuAnchor}
        >
          <Image fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={toNativeCollectionImageSource(assetBaseUrl, '/images/btn_action_menu.png')}
            style={styles.actionMenuBall}
          />
        </Pressable>
      ) : null}
      {onCreateTag && onDeleteTag && onUpdateTag && (creating || editingTag) ? (
        <NativeCustomTagEditorSheet
          isSaving={isSaving}
          onClose={() => {
            setCreating(false);
            setEditingTag(null);
          }}
          onCreate={onCreateTag}
          onDelete={onDeleteTag}
          onUpdate={onUpdateTag}
          parent={editingTag?.parent ?? parent}
          tag={editingTag}
          key={editingTag?.tag_id ?? `new:${parent}`}
          visible
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    flexGrow: 1,
    width: '100%',
    maxWidth:
      collectionParityTokens.tags.contentMaxWidth
      + (collectionParityTokens.tags.pageInset * 2),
    alignSelf: 'center',
    padding: collectionParityTokens.tags.pageInset,
    paddingBottom: 92,
  },
  listHeader: { gap: 12 },
  toolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  total: { flex: 1, paddingHorizontal: 2, textAlignVertical: 'center', fontSize: 13, fontWeight: '400' },
  orderActions: { flexDirection: 'row', gap: 6 },
  toolbarButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 },
  toolbarButtonText: { fontSize: 12, fontWeight: '900' },
  saveOrderButton: { borderColor: '#2fc17d', backgroundColor: '#2fc17d2e' },
  saveOrderText: { color: '#70e6aa', fontSize: 12, fontWeight: '900' },
  orderHelp: { marginHorizontal: 2, fontSize: 12, lineHeight: 16 },
  operationError: { padding: 10, borderWidth: 1, borderColor: '#ef5b72', borderRadius: 10, color: '#ef5b72', fontSize: 12, fontWeight: '800' },
  warningCard: {
    gap: 2,
    borderWidth: 1,
    borderColor: '#a1772c',
    borderRadius: 12,
    backgroundColor: '#332a18',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningTitle: { color: '#ffe0a0', fontSize: 13, fontWeight: '900' },
  warningBody: { color: '#d9c79f', fontSize: 12, lineHeight: 17 },
  tagCard: {
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 18,
    borderRadius: collectionParityTokens.tags.cardRadius,
    padding: collectionParityTokens.tags.cardPadding,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  draggingCard: {
    zIndex: 50,
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
  },
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    marginTop: -collectionParityTokens.tags.cardPadding,
    marginHorizontal: -collectionParityTokens.tags.cardPadding,
    paddingVertical: collectionParityTokens.tags.previewBlockInset,
  },
  previewNarrow: {
    minHeight: 120,
    paddingHorizontal: 0,
  },
  previewWide: {
    minHeight: 154,
    paddingHorizontal: collectionParityTokens.tags.cardPadding + 24,
  },
  previewCell: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  previewCellNarrow: { width: '16.666%', height: 60 },
  previewCellWide: { width: '11.111%', height: 69 },
  previewImageNarrow: {
    width: 44,
    height: 44,
  },
  previewImageWide: {
    width: collectionParityTokens.tags.previewCellWide,
    height: collectionParityTokens.tags.previewCellWide,
  },
  previewMaxBadge: { position: 'absolute', top: 2, right: 2, width: 13, height: 13 },
  emptyPreview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyPreviewText: { color: '#525252', fontSize: 15, fontWeight: '500', opacity: 0.9 },
  tagFooter: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: collectionParityTokens.tags.footerHorizontalInset,
    paddingVertical: collectionParityTokens.tags.footerVerticalInset,
  },
  tagIdentity: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center' },
  tagCopy: { minWidth: 0, flex: 1 },
  tagDot: { width: 12, height: 12, marginRight: 7, borderWidth: 1, borderColor: '#ffffff99', borderRadius: 6 },
  editButton: { minWidth: 54, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 19 },
  editButtonSpacer: { width: 54, height: 38 },
  editButtonOverlay: { position: 'absolute', right: 10, bottom: 10, zIndex: 2 },
  editText: { fontSize: 12, fontWeight: '900' },
  dragGrip: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff47', borderRadius: 12, backgroundColor: '#ffffff12', zIndex: 10, elevation: 8 },
  dragGripText: { color: '#f5fffc', fontSize: 25, fontWeight: '900' },
  tagName: { fontSize: 18, fontWeight: '700' },
  tagCount: { fontSize: 14.4, lineHeight: 16 },
  emptyState: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center' },
  retryButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#ef5b72' },
  retryText: { color: '#fff', fontWeight: '900' },
  createButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2196f3', borderRadius: 10, backgroundColor: '#2196f31a' },
  createButtonWanted: { borderColor: '#f44336', backgroundColor: '#f443361a' },
  createButtonText: { fontWeight: '900' },
  actionMenuAnchor: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    zIndex: 21,
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -27,
    borderWidth: 3,
    borderColor: '#d9ffff',
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  actionMenuBall: { width: 48, height: 48 },
});
