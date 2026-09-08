import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { NativeActionMenuAnchor } from '../components/NativeActionMenuAnchor';
import {
  NativeTradeBoardViewport,
  type NativeTradeBoardIdentityHandle,
} from '../features/tradeBoard/NativeTradeBoard';
import type {
  NativeTradeBoardModel,
  NativeTradeBoardTheme,
} from '../features/tradeBoard/nativeTradeBoardModel';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../components/NativeUiIcon';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
} from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  error?: string | null;
  errorKind?: 'error' | 'not-found' | 'private';
  isLoading?: boolean;
  model: NativeTradeBoardModel | null;
  editable?: boolean;
  onActionMenuPress?: () => void;
  onBack: () => void;
  onOpenCreateBoard?: () => void;
  onOpenHelp?: () => void;
  onOpenLiveBoard?: () => void;
  onOpenProfile?: () => void;
  onOpenCollection: () => void;
  onOpenTradeListings?: () => void;
  onOpenWantedListings?: () => void;
  onSearchTrainers?: () => void;
  onRetry: () => void;
  ownerUsername?: string;
  signedIn?: boolean;
};

const THEMES: { id: NativeTradeBoardTheme; label: string; description: string }[] = [
  { id: 'brand-dark', label: 'Nexus Dark', description: 'Bold and ideal for social feeds.' },
  { id: 'brand-light', label: 'Nexus Light', description: 'Clean and bright for messaging.' },
  { id: 'minimal', label: 'Minimal', description: 'Neutral and easy to print.' },
];

type NativeTradeBoardNoticeHandle = {
  clear: () => void;
  show: (message: string) => void;
};

const NativeTradeBoardNotice = forwardRef<NativeTradeBoardNoticeHandle, {
  editable: boolean;
  light: boolean;
}>(function NativeTradeBoardNotice({ editable, light }, ref) {
  const [notice, setNotice] = useState<string | null>(null);
  const [copySuccessVisible, setCopySuccessVisible] = useState(false);
  const copySuccessRef = useRef<View>(null);
  const copyVisibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCopySuccessVisibility = useCallback((visible: boolean) => {
    if (process.env.NODE_ENV === 'test') {
      setCopySuccessVisible(visible);
      return;
    }
    if (Platform.OS === 'web') {
      const element = copySuccessRef.current as unknown as HTMLElement | null;
      if (!element) return;
      element.style.opacity = visible ? '1' : '0';
      if (!visible) element.style.pointerEvents = 'none';
      if (copyVisibilityTimeoutRef.current) clearTimeout(copyVisibilityTimeoutRef.current);
      copyVisibilityTimeoutRef.current = setTimeout(() => {
        element.style.pointerEvents = visible ? 'auto' : 'none';
        element.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }, 50);
      return;
    }
    copySuccessRef.current?.setNativeProps({
      accessibilityElementsHidden: !visible,
      importantForAccessibility: visible ? 'auto' : 'no-hide-descendants',
      pointerEvents: visible ? 'auto' : 'none',
      style: { opacity: visible ? 1 : 0 },
    });
  }, []);
  const hideCopySuccess = useCallback(
    () => updateCopySuccessVisibility(false),
    [updateCopySuccessVisibility],
  );
  useEffect(() => () => {
    if (copyVisibilityTimeoutRef.current) clearTimeout(copyVisibilityTimeoutRef.current);
  }, []);
  useImperativeHandle(ref, () => ({
    clear: () => {
      hideCopySuccess();
      setNotice(null);
    },
    show: (message) => {
      if (editable && message === 'Live Trade Board link copied.') {
        if (notice !== null) setNotice(null);
        updateCopySuccessVisibility(true);
        return;
      }
      hideCopySuccess();
      setNotice(message);
    },
  }), [editable, hideCopySuccess, notice, updateCopySuccessVisibility]);
  if (!editable) {
    return notice
      ? <Text accessibilityLiveRegion="polite" style={[styles.notice, light && styles.textLight]}>{notice}</Text>
      : null;
  }
  return (
    <>
      <View
        accessibilityElementsHidden={!copySuccessVisible}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        importantForAccessibility={copySuccessVisible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={copySuccessVisible ? 'auto' : 'none'}
        ref={copySuccessRef}
        style={[
          styles.noticeOverlay,
          light && styles.noticeOverlayLight,
          !copySuccessVisible && styles.noticeOverlayHidden,
        ]}
      >
        <Text style={[styles.noticeOverlayText, light && styles.textLight]}>Live Trade Board link copied.</Text>
        <Pressable accessibilityLabel="Dismiss Trade Board message" accessibilityRole="button" onPress={hideCopySuccess} style={styles.noticeDismiss}>
          <Text style={[styles.noticeDismissText, light && styles.textLight]}>×</Text>
        </Pressable>
      </View>
      {notice ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.noticeOverlay, light && styles.noticeOverlayLight]}>
          <Text style={[styles.noticeOverlayText, light && styles.textLight]}>{notice}</Text>
          <Pressable accessibilityLabel="Dismiss Trade Board message" accessibilityRole="button" onPress={() => setNotice(null)} style={styles.noticeDismiss}>
            <Text style={[styles.noticeDismissText, light && styles.textLight]}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
});

type NativeTradeBoardThemePreviewHandle = {
  getBoardRef: () => { current: View | null };
  setPokemonGoNameVisible: (visible: boolean) => void;
  selectTheme: (theme: NativeTradeBoardTheme) => void;
};

const NativeTradeBoardThemePreview = forwardRef<NativeTradeBoardThemePreviewHandle, {
  assetBaseUrl: string;
  model: NativeTradeBoardModel;
}>(function NativeTradeBoardThemePreview({ assetBaseUrl, model }, ref) {
  const activeThemeRef = useRef<NativeTradeBoardTheme>('brand-dark');
  const [renderTheme, setRenderTheme] = useState<NativeTradeBoardTheme>('brand-dark');
  const pokemonGoNameVisibleRef = useRef(true);
  const [renderPokemonGoNameVisible, setRenderPokemonGoNameVisible] = useState(true);
  const [preparedModel, setPreparedModel] = useState(model);
  const [preparedThemes, setPreparedThemes] = useState<NativeTradeBoardTheme[]>(
    () => process.env.NODE_ENV === 'test'
      ? ['brand-dark']
      : ['brand-dark', 'brand-light'],
  );
  const darkBoardRef = useRef<View>(null);
  const lightBoardRef = useRef<View>(null);
  const minimalBoardRef = useRef<View>(null);
  const darkWrapperRef = useRef<View>(null);
  const lightWrapperRef = useRef<View>(null);
  const minimalWrapperRef = useRef<View>(null);
  const accessibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const darkIdentityRef = useRef<NativeTradeBoardIdentityHandle>(null);
  const lightIdentityRef = useRef<NativeTradeBoardIdentityHandle>(null);
  const minimalIdentityRef = useRef<NativeTradeBoardIdentityHandle>(null);
  const boardRefs = useMemo(() => ({
    'brand-dark': darkBoardRef,
    'brand-light': lightBoardRef,
    minimal: minimalBoardRef,
  } as const), []);
  const wrapperRefs = useMemo(() => ({
    'brand-dark': darkWrapperRef,
    'brand-light': lightWrapperRef,
    minimal: minimalWrapperRef,
  } as const), []);
  const identityRefs = useMemo(() => ({
    'brand-dark': darkIdentityRef,
    'brand-light': lightIdentityRef,
    minimal: minimalIdentityRef,
  } as const), []);

  useImperativeHandle(ref, () => ({
    getBoardRef: () => boardRefs[activeThemeRef.current],
    setPokemonGoNameVisible: (visible) => {
      pokemonGoNameVisibleRef.current = visible;
      identityRefs[activeThemeRef.current].current?.setPokemonGoNameVisible(visible);
      if (identityTimeoutRef.current) clearTimeout(identityTimeoutRef.current);
      identityTimeoutRef.current = setTimeout(() => {
        setRenderPokemonGoNameVisible(visible);
        for (const option of THEMES) {
          if (option.id !== activeThemeRef.current) {
            identityRefs[option.id].current?.setPokemonGoNameVisible(visible);
          }
        }
      }, 150);
    },
    selectTheme: (nextTheme) => {
      const previousTheme = activeThemeRef.current;
      if (nextTheme === previousTheme) return;
      activeThemeRef.current = nextTheme;
      if (Platform.OS === 'web') {
        identityRefs[nextTheme].current?.setPokemonGoNameVisible(pokemonGoNameVisibleRef.current);
        setRenderTheme(nextTheme);
        return;
      }
      const previousWrapper = wrapperRefs[previousTheme].current;
      const nextWrapper = wrapperRefs[nextTheme].current;
      identityRefs[nextTheme].current?.setPokemonGoNameVisible(pokemonGoNameVisibleRef.current);
      previousWrapper?.setNativeProps({
        style: { opacity: 0 },
      });
      if (nextWrapper) {
        nextWrapper.setNativeProps({
          style: { opacity: 1 },
        });
      } else {
        setPreparedThemes((current) => current.includes(nextTheme)
          ? current
          : [...current, nextTheme]);
        setRenderTheme(nextTheme);
      }
      if (accessibilityTimeoutRef.current) clearTimeout(accessibilityTimeoutRef.current);
      accessibilityTimeoutRef.current = setTimeout(() => {
        if (activeThemeRef.current !== nextTheme) return;
        setRenderTheme(nextTheme);
        previousWrapper?.setNativeProps({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        });
        wrapperRefs[nextTheme].current?.setNativeProps({
          accessibilityElementsHidden: false,
          importantForAccessibility: 'auto',
        });
      }, 150);
    },
  }), [boardRefs, identityRefs, wrapperRefs]);

  useEffect(() => {
    const timeout = setTimeout(() => setPreparedModel(model), 80);
    return () => clearTimeout(timeout);
  }, [model]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    const minimalTimeout = setTimeout(() => {
      setPreparedThemes((current) => current.includes('minimal')
        ? current
        : [...current, 'minimal']);
    }, 80);
    return () => {
      clearTimeout(minimalTimeout);
      if (accessibilityTimeoutRef.current) clearTimeout(accessibilityTimeoutRef.current);
      if (identityTimeoutRef.current) clearTimeout(identityTimeoutRef.current);
    };
  }, []);

  return (
    <View style={styles.themeCanvasStack}>
      {THEMES.map((option) => (
        preparedThemes.includes(option.id) || option.id === renderTheme ? (
          <View
            accessibilityElementsHidden={option.id !== renderTheme}
            importantForAccessibility={option.id === renderTheme ? 'auto' : 'no-hide-descendants'}
            key={option.id}
            pointerEvents="none"
            ref={wrapperRefs[option.id]}
            style={[
              option.id === 'brand-dark' ? styles.themeCanvasBase : styles.themeCanvasOverlay,
              option.id === renderTheme ? styles.themeCanvasActive : styles.themeCanvasHidden,
            ]}
          >
            <NativeTradeBoardViewport
              assetBaseUrl={assetBaseUrl}
              identityRef={identityRefs[option.id]}
              initialPokemonGoNameVisible={renderPokemonGoNameVisible}
              model={option.id === renderTheme ? model : preparedModel}
              ref={boardRefs[option.id]}
              theme={option.id}
            />
          </View>
        ) : null
      ))}
    </View>
  );
});

const NativeTradeBoardThemePicker = ({
  light,
  onSelect,
}: {
  light: boolean;
  onSelect: (theme: NativeTradeBoardTheme) => void;
}) => {
  const [theme, setTheme] = useState<NativeTradeBoardTheme>('brand-dark');
  return (
    <View style={styles.themeList}>
      {THEMES.map((option) => (
        <Pressable
          aria-checked={theme === option.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: theme === option.id }}
          key={option.id}
          onPress={() => {
            if (option.id === theme) return;
            const startedAt = captureNativeUiInteractionStart();
            setTheme(option.id);
            onSelect(option.id);
            markNativeUiPerformanceAfterPaint('trade_board_theme_result_painted', startedAt);
          }}
          style={[styles.themeButton, light && styles.controlLight, theme === option.id && styles.themeButtonActive]}
          testID={`native-trade-board-theme-${option.id}`}
        >
          <View style={[styles.themeSwatch, option.id === 'brand-light' && styles.themeSwatchLight, option.id === 'minimal' && styles.themeSwatchMinimal]} />
          <View style={styles.themeCopy}>
            <Text style={[styles.themeText, light && styles.textLight, theme === option.id && styles.themeTextActive]}>{option.label}</Text>
            <Text style={[
              styles.themeDescription,
              light && styles.mutedLight,
              theme === option.id && styles.themeDescriptionActive,
            ]}>{option.description}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const NativeTradeBoardIdentityOption = ({
  light,
  onChange,
}: {
  light: boolean;
  onChange: (visible: boolean) => void;
}) => {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);
  const optionRef = useRef<View>(null);
  const checkMarkRef = useRef<Text>(null);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
  }, []);
  return (
    <Pressable
      aria-checked={visible}
      accessibilityLabel="Show my Pokémon GO name"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visible }}
      onPress={() => {
        const startedAt = captureNativeUiInteractionStart();
        const nextVisible = !visibleRef.current;
        visibleRef.current = nextVisible;
        if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
          setVisible(nextVisible);
        } else {
          optionRef.current?.setNativeProps({ accessibilityState: { checked: nextVisible } });
          checkMarkRef.current?.setNativeProps({
            style: { opacity: nextVisible ? 1 : 0 },
          });
          if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
          commitTimeoutRef.current = setTimeout(() => setVisible(nextVisible), 150);
        }
        onChange(nextVisible);
        markNativeUiPerformanceAfterPaint('trade_board_identity_result_painted', startedAt);
      }}
      ref={optionRef}
      style={[styles.identityOption, light && styles.optionGroupLight]}
      testID="native-trade-board-show-pokemon-go-name"
    >
      <View style={[styles.checkBox, styles.identityCheck]}>
        <Text ref={checkMarkRef} style={[styles.checkMark, !visible && styles.checkMarkHidden]}>✓</Text>
      </View>
      <Text style={[styles.switchTitle, light && styles.textLight]}>Show my Pokémon GO name</Text>
    </Pressable>
  );
};

export const NativeTradeBoardScreen = ({
  assetBaseUrl,
  error = null,
  errorKind = 'error',
  isLoading = false,
  model,
  editable = true,
  onActionMenuPress,
  onBack,
  onOpenCreateBoard,
  onOpenHelp,
  onOpenLiveBoard,
  onOpenProfile,
  onOpenCollection,
  onOpenTradeListings,
  onOpenWantedListings,
  onSearchTrainers,
  onRetry,
  ownerUsername,
  signedIn = false,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const compactPublicHeader = viewportWidth < 620;
  const publicBoardRef = useRef<View>(null);
  const themePreviewRef = useRef<NativeTradeBoardThemePreviewHandle>(null);
  const ownerNoticeRef = useRef<NativeTradeBoardNoticeHandle>(null);
  const publicNoticeRef = useRef<NativeTradeBoardNoticeHandle>(null);
  const [includeTrade, setIncludeTrade] = useState(true);
  const [includeWanted, setIncludeWanted] = useState(true);
  const [sharing, setSharing] = useState(false);
  const showNotice = (message: string) => {
    (editable ? ownerNoticeRef : publicNoticeRef).current?.show(message);
  };
  const tradeIncluded = Boolean(model?.tradeCount) && includeTrade;
  const wantedIncluded = Boolean(model?.wantedCount) && includeWanted;
  const visibleModel = useMemo(() => model ? {
    ...model,
    includeTrade: tradeIncluded,
    includeWanted: wantedIncluded,
    pokemonGoName: model.pokemonGoName,
    tradeCount: tradeIncluded ? model.tradeCount : 0,
    tradeEntries: tradeIncluded ? model.tradeEntries : [],
    wantedCount: wantedIncluded ? model.wantedCount : 0,
    wantedEntries: wantedIncluded ? model.wantedEntries : [],
  } : null, [model, tradeIncluded, wantedIncluded]);
  const shareBoard = async () => {
    const boardRef = editable
      ? themePreviewRef.current?.getBoardRef()
      : publicBoardRef;
    if (!visibleModel || !boardRef?.current || sharing) return;
    setSharing(true);
    ownerNoticeRef.current?.clear();
    try {
      const uri = await captureRef(boardRef, {
        fileName: `pokegonexus-${visibleModel.username}-trade-board-${visibleModel.generatedAt.slice(0, 10)}`,
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const download = document.createElement('a');
        download.href = uri;
        download.download = `pokegonexus-${visibleModel.username}-trade-board.png`;
        document.body.appendChild(download);
        download.click();
        download.remove();
        showNotice('Trade Board PNG downloaded.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share @${visibleModel.username}'s Trade Board`,
          mimeType: 'image/png',
          UTI: 'public.png',
        });
      } else {
        await Share.share({ message: visibleModel.boardUrl, title: 'Pokémon Go Nexus Trade Board' });
      }
      showNotice('Your Trade Board is ready to share.');
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : 'The Trade Board could not be shared.');
    } finally {
      setSharing(false);
    }
  };

  const copyLiveLink = () => {
    if (!visibleModel) return;
    const startedAt = Platform.OS === 'web' ? null : captureNativeUiInteractionStart();
    // A clipboard bridge round trip does not need to hold the interaction
    // hostage. Paint the acknowledgement with the tap, then replace it only
    // if the platform reports a real write failure.
    showNotice('Live Trade Board link copied.');
    if (startedAt !== null) {
      markNativeUiPerformanceAfterPaint('trade_board_copy_result_painted', startedAt);
    }
    void Clipboard.setStringAsync(visibleModel.boardUrl).catch((caught: unknown) => {
      showNotice(caught instanceof Error ? caught.message : 'The live Trade Board link could not be copied.');
    });
  };

  const toggleSection = (section: 'trade' | 'wanted') => {
    if (!model) return;
    if ((section === 'trade' ? model.tradeCount : model.wantedCount) === 0) return;
    const startedAt = captureNativeUiInteractionStart();
    const nextValue = !(section === 'trade' ? tradeIncluded : wantedIncluded);
    if (!nextValue && (section === 'trade' ? !wantedIncluded : !tradeIncluded)) {
      showNotice('Keep at least one Trade Board section selected.');
    } else if (section === 'trade') {
      setIncludeTrade(nextValue);
    } else {
      setIncludeWanted(nextValue);
    }
    markNativeUiPerformanceAfterPaint('trade_board_section_result_painted', startedAt);
  };

  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-trade-board-screen">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 8 + insets.top, paddingBottom: 112 + insets.bottom }]}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        {editable ? (
        <View style={[styles.header, light && styles.headerLight]}>
          <View style={styles.headerMain}>
            <View accessibilityElementsHidden style={styles.shareGlyph}>
              <View style={[styles.shareNode, styles.shareNodeTop]} />
              <View style={[styles.shareNode, styles.shareNodeMiddle]} />
              <View style={[styles.shareNode, styles.shareNodeBottom]} />
              <View style={[styles.shareLine, styles.shareLineTop]} />
              <View style={[styles.shareLine, styles.shareLineBottom]} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, light && styles.accentLight]}>SHAREABLE COLLECTION</Text>
              <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Trade Board</Text>
              <Text style={[styles.subtitle, light && styles.mutedLight]}>
                {editable
                  ? 'Create a polished, shareable view of your For Trade and Wanted listings.'
                  : `Explore and share @${ownerUsername ?? model?.username ?? 'trainer'}'s live listings.`}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="Back to Trades" accessibilityRole="button" onPress={onBack} style={[styles.headerAction, light && styles.controlLight]}>
              <Text style={[styles.headerActionText, light && styles.textLight]}>←  Trades</Text>
            </Pressable>
            {editable && onOpenLiveBoard && model ? (
              <Pressable accessibilityRole="button" onPress={onOpenLiveBoard} style={[styles.headerAction, light && styles.controlLight]}>
                <Text style={[styles.liveActionText, light && styles.accentLight]}>View live board  ↗</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        ) : (
          <View style={styles.publicHeader}>
            <Pressable accessibilityLabel="Pokémon Go Nexus home" accessibilityRole="button" onPress={onBack} style={styles.publicBrand}>
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/icons/icon-192x192.png` }}
                style={styles.publicBrandIcon}
              />
              {!compactPublicHeader ? <Text style={[styles.publicBrandText, light && styles.textLight]}>Pokémon Go Nexus</Text> : null}
            </Pressable>
            <View style={styles.publicHeaderActions}>
              {onOpenHelp ? (
                <Pressable accessibilityRole="link" onPress={onOpenHelp}>
                  <Text style={[styles.publicHeaderLink, light && styles.textLight]}>Help</Text>
                </Pressable>
              ) : null}
              {onOpenCreateBoard ? (
                <Pressable accessibilityRole="link" onPress={onOpenCreateBoard}>
                  <Text style={[styles.publicHeaderLink, light && styles.textLight]}>{signedIn ? 'Find trainers' : 'Create your board'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={[styles.state, light && styles.panelLight]}>
            <ActivityIndicator color="#299cf5" size="large" />
            <Text style={[styles.stateTitle, light && styles.textLight]}>
              {editable
                ? 'Preparing your Trade Board…'
                : `Loading @${ownerUsername ?? 'trainer'}’s Trade Board`}
            </Text>
          </View>
        ) : error ? (
          <View accessibilityRole="alert" style={[styles.state, styles.errorState, light && styles.panelLight]}>
            <View style={styles.stateGlyphWrap}>
              <NativeUiIcon color="#299cf5" name={errorKind === 'private' ? 'blocked' : errorKind === 'not-found' ? 'search' : 'info'} size={25} />
            </View>
            <Text style={[styles.stateTitle, light && styles.textLight]}>
              {errorKind === 'private'
                ? 'This Trade Board is private'
                : errorKind === 'not-found'
                  ? 'Trade Board not found'
                  : 'We couldn’t load this Trade Board'}
            </Text>
            <Text style={[styles.stateCopy, light && styles.mutedLight]}>
              {errorKind === 'private'
                ? 'The trainer’s collection privacy applies to this live board.'
                : errorKind === 'not-found'
                  ? 'That trainer may have changed their username or left Pokémon Go Nexus.'
                  : error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={errorKind === 'private'
                ? onOpenProfile ?? onOpenCollection
                : errorKind === 'not-found'
                  ? onSearchTrainers ?? onBack
                  : onRetry}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {errorKind === 'private' ? 'View public profile' : errorKind === 'not-found' ? 'Search for a trainer' : 'Try again'}
              </Text>
            </Pressable>
          </View>
        ) : !model || model.tradeCount + model.wantedCount === 0 ? (
          <View style={[styles.state, light && styles.panelLight]}>
            <NativeUiIcon color="#299cf5" name="share" size={34} />
            <Text style={[styles.stateTitle, light && styles.textLight]}>
              {editable ? 'Your Trade Board needs a listing' : 'No public listings yet'}
            </Text>
            <Text style={[styles.stateCopy, light && styles.mutedLight]}>
              {editable
                ? 'Mark at least one Pokémon as For Trade or Wanted, then this board stays synchronized automatically.'
                : `@${ownerUsername ?? 'This trainer'} has not published any For Trade or Wanted Pokémon.`}
            </Text>
            <Pressable accessibilityRole="button" onPress={onOpenCollection} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{editable ? 'Add Pokémon listings' : 'View trainer catalog'}</Text>
            </Pressable>
          </View>
        ) : visibleModel && !editable ? (
          <>
            <View style={styles.publicIntro}>
              <View style={styles.publicIntroCopy}>
                <Text style={[styles.publicKicker, light && styles.successLight]}>LIVE COMMUNITY LISTING</Text>
                <Text accessibilityRole="header" style={[styles.publicTitle, light && styles.textLight]}>@{visibleModel.username}’s Trade Board</Text>
                <Text style={[styles.publicSubtitle, light && styles.mutedLight]}>These listings reflect the trainer’s current public Pokémon Go Nexus collection.</Text>
              </View>
              <Pressable accessibilityLabel="Copy live Trade Board link" accessibilityRole="button" onPress={() => void copyLiveLink()} style={[styles.publicCopyButton, light && styles.controlLight]}>
                <Text style={[styles.publicCopyGlyph, light && styles.textLight]}>↗</Text>
                {!compactPublicHeader ? <Text style={[styles.publicCopyText, light && styles.textLight]}>Copy link</Text> : null}
              </Pressable>
            </View>
            <NativeTradeBoardNotice editable={false} light={light} ref={publicNoticeRef} />
            <NativeTradeBoardViewport assetBaseUrl={assetBaseUrl} model={visibleModel} ref={publicBoardRef} theme="brand-dark" />
            <View accessibilityLabel="Explore this trainer" style={styles.publicCatalogLinks}>
              <Pressable accessibilityRole="link" onPress={onOpenTradeListings ?? onOpenCollection} style={[styles.publicCatalogLink, styles.publicTradeLink, light && styles.headerLight]}>
                <Text style={[styles.publicCatalogText, light && styles.textLight]}><Text style={styles.publicCatalogCount}>{visibleModel.tradeCount}</Text> For Trade</Text>
                <Text style={[styles.publicCatalogArrow, light && styles.textLight]}>→</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={onOpenWantedListings ?? onOpenCollection} style={[styles.publicCatalogLink, styles.publicWantedLink, light && styles.headerLight]}>
                <Text style={[styles.publicCatalogText, light && styles.textLight]}><Text style={styles.publicCatalogCount}>{visibleModel.wantedCount}</Text> Looking For</Text>
                <Text style={[styles.publicCatalogArrow, light && styles.textLight]}>→</Text>
              </Pressable>
            </View>
            {!signedIn && onOpenCreateBoard ? (
              <View style={styles.publicCta}>
                <View style={styles.publicCtaCopy}>
                  <Text style={[styles.publicKicker, light && styles.successLight]}>BUILD YOUR OWN COLLECTION</Text>
                  <Text style={[styles.publicCtaTitle, light && styles.textLight]}>Trade smarter with Pokémon Go Nexus</Text>
                  <Text style={[styles.publicCtaBody, light && styles.mutedLight]}>Catalog what you have, match what you want, and share one live Trade Board.</Text>
                </View>
                <Pressable accessibilityRole="link" onPress={onOpenCreateBoard} style={styles.publicCtaButton}>
                  <Text style={styles.publicCtaButtonText}>Join Pokémon Go Nexus  →</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : visibleModel ? (
          <>
            <View style={[styles.controls, light && styles.panelLight]}>
              <View style={styles.composerHeader}>
                <Text style={[styles.composerEyebrow, light && styles.accentLight]}>SHARE YOUR COLLECTION</Text>
                <Text style={[styles.composerTitle, light && styles.textLight]}>Share your Trade Board</Text>
                <Text style={[styles.composerCopy, light && styles.mutedLight]}>One clear image for what you have and what you want.</Text>
              </View>
              <View style={[styles.optionGroup, light && styles.optionGroupLight]}>
                <Text style={[styles.optionLegend, light && styles.textLight]}>INCLUDE ON BOARD</Text>
                <Pressable
                  aria-checked={tradeIncluded}
                  accessibilityLabel="Include For Trade Pokémon"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tradeIncluded, disabled: model.tradeCount === 0 }}
                  disabled={model.tradeCount === 0}
                  onPress={() => toggleSection('trade')}
                  style={[styles.sectionOption, styles.tradeOption]}
                  testID="native-trade-board-section-trade"
                >
                  <View style={[styles.checkBox, styles.tradeCheck]}><Text style={styles.checkMark}>{tradeIncluded ? '✓' : ''}</Text></View>
                  <View style={styles.switchCopy}>
                    <Text style={[styles.switchTitle, light && styles.textLight]}>For Trade</Text>
                    <Text style={[styles.switchDetail, light && styles.mutedLight]}>{model.tradeCount} Pokémon</Text>
                  </View>
                </Pressable>
                <Pressable
                  aria-checked={wantedIncluded}
                  accessibilityLabel="Include Looking For Pokémon"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: wantedIncluded, disabled: model.wantedCount === 0 }}
                  disabled={model.wantedCount === 0}
                  onPress={() => toggleSection('wanted')}
                  style={[styles.sectionOption, styles.wantedOption]}
                  testID="native-trade-board-section-wanted"
                >
                  <View style={[styles.checkBox, styles.wantedCheck]}><Text style={styles.checkMark}>{wantedIncluded ? '✓' : ''}</Text></View>
                  <View style={styles.switchCopy}>
                    <Text style={[styles.switchTitle, light && styles.textLight]}>Looking For</Text>
                    <Text style={[styles.switchDetail, light && styles.mutedLight]}>{model.wantedCount} Pokémon</Text>
                  </View>
                </Pressable>
              </View>
              <View style={[styles.optionGroup, light && styles.optionGroupLight]}>
                <Text style={[styles.optionLegend, light && styles.textLight]}>BOARD STYLE</Text>
                <NativeTradeBoardThemePicker
                  light={light}
                  onSelect={(nextTheme) => themePreviewRef.current?.selectTheme(nextTheme)}
                />
              </View>
              {model.pokemonGoName
                && model.pokemonGoName.toLocaleLowerCase() !== model.username.toLocaleLowerCase() ? (
                <NativeTradeBoardIdentityOption
                  light={light}
                  onChange={(visible) => themePreviewRef.current?.setPokemonGoNameVisible(visible)}
                />
              ) : null}
              <View style={[styles.privacyNote, light && styles.privacyNoteLight]}>
                <Text style={styles.privacyIcon}>◇</Text>
                <Text style={[styles.privacyCopy, light && styles.mutedLight]}>
                  <Text style={[styles.privacyStrong, light && styles.textLight]}>Your privacy still applies. </Text>
                  The live board is read-only and never exposes private location data.
                </Text>
              </View>
            </View>
            <View style={[styles.preview, light && styles.panelLight]}>
              <View style={[styles.previewHeader, light && styles.dividerLight]}>
                <View>
                  <Text style={[styles.composerEyebrow, light && styles.accentLight]}>LIVE PREVIEW</Text>
                  <Text style={[styles.previewTitle, light && styles.textLight]}>Exactly what gets exported</Text>
                </View>
                <Text style={[styles.previewMeta, light && styles.mutedLight]}>High-resolution PNG</Text>
              </View>
              <NativeTradeBoardThemePreview
                assetBaseUrl={assetBaseUrl}
                model={visibleModel}
                ref={themePreviewRef}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
      {editable ? <NativeTradeBoardNotice editable light={light} ref={ownerNoticeRef} /> : null}
      {editable && visibleModel ? (
        <View style={[styles.actions, styles.actionDock, { bottom: 82 }, light && styles.actionDockLight]}>
              <Pressable accessibilityLabel="Copy live link" accessibilityRole="button" onPress={() => void copyLiveLink()} style={[styles.secondaryButton, styles.copyDockButton, light && styles.controlLight]}>
            <NativeUiIcon color={light ? '#102025' : '#eaf2f4'} name="link" size={18} />
            <Text style={styles.copyDockLabel}>Copy live link</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={sharing}
            onPress={() => void shareBoard()}
            style={[
              Platform.OS === 'web' ? styles.downloadDockButton : styles.primaryButton,
              Platform.OS === 'web' && light && styles.downloadDockButtonLight,
              styles.dockedButton,
            ]}
          >
            <View style={styles.dockButtonContent}>
              {Platform.OS === 'web' ? <NativeUiIcon color={light ? '#102025' : '#eaf2f4'} name="download" size={16} /> : null}
              <Text style={[styles.primaryButtonText, Platform.OS === 'web' && styles.downloadDockText, Platform.OS === 'web' && light && styles.textLight]}>{sharing ? (Platform.OS === 'web' ? 'Creating…' : 'Preparing image…') : (Platform.OS === 'web' ? 'Download PNG' : 'Share board image')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
      {onActionMenuPress ? (
        <NativeActionMenuAnchor assetBaseUrl={assetBaseUrl} onPress={onActionMenuPress} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071014' },
  rootLight: { backgroundColor: '#f8fff9' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 14, paddingHorizontal: 12 },
  publicHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 4 },
  publicBrand: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  publicBrandIcon: { width: 36, height: 36 },
  publicBrandText: { color: '#f6fbfc', fontSize: 14, fontWeight: '900' },
  publicHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  publicHeaderLink: { color: '#f6fbfc', fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  publicIntro: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, paddingVertical: 2 },
  publicIntroCopy: { minWidth: 0, flex: 1 },
  publicKicker: { color: '#40d797', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  successLight: { color: '#087454' },
  publicTitle: { marginTop: 3, color: '#f6fbfc', fontSize: 27, lineHeight: 31, fontWeight: '900' },
  publicSubtitle: { marginTop: 5, color: '#9db0b5', fontSize: 12, lineHeight: 17 },
  publicCopyButton: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#405054', borderRadius: 10, backgroundColor: '#182124' },
  publicCopyGlyph: { color: '#f6fbfc', fontSize: 18, fontWeight: '900' },
  publicCopyText: { color: '#f6fbfc', fontSize: 11, fontWeight: '900' },
  publicCatalogLinks: { gap: 10 },
  publicCatalogLink: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 17, borderWidth: 1, borderRadius: 14, backgroundColor: '#171b1d' },
  publicTradeLink: { borderColor: 'rgba(53,212,136,0.45)' },
  publicWantedLink: { borderColor: 'rgba(255,95,116,0.45)' },
  publicCatalogText: { color: '#f6fbfc', fontSize: 16, fontWeight: '900' },
  publicCatalogCount: { fontSize: 22 },
  publicCatalogArrow: { color: '#f6fbfc', fontSize: 24, fontWeight: '900' },
  publicCta: { gap: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(53,212,136,0.4)', borderRadius: 18, backgroundColor: 'rgba(53,212,136,0.07)' },
  publicCtaCopy: { minWidth: 0 },
  publicCtaTitle: { marginTop: 3, color: '#f6fbfc', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  publicCtaBody: { marginTop: 5, color: '#9db0b5', fontSize: 12, lineHeight: 17 },
  publicCtaButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 11, backgroundColor: '#35c786' },
  publicCtaButtonText: { color: '#07130e', fontSize: 13, fontWeight: '900' },
  header: { gap: 10, padding: 12, borderWidth: 1, borderColor: '#2d4b4e', borderRadius: 12, backgroundColor: '#10211f' },
  headerLight: { borderColor: '#a8bbb7', backgroundColor: '#ffffff' },
  headerMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  shareGlyph: { position: 'relative', width: 44, height: 44, flexShrink: 0 },
  shareNode: { position: 'absolute', zIndex: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#299cf5' },
  shareNodeTop: { top: 2, right: 2 },
  shareNodeMiddle: { top: 16, left: 2 },
  shareNodeBottom: { right: 2, bottom: 2 },
  shareLine: { position: 'absolute', left: 11, width: 25, height: 4, borderRadius: 2, backgroundColor: '#299cf5' },
  shareLineTop: { top: 15, transform: [{ rotate: '-28deg' }] },
  shareLineBottom: { bottom: 13, transform: [{ rotate: '28deg' }] },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  accentLight: { color: '#005bb5' },
  title: { color: '#f6fbfc', fontSize: 29, lineHeight: 34, fontWeight: '900' },
  subtitle: { maxWidth: 620, color: '#9db0b5', fontSize: 13, lineHeight: 19 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerAction: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#405054', borderRadius: 9, backgroundColor: '#182124' },
  headerActionText: { color: '#f6fbfc', fontSize: 12, fontWeight: '900' },
  liveActionText: { color: '#2f9cff', fontSize: 12, fontWeight: '900' },
  controls: { overflow: 'hidden', borderWidth: 1, borderColor: '#526164', borderRadius: 10, backgroundColor: '#282d2e' },
  composerHeader: { alignItems: 'center', gap: 2, padding: 14, borderBottomWidth: 1, borderBottomColor: '#4a5355' },
  composerEyebrow: { color: '#2f9cff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  composerTitle: { color: '#f6fbfc', fontSize: 20, fontWeight: '900' },
  composerCopy: { color: '#aab8bb', fontSize: 11, lineHeight: 15, textAlign: 'center' },
  optionGroup: { gap: 8, margin: 10, marginBottom: 0, padding: 10, borderWidth: 1, borderColor: '#4a5355', borderRadius: 9, backgroundColor: '#303536' },
  optionGroupLight: { borderColor: '#c0c9cb', backgroundColor: '#f4f7f7' },
  optionLegend: { alignSelf: 'center', color: '#f6fbfc', fontSize: 10, fontWeight: '900' },
  sectionOption: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderWidth: 1, borderRadius: 9 },
  tradeOption: { borderColor: '#35d48888', backgroundColor: '#35d48812' },
  wantedOption: { borderColor: '#ff617888', backgroundColor: '#ff617812' },
  identityOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, margin: 10, marginBottom: 0, padding: 10, borderWidth: 1, borderColor: '#4a5355', borderRadius: 9, backgroundColor: '#303536' },
  identityCheck: { borderColor: '#2f9cff' },
  checkBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 7 },
  tradeCheck: { borderColor: '#35d488' },
  wantedCheck: { borderColor: '#ff6178' },
  checkMark: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  checkMarkHidden: { opacity: 0 },
  switchCopy: { flex: 1 },
  switchTitle: { color: '#f6fbfc', fontSize: 14, fontWeight: '900' },
  switchDetail: { marginTop: 2, color: '#9db0b5', fontSize: 11 },
  themeList: { gap: 7 },
  themeButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: 1, borderColor: '#43565a', borderRadius: 9, backgroundColor: '#353a3b' },
  themeButtonActive: { borderColor: '#2f9cff', backgroundColor: '#12345a' },
  themeSwatch: { width: 32, height: 32, borderWidth: 2, borderColor: '#35d488', borderRadius: 8, backgroundColor: '#06162f', shadowColor: '#ff6178', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0 },
  themeSwatchLight: { backgroundColor: '#eef7f4' },
  themeSwatchMinimal: { backgroundColor: '#f2f0e9', borderColor: '#178651' },
  themeCopy: { flex: 1, minWidth: 0 },
  themeText: { color: '#e8f0f1', fontSize: 12, fontWeight: '900' },
  themeTextActive: { color: '#fff' },
  themeDescription: { marginTop: 1, color: '#9db0b5', fontSize: 10, lineHeight: 13 },
  themeDescriptionActive: { color: '#ffffff' },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, margin: 10, padding: 10, borderWidth: 1, borderColor: '#367181', borderRadius: 9, backgroundColor: '#173039' },
  privacyNoteLight: { borderColor: '#73a7b1', backgroundColor: '#e8f7f8' },
  privacyIcon: { color: '#62d2e9', fontSize: 18, fontWeight: '900' },
  privacyCopy: { flex: 1, color: '#9db0b5', fontSize: 10, lineHeight: 14 },
  privacyStrong: { color: '#f6fbfc', fontWeight: '900' },
  preview: { overflow: 'hidden', borderWidth: 1, borderColor: '#526164', borderRadius: 10, paddingBottom: 10, backgroundColor: '#282d2e' },
  previewHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#4a5355', paddingHorizontal: 12, paddingVertical: 9 },
  previewTitle: { marginTop: 2, color: '#f6fbfc', fontSize: 14, fontWeight: '900' },
  previewMeta: { color: '#9db0b5', fontSize: 10, fontWeight: '800' },
  dividerLight: { borderColor: '#b7c4c8' },
  themeCanvasStack: { position: 'relative', minHeight: 0 },
  themeCanvasBase: { minHeight: 0 },
  themeCanvasOverlay: { position: 'absolute', top: 0, right: 0, left: 0 },
  themeCanvasActive: { opacity: 1 },
  themeCanvasHidden: { opacity: 0 },
  state: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#34484c', borderRadius: 18, padding: 24, backgroundColor: '#141d20' },
  errorState: { borderColor: '#ef6077' },
  stateGlyph: { color: '#2f9cff', fontSize: 36, fontWeight: '900' },
  stateGlyphWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(47, 156, 255, 0.12)' },
  stateTitle: { color: '#f6fbfc', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateCopy: { maxWidth: 560, color: '#9db0b5', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  panelLight: { borderColor: '#b7c4c8', backgroundColor: '#fff' },
  textLight: { color: '#102025' },
  mutedLight: { color: '#586a70' },
  controlLight: { borderColor: '#aebdc1', backgroundColor: '#f6f9fa' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionDock: { position: 'absolute', zIndex: 20, right: 10, left: 10, padding: 8, borderWidth: 1, borderColor: '#43565a', borderRadius: 12, backgroundColor: '#1a2224' },
  actionDockLight: { borderColor: '#aebdc1', backgroundColor: '#ffffff' },
  dockedButton: { flex: 1, minWidth: 0 },
  copyDockButton: { width: 44, minWidth: 44, flexBasis: 44, flexGrow: 0, flexShrink: 0, paddingHorizontal: 0 },
  copyDockLabel: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  downloadDockButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#596a6d', borderRadius: 11, paddingHorizontal: 16, backgroundColor: '#353a3b' },
  downloadDockButtonLight: { borderColor: '#aebdc1', backgroundColor: '#e6efeb' },
  downloadDockText: { color: '#eaf2f4' },
  dockButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 18, backgroundColor: '#168ef0' },
  primaryButtonText: { color: '#04131f', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#43565a', borderRadius: 11, paddingHorizontal: 16, backgroundColor: '#182124' },
  secondaryButtonText: { color: '#eaf2f4', fontSize: 13, fontWeight: '800' },
  notice: { color: '#b9d1d7', fontSize: 12, textAlign: 'center' },
  noticeOverlay: { position: 'absolute', zIndex: 22, right: 12, bottom: 148, left: 12, minHeight: 48, maxWidth: 736, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, borderWidth: 1, borderColor: '#2fbd79', borderRadius: 11, backgroundColor: '#13372b' },
  noticeOverlayHidden: { opacity: 0 },
  noticeOverlayLight: { borderColor: '#168f58', backgroundColor: '#e8f8ef' },
  noticeOverlayText: { minWidth: 0, flex: 1, color: '#ffffff', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  noticeDismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  noticeDismissText: { color: '#ffffff', fontSize: 24, lineHeight: 26 },
});
