import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
} from 'react';
import { Image, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {
  NativeTradeBoardEntry,
  NativeTradeBoardModel,
  NativeTradeBoardTheme,
} from './nativeTradeBoardModel';

type Props = {
  assetBaseUrl: string;
  identityRef?: Ref<NativeTradeBoardIdentityHandle>;
  initialPokemonGoNameVisible?: boolean;
  model: NativeTradeBoardModel;
  theme: NativeTradeBoardTheme;
};

export type NativeTradeBoardIdentityHandle = {
  setPokemonGoNameVisible: (visible: boolean) => void;
};

export const NATIVE_TRADE_BOARD_WIDTH = 1200;

// The board is an image-generation canvas. Keep its typography deterministic so
// exported boards do not reflow differently based on the creator's system font
// scale; the surrounding screen controls continue to honor accessibility text.
const BoardText = (props: ComponentProps<typeof Text>) => (
  <Text {...props} allowFontScaling={false} />
);

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const PALETTES = {
  'brand-dark': {
    background: '#06162f',
    card: '#0d2339',
    border: '#2d9ef8',
    muted: '#9ab8ca',
    text: '#f7fbff',
  },
  'brand-light': {
    background: '#eaf6ff',
    card: '#ffffff',
    border: '#258ce2',
    muted: '#4c6371',
    text: '#0b2030',
  },
  minimal: {
    background: '#f7f5f0',
    card: '#ffffff',
    border: '#77736b',
    muted: '#64615b',
    text: '#1e1d1b',
  },
} as const;

const BoardArtworkLayers = memo(function BoardArtworkLayers({
  assetBaseUrl,
  entry,
}: {
  assetBaseUrl: string;
  entry: NativeTradeBoardEntry;
}) {
  return (
    <>
      {entry.locationBackgroundUri ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="cover"
          source={{ uri: toAssetUrl(assetBaseUrl, entry.locationBackgroundUri) }}
          style={styles.locationBackground}
        />
      ) : null}
      {entry.luckyRequested ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
          style={styles.luckyBackground}
        />
      ) : null}
      <Image fadeDuration={0}
        accessibilityLabel={entry.name}
        resizeMode="contain"
        source={{ uri: toAssetUrl(assetBaseUrl, entry.imageUri ?? '/images/default_pokemon.png') }}
        style={styles.artwork}
      />
      {entry.maxKind ? (
        <Image fadeDuration={0}
          accessibilityLabel={entry.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          resizeMode="contain"
          source={{
            uri: toAssetUrl(
              assetBaseUrl,
              entry.maxKind === 'gigantamax' ? '/images/gigantamax.png' : '/images/dynamax.png',
            ),
          }}
          style={styles.maxBadge}
        />
      ) : null}
      {entry.mostWanted ? <BoardText accessibilityLabel="Most Wanted" style={styles.mostWanted}>★</BoardText> : null}
    </>
  );
});

const BoardEntry = memo(function BoardEntry({
  assetBaseUrl,
  entry,
  palette,
}: {
  assetBaseUrl: string;
  entry: NativeTradeBoardEntry;
  palette: (typeof PALETTES)[NativeTradeBoardTheme];
}) {
  return (
  <View style={[
    styles.entry,
    { backgroundColor: palette.card, borderColor: `${palette.border}80` },
    entry.mostWanted && styles.mostWantedEntry,
  ]}>
    <View style={styles.artworkStage}>
      <BoardArtworkLayers assetBaseUrl={assetBaseUrl} entry={entry} />
      {entry.quantity > 1 ? (
        <BoardText style={[styles.quantity, { backgroundColor: palette.border }]}>×{entry.quantity}</BoardText>
      ) : null}
    </View>
    <BoardText numberOfLines={2} style={[styles.entryName, { color: palette.text }]}>{entry.name}</BoardText>
    <BoardText style={[styles.entryNumber, { color: palette.muted }]}>#{String(entry.pokedexNumber).padStart(4, '0')}</BoardText>
  </View>
  );
});

const BoardSection = memo(function BoardSection({
  accent,
  assetBaseUrl,
  count,
  description,
  entries,
  eyebrow,
  label,
  palette,
}: {
  accent: string;
  assetBaseUrl: string;
  count: number;
  description: string;
  entries: NativeTradeBoardEntry[];
  eyebrow: string;
  label: string;
  palette: (typeof PALETTES)[NativeTradeBoardTheme];
}) {
  return (
  <View style={[styles.section, { borderColor: `${accent}a6` }]}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeadingCopy}>
        <BoardText style={[styles.sectionEyebrow, { color: accent }]}>{eyebrow}</BoardText>
        <BoardText style={[styles.sectionTitle, { color: palette.text }]}>{label}</BoardText>
        <BoardText style={[styles.sectionDescription, { color: palette.muted }]}>{description}</BoardText>
      </View>
      <BoardText style={[styles.sectionCount, { backgroundColor: `${accent}26`, borderColor: accent, color: accent }]}>{count}</BoardText>
    </View>
    {entries.length ? (
      <View style={styles.grid}>
        {entries.map((entry) => (
          <BoardEntry assetBaseUrl={assetBaseUrl} entry={entry} key={entry.id} palette={palette} />
        ))}
      </View>
    ) : (
      <BoardText style={[styles.empty, { color: palette.muted }]}>No Pokémon listed here yet.</BoardText>
    )}
  </View>
  );
});

const BoardBrand = memo(function BoardBrand({
  assetBaseUrl,
  palette,
}: {
  assetBaseUrl: string;
  palette: (typeof PALETTES)[NativeTradeBoardTheme];
}) {
  return (
    <View style={styles.brandLockup}>
      <Image fadeDuration={0}
        accessibilityLabel="Pokémon Go Nexus"
        resizeMode="contain"
        source={{ uri: toAssetUrl(assetBaseUrl, '/icons/icon-192x192.png') }}
        style={styles.logo}
      />
      <View style={styles.brandCopy}>
        <BoardText style={[styles.brandName, { color: palette.muted }]}>POKÉMON GO NEXUS</BoardText>
        <BoardText style={[styles.brandTitle, { color: palette.text }]}>Community Trade Board</BoardText>
      </View>
    </View>
  );
});

const BoardIdentity = memo(forwardRef<NativeTradeBoardIdentityHandle, {
  initialPokemonGoNameVisible: boolean;
  palette: (typeof PALETTES)[NativeTradeBoardTheme];
  pokemonGoName: string | null;
  username: string;
}>(function BoardIdentity({
  initialPokemonGoNameVisible,
  palette,
  pokemonGoName,
  username,
}, ref) {
  const pokemonGoNameRef = useRef<Text>(null);
  const usesReactVisibility = Platform.OS === 'web' || process.env.NODE_ENV === 'test';
  const [pokemonGoNameVisible, setPokemonGoNameVisible] = useState(
    initialPokemonGoNameVisible,
  );
  useImperativeHandle(ref, () => ({
    setPokemonGoNameVisible: (visible) => {
      if (usesReactVisibility) {
        setPokemonGoNameVisible(visible);
        return;
      }
      pokemonGoNameRef.current?.setNativeProps({
        style: { display: visible ? 'flex' : 'none' },
      });
    },
  }), [usesReactVisibility]);
  return (
    <View style={styles.identity}>
      <BoardText style={[styles.kicker, { color: palette.muted }]}>TRAINER</BoardText>
      <BoardText numberOfLines={1} style={[styles.username, { color: palette.text }]}>@{username}</BoardText>
      {pokemonGoName && (!usesReactVisibility || pokemonGoNameVisible) ? (
        <Text
          allowFontScaling={false}
          ref={pokemonGoNameRef}
          style={[
            styles.pogoName,
            { color: palette.muted },
            !(usesReactVisibility ? pokemonGoNameVisible : initialPokemonGoNameVisible)
              && styles.pokemonGoNameHidden,
          ]}
        >Pokémon GO: {pokemonGoName}</Text>
      ) : null}
    </View>
  );
}));

const BoardFooter = memo(function BoardFooter({
  generatedLabel,
  model,
  palette,
}: {
  generatedLabel: string;
  model: Pick<NativeTradeBoardModel, 'boardUrl' | 'username'>;
  palette: (typeof PALETTES)[NativeTradeBoardTheme];
}) {
  return (
    <View style={[styles.footer, { borderTopColor: `${palette.border}70` }]}>
      <View style={styles.footerCopy}>
        <BoardText style={[styles.footerTitle, { color: palette.text }]}>See live listings and exact trade preferences</BoardText>
        <BoardText style={[styles.footerUrl, { color: palette.border }]} numberOfLines={1}>pokegonexus.com/trade-board/{model.username}</BoardText>
        <BoardText style={[styles.generated, { color: palette.muted }]}>Generated {generatedLabel} · Unofficial community tool</BoardText>
      </View>
      <View style={styles.qrBlock}>
        <View
          accessibilityLabel="QR code for this trainer's live trade board"
          accessibilityRole="image"
          accessible
          style={styles.qrShell}
        >
          <QRCode backgroundColor="#ffffff" color="#071526" quietZone={4} size={131} value={model.boardUrl} />
        </View>
        <BoardText style={[styles.qrLabel, { color: palette.muted }]}>Scan for the live board</BoardText>
      </View>
    </View>
  );
}, (previous, next) => (
  previous.generatedLabel === next.generatedLabel
  && previous.model.boardUrl === next.model.boardUrl
  && previous.model.username === next.model.username
  && previous.palette === next.palette
));

const NativeTradeBoardCanvas = forwardRef<View, Props>(function NativeTradeBoard({
  assetBaseUrl,
  identityRef,
  initialPokemonGoNameVisible = true,
  model,
  theme,
}, ref) {
  const palette = PALETTES[theme];
  const generated = new Date(model.generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? ''
    : generated.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  const mostWantedCount = model.wantedEntries.reduce(
    (count, entry) => count + (entry.mostWanted ? entry.quantity : 0),
    0,
  );
  return (
    <View
      collapsable={false}
      ref={ref}
      style={[styles.board, { backgroundColor: palette.background, borderColor: palette.border }]}
      testID="native-trade-board"
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <BoardBrand assetBaseUrl={assetBaseUrl} palette={palette} />
          <BoardIdentity
            initialPokemonGoNameVisible={initialPokemonGoNameVisible}
            palette={palette}
            pokemonGoName={model.pokemonGoName}
            ref={identityRef}
            username={model.username}
          />
        </View>
        <View style={styles.summary}>
          {model.includeTrade ? (
            <BoardText style={styles.tradeSummary}><BoardText style={styles.summaryNumber}>{model.tradeCount}</BoardText> For Trade</BoardText>
          ) : null}
          {model.includeWanted ? (
            <BoardText style={styles.wantedSummary}><BoardText style={styles.summaryNumber}>{model.wantedCount}</BoardText> Looking For</BoardText>
          ) : null}
        </View>
      </View>
      <View style={styles.content}>
        {model.includeTrade ? (
          <BoardSection
            accent="#36ce83"
            assetBaseUrl={assetBaseUrl}
            count={model.tradeCount}
            description="Pokémon this trainer currently has available to exchange."
            entries={model.tradeEntries}
            eyebrow="AVAILABLE POKÉMON"
            label="For Trade"
            palette={palette}
          />
        ) : null}
        {model.includeWanted ? (
          <BoardSection
            accent="#ff6678"
            assetBaseUrl={assetBaseUrl}
            count={model.wantedCount}
            description={mostWantedCount > 0
              ? `Looking for these Pokémon · ${mostWantedCount} marked Most Wanted.`
              : 'Pokémon this trainer is currently looking for.'}
            entries={model.wantedEntries}
            eyebrow="WANTED POKÉMON"
            label="Looking For"
            palette={palette}
          />
        ) : null}
      </View>
      <BoardFooter generatedLabel={generatedLabel} model={model} palette={palette} />
    </View>
  );
});

export const NativeTradeBoard = memo(NativeTradeBoardCanvas);

/**
 * The canonical Trade Board is a fixed 1200px export canvas. Its in-app
 * preview scales that exact canvas down instead of reflowing it, so the user
 * sees the same eight-column image that will be shared.
 */
const NativeTradeBoardViewportCanvas = forwardRef<View, Props>(function NativeTradeBoardViewport(
  props,
  ref,
) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
  const scale = frameWidth > 0 ? Math.min(1, frameWidth / NATIVE_TRADE_BOARD_WIDTH) : 1;

  const measureFrame = useCallback((event: LayoutChangeEvent) => {
    setFrameWidth(event.nativeEvent.layout.width);
  }, []);
  const measureBoard = useCallback((event: LayoutChangeEvent) => {
    setBoardHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <View
      onLayout={measureFrame}
      style={[styles.viewport, boardHeight > 0 && { height: boardHeight * scale }]}
      testID="native-trade-board-viewport"
    >
      <View style={[styles.scaler, { transform: [{ scale }] }]}>
        <View onLayout={measureBoard}>
          <NativeTradeBoard {...props} ref={ref} />
        </View>
      </View>
    </View>
  );
});

export const NativeTradeBoardViewport = memo(NativeTradeBoardViewportCanvas);

const styles = StyleSheet.create({
  viewport: { position: 'relative', width: '100%', minWidth: 0, minHeight: 1, overflow: 'hidden' },
  scaler: { position: 'absolute', top: 0, left: 0, width: NATIVE_TRADE_BOARD_WIDTH, transformOrigin: 'top left' },
  board: { width: NATIVE_TRADE_BOARD_WIDTH, overflow: 'hidden', borderWidth: 1, borderRadius: 34 },
  hero: { gap: 32, paddingHorizontal: 52, paddingTop: 42, paddingBottom: 38, borderBottomWidth: 1, borderBottomColor: 'rgba(138,190,178,0.28)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 32 },
  brandLockup: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 18 },
  logo: { width: 78, height: 78 },
  brandCopy: { minWidth: 0, flex: 1 },
  brandName: { fontSize: 16, fontWeight: '900', letterSpacing: 2.56 },
  brandTitle: { marginTop: 4, fontSize: 29, lineHeight: 31, fontWeight: '900' },
  identity: { minWidth: 320, alignItems: 'flex-end', justifyContent: 'center' },
  kicker: { fontSize: 16, fontWeight: '900', letterSpacing: 2.56 },
  username: { maxWidth: 470, marginTop: 4, fontSize: 38, lineHeight: 40, fontWeight: '900', textAlign: 'right' },
  pogoName: { marginTop: 7, fontSize: 19, fontWeight: '700' },
  pokemonGoNameHidden: { display: 'none' },
  summary: { flexDirection: 'row', gap: 14 },
  tradeSummary: { minHeight: 46, borderWidth: 1, borderColor: '#36ce83', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 9, overflow: 'hidden', backgroundColor: '#36ce8314', color: '#36ce83', fontSize: 18, fontWeight: '800' },
  wantedSummary: { minHeight: 46, borderWidth: 1, borderColor: '#ff6678', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 9, overflow: 'hidden', backgroundColor: '#ff667814', color: '#ff6678', fontSize: 18, fontWeight: '800' },
  summaryNumber: { fontSize: 23, fontWeight: '900' },
  content: { gap: 34, paddingHorizontal: 42, paddingTop: 38, paddingBottom: 46 },
  section: { overflow: 'hidden', borderWidth: 2, borderRadius: 25 },
  sectionHeader: { minHeight: 128, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingHorizontal: 30, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(138,190,178,0.22)' },
  sectionHeadingCopy: { minWidth: 0, flex: 1 },
  sectionEyebrow: { fontSize: 16, fontWeight: '900', letterSpacing: 2.56 },
  sectionTitle: { marginTop: 3, fontSize: 35, lineHeight: 37, fontWeight: '900' },
  sectionDescription: { marginTop: 2, fontSize: 17, lineHeight: 22 },
  sectionCount: { minWidth: 70, height: 70, overflow: 'hidden', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingTop: 19, color: '#fff', fontSize: 27, textAlign: 'center', fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, padding: 24 },
  entry: { width: 126.35, minHeight: 174, minWidth: 0, alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 8, paddingTop: 11, paddingBottom: 9 },
  mostWantedEntry: { borderColor: '#ff794db8', borderWidth: 2 },
  artworkStage: { width: 100, height: 100, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  locationBackground: { position: 'absolute', zIndex: 0, width: '100%', height: '100%', borderRadius: 999, opacity: 0.72 },
  luckyBackground: { position: 'absolute', zIndex: 1, width: '100%', height: '100%' },
  artwork: { zIndex: 2, width: 100, height: 100 },
  maxBadge: { position: 'absolute', zIndex: 3, top: 2, right: 2, width: 27, height: 27 },
  mostWanted: { position: 'absolute', zIndex: 5, top: 1, left: 1, width: 31, height: 31, overflow: 'hidden', borderRadius: 999, backgroundColor: '#ff794d', color: '#fff', fontSize: 20, lineHeight: 30, textAlign: 'center' },
  quantity: { position: 'absolute', zIndex: 5, right: 1, bottom: 2, minWidth: 34, height: 28, overflow: 'hidden', borderRadius: 999, paddingHorizontal: 7, paddingTop: 5, color: '#06111a', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  entryName: { width: '100%', minHeight: 35, marginTop: 4, fontSize: 15, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  entryNumber: { marginTop: 'auto', fontSize: 12, fontWeight: '800', letterSpacing: 0.48 },
  empty: { minHeight: 130, paddingVertical: 28, fontSize: 19, textAlign: 'center', fontWeight: '700' },
  footer: { minHeight: 210, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 30, borderTopWidth: 1, paddingHorizontal: 52, paddingVertical: 32 },
  footerCopy: { flex: 1, minWidth: 0 },
  footerTitle: { maxWidth: 660, fontSize: 27, lineHeight: 31, fontWeight: '900' },
  footerUrl: { marginTop: 9, fontSize: 20, fontWeight: '900' },
  generated: { marginTop: 16, fontSize: 14 },
  qrBlock: { width: 175, alignItems: 'center', gap: 7 },
  qrShell: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', padding: 7 },
  qrLabel: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
