import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  NativeUiIcon,
  type NativeUiIconName,
} from '../components/NativeUiIcon';
import type {
  NativeInformationPage,
  NativeInformationSection,
} from '../features/information/nativeInformationContent';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
} from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  initialFaqId?: string;
  isLoggedIn?: boolean;
  onBack: () => void;
  onNavigate: (path: string) => void;
  page: NativeInformationPage;
};

const GETTING_STARTED_VISUALS: Record<string, {
  glyph: string;
  images: { maxKind?: 'gigantamax'; path: string }[];
  label: string;
  tone: 'caught' | 'wanted' | 'trade' | 'search' | 'proposal' | 'share';
}> = {
  collection: { glyph: '◆', images: [{ maxKind: 'gigantamax', path: '/images/shiny_gigantamax/shiny_gigantamax_6.png' }], label: 'Shiny Gigantamax Charizard', tone: 'caught' },
  wanted: { glyph: '♥', images: [{ path: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }], label: 'Shiny Detective Pikachu', tone: 'wanted' },
  'for-trade': { glyph: '↔', images: [{ maxKind: 'gigantamax', path: '/images/shiny_gigantamax/shiny_gigantamax_6.png' }], label: 'Your Shiny Gigantamax Charizard', tone: 'trade' },
  discovery: { glyph: '⌕', images: [{ path: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }], label: 'Find a trainer offering this Pikachu', tone: 'search' },
  proposal: { glyph: '✓', images: [{ maxKind: 'gigantamax', path: '/images/shiny_gigantamax/shiny_gigantamax_6.png' }, { path: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }], label: 'Charizard ↔ Detective Pikachu', tone: 'proposal' },
  sharing: { glyph: '↗', images: [{ maxKind: 'gigantamax', path: '/images/shiny_gigantamax/shiny_gigantamax_6.png' }, { path: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }], label: 'One board, both listings', tone: 'share' },
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const FAQ_CATEGORIES = [
  { category: 'ACCOUNT', countLabel: 'Account & access', description: 'Login methods, password recovery, and account control.', icon: 'user' },
  { category: 'COLLECTION', countLabel: 'Collection & tags', description: 'Statuses, custom organization, and collection synchronization.', icon: 'diamond' },
  { category: 'TRADING', countLabel: 'Trading', description: 'Preferences, proposals, eligibility, costs, and trade states.', icon: 'trade' },
  { category: 'DISCOVERY', countLabel: 'Discovery & privacy', description: 'Search, friends, location, visibility, and public sharing.', icon: 'search' },
] as const satisfies readonly {
  category: string;
  countLabel: string;
  description: string;
  icon: NativeUiIconName;
}[];

const FAQ_COMMON_IDS = new Set([
  'same-email-account',
  'collection-statuses',
  'propose-trade',
  'search-matchmaker',
]);

const faqCategoryLabel = (category?: string): string => (
  FAQ_CATEGORIES.find((candidate) => candidate.category === category)?.countLabel
  ?? category
  ?? 'Common questions'
);

const InformationHeroIcon = ({ kind, light }: { kind: 'about' | 'help' | 'safety'; light: boolean }) => (
  <View style={[styles.informationHeroIcon, light && styles.informationHeroIconLight]}>
    <Svg height={28} viewBox="0 0 24 24" width={28}>
      {kind === 'help' ? (
        <Path d="M3.5 5.25c2.8-.9 5.3-.45 7.5 1.3v12.2c-2.2-1.75-4.7-2.2-7.5-1.3V5.25Zm17 0c-2.8-.9-5.3-.45-7.5 1.3v12.2c2.2-1.75 4.7-2.2 7.5-1.3V5.25Z" fill="#299cf5" />
      ) : kind === 'about' ? (
        <>
          <Circle cx="12" cy="12" fill="none" r="8.25" stroke="#299cf5" strokeWidth="1.8" />
          <Path d="M3.9 10.2h16.2M4.2 14.8h15.6M12 3.75c2.1 2.2 3.15 4.95 3.15 8.25S14.1 18.05 12 20.25C9.9 18.05 8.85 15.3 8.85 12S9.9 5.95 12 3.75Z" fill="none" stroke="#299cf5" strokeWidth="1.45" />
        </>
      ) : (
        <Path d="M12 2.8 20 6v5.25c0 5.1-3.15 8.55-8 10.1-4.85-1.55-8-5-8-10.1V6l8-3.2Zm0 3.15L7 7.9v3.35c0 3.35 1.85 5.7 5 6.95 3.15-1.25 5-3.6 5-6.95V7.9l-5-1.95Z" fill="#299cf5" />
      )}
    </Svg>
  </View>
);

const GettingStartedScreen = ({
  assetBaseUrl,
  isLoggedIn,
  light,
  onBack,
  onNavigate,
  page,
}: {
  assetBaseUrl: string;
  isLoggedIn: boolean;
  light: boolean;
  onBack: () => void;
  onNavigate: (path: string) => void;
  page: NativeInformationPage;
}) => {
    const insets = useSafeAreaInsets();
    const charizardImage = toAssetUrl(assetBaseUrl, '/images/shiny_gigantamax/shiny_gigantamax_6.png');
    const pikachuImage = toAssetUrl(assetBaseUrl, '/images/costumes_shiny/pokemon_25_detective_shiny.png');
    const legend = [
      { detail: 'You own it', image: charizardImage, label: 'Caught', mark: '✓', maxKind: 'gigantamax' as const, tone: 'caught' as const },
      { detail: 'You offer it', image: charizardImage, label: 'For Trade', mark: '↔', maxKind: 'gigantamax' as const, tone: 'trade' as const },
      { detail: 'You seek it', image: pikachuImage, label: 'Wanted', mark: '♥', tone: 'wanted' as const },
    ];
    return (
      <View style={[styles.root, light && styles.rootLight]} testID="native-information-getting-started">
        <ScrollView contentContainerStyle={[styles.guideContent, { paddingTop: insets.top, paddingBottom: 104 + insets.bottom }]}>
          <View style={[styles.guideTopbar, light && styles.guideDividerLight]}>
            <Pressable accessibilityLabel="Pokémon Go Nexus home" accessibilityRole="button" onPress={() => onNavigate('/')}>
              <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/logo.png') }} style={styles.guideTopbarLogo} />
            </Pressable>
            <View style={styles.guideTopbarActions}>
              <Pressable accessibilityRole="button" onPress={onBack} style={styles.guideHomeLink}>
                <Text style={[styles.guideHomeText, light && styles.mutedLight]}>←  Home</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onNavigate(isLoggedIn ? '/pokemon' : '/register')} style={styles.guidePrimaryCompact}>
                <Text style={styles.guidePrimaryText}>{isLoggedIn ? 'Open collection' : 'Create account'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.guideIndex, light && styles.guidePanelLight]}>
            <Text style={[styles.guideEyebrow, light && styles.guideBlueLight]}>ON THIS PAGE</Text>
            <View style={styles.guideIndexRows}>
              {page.sections.map((section) => (
                <View key={section.id} style={[styles.guideIndexRow, light && styles.guideDividerLight]}>
                  <Text style={[styles.guideIndexNumber, light && styles.guideGreenLight]}>{section.category?.replace('STEP ', '')}</Text>
                  <Text style={[styles.guideIndexLabel, light && styles.mutedLight]}>{section.title}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.guideHero}>
            <Text style={[styles.guideEyebrow, light && styles.guideBlueLight]}>{page.eyebrow}</Text>
            <Text accessibilityRole="header" style={[styles.guideTitle, light && styles.textLight]}>{page.title}</Text>
            <Text style={[styles.guideIntro, light && styles.mutedLight]}>This guide follows the same order you will use in the app. Read it straight through, or jump directly to the part of the workflow you need.</Text>
            <View style={[styles.guideStoryNote, light && styles.guideStoryNoteLight]}>
              <Text style={[styles.guideStoryText, light && styles.mutedLight]}><Text style={[styles.guideStoryStrong, light && styles.guideGreenLight]}>Running example:</Text> offer a Shiny Gigantamax Charizard for a Shiny Detective Pikachu.</Text>
            </View>
            <View style={styles.guideLegend}>
              {legend.map((item) => (
                <View key={item.label} style={[styles.guideLegendCard, light && styles.guidePanelLight]}>
                  <View style={[
                    styles.guideLegendArtworkWrap,
                    item.tone === 'caught'
                      ? styles.guideToneCaught
                      : item.tone === 'trade'
                        ? styles.guideToneTrade
                        : styles.guideToneWanted,
                  ]}>
                    <Image fadeDuration={0} resizeMode="contain" source={{ uri: item.image }} style={styles.guideLegendArtwork} />
                    {item.maxKind ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, `/images/${item.maxKind}.png`) }} style={styles.guideLegendMax} /> : null}
                    <Text style={styles.guideLegendMark}>{item.mark}</Text>
                  </View>
                  <View style={styles.guideLegendCopy}>
                    <Text style={[styles.guideLegendLabel, light && styles.textLight]}>{item.label}</Text>
                    <Text style={[styles.guideLegendDetail, light && styles.mutedLight]}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.guideSteps}>
            {page.sections.map((section) => {
              const visual = GETTING_STARTED_VISUALS[section.id];
              return (
                <View key={section.id} style={[styles.guideStep, light && styles.guidePanelLight]}>
                  <View style={[styles.guideStepVisual, visual.tone === 'wanted' && styles.guideStepVisualWanted, (visual.tone === 'trade' || visual.tone === 'proposal') && styles.guideStepVisualTrade, light && styles.guideStepVisualLight]}>
                    <Text style={[styles.guideVisualNumber, light && styles.guideVisualNumberLight]}>{section.category?.replace('STEP ', '')}</Text>
                    <Text style={[styles.guideVisualGlyph, light && styles.guideGreenLight]}>{visual.glyph}</Text>
                    <View style={styles.guideVisualPokemonRow}>
                      {visual.images.map((image, index) => (
                        <View key={`${image.path}-${index}`} style={[styles.guideVisualPokemonWrap, visual.images.length > 1 && styles.guideVisualPokemonWrapPair]}>
                          <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, image.path) }} style={styles.guideVisualPokemon} />
                          {image.maxKind ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: toAssetUrl(assetBaseUrl, `/images/${image.maxKind}.png`) }} style={styles.guideVisualMax} /> : null}
                        </View>
                      ))}
                    </View>
                    <Text numberOfLines={1} style={[styles.guideVisualLabel, light && styles.mutedLight]}>{visual.label}</Text>
                  </View>
                  <View style={styles.guideStepCopy}>
                    <Text style={[styles.guideEyebrow, light && styles.guideBlueLight]}>{section.category}</Text>
                    <Text accessibilityRole="header" style={[styles.guideStepTitle, light && styles.textLight]}>{section.title}</Text>
                    <Text style={[styles.guideStepDetail, light && styles.mutedLight]}>{section.detail}</Text>
                    <View style={styles.guideBullets}>
                      {section.bullets?.map((bullet) => (
                        <View key={bullet} style={styles.guideBulletRow}>
                          <Text style={[styles.guideBulletMark, light && styles.guideGreenLight]}>✓</Text>
                          <Text style={[styles.guideBulletText, light && styles.mutedLight]}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                    {section.links?.map((link) => (
                      <Pressable accessibilityLabel={link.label} accessibilityRole="button" key={link.path} onPress={() => onNavigate(link.path)} style={styles.guideStepLink}>
                        <Text style={[styles.guideStepLinkText, light && styles.guideGreenLight]}>{link.label}  →</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.guideFinish, light && styles.guideFinishLight]}>
            <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/logo.png') }} style={styles.guideFinishLogo} />
            <Text style={[styles.guideEyebrow, light && styles.guideBlueLight]}>YOU DO NOT NEED A COMPLETE CATALOG</Text>
            <Text style={[styles.guideFinishTitle, light && styles.textLight]}>Start small. Let the workflow grow with you.</Text>
            <Text style={[styles.guideFinishText, light && styles.mutedLight]}>Add one Pokémon today. Your signed-in Home will show the next useful milestone without forcing you through a tour.</Text>
            <Pressable accessibilityRole="button" onPress={() => onNavigate(isLoggedIn ? '/pokemon' : '/register')} style={styles.guideFinishButton}>
              <Text style={styles.guidePrimaryText}>{isLoggedIn ? 'Open Pokémon' : 'Start your collection'}  →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
};

const InformationSection = memo(({
  expanded,
  isFaq,
  light,
  onNavigate,
  onToggle,
  section,
}: {
  expanded: boolean;
  isFaq: boolean;
  light: boolean;
  onNavigate: (path: string) => void;
  onToggle: (id: string) => void;
  section: NativeInformationSection;
}) => {
  const bodyVisible = !isFaq || expanded;

  return (
    <View style={[styles.section, light && styles.sectionLight]}>
      <Pressable
        accessibilityRole={isFaq ? 'button' : undefined}
        accessibilityState={isFaq ? { expanded } : undefined}
        disabled={!isFaq}
        onPress={() => onToggle(section.id)}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderCopy}>
          {section.category ? <Text style={[styles.sectionCategory, light && styles.blueTextLight]}>{isFaq ? faqCategoryLabel(section.category) : section.category}</Text> : null}
          <Text accessibilityRole="header" style={[styles.sectionTitle, light && styles.textLight]}>{section.title}</Text>
          {section.detail ? <Text style={[styles.sectionDetail, light && styles.mutedLight]}>{section.detail}</Text> : null}
        </View>
        {isFaq ? (
          <View style={[styles.faqChevron, light && styles.faqChevronLight]}>
            <Svg height={14} viewBox="0 0 24 24" width={14}>
              <Path
                d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                fill="none"
                stroke={light ? '#53666f' : '#aab7be'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.25}
              />
            </Svg>
          </View>
        ) : null}
      </Pressable>
      {bodyVisible || isFaq ? (
        <View
          accessibilityElementsHidden={!bodyVisible}
          importantForAccessibility={bodyVisible ? 'auto' : 'no-hide-descendants'}
          pointerEvents={bodyVisible ? 'auto' : 'none'}
          style={!bodyVisible ? styles.faqBodyCollapsed : undefined}
        >
          <View style={styles.sectionBody}>
            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={[styles.paragraph, light && styles.mutedLight]}>{paragraph}</Text>
            ))}
            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bulletCheck}>✓</Text>
                <Text style={[styles.bulletText, light && styles.mutedLight]}>{bullet}</Text>
              </View>
            ))}
            {isFaq ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => onNavigate(`/faq#${section.id}`)}
                style={styles.faqAnswerLink}
              >
                <Text style={[styles.faqAnswerLinkText, light && styles.blueTextLight]}>
                  ⌁  Link to this answer
                </Text>
              </Pressable>
            ) : null}
            {section.links?.length ? (
              <View style={styles.links}>
                {section.links.map((link) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${section.id}-${link.path}`}
                    onPress={() => onNavigate(link.path)}
                    style={[styles.link, link.primary ? styles.linkPrimary : light ? styles.linkLight : styles.linkDark]}
                  >
                    <Text style={[styles.linkText, link.primary ? styles.linkTextPrimary : light && styles.textLight]}>{link.label}</Text>
                    <Text style={[styles.linkArrow, link.primary ? styles.linkTextPrimary : light && styles.textLight]}>›</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
});

InformationSection.displayName = 'InformationSection';

const NativeLegalSection = ({
  light,
  onNavigate,
  page,
  section,
}: {
  light: boolean;
  onNavigate: (path: string) => void;
  page: NativeInformationPage;
  section: NativeInformationSection;
}) => (
  <View style={[styles.legalSection, light && styles.legalSectionLight]}>
    <Text style={[styles.legalSectionTitle, light && styles.legalHeadingLight]}>{section.title}</Text>
    {section.bullets?.map((bullet, index) => (
      <View key={bullet} style={styles.legalOrderedRow}>
        <Text style={[styles.legalOrderedNumber, light && styles.legalLinkLight]}>{index + 1}.</Text>
        {page.slug === 'data-deletion' && section.id === 'delete' && index === 1 ? (
          <Text style={[styles.legalParagraph, light && styles.legalParagraphLight]}>
            Open{' '}
            <Text
              accessibilityRole="link"
              onPress={() => onNavigate('/settings/account')}
              style={[styles.legalLink, light && styles.legalLinkLight]}
            >
              Settings → Account Security
            </Text>
            .
          </Text>
        ) : page.slug === 'data-deletion' && section.id === 'delete' && index === 2 ? (
          <Text style={[styles.legalParagraph, light && styles.legalParagraphLight]}>
            Select <Text style={styles.legalStrong}>Delete account</Text> and confirm the request.
          </Text>
        ) : (
          <Text style={[styles.legalParagraph, light && styles.legalParagraphLight]}>{bullet}</Text>
        )}
      </View>
    ))}
    {section.paragraphs?.map((paragraph) => (
      <Text key={paragraph} style={[styles.legalParagraph, light && styles.legalParagraphLight]}>{paragraph}</Text>
    ))}
    {section.links?.map((link) => (
      <Pressable accessibilityRole="link" key={link.path} onPress={() => onNavigate(link.path)}>
        <Text style={[styles.legalLink, light && styles.legalLinkLight]}>{link.label}</Text>
      </Pressable>
    ))}
  </View>
);

const FaqHero = memo(({ light, page }: { light: boolean; page: NativeInformationPage }) => (
  <View style={[styles.faqHero, light && styles.faqHeroLight]}>
    <View style={[styles.faqHeroIcon, light && styles.faqHeroIconLight]}>
      <NativeUiIcon color="#299cf5" name="help" size={32} />
    </View>
    <Text style={[styles.eyebrow, light && styles.blueTextLight]}>{page.eyebrow}</Text>
    <Text accessibilityRole="header" style={[styles.faqTitle, light && styles.textLight]}>{page.title}</Text>
    <Text style={[styles.faqIntro, light && styles.mutedLight]}>{page.intro}</Text>
  </View>
));

FaqHero.displayName = 'FaqHero';

const FaqCategoryControl = memo(({ meta, light, selected, count, onSelect }: {
  meta: typeof FAQ_CATEGORIES[number];
  light: boolean;
  selected: boolean;
  count: number;
  onSelect: (category: string) => void;
}) => (
  <Pressable accessibilityLabel={`Browse ${meta.countLabel} questions`} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onSelect(meta.category)} style={[styles.faqCategory, light && styles.faqCategoryLight, selected && styles.faqCategorySelected, selected && light && styles.faqCategorySelectedLight]}>
  <View style={[styles.faqCategoryIcon, light && styles.faqCategoryIconLight]}>
    <NativeUiIcon color="#299cf5" name={meta.icon} size={20} />
  </View>
  <View style={styles.faqCategoryCopy}><Text style={[styles.faqCategoryTitle, light && styles.textLight]}>{meta.countLabel}</Text><Text style={[styles.faqCategoryDetail, light && styles.mutedLight]}>{meta.description}</Text></View>
  <View style={[styles.faqCategoryCount, light && styles.faqCategoryCountLight]}><Text style={styles.faqCategoryCountText}>{count}</Text></View>
  <Text style={[styles.faqCategoryArrow, light && styles.mutedLight]}>›</Text>
        </Pressable>
));

FaqCategoryControl.displayName = 'FaqCategoryControl';

const NativeInformationPageScreen = ({ assetBaseUrl, initialFaqId, isLoggedIn = false, onBack, onNavigate, page }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().width < 600;
  const isFaq = page.slug === 'faq';
  const isAbout = page.slug === 'about';
  const isHelp = page.slug === 'help';
  const isLegal = page.slug === 'privacy' || page.slug === 'terms' || page.slug === 'data-deletion';
  const isSafety = page.slug === 'safety';
  const isGettingStarted = page.slug === 'getting-started';
  const categories = useMemo(() => (
    Array.from(new Set(page.sections.map(({ category }) => category).filter(Boolean))) as string[]
  ), [page.sections]);
  const initialFaqSection = isFaq
    ? page.sections.find(({ id }) => id === initialFaqId)
    : undefined;
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialFaqSection?.category ?? null,
  );
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(initialFaqSection ? [initialFaqSection.id] : []),
  );
  const [query, setQuery] = useState('');
  const faqScrollRef = useRef<ScrollView>(null);
  const [faqResultsY, setFaqResultsY] = useState<number | null>(null);
  const [faqListY, setFaqListY] = useState<number | null>(null);
  const [faqTargetY, setFaqTargetY] = useState<number | null>(null);
  const validActiveCategory = activeCategory && categories.includes(activeCategory)
    ? activeCategory
    : null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const indexedSections = useMemo(() => page.sections.map((section) => ({
    section,
    searchText: [section.title, ...(section.paragraphs ?? []), faqCategoryLabel(section.category)]
      .join(' ').toLocaleLowerCase(),
  })), [page.sections]);
  const visibleSections = useMemo(() => indexedSections.filter(({ section, searchText }) => {
    if (isFaq && normalizedQuery) return searchText.includes(normalizedQuery);
    if (validActiveCategory) return section.category === validActiveCategory;
    return !isFaq || FAQ_COMMON_IDS.has(section.id);
  }).map(({ section }) => section), [indexedSections, isFaq, normalizedQuery, validActiveCategory]);
  const allVisibleOpen = visibleSections.length > 0
    && visibleSections.every(({ id }) => openIds.has(id));
  const commitFaqInteraction = useCallback((event: string, update: () => void) => {
    const startedAt = captureNativeUiInteractionStart();
    update();
    markNativeUiPerformanceAfterPaint(event, startedAt);
  }, []);
  const toggleSection = useCallback((id: string) => {
    commitFaqInteraction('information_faq_answer_result_painted', () => setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }));
  }, [commitFaqInteraction]);
  const selectCategory = useCallback((category: string) => {
    commitFaqInteraction('information_faq_category_result_painted', () => {
      setActiveCategory(category);
      setQuery('');
    });
  }, [commitFaqInteraction]);
  const categoryCounts = useMemo(() => new Map(FAQ_CATEGORIES.map(({ category }) => [
    category, page.sections.filter((section) => section.category === category).length,
  ])), [page.sections]);

  useEffect(() => {
    if (!initialFaqSection || faqResultsY === null || faqListY === null || faqTargetY === null) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      faqScrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(0, faqResultsY + faqListY + faqTargetY - 12),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [faqListY, faqResultsY, faqTargetY, initialFaqSection]);

  if (isGettingStarted) {
    return (
      <GettingStartedScreen
        assetBaseUrl={assetBaseUrl}
        isLoggedIn={isLoggedIn}
        light={light}
        onBack={onBack}
        onNavigate={onNavigate}
        page={page}
      />
    );
  }

  if (isFaq) {
    return (
      <View style={[styles.root, light && styles.rootLight]} testID="native-information-faq">
        <ScrollView ref={faqScrollRef} contentContainerStyle={{ paddingTop: 8 + insets.top, paddingBottom: 96 + insets.bottom, paddingHorizontal: 10 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.informationShell, light && styles.informationShellLight]}>
          <FaqHero light={light} page={page} />

          <View style={[styles.faqTools, light && styles.faqToolsLight]}>
            <View style={[styles.faqSearch, light && styles.faqSearchLight]}>
              <NativeUiIcon color={light ? '#53666f' : '#9ba9b0'} name="search" size={20} />
              <TextInput
                accessibilityLabel="Search questions and answers"
                onChangeText={(value) => commitFaqInteraction('information_faq_search_result_painted', () => { setQuery(value); if (value.trim()) setActiveCategory(null); })}
                placeholder="Search questions and answers"
                placeholderTextColor={light ? '#66757d' : '#87959d'}
                style={[styles.faqSearchInput, light && styles.textLight]}
                value={query}
              />
              {query ? <Pressable accessibilityLabel="Clear FAQ search" accessibilityRole="button" onPress={() => commitFaqInteraction('information_faq_clear_result_painted', () => setQuery(''))} style={styles.faqClear}><Text style={[styles.faqClearText, light && styles.textLight]}>×</Text></Pressable> : null}
            </View>
            <View accessibilityLabel="Browse FAQ topics" style={styles.faqCategories}>
              {FAQ_CATEGORIES.map((meta) => (
                <FaqCategoryControl key={meta.category} meta={meta} light={light}
                  selected={activeCategory === meta.category} count={categoryCounts.get(meta.category) ?? 0}
                  onSelect={selectCategory} />
              ))}
            </View>
          </View>

          <View
            onLayout={initialFaqSection
              ? ({ nativeEvent }) => setFaqResultsY(nativeEvent.layout.y)
              : undefined}
            style={styles.faqResults}
          >
            <View style={styles.faqResultsHeader}>
              <View style={styles.faqResultsCopy}><Text style={[styles.sectionCategory, light && styles.blueTextLight]}>KNOWLEDGE BASE</Text><Text style={[styles.faqResultsTitle, light && styles.textLight]}>{normalizedQuery ? 'Search results' : validActiveCategory ? faqCategoryLabel(validActiveCategory) : 'Common questions'}</Text><Text style={[styles.faqResultsDetail, light && styles.mutedLight]}>{visibleSections.length} {visibleSections.length === 1 ? 'question' : 'questions'}{normalizedQuery ? ` matching “${query.trim()}”` : ''}</Text></View>
              <View style={styles.faqResultsActions}>
                {validActiveCategory && !normalizedQuery ? <Pressable accessibilityRole="button" onPress={() => commitFaqInteraction('information_faq_category_result_painted', () => setActiveCategory(null))} style={[styles.faqPill, light && styles.faqPillLight]}><Text style={styles.faqPillAccent}>‹ All topics</Text></Pressable> : null}
                {visibleSections.length ? <Pressable accessibilityRole="button" onPress={() => commitFaqInteraction('information_faq_answer_result_painted', () => setOpenIds((current) => { const next = new Set(current); visibleSections.forEach(({ id }) => { if (allVisibleOpen) next.delete(id); else next.add(id); }); return next; }))} style={[styles.faqPill, light && styles.faqPillLight]}><Text style={[styles.faqPillText, light && styles.textLight]}>{allVisibleOpen ? 'Collapse answers' : 'Expand answers'}</Text></Pressable> : null}
              </View>
            </View>
            <View
              onLayout={initialFaqSection
                ? ({ nativeEvent }) => setFaqListY(nativeEvent.layout.y)
                : undefined}
              style={styles.sections}
            >
              {visibleSections.map((section) => <View key={section.id} onLayout={section.id === initialFaqSection?.id ? ({ nativeEvent }) => setFaqTargetY(nativeEvent.layout.y) : undefined}><InformationSection expanded={openIds.has(section.id)} isFaq light={light} onNavigate={onNavigate} onToggle={toggleSection} section={section} /></View>)}
              {!visibleSections.length ? <View style={[styles.faqEmpty, light && styles.sectionLight]}><Text style={styles.faqEmptyIcon}>⌕</Text><Text style={[styles.faqEmptyTitle, light && styles.textLight]}>No matching questions</Text><Text style={[styles.faqEmptyText, light && styles.mutedLight]}>Try a shorter phrase or search all categories.</Text><Pressable accessibilityRole="button" onPress={() => { setActiveCategory(null); setQuery(''); }} style={[styles.faqPill, light && styles.faqPillLight]}><Text style={[styles.faqPillText, light && styles.textLight]}>Reset FAQ filters</Text></Pressable></View> : null}
            </View>
          </View>

          <View style={[styles.faqGuide, light && styles.faqGuideLight]}><View style={[styles.faqGuideIcon, light && styles.blueIconTileLight]}><Text style={styles.faqGuideIconText}>▤</Text></View><View style={styles.faqGuideCopy}><Text style={[styles.faqGuideTitle, light && styles.textLight]}>Would you rather follow the complete workflow?</Text><Text style={[styles.faqGuideDetail, light && styles.mutedLight]}>The illustrated guide walks from creating a collection to reviewing a trade.</Text></View><Pressable accessibilityRole="button" onPress={() => onNavigate('/getting-started')} style={styles.faqGuideButton}><Text style={styles.faqGuideButtonText}>Open Getting Started</Text></Pressable></View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        isLegal && styles.legalRoot,
        light && styles.rootLight,
        light && isLegal && styles.legalRootLight,
      ]}
      testID={`native-information-${page.slug}`}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: (isLegal && compact ? 0 : 8) + insets.top,
          paddingBottom: (isLegal && compact ? 0 : 96) + insets.bottom,
          paddingHorizontal: isLegal ? 14 : 10,
        }}
      >
        <View style={!isLegal ? [styles.informationShell, light && styles.informationShellLight] : undefined}>
        <View style={[styles.hero, (isHelp || isAbout || isSafety) && styles.informationHeroCentered, !isLegal && styles.informationHeroWithinShell, isLegal && styles.legalHero, compact && isLegal && styles.legalHeroCompact, light && styles.heroLight, light && isLegal && styles.legalHeroLight, light && compact && isLegal && styles.legalHeroCompactLight]}>
          {isHelp ? <InformationHeroIcon kind="help" light={light} /> : isAbout ? <InformationHeroIcon kind="about" light={light} /> : isSafety ? <InformationHeroIcon kind="safety" light={light} /> : null}
          <Text style={[styles.eyebrow, (isHelp || isAbout || isSafety) && styles.centeredText, isLegal && styles.legalEyebrow, light && !isLegal && styles.blueTextLight, light && isLegal && styles.legalLinkLight]}>{page.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.title, (isHelp || isAbout || isSafety) && styles.centeredText, isLegal && styles.legalTitle, light && styles.textLight, light && isLegal && styles.legalHeadingLight]}>{page.title}</Text>
          {!isLegal ? <Text style={[styles.intro, (isHelp || isAbout || isSafety) && styles.centeredText, isAbout && styles.aboutIntro, light && styles.mutedLight]}>{isAbout ? page.intro.replace('trade-planning hub', 'trade-planning\nhub').replace('Pokémon distinct.', 'Pokémon\ndistinct.') : page.intro}</Text> : null}
          {page.updated ? <Text style={[styles.updated, isLegal && styles.legalUpdated, light && styles.mutedLight, light && isLegal && styles.legalParagraphLight]}>{`Last updated: ${page.updated}`}</Text> : null}
        </View>

        {isLegal ? (
          <View style={[styles.legalDocument, compact && styles.legalDocumentCompact, light && styles.legalDocumentLight]}>
            {page.sections.map((section) => (
              <NativeLegalSection
                key={section.id}
                light={light}
                onNavigate={onNavigate}
                page={page}
                section={section}
              />
            ))}
            <View style={styles.legalFooter}><Pressable accessibilityRole="link" onPress={() => onNavigate('/help')}><Text style={[styles.legalLink, light && styles.legalLinkLight]}>Help &amp; information</Text></Pressable><Pressable accessibilityRole="link" onPress={() => onNavigate('/')}><Text style={[styles.legalLink, light && styles.legalLinkLight]}>Return to Pokémon Go Nexus</Text></Pressable></View>
          </View>
        ) : isAbout ? (
          <View style={[styles.aboutBody, styles.groupBodyWithinShell, light && styles.groupShellLight]}>
            <View style={[styles.aboutStory, light && styles.aboutStoryLight]}>
              <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/lockup.png') }} style={styles.aboutStoryLogo} />
              <View style={styles.aboutStoryCopy}>
                <Text style={[styles.sectionCategory, light && styles.blueTextLight]}>{page.sections[0]?.category}</Text>
                <Text style={[styles.aboutHeading, light && styles.textLight]}>{page.sections[0]?.title}</Text>
                {page.sections[0]?.paragraphs?.map((paragraph) => <Text key={paragraph} style={[styles.paragraph, styles.aboutParagraph, light && styles.mutedLight]}>{paragraph}</Text>)}
              </View>
            </View>

            <View style={styles.aboutGroup}>
              <Text style={[styles.sectionCategory, light && styles.blueTextLight]}>PRODUCT PRINCIPLES</Text>
              <Text style={[styles.aboutHeading, light && styles.textLight]}>One connected model, not a pile of unrelated tools.</Text>
              <View style={styles.aboutCards}>
                {page.sections.filter(({ category }) => category === 'PRODUCT PRINCIPLES').map((section, index) => <View key={section.id} style={[styles.aboutCard, light && styles.sectionLight]}><View style={[styles.aboutCardIcon, light && styles.blueIconTileLight]}><Text style={styles.aboutCardIconText}>{['◆', '⌕', '✓'][index] ?? '◆'}</Text></View><Text style={[styles.aboutCardTitle, light && styles.textLight]}>{section.title}</Text>{section.paragraphs?.map((paragraph) => <Text key={paragraph} style={[styles.aboutCardText, light && styles.mutedLight]}>{paragraph}</Text>)}</View>)}
              </View>
            </View>

            <View style={styles.aboutGroup}>
              <Text style={[styles.sectionCategory, light && styles.blueTextLight]}>THE TRAINER HUB</Text>
              <Text style={[styles.aboutHeading, light && styles.textLight]}>Move naturally from a collection to the right trainer.</Text>
              <View style={styles.aboutLinks}>
                {page.sections.filter(({ category }) => category === 'THE TRAINER HUB').map((section, index) => <Pressable accessibilityRole="button" key={section.id} onPress={() => onNavigate(section.links?.[0]?.path ?? '/')} style={[styles.aboutLink, light && styles.sectionLight]}><View style={[styles.aboutLinkIcon, light && styles.blueIconTileLight]}><Text style={styles.aboutLinkIconText}>{['◆', '⌕', '↔', '♙'][index] ?? '◆'}</Text></View><View style={styles.aboutLinkCopy}><Text style={[styles.aboutLinkTitle, light && styles.textLight]}>{section.title}</Text><Text style={[styles.aboutLinkDetail, light && styles.mutedLight]}>{section.detail}</Text></View><Text style={[styles.aboutLinkArrow, light && styles.mutedLight]}>›</Text></Pressable>)}
              </View>
            </View>

            {page.sections.filter(({ id }) => id === 'independent').map((section) => <View key={section.id} style={[styles.aboutCallout, light && styles.aboutCalloutLight]}><View style={[styles.aboutCalloutIcon, light && styles.blueIconTileLight]}><Text style={styles.aboutCalloutIconText}>✓</Text></View><View style={styles.aboutCalloutCopy}><Text style={[styles.aboutCardTitle, light && styles.textLight]}>Independent by design</Text>{section.paragraphs?.map((paragraph) => <Text key={paragraph} style={[styles.aboutCardText, light && styles.mutedLight]}>{paragraph}</Text>)}</View></View>)}

            <View style={[styles.aboutCta, light && styles.aboutCtaLight]}><View style={styles.aboutCtaCopy}><Text style={[styles.sectionCategory, light && styles.blueTextLight]}>SEE IT IN CONTEXT</Text><Text style={[styles.aboutHeading, light && styles.textLight]}>Follow the collection-to-trade workflow.</Text><Text style={[styles.aboutCardText, light && styles.mutedLight]}>The illustrated guide shows how the major parts of Pokémon Go Nexus fit together.</Text></View><View style={styles.aboutCtaActions}><Pressable accessibilityRole="button" onPress={() => onNavigate('/getting-started')} style={styles.aboutPrimaryButton}><Text style={styles.aboutPrimaryButtonText}>Getting Started  ›</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onNavigate('/faq')} style={[styles.aboutSecondaryButton, light && styles.aboutSecondaryButtonLight]}><Text style={[styles.aboutSecondaryButtonText, light && styles.textLight]}>Read the FAQ</Text></Pressable></View></View>
          </View>
        ) : isHelp ? (
          <View style={[styles.helpDirectory, styles.groupBodyWithinShell, light && styles.groupShellLight]}>
            {page.sections.map((section) => <View key={section.id} style={styles.helpGroup}><View style={styles.helpGroupHeader}><Text style={[styles.helpGroupTitle, light && styles.textLight]}>{section.title}</Text><Text style={[styles.helpGroupDetail, light && styles.mutedLight]}>{section.detail}</Text></View><View style={styles.helpLinks}>{section.links?.map((link, index) => <Pressable accessibilityRole="button" key={link.path} onPress={() => onNavigate(link.path)} style={[styles.helpLink, light && styles.sectionLight]}><View style={[styles.helpLinkIcon, light && styles.blueIconTileLight]}><Text style={styles.helpLinkIconText}>{['?', '↗', '◎'][index % 3]}</Text></View><View style={styles.helpLinkCopy}><Text style={[styles.helpLinkTitle, light && styles.textLight]}>{link.label}</Text><Text style={[styles.helpLinkDetail, light && styles.mutedLight]}>{link.description}</Text></View><Text style={[styles.aboutLinkArrow, light && styles.mutedLight]}>›</Text></Pressable>)}</View></View>)}
          </View>
        ) : isSafety ? (
          <View style={[styles.safetyBody, styles.groupBodyWithinShell, light && styles.groupShellLight]}>
            {page.sections.filter(({ id }) => id === 'boundary').map((section) => <View key={section.id} style={[styles.safetyImportant, light && styles.safetyImportantLight]}><View style={[styles.safetyImportantIcon, light && styles.safetyImportantIconLight]}><Text style={[styles.safetyImportantIconText, light && styles.safetyImportantIconTextLight]}>↔</Text></View><View style={styles.aboutCalloutCopy}><Text style={[styles.aboutCardTitle, light && styles.textLight]}>{section.title}</Text>{section.paragraphs?.map((paragraph) => <Text key={paragraph} style={[styles.aboutCardText, light && styles.mutedLight]}>{paragraph}</Text>)}</View></View>)}
            <View style={styles.aboutGroup}><Text style={[styles.sectionCategory, light && styles.blueTextLight]}>BEFORE AND DURING A TRADE</Text><Text style={[styles.aboutHeading, light && styles.textLight]}>Keep the interaction clear, private, and voluntary.</Text><View style={styles.safetyCards}>{page.sections.filter(({ id, category }) => id !== 'boundary' && !category).map((section, index) => <View key={section.id} style={[styles.safetyCard, light && styles.sectionLight]}><View style={[styles.aboutCardIcon, light && styles.blueIconTileLight]}><Text style={styles.aboutCardIconText}>{['✓', '⌾', '⌖', '♙', '◌', '⊘', '!'][index] ?? '✓'}</Text></View><View style={styles.safetyCardCopy}><Text style={[styles.aboutCardTitle, light && styles.textLight]}>{section.title}</Text>{section.bullets?.map((bullet) => <View key={bullet} style={styles.safetyBullet}><Text style={styles.safetyBulletMark}>•</Text><Text style={[styles.aboutCardText, light && styles.mutedLight]}>{bullet}</Text></View>)}</View></View>)}</View></View>
            <View style={[styles.safetyBoundaries, light && styles.safetyBoundariesLight]}><Text style={[styles.sectionCategory, light && styles.blueTextLight]}>KNOW THE BOUNDARY</Text><Text style={[styles.aboutHeading, light && styles.textLight]}>What the platform can—and cannot—establish.</Text>{page.sections.filter(({ category }) => category === 'KNOW THE BOUNDARY').map((section) => <View key={section.id} style={[styles.safetyBoundaryCard, light && styles.sectionLight]}><Text style={[styles.aboutCardTitle, light && styles.textLight]}>{section.title}</Text>{section.bullets?.map((bullet) => <View key={bullet} style={styles.safetyBullet}><Text style={styles.safetyBulletMark}>•</Text><Text style={[styles.aboutCardText, light && styles.mutedLight]}>{bullet}</Text></View>)}</View>)}</View>
            {page.sections.filter(({ id }) => id === 'controls').map((section) => <View key={section.id} style={[styles.aboutCta, light && styles.aboutCtaLight]}><View style={styles.aboutCtaCopy}><Text style={[styles.sectionCategory, light && styles.blueTextLight]}>{section.category}</Text><Text style={[styles.aboutHeading, light && styles.textLight]}>{section.title}</Text><Text style={[styles.aboutCardText, light && styles.mutedLight]}>{section.detail}</Text></View><View style={styles.aboutCtaActions}>{section.links?.map((link) => <Pressable accessibilityRole="button" key={link.path} onPress={() => onNavigate(link.path)} style={link.primary ? styles.aboutPrimaryButton : [styles.aboutSecondaryButton, light && styles.aboutSecondaryButtonLight]}><Text style={link.primary ? styles.aboutPrimaryButtonText : [styles.aboutSecondaryButtonText, light && styles.textLight]}>{link.label}</Text></Pressable>)}</View></View>)}
          </View>
        ) : (
        <View style={styles.sections}>
          {visibleSections.map((section) => (
            <InformationSection
              expanded={openIds.has(section.id)}
              isFaq={isFaq}
              key={section.id}
              light={light}
              onNavigate={onNavigate}
              onToggle={toggleSection}
              section={section}
            />
          ))}
        </View>
        )}
        </View>

        {!isLegal ? <View style={[styles.footer, light && styles.footerLight]}>
          <Image fadeDuration={0} source={{ uri: toAssetUrl(assetBaseUrl, '/images/logo/lockup.png') }} style={styles.footerLogo} />
          <Text style={[styles.footerText, light && styles.mutedLight]}>An independent community project. Pokémon and related marks belong to their respective owners.</Text>
          <View style={styles.footerLinks}>
            {(['help', 'privacy', 'terms', 'safety'] as const).map((slug) => (
              <Pressable accessibilityRole="button" key={slug} onPress={() => onNavigate(`/${slug}`)}><Text style={styles.footerLink}>{slug.replace('-', ' ')}</Text></Pressable>
            ))}
          </View>
        </View> : null}
      </ScrollView>
    </View>
  );
};

export const NativeInformationScreen = (props: Props) => (
  <NativeInformationPageScreen key={`${props.page.slug}:${props.initialFaqId ?? ''}`} {...props} />
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d12' }, rootLight: { backgroundColor: '#f8fff9' },
  faqBodyCollapsed: { height: 0, overflow: 'hidden', opacity: 0 },
  legalRoot: { backgroundColor: '#222222' },
  legalRootLight: { backgroundColor: '#e0f0e5' },
  informationShell: { overflow: 'hidden', borderWidth: 1, borderColor: '#344149', borderRadius: 18, backgroundColor: '#0d1114' },
  informationShellLight: { borderColor: '#9bb8b1', backgroundColor: '#f8fff9' },
  informationHeroWithinShell: { marginTop: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  groupBodyWithinShell: { marginTop: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  topbar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3f4b54', borderRadius: 22, backgroundColor: '#171d22' },
  backLight: { borderColor: '#bdcbd3', backgroundColor: '#fff' }, backGlyph: { marginTop: -4, color: '#fff', fontSize: 40, fontWeight: '300' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 }, logo: { width: 34, height: 34, resizeMode: 'contain' }, brandName: { color: '#fff', fontSize: 16, fontWeight: '900' }, topbarSpacer: { width: 44 },
  guideContent: { paddingHorizontal: 10 },
  guideTopbar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#29383e' },
  guideTopbarLogo: { width: 42, height: 42, resizeMode: 'contain' },
  guideTopbarActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  guideHomeLink: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  guideHomeText: { color: '#9facb3', fontSize: 12, fontWeight: '800' },
  guidePrimaryCompact: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderRadius: 11, backgroundColor: '#299cf5' },
  guidePrimaryText: { color: '#061019', fontSize: 12, fontWeight: '900' },
  guideIndex: { marginTop: 38, borderWidth: 1, borderColor: '#3a4449', borderRadius: 17, padding: 17, backgroundColor: '#1b1b1b' },
  guidePanelLight: { borderColor: '#c5d0d5', backgroundColor: '#fff' },
  guideEyebrow: { color: '#299cf5', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.4 },
  guideBlueLight: { color: '#005bb5' },
  guideGreenLight: { color: '#087454' },
  guideIndexRows: { marginTop: 10 },
  guideIndexRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: '#343a3d' },
  guideDividerLight: { borderColor: '#c5d0d5' },
  guideIndexNumber: { width: 24, color: '#43d79a', fontSize: 10, fontWeight: '900' },
  guideIndexLabel: { flex: 1, color: '#adb5b9', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  guideHero: { marginTop: 54 },
  guideTitle: { maxWidth: 390, marginTop: 8, color: '#fff', fontSize: 48, lineHeight: 48, fontWeight: '900', letterSpacing: -2.1 },
  guideIntro: { marginTop: 17, color: '#b8c2c7', fontSize: 15, lineHeight: 24 },
  guideStoryNote: { alignSelf: 'flex-start', marginTop: 17, borderWidth: 1, borderColor: '#246948', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#10261c' },
  guideStoryNoteLight: { borderColor: '#74b595', backgroundColor: '#eaf9f0' },
  guideStoryText: { color: '#b8c2c7', fontSize: 11, lineHeight: 16 },
  guideStoryStrong: { color: '#43d79a', fontWeight: '900' },
  guideLegend: { gap: 10, marginTop: 28 },
  guideLegendCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#3a4449', borderRadius: 14, padding: 12, backgroundColor: '#1b1b1b' },
  guideLegendArtworkWrap: { position: 'relative', width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  guideToneCaught: { backgroundColor: '#17304d' },
  guideToneTrade: { backgroundColor: '#123326' },
  guideToneWanted: { backgroundColor: '#3a1a22' },
  guideLegendArtwork: { width: 50, height: 50 },
  guideLegendMax: { position: 'absolute', top: 2, right: 2, width: 16, height: 16 },
  guideLegendMark: { position: 'absolute', right: -2, bottom: -2, minWidth: 19, height: 19, overflow: 'hidden', borderWidth: 2, borderColor: '#090d12', borderRadius: 10, backgroundColor: '#20272a', color: '#43d79a', fontSize: 10, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
  guideLegendCopy: { gap: 3 },
  guideLegendLabel: { color: '#fff', fontSize: 13, fontWeight: '900' },
  guideLegendDetail: { color: '#aeb8bd', fontSize: 11 },
  guideSteps: { gap: 16, marginTop: 54 },
  guideStep: { overflow: 'hidden', borderWidth: 1, borderColor: '#3a4449', borderRadius: 24, backgroundColor: '#1b1b1b' },
  guideStepVisual: { position: 'relative', minHeight: 178, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#111e2d' },
  guideStepVisualLight: { backgroundColor: '#edf5fc' },
  guideStepVisualWanted: { backgroundColor: '#2b151b' },
  guideStepVisualTrade: { backgroundColor: '#10271d' },
  guideVisualNumber: { position: 'absolute', top: 11, left: 16, color: '#ffffffbd', fontSize: 45, lineHeight: 48, fontWeight: '900' },
  guideVisualNumberLight: { color: '#24323cc7' },
  guideVisualGlyph: { color: '#43d79a', fontSize: 55, lineHeight: 64, fontWeight: '900' },
  guideVisualPokemonRow: { position: 'absolute', right: 14, bottom: 11, left: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  guideVisualPokemonWrap: { position: 'relative', width: 118, height: 118 },
  guideVisualPokemonWrapPair: { width: 98, height: 98, marginHorizontal: -9 },
  guideVisualPokemon: { width: '100%', height: '100%' },
  guideVisualMax: { position: 'absolute', top: 5, right: 5, width: 29, height: 29 },
  guideVisualLabel: { position: 'absolute', right: 12, bottom: 8, left: 12, color: '#aeb8bd', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  guideStepCopy: { paddingHorizontal: 17, paddingTop: 22, paddingBottom: 24 },
  guideStepTitle: { marginTop: 5, color: '#fff', fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 },
  guideStepDetail: { marginTop: 8, color: '#b8c2c7', fontSize: 14, lineHeight: 21 },
  guideBullets: { gap: 8, marginVertical: 18 },
  guideBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  guideBulletMark: { width: 18, marginTop: 1, color: '#43d79a', fontSize: 13, fontWeight: '900' },
  guideBulletText: { flex: 1, color: '#b8c2c7', fontSize: 12, lineHeight: 18 },
  guideStepLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  guideStepLinkText: { color: '#43d79a', fontSize: 13, fontWeight: '900' },
  guideFinish: { alignItems: 'center', gap: 8, marginTop: 16, borderWidth: 1, borderColor: '#2c7353', borderRadius: 24, padding: 22, backgroundColor: '#10271d' },
  guideFinishLight: { borderColor: '#76b799', backgroundColor: '#eaf8f0' },
  guideFinishLogo: { width: 76, height: 76, resizeMode: 'contain' },
  guideFinishTitle: { color: '#fff', fontSize: 24, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  guideFinishText: { color: '#b8c2c7', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  guideFinishButton: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 12, backgroundColor: '#299cf5' },
  hero: { maxWidth: 860, width: '100%', alignSelf: 'center', marginTop: 18, borderWidth: 1, borderColor: '#244e6f', borderRadius: 20, padding: 22, backgroundColor: '#121a23' },
  informationHeroCentered: { alignItems: 'center', marginTop: 0, borderRadius: 18, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 11 },
  centeredText: { textAlign: 'center' },
  heroLight: { borderColor: '#9bb8b1', backgroundColor: '#f8fff9' }, eyebrow: { color: '#299cf5', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  blueTextLight: { color: '#005bb5' },
  informationHeroIcon: { width: 58, height: 58, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#285d82', borderRadius: 18, backgroundColor: '#10263a' },
  informationHeroIconLight: { borderColor: '#8dbddd', backgroundColor: '#e1f1fb' },
  title: { marginTop: 6, color: '#fff', fontSize: 25, lineHeight: 28, fontWeight: '900' }, intro: { marginTop: 7, maxWidth: 720, color: '#b6c2ca', fontSize: 13, lineHeight: 19 }, updated: { marginTop: 10, color: '#91a1ab', fontSize: 11, fontWeight: '700' },
  aboutIntro: { fontSize: 13 },
  legalHero: { marginTop: 0, borderWidth: 0, borderRadius: 0, paddingHorizontal: 6, paddingTop: 18, paddingBottom: 18, backgroundColor: 'transparent' },
  legalHeroCompact: { width: 'auto', alignSelf: 'stretch', marginHorizontal: -14, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28, backgroundColor: '#222222' },
  legalHeroLight: { backgroundColor: 'transparent' },
  legalHeroCompactLight: { backgroundColor: '#e0f0e5' },
  legalEyebrow: { fontSize: 12, letterSpacing: 1.1 },
  legalTitle: { marginTop: 6, fontSize: 44, lineHeight: 46, letterSpacing: -1.75 },
  legalHeadingLight: { color: '#2f4744' },
  legalUpdated: { marginTop: 12, color: '#aaaaaa', fontSize: 16, lineHeight: 27, fontWeight: '400' },
  legalDocument: { maxWidth: 840, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: '#344149', borderRadius: 20, paddingHorizontal: 17, paddingBottom: 18, backgroundColor: '#171d21' },
  legalDocumentCompact: { width: 'auto', alignSelf: 'stretch', marginHorizontal: -14, borderWidth: 0, borderRadius: 0, paddingHorizontal: 20, backgroundColor: '#222222' },
  legalDocumentLight: { borderColor: '#cccccc', backgroundColor: '#e0f0e5' },
  legalSection: { gap: 8, borderTopWidth: 1, borderTopColor: '#cccccc', paddingVertical: 18 },
  legalSectionLight: { borderTopColor: '#cccccc' },
  legalSectionTitle: { color: '#ffffff', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  legalParagraph: { flex: 1, color: '#aaaaaa', fontSize: 16, lineHeight: 27 },
  legalParagraphLight: { color: '#4b625e' },
  legalStrong: { fontWeight: '900' },
  legalOrderedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  legalOrderedNumber: { color: '#268cff', fontSize: 16, lineHeight: 27, fontWeight: '900' },
  legalLink: { color: '#268cff', fontSize: 16, lineHeight: 27, fontWeight: '800' },
  legalLinkLight: { color: '#005fbd' },
  legalFooter: { gap: 14, borderTopWidth: 1, borderTopColor: '#cccccc', paddingTop: 26, marginTop: 18 },
  categoryRail: { maxWidth: 860, width: '100%', alignSelf: 'center', marginTop: 16 }, categoryContent: { gap: 8, paddingRight: 10 },
  category: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: '#46535c', borderRadius: 999, paddingHorizontal: 16, backgroundColor: '#141a1f' }, categoryActive: { borderColor: '#299cf5', backgroundColor: '#123b61' }, categoryLabel: { color: '#b7c2c8', fontSize: 12, fontWeight: '900' }, categoryLabelActive: { color: '#fff' },
  sections: { maxWidth: 860, width: '100%', alignSelf: 'center', gap: 10, marginTop: 16 },
  section: { overflow: 'hidden', borderWidth: 1, borderColor: '#344149', borderRadius: 16, backgroundColor: '#171d21' }, sectionLight: { borderColor: '#9bb8b1', backgroundColor: '#eef6f1' },
  sectionHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 }, sectionHeaderCopy: { flex: 1, minWidth: 0 }, sectionCategory: { color: '#299cf5', fontSize: 9, fontWeight: '900', letterSpacing: 1.25 }, sectionTitle: { marginTop: 2, color: '#fff', fontSize: 18, lineHeight: 23, fontWeight: '900' }, sectionDetail: { marginTop: 4, color: '#acb8bf', fontSize: 12, lineHeight: 17 },
  faqChevron: { width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#40505a', borderRadius: 16, backgroundColor: '#141a1f' },
  faqChevronLight: { borderColor: '#c4d0d6', backgroundColor: '#f7fafb' },
  sectionBody: { gap: 10, borderTopWidth: 1, borderTopColor: '#334047', padding: 15, paddingTop: 12 }, paragraph: { color: '#b8c3ca', fontSize: 13.5, lineHeight: 20 }, bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, bulletCheck: { color: '#36cb86', fontSize: 15, fontWeight: '900' }, bulletText: { flex: 1, color: '#b8c3ca', fontSize: 13.5, lineHeight: 20 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 }, link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 }, linkPrimary: { borderColor: '#299cf5', backgroundColor: '#168ced' }, linkLight: { borderColor: '#aabac2', backgroundColor: '#f5f8fa' }, linkDark: { borderColor: '#526068', backgroundColor: '#22292e' }, linkText: { color: '#fff', fontSize: 12, fontWeight: '900' }, linkTextPrimary: { color: '#fff' }, linkArrow: { color: '#fff', fontSize: 20 },
  footer: { maxWidth: 860, width: '100%', alignSelf: 'center', alignItems: 'center', gap: 9, marginTop: 22, borderTopWidth: 1, borderTopColor: '#27343b', paddingTop: 20 }, footerLight: { borderTopColor: '#c4d0d6' }, footerLogo: { width: 176, height: 76, resizeMode: 'contain' }, footerText: { maxWidth: 620, color: '#8f9ca3', fontSize: 10.5, lineHeight: 15, textAlign: 'center' }, footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }, footerLink: { color: '#299cf5', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  faqHero: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  faqHeroLight: { backgroundColor: 'transparent' },
  faqHeroIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#285d82', borderRadius: 18, backgroundColor: '#10263a' },
  faqHeroIconLight: { borderColor: '#8dbddd', backgroundColor: '#e1f1fb' },
  faqTitle: { marginTop: 3, color: '#fff', fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center' },
  faqIntro: { maxWidth: 350, marginTop: 6, color: '#b6c2ca', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  faqTools: { gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2d3a42', paddingHorizontal: 12, paddingVertical: 16, backgroundColor: '#11171b' },
  faqToolsLight: { borderColor: '#9bb8b1', backgroundColor: '#f3f8f5' },
  faqSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#35464f', borderRadius: 15, paddingHorizontal: 14, backgroundColor: '#0d1719' },
  faqSearchLight: { borderColor: '#b7c6cd', backgroundColor: '#fff' },
  faqSearchInput: { minWidth: 0, flex: 1, height: 50, color: '#fff', fontSize: 14 },
  faqClear: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#ffffff10' },
  faqClearText: { color: '#fff', fontSize: 25, lineHeight: 28 },
  faqAnswerLink: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 2 },
  faqAnswerLinkText: { color: '#299cf5', fontSize: 12, fontWeight: '900' },
  faqCategories: { gap: 10 },
  faqCategory: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#344149', borderRadius: 15, padding: 13, backgroundColor: '#1a2024' },
  faqCategoryLight: { borderColor: '#9bb8b1', backgroundColor: '#eef6f1' },
  faqCategorySelected: { borderColor: '#299cf5', backgroundColor: '#123b61' },
  faqCategorySelectedLight: { borderColor: '#299cf5', backgroundColor: '#e5f3fc' },
  faqCategoryIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#18314b' },
  faqCategoryIconLight: { backgroundColor: '#e1f1fb' },
  faqCategoryCopy: { minWidth: 0, flex: 1, gap: 3 },
  faqCategoryTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  faqCategoryDetail: { color: '#aab7be', fontSize: 10.5, lineHeight: 14 },
  faqCategoryCount: { minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#18314b' },
  faqCategoryCountLight: { backgroundColor: '#e1f1fb' },
  faqCategoryCountText: { color: '#299cf5', fontSize: 11, fontWeight: '900' },
  faqCategoryArrow: { color: '#aab7be', fontSize: 22 },
  faqResults: { paddingHorizontal: 12, paddingTop: 18 },
  faqResultsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  faqResultsCopy: { minWidth: 0, flex: 1, gap: 2 },
  faqResultsTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  faqResultsDetail: { color: '#9aa8af', fontSize: 11 },
  faqResultsActions: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: 8 },
  faqPill: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#40505a', borderRadius: 999, paddingHorizontal: 13, backgroundColor: '#161d21' },
  faqPillLight: { borderColor: '#b9c7cd', backgroundColor: '#fff' },
  faqPillText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  faqPillAccent: { color: '#299cf5', fontSize: 12, fontWeight: '900' },
  faqEmpty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#40505a', borderRadius: 18, padding: 24, backgroundColor: '#171d21' },
  faqEmptyIcon: { color: '#299cf5', fontSize: 28 },
  faqEmptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  faqEmptyText: { color: '#9aa8af', fontSize: 12, textAlign: 'center' },
  faqGuide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 18, borderWidth: 1, borderColor: '#285d82', borderRadius: 17, padding: 13, backgroundColor: '#102334' },
  faqGuideLight: { backgroundColor: '#e9f4fd' },
  faqGuideIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#183c5c' },
  faqGuideIconText: { color: '#299cf5', fontSize: 22 },
  faqGuideCopy: { minWidth: 0, flex: 1 },
  faqGuideTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  faqGuideDetail: { marginTop: 3, color: '#aab7be', fontSize: 11, lineHeight: 15 },
  faqGuideButton: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#299cf5' },
  faqGuideButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  aboutBody: { maxWidth: 860, width: '100%', alignSelf: 'center', overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: '#344149', borderRadius: 18, backgroundColor: '#11171b' },
  groupShellLight: { borderColor: '#9bb8b1', backgroundColor: '#f8fff9' },
  aboutStory: { alignItems: 'center', gap: 18, borderBottomWidth: 1, borderBottomColor: '#344149', paddingHorizontal: 12, paddingVertical: 20, backgroundColor: '#171d21' },
  aboutStoryLight: { borderBottomColor: '#9bb8b1', backgroundColor: '#eef6f1' },
  aboutStoryLogo: { width: '86%', height: 126, resizeMode: 'contain' },
  aboutStoryCopy: { width: '100%', gap: 7 },
  aboutParagraph: { marginTop: 7, fontSize: 13, lineHeight: 21 },
  aboutHeading: { marginTop: 4, color: '#fff', fontSize: 21, lineHeight: 25, fontWeight: '900' },
  aboutGroup: { gap: 11, borderBottomWidth: 1, borderBottomColor: '#344149', padding: 17 },
  aboutCards: { gap: 10 },
  aboutCard: { gap: 7, borderWidth: 1, borderColor: '#344149', borderRadius: 16, padding: 14, backgroundColor: '#171d21' },
  aboutCardIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#153653' },
  blueIconTileLight: { backgroundColor: '#e1f1fb' },
  aboutCardIconText: { color: '#299cf5', fontSize: 19, fontWeight: '900' },
  aboutCardTitle: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  aboutCardText: { flex: 1, color: '#aebac1', fontSize: 12, lineHeight: 18 },
  aboutLinks: { gap: 9 },
  aboutLink: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#344149', borderRadius: 15, padding: 12, backgroundColor: '#171d21' },
  aboutLinkIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#153653' },
  aboutLinkIconText: { color: '#299cf5', fontSize: 18, fontWeight: '900' },
  aboutLinkCopy: { minWidth: 0, flex: 1, gap: 3 },
  aboutLinkTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  aboutLinkDetail: { color: '#aebac1', fontSize: 10.5, lineHeight: 15 },
  aboutLinkArrow: { color: '#aebac1', fontSize: 22 },
  aboutCallout: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, margin: 17, borderWidth: 1, borderColor: '#285d82', borderRadius: 17, padding: 14, backgroundColor: '#102334' },
  aboutCalloutLight: { backgroundColor: '#e8f4fd' },
  aboutCalloutIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#153653' },
  aboutCalloutIconText: { color: '#299cf5', fontSize: 19, fontWeight: '900' },
  aboutCalloutCopy: { minWidth: 0, flex: 1, gap: 5 },
  aboutCta: { gap: 14, borderTopWidth: 1, borderTopColor: '#344149', padding: 17, backgroundColor: '#151e26' },
  aboutCtaLight: { backgroundColor: '#edf6fc' },
  aboutCtaCopy: { gap: 5 },
  aboutCtaActions: { gap: 8 },
  aboutPrimaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#299cf5' },
  aboutPrimaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  aboutSecondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4a5962', borderRadius: 12, backgroundColor: '#20282d' },
  aboutSecondaryButtonLight: { borderColor: '#b5c4cb', backgroundColor: '#fff' },
  aboutSecondaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  helpDirectory: { maxWidth: 860, width: '100%', alignSelf: 'center', gap: 18, marginTop: 16, borderWidth: 1, borderColor: '#344149', borderRadius: 18, paddingHorizontal: 13, paddingTop: 18, paddingBottom: 13, backgroundColor: '#11171b' },
  helpGroup: { gap: 11, borderBottomWidth: 1, borderBottomColor: '#344149', paddingBottom: 18 },
  helpGroupHeader: { alignItems: 'center', gap: 4, paddingHorizontal: 5 },
  helpGroupTitle: { color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  helpGroupDetail: { color: '#aebac1', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  helpLinks: { gap: 9 },
  helpLink: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#344149', borderRadius: 15, padding: 12, backgroundColor: '#171d21' },
  helpLinkIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#153653' },
  helpLinkIconText: { color: '#299cf5', fontSize: 20, fontWeight: '900' },
  helpLinkCopy: { minWidth: 0, flex: 1, gap: 4 },
  helpLinkTitle: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  helpLinkDetail: { color: '#aebac1', fontSize: 11.5, lineHeight: 16 },
  safetyBody: { maxWidth: 860, width: '100%', alignSelf: 'center', overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: '#344149', borderRadius: 18, backgroundColor: '#11171b' },
  safetyImportant: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, margin: 17, borderWidth: 1, borderColor: '#7d6130', borderRadius: 17, padding: 14, backgroundColor: '#2a2112' },
  safetyImportantLight: { borderColor: '#c9a45d', backgroundColor: '#fff7e4' },
  safetyImportantIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#49381a' },
  safetyImportantIconLight: { backgroundColor: '#f9e8bd' },
  safetyImportantIconText: { color: '#f4bb55', fontSize: 19, fontWeight: '900' },
  safetyImportantIconTextLight: { color: '#765800' },
  safetyCards: { gap: 10 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: 1, borderColor: '#344149', borderRadius: 16, padding: 13, backgroundColor: '#171d21' },
  safetyCardCopy: { minWidth: 0, flex: 1, gap: 5 },
  safetyBullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  safetyBulletMark: { color: '#299cf5', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  safetyBoundaries: { gap: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#344149', padding: 17, backgroundColor: '#171d21' },
  safetyBoundariesLight: { backgroundColor: '#f7fafb' },
  safetyBoundaryCard: { gap: 7, borderWidth: 1, borderColor: '#344149', borderRadius: 16, padding: 14, backgroundColor: '#11171b' },
  textLight: { color: '#132229' }, mutedLight: { color: '#53666f' },
});
