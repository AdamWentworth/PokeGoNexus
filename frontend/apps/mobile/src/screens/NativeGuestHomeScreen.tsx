import { useRef } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { NativeActionMenuHint } from '../components/NativeActionMenuHint';
import { useNativeReducedMotion } from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon, type NativeUiIconName } from '../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  onDismissActionMenuHint?: () => void;
  onNavigate: (path: string) => void;
  onOpenActionMenu?: () => void;
  showActionMenuHint?: boolean;
};

const CORE_FEATURES = [
  { accent: '#35c984', image: '/images/btn_pokemon.png', title: 'Pokémon collection', detail: 'Catalog exact variants, showcase rare catches, and organize everything with flexible tags.', path: '/pokemon' },
  { accent: '#299cf5', image: '/images/btn_search.png', title: 'Search & discovery', detail: 'Find Pokémon listings or trainers nearby, with detailed filters that reflect what matters to you.', path: '/search' },
  { accent: '#35c984', image: '/images/btn_trades.png', title: 'Trades', detail: 'Set per-Pokémon preferences, propose an exchange, and follow every trade from offer to completion.', path: '/trades' },
] as const;

const STEPS = [
  ['01', 'Catalog what you have', 'Record exact catches, organize them your way, and mark the Pokémon you are ready to trade.', 'collection'],
  ['02', 'Find a real match', 'Search listings and see when what you offer lines up with what another trainer actually wants.', 'match'],
  ['03', 'Propose with confidence', 'Review both Pokémon, trade eligibility, friendship, and Stardust cost before either trainer commits.', 'proposal'],
] as const;

const TOOLS = [
  ['Pokédex', 'Explore species and variants.', '/images/btn_pokedex.png', '/pokedex'],
  ['Raids', 'Build effective raid teams.', '/images/btn_raid.png', '/raid'],
  ['PvP', 'Explore leagues and matchups.', '/images/btn_pvp.png', '/pvp'],
  ['Max Battles', 'Plan for Dynamax encounters.', '/images/btn_max.png', '/max'],
  ['Rankings', 'Compare Pokémon performance.', '/images/btn_rankings.png', '/rankings'],
] as const;

const FOOTER_GROUPS = [
  {
    heading: 'GET STARTED',
    links: [
      ['Help & information', '/help'], ['Frequently asked questions', '/faq'],
      ['About Pokémon Go Nexus', '/about'], ['How it works', '/getting-started'],
      ['Collection', '/pokemon'], ['Search & discovery', '/search'],
      ['Trades', '/trades'], ['Trade Board', '/trade-board'],
    ],
  },
  {
    heading: 'TRAINER TOOLS',
    links: [
      ['Pokédex', '/pokedex'], ['Raids', '/raid'], ['PvP', '/pvp'],
      ['Max Battles', '/max'], ['Rankings', '/rankings'],
    ],
  },
  {
    heading: 'ACCOUNT & LEGAL',
    links: [
      ['Log in', '/login'], ['Create account', '/register'], ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms'], ['Data deletion', '/data-deletion'], ['Trade safety', '/safety'],
    ],
  },
] as const;

const toAssetUrl = (baseUrl: string, path: string): string => (
  `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const GuestHeroBackground = ({ light }: { light: boolean }) => (
  <Svg
    height="100%"
    pointerEvents="none"
    preserveAspectRatio="none"
    style={StyleSheet.absoluteFill}
    width="100%"
  >
    <Defs>
      <LinearGradient id="guest-hero-base" x1="0" x2="1" y1="0" y2="1">
        <Stop offset="0" stopColor={light ? '#e8f7ff' : '#102438'} />
        <Stop offset="0.64" stopColor={light ? '#f8fff9' : '#090d12'} />
        <Stop offset="1" stopColor={light ? '#f8fff9' : '#090d12'} />
      </LinearGradient>
      <RadialGradient cx="50%" cy="28%" id="guest-hero-blue" rx="72%" ry="54%">
        <Stop offset="0" stopColor={light ? '#58c8ff' : '#299cf5'} stopOpacity={light ? 0.18 : 0.16} />
        <Stop offset="0.62" stopColor={light ? '#58c8ff' : '#299cf5'} stopOpacity={0.04} />
        <Stop offset="1" stopColor={light ? '#58c8ff' : '#299cf5'} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient cx="50%" cy="91%" id="guest-hero-green" rx="70%" ry="38%">
        <Stop offset="0" stopColor="#35c984" stopOpacity={light ? 0.08 : 0.07} />
        <Stop offset="1" stopColor="#35c984" stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect fill="url(#guest-hero-base)" height="100%" width="100%" />
    <Rect fill="url(#guest-hero-blue)" height="100%" width="100%" />
    <Rect fill="url(#guest-hero-green)" height="100%" width="100%" />
  </Svg>
);

export const NativeGuestHomeScreen = ({
  assetBaseUrl,
  onDismissActionMenuHint = () => undefined,
  onNavigate,
  onOpenActionMenu = () => undefined,
  showActionMenuHint = false,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compactNavigation = width < 560;
  const reducedMotion = useNativeReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const exploreStartedAtRef = useRef<number | null>(null);
  const contentYRef = useRef(0);
  const featureDirectoryRelativeYRef = useRef(0);
  const exploreFeatures = () => {
    exploreStartedAtRef.current = Date.now();
    scrollRef.current?.scrollTo({
      animated: !reducedMotion,
      y: Math.max(0, contentYRef.current + featureDirectoryRelativeYRef.current - 12),
    });
  };
  const completeExploreScroll = () => {
    if (exploreStartedAtRef.current === null) return;
    const startedAt = exploreStartedAtRef.current;
    exploreStartedAtRef.current = null;
    markNativeUiPerformanceAfterPaint('home_guest_explore_result_painted', startedAt);
  };
  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-guest-home-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 106 + insets.bottom }}
        onMomentumScrollEnd={completeExploreScroll}
        ref={scrollRef}
        testID="native-guest-home-scroll"
      >
        <View style={styles.heroRegion}>
          <GuestHeroBackground light={light} />
          <View style={[styles.topbar, { paddingTop: 8 + insets.top }]}>
          <Pressable accessibilityLabel="Pokémon Go Nexus home" accessibilityRole="link" onPress={() => onNavigate('/')} style={styles.brand}>
            <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/logo.png') }} style={styles.brandIcon} />
            {!compactNavigation ? <Text style={[styles.brandText, light && styles.textLight]}>Pokémon Go Nexus</Text> : null}
          </Pressable>
          <View style={styles.topActions}>
            {!compactNavigation ? <Pressable accessibilityRole="link" onPress={() => onNavigate('/getting-started')} style={styles.navLink}><Text style={[styles.navLinkText, light && styles.textLight]}>How it works</Text></Pressable> : null}
            <Pressable accessibilityRole="link" onPress={() => onNavigate('/help')} style={styles.navLink}><Text style={[styles.navLinkText, light && styles.textLight]}>Help</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => onNavigate('/login')} style={[styles.signIn, light && styles.signInLight]}><Text style={[styles.signInText, light && styles.textLight]}>Log in</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => onNavigate('/register')} style={styles.register}><Text style={styles.registerText}>Create account</Text></Pressable>
          </View>
          </View>

          <View style={[styles.hero, compactNavigation && styles.heroCompact]}>
          <Image fadeDuration={0}
            accessibilityLabel="Pokémon Go Nexus"
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/hero-lockup.png') }}
            style={[styles.lockup, compactNavigation && styles.lockupCompact]}
          />
          <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>THE ULTIMATE TRAINER HUB</Text>
          <Text accessibilityRole="header" style={[styles.title, compactNavigation && styles.titleCompact, light && styles.textLight]}>Build your collection.</Text>
          <Text accessibilityRole="header" style={[styles.titleAccent, compactNavigation && styles.titleCompact]}>Find the right trade.</Text>
          <Text style={[styles.lead, compactNavigation && styles.leadCompact, light && styles.mutedLight]}>Pokémon Go Nexus is the go-to platform for Pokémon GO trainers to catalog Pokémon, showcase rare catches, and find players whose For Trade and Wanted lists actually line up.</Text>
          <View style={[styles.heroActions, compactNavigation && styles.heroActionsCompact]}>
            <Pressable accessibilityRole="link" onPress={() => onNavigate('/register')} style={[styles.primary, compactNavigation && styles.heroActionCompact]}><Text style={styles.primaryText}>Create your free account</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={exploreFeatures} style={[styles.secondary, compactNavigation && styles.heroActionCompact, light && styles.secondaryLight]}><Text style={[styles.secondaryText, light && styles.textLight]}>Explore the app ↓</Text></Pressable>
          </View>
          <View accessibilityLabel="Product highlights" style={styles.proof}>
            {['Exact variants and custom tags', 'Reciprocal trade matching', 'Built for mobile and desktop'].map((label) => (
              <View key={label} style={styles.proofItem}><NativeUiIcon color="#299cf5" name="check" size={11} /><Text style={[styles.proofText, light && styles.mutedLight]}>{label}</Text></View>
            ))}
          </View>
          <View accessibilityLabel="Example reciprocal trade match" style={[styles.matchPreview, light && styles.matchPreviewLight]}>
            <View style={styles.matchHeading}><Text style={[styles.matchEyebrow, light && styles.matchEyebrowLight]}>RECIPROCAL MATCH</Text><Text style={[styles.matchTitle, light && styles.textLight]}>You each have what the other trainer wants</Text></View>
            <View style={styles.exchange}>
              <View style={[styles.exchangePokemon, styles.exchangePokemonTrade, light && styles.exchangePokemonLight]}>
                <Text style={[styles.tradeLabel, light && styles.matchEyebrowLight]}>YOU OFFER</Text>
                <View style={styles.exchangeStage}>
                  <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/shiny_gigantamax/shiny_gigantamax_6.png') }} style={styles.exchangeImage} />
                  <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/gigantamax.png') }} style={styles.exchangeMaxIcon} />
                </View>
                <Text style={[styles.exchangeName, light && styles.textLight]}>Shiny Gigantamax Charizard</Text>
                <Text style={[styles.exchangeMeta, light && styles.mutedLight]}>On your For Trade list</Text>
              </View>
              <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/pogo_trade_icon.png') }} style={styles.exchangeIcon} />
              <View style={[styles.exchangePokemon, styles.exchangePokemonWanted, light && styles.exchangePokemonLight]}>
                <Text style={[styles.wantedLabel, light && styles.wantedLabelLight]}>YOU WANT</Text>
                <View style={styles.exchangeStage}>
                  <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/costumes_shiny/pokemon_25_detective_shiny.png') }} style={styles.exchangeImage} />
                </View>
                <Text style={[styles.exchangeName, light && styles.textLight]}>Shiny Detective Pikachu</Text>
                <Text style={[styles.exchangeMeta, light && styles.mutedLight]}>On your Wanted list</Text>
              </View>
            </View>
            <View style={[styles.matchResult, light && styles.matchResultLight]}><NativeUiIcon color="#35c984" name="trade" size={22} /><View style={styles.matchResultCopy}><Text style={[styles.matchResultTitle, light && styles.textLight]}>Ready to review</Text><Text style={[styles.matchResultDetail, light && styles.mutedLight]}>Compare the exact Pokémon, friendship, eligibility, and Stardust cost.</Text></View></View>
          </View>
          </View>
        </View>

        <View
          onLayout={(event) => { contentYRef.current = event.nativeEvent.layout.y; }}
          style={styles.content}
        >
          <View style={[styles.workflow, light && styles.surfaceLight]} testID="native-home-trade-story">
            <View style={styles.heading}><Text style={[styles.eyebrow, light && styles.eyebrowLight]}>TRADING, WITHOUT THE GUESSWORK</Text><Text style={[styles.headingTitle, light && styles.textLight]}>The trade is the destination.{`\n`}Your collection makes it possible.</Text><Text style={[styles.headingDetail, light && styles.mutedLight]}>Pokémon Go Nexus connects the pieces that usually live in screenshots, chat messages, and memory. Your collection, wishlist, and trade preferences work together to surface useful matches.</Text></View>
            <View style={styles.steps}>
              {STEPS.map(([number, title, detail, kind]) => (
                <View key={number} style={[styles.step, light && styles.stepLight]}>
                  <Text style={styles.stepNumber}>{number}</Text>
                  <View style={styles.stepVisual}>
                    <View style={styles.stepPokemonStage}>
                      <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/shiny_gigantamax/shiny_gigantamax_6.png') }} style={styles.stepPokemon} />
                      <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/gigantamax.png') }} style={styles.stepMaxIcon} />
                    </View>
                    <NativeUiIcon color="#299cf5" name={(kind === 'collection' ? 'catalog' : kind === 'match' ? 'search' : 'trade') as NativeUiIconName} size={22} />
                    {kind !== 'collection' ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, '/images/costumes_shiny/pokemon_25_detective_shiny.png') }} style={styles.stepPokemon} /> : null}
                  </View>
                  <Text style={[styles.stepTitle, light && styles.textLight]}>{title}</Text>
                  <Text style={[styles.stepDetail, light && styles.mutedLight]}>{detail}</Text>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="link" onPress={() => onNavigate('/getting-started')} style={styles.workflowLink}><Text style={styles.workflowLinkText}>▤ New here? Open the complete illustrated guide →</Text></Pressable>
          </View>

          <View
            onLayout={(event) => {
              featureDirectoryRelativeYRef.current = event.nativeEvent.layout.y;
            }}
            style={styles.directory}
            testID="native-home-feature-directory"
          >
            <View style={styles.heading}>
              <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>EVERYTHING IN ONE TRAINER HUB</Text>
              <Text accessibilityRole="header" style={[styles.headingTitle, light && styles.textLight]}>Explore Pokémon Go Nexus</Text>
              <Text style={[styles.headingDetail, light && styles.mutedLight]}>Trading is the heart of the platform, supported by the collection, discovery, social, and battle tools around it.</Text>
            </View>
            <View style={styles.features}>
              {CORE_FEATURES.map((feature) => (
                <Pressable key={feature.title} accessibilityRole="link" onPress={() => onNavigate(feature.path)} style={({ pressed }) => [styles.feature, light && styles.surfaceLight, pressed && styles.pressed]}>
                  <View style={[styles.featureGlyph, { backgroundColor: `${feature.accent}24` }]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, feature.image) }} style={styles.featureImage} /></View>
                  <View style={styles.featureCopy}><Text style={[styles.featureTitle, light && styles.textLight]}>{feature.title}</Text><Text style={[styles.featureDetail, light && styles.mutedLight]}>{feature.detail}</Text></View>
                  <Text style={[styles.arrow, light && styles.mutedLight]}>›</Text>
                </Pressable>
              ))}
            </View>

          <View style={[styles.community, light && styles.communityLight]}>
            <View style={styles.communityIntro}>
              <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>CONNECT AND SHARE</Text>
              <Text style={[styles.communityTitle, light && styles.textLight]}>Your collection can travel further.</Text>
              <Text style={[styles.communityDetail, light && styles.mutedLight]}>Build trusted connections inside Nexus, then take a polished trade list anywhere trainers gather.</Text>
            </View>
            <View style={styles.communityActions}>
              <Pressable accessibilityRole="link" onPress={() => onNavigate('/friends')} style={[styles.communityCard, styles.communityFriends, light && styles.surfaceLight]}>
                <View style={styles.communityIcon}><NativeUiIcon color="#299cf5" name="trainers" size={22} /></View>
                <View style={styles.communityCopy}><Text style={[styles.communityEyebrow, light && styles.eyebrowLight]}>TRAINER NETWORK</Text><Text style={[styles.communityCardTitle, light && styles.textLight]}>Friends</Text><Text style={[styles.communityCardDetail, light && styles.mutedLight]}>Manage trusted trainers, requests, privacy, and collection access.</Text></View><Text style={[styles.arrow, light && styles.mutedLight]}>›</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => onNavigate('/trade-board')} style={[styles.communityCard, styles.communityBoard, light && styles.surfaceLight]}>
                <View style={[styles.communityIcon, styles.communityBoardIcon]}><NativeUiIcon color="#35c984" name="share" size={22} /></View>
                <View style={styles.communityCopy}><Text style={[styles.communityEyebrow, light && styles.eyebrowLight]}>SHARE BEYOND NEXUS</Text><Text style={[styles.communityCardTitle, light && styles.textLight]}>Trade Board</Text><Text style={[styles.communityCardDetail, light && styles.mutedLight]}>Create one visual list or live link for Discord, chats, and communities.</Text></View><Text style={[styles.arrow, light && styles.mutedLight]}>›</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.toolsBlock}>
            <View style={styles.toolsHeading}><Text style={[styles.blockTitle, light && styles.textLight]}>Trainer tools</Text><Text style={[styles.toolsDetail, light && styles.mutedLight]}>Jump directly to the reference and planning tools you need.</Text></View>
            <View style={styles.tools}>
              {TOOLS.map(([label, detail, icon, path]) => (
                <Pressable accessibilityRole="link" key={path} onPress={() => onNavigate(path)} style={[styles.tool, light && styles.surfaceLight]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, icon) }} style={styles.toolIcon} /><View style={styles.toolCopy}><Text style={[styles.toolText, light && styles.textLight]}>{label}</Text><Text style={[styles.toolDetail, light && styles.mutedLight]}>{detail}</Text></View><Text style={[styles.arrow, light && styles.mutedLight]}>›</Text></Pressable>
              ))}
            </View>
          </View>
          </View>

          <View style={[styles.cta, light && styles.ctaLight]}>
            <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/lockup.png') }} style={styles.ctaLogo} />
            <View style={styles.ctaCopy}><Text style={[styles.eyebrow, light && styles.eyebrowLight]}>READY TO TRADE SMARTER?</Text><Text style={[styles.ctaTitle, light && styles.textLight]}>Bring your collection. Find the right trainer.</Text><Text style={[styles.ctaDetail, light && styles.mutedLight]}>Create your free account to organize exact Pokémon, publish your trade list, and discover exchanges that work for both trainers.</Text></View>
            <View style={styles.ctaActions}><Pressable accessibilityRole="link" onPress={() => onNavigate('/register')} style={styles.primary}><Text style={styles.primaryText}>Create account →</Text></Pressable><Pressable accessibilityRole="link" onPress={() => onNavigate('/getting-started')} style={[styles.secondary, light && styles.secondaryLight]}><Text style={[styles.secondaryText, light && styles.textLight]}>Quick start guide</Text></Pressable></View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerAbout}><Text style={[styles.footerBrand, light && styles.textLight]}>Pokémon Go Nexus</Text><Text style={[styles.footerAboutText, light && styles.mutedLight]}>A collection, discovery, and trading hub built around the details Pokémon GO trainers actually care about.</Text></View>
            <View style={styles.footerDirectory}>
              {FOOTER_GROUPS.map((group) => (
                <View key={group.heading} style={styles.footerGroup}>
                  <Text style={[styles.footerHeading, light && styles.textLight]}>{group.heading}</Text>
                  {group.links.map(([label, path]) => <Pressable accessibilityRole="link" key={path} onPress={() => onNavigate(path)}><Text style={styles.footerLink}>{label}</Text></Pressable>)}
                </View>
              ))}
            </View>
            <View style={[styles.footerLegalBlock, light && styles.footerLegalBlockLight]}><Text style={[styles.footerCopyright, light && styles.textLight]}>© {new Date().getFullYear()} Pokémon Go Nexus.</Text><Text style={[styles.footerLegal, light && styles.mutedLight]}>Pokémon Go Nexus is an independent community project and is not affiliated with or endorsed by Niantic, The Pokémon Company, Nintendo, or other rights holders. Pokémon, Pokémon GO, related names, images, and trademarks belong to their respective owners.</Text></View>
          </View>
        </View>
      </ScrollView>
      {showActionMenuHint ? (
        <NativeActionMenuHint
          assetBaseUrl={assetBaseUrl}
          audience="guest"
          onDismiss={onDismissActionMenuHint}
          onOpen={onOpenActionMenu}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071012' }, rootLight: { backgroundColor: '#f8fff9' }, textLight: { color: '#14232a' }, mutedLight: { color: '#576a73' },
  heroRegion: { position: 'relative', overflow: 'hidden' },
  topbar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandIcon: { width: 38, height: 38, resizeMode: 'contain' }, brandText: { color: '#fff', fontSize: 16, fontWeight: '900' }, topActions: { flexDirection: 'row', alignItems: 'center', gap: 5 }, navLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 7 }, navLinkText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  signIn: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: '#66747d', borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#171d22' }, signInLight: { borderColor: '#aebbc2', backgroundColor: '#fff' }, signInText: { color: '#fff', fontSize: 11, fontWeight: '900' }, register: { minHeight: 40, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#168ced' }, registerText: { color: '#05111d', fontSize: 10.5, fontWeight: '900' },
  hero: { minHeight: 530, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 44 },
  heroCompact: { minHeight: 0, paddingTop: 32, paddingBottom: 58 },
  lockup: { width: '92%', maxWidth: 560, height: 190 },
  lockupCompact: { width: '94%', height: 158, marginBottom: 8 },
  eyebrow: { color: '#299cf5', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  eyebrowLight: { color: '#005bb5' },
  title: { maxWidth: 820, marginTop: 10, color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.1, textAlign: 'center' },
  titleAccent: { maxWidth: 820, color: '#55c9ff', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.1, textAlign: 'center' },
  titleCompact: { maxWidth: 390, fontSize: 55, lineHeight: 58, letterSpacing: -2.5 },
  lead: { maxWidth: 720, marginTop: 15, color: '#b6c3ca', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  leadCompact: { marginTop: 24 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 24 },
  heroActionsCompact: { width: '100%', maxWidth: 190, flexDirection: 'column', alignItems: 'stretch' },
  heroActionCompact: { width: '100%' },
  proof: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 18 }, proofItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, proofText: { color: '#aab9c1', fontSize: 10.5, fontWeight: '700' },
  matchPreview: { width: '100%', maxWidth: 700, marginTop: 35, borderWidth: 1, borderColor: '#305d4e', borderRadius: 24, padding: 14, backgroundColor: '#15221f' }, matchPreviewLight: { borderColor: '#8acbb4', backgroundColor: '#f6fffb' }, matchHeading: { alignItems: 'center', gap: 4, paddingBottom: 12 }, matchEyebrow: { color: '#35c984', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, matchEyebrowLight: { color: '#087454' }, matchTitle: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' }, exchange: { flexDirection: 'row', alignItems: 'center', gap: 5 }, exchangePokemon: { minWidth: 0, flex: 1, minHeight: 205, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16, padding: 8, backgroundColor: '#101815' }, exchangePokemonLight: { backgroundColor: '#fff' }, exchangePokemonTrade: { borderColor: '#327e60' }, exchangePokemonWanted: { borderColor: '#9c465a' }, tradeLabel: { color: '#35c984', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }, wantedLabel: { color: '#f05a70', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }, wantedLabelLight: { color: '#b00020' }, exchangeStage: { width: '100%', height: 106, alignItems: 'center', justifyContent: 'center' }, exchangeImage: { width: '92%', height: '92%' }, exchangeMaxIcon: { position: 'absolute', right: 2, top: 2, width: 31, height: 31 }, exchangeIcon: { width: 36, height: 36 }, exchangeName: { minHeight: 36, color: '#fff', fontSize: 11.5, lineHeight: 16, fontWeight: '900', textAlign: 'center' }, exchangeMeta: { color: '#9caab1', fontSize: 8.5, textAlign: 'center' }, matchResult: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10, borderRadius: 12, padding: 10, backgroundColor: '#0e3227' }, matchResultLight: { backgroundColor: '#e5f8f0' }, matchResultIcon: { color: '#35c984', fontSize: 22, fontWeight: '900' }, matchResultCopy: { minWidth: 0, flex: 1 }, matchResultTitle: { color: '#fff', fontSize: 12, fontWeight: '900' }, matchResultDetail: { color: '#a8bab2', fontSize: 9, lineHeight: 13 },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 20, backgroundColor: '#168ced' }, primaryText: { color: '#05111d', fontWeight: '900' }, secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#66747d', borderRadius: 11, paddingHorizontal: 20, backgroundColor: '#161c21' }, secondaryLight: { borderColor: '#aebbc2', backgroundColor: '#fff' }, secondaryText: { color: '#fff', fontWeight: '900' },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center', gap: 28, paddingHorizontal: 14 }, directory: { gap: 28 }, heading: { gap: 6 }, headingTitle: { color: '#fff', fontSize: 27, lineHeight: 32, fontWeight: '900', textAlign: 'center' }, headingDetail: { maxWidth: 720, alignSelf: 'center', color: '#afbdc5', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  features: { gap: 10 }, feature: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: '#303b43', borderRadius: 16, padding: 14, backgroundColor: '#141a1f' }, surfaceLight: { borderColor: '#c6d1d6', backgroundColor: '#fff' }, featureGlyph: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, featureImage: { width: 51, height: 51 }, featureCopy: { flex: 1, minWidth: 0 }, featureTitle: { color: '#fff', fontSize: 16, fontWeight: '900' }, featureDetail: { marginTop: 4, color: '#aebbc2', fontSize: 12, lineHeight: 17 }, arrow: { color: '#bdc6ca', fontSize: 26 }, pressed: { opacity: 0.77 },
  workflow: { gap: 18, borderWidth: 1, borderColor: '#334048', borderRadius: 20, padding: 18, backgroundColor: '#151b20' }, steps: { gap: 9 }, step: { borderLeftWidth: 3, borderLeftColor: '#299cf5', borderRadius: 10, padding: 13, backgroundColor: '#10161a' }, stepLight: { backgroundColor: '#f2f7fa' }, stepNumber: { color: '#299cf5', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, stepVisual: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 6 }, stepPokemonStage: { width: 92, height: 86, alignItems: 'center', justifyContent: 'center' }, stepPokemon: { width: 92, height: 86 }, stepMaxIcon: { position: 'absolute', right: 0, top: 0, width: 27, height: 27 }, stepVisualGlyph: { color: '#58c3ff', fontSize: 27, fontWeight: '900' }, stepTitle: { marginTop: 3, color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' }, stepDetail: { marginTop: 4, color: '#acb8bf', fontSize: 12, lineHeight: 17, textAlign: 'center' }, workflowLink: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#123e62' }, workflowLinkText: { color: '#63baff', fontWeight: '900', textAlign: 'center' },
  community: { gap: 14, borderWidth: 1, borderColor: '#314047', borderRadius: 20, padding: 16, backgroundColor: '#11171b' }, communityLight: { borderColor: '#c6d1d6', backgroundColor: '#f5fafc' }, communityIntro: { gap: 6, alignItems: 'center' }, communityTitle: { color: '#fff', fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center' }, communityDetail: { maxWidth: 680, color: '#afbdc5', fontSize: 13, lineHeight: 19, textAlign: 'center' }, communityActions: { gap: 10 }, communityCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 15, padding: 13, backgroundColor: '#141a1f' }, communityFriends: { borderColor: '#25558a' }, communityBoard: { borderColor: '#553b86' }, communityIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#102d51' }, communityBoardIcon: { backgroundColor: '#2c1d4d' }, communityIconText: { color: '#299cf5', fontSize: 28, fontWeight: '900' }, communityCopy: { minWidth: 0, flex: 1, gap: 2 }, communityEyebrow: { color: '#299cf5', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, communityCardTitle: { color: '#fff', fontSize: 17, fontWeight: '900' }, communityCardDetail: { color: '#aebbc2', fontSize: 11, lineHeight: 16 },
  toolsBlock: { gap: 12 }, toolsHeading: { gap: 4 }, blockTitle: { color: '#fff', fontSize: 21, fontWeight: '900' }, toolsDetail: { color: '#aebbc2', fontSize: 12, lineHeight: 17 }, tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tool: { minWidth: '47%', flexGrow: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: '#303b43', borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#141a1f' }, toolIcon: { width: 42, height: 42 }, toolCopy: { minWidth: 0, flex: 1, gap: 2 }, toolText: { color: '#fff', fontSize: 13, fontWeight: '900' }, toolDetail: { color: '#aebbc2', fontSize: 9.5, lineHeight: 13 },
  cta: { alignItems: 'center', gap: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2d668d', borderRadius: 20, padding: 18, backgroundColor: '#122331' }, ctaLight: { borderColor: '#9fc6df', backgroundColor: '#e6f4fc' }, ctaLogo: { width: 250, height: 110, resizeMode: 'contain' }, ctaCopy: { alignItems: 'center' }, ctaTitle: { marginTop: 6, color: '#fff', fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center' }, ctaDetail: { marginTop: 7, color: '#afbdc5', fontSize: 13, lineHeight: 19, textAlign: 'center' }, ctaActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9 },
  footer: { gap: 20, borderTopWidth: 1, borderTopColor: '#2b373f', paddingVertical: 24 }, footerAbout: { gap: 7 }, footerBrand: { color: '#fff', fontSize: 18, fontWeight: '900' }, footerAboutText: { maxWidth: 620, color: '#9aa9b0', fontSize: 12, lineHeight: 18 }, footerDirectory: { flexDirection: 'row', flexWrap: 'wrap', gap: 22 }, footerGroup: { minWidth: 130, flexGrow: 1, gap: 8 }, footerHeading: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, footerLink: { color: '#299cf5', fontSize: 11, lineHeight: 17, fontWeight: '800' }, footerLegalBlock: { gap: 7, borderTopWidth: 1, borderTopColor: '#2b373f', paddingTop: 16 }, footerLegalBlockLight: { borderTopColor: '#cad4d9' }, footerCopyright: { color: '#fff', fontSize: 11, fontWeight: '800' }, footerLegal: { maxWidth: 720, color: '#8e9da5', fontSize: 10, lineHeight: 15 },
});
