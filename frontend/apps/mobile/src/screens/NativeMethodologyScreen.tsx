import { useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  NativeMethodologyItem,
  NativeMethodologyPage,
  NativeMethodologySection,
} from '../features/tools/nativeMethodologyContent';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  assetBaseUrl: string;
  content: NativeMethodologyPage;
  onBack: () => void;
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const DetailItems = ({
  items,
  light,
  pvp,
}: {
  items: NativeMethodologyItem[];
  light: boolean;
  pvp: boolean;
}) => (
  <View style={styles.detailList}>
    {items.map((item, index) => (
      <View key={item.title} style={[styles.detailItem, light && styles.dividerLight]}>
        <Text style={[
          styles.detailIndex,
          item.marker && styles.detailMarker,
          pvp && styles.detailIndexPvp,
          light && styles.detailIndexLight,
          light && pvp && styles.detailIndexPvpLight,
        ]}>
          {item.marker ?? String(index + 1).padStart(2, '0')}
        </Text>
        <View style={styles.detailCopy}>
          <Text style={[styles.detailTitle, light && styles.textLight]}>{item.title}</Text>
          {item.summary ? <Text style={[styles.detailSummary, light && styles.textLight]}>{item.summary}</Text> : null}
          <Text style={[styles.body, light && styles.bodyLight]}>{item.detail}</Text>
        </View>
      </View>
    ))}
  </View>
);

const StepItems = ({
  items,
  light,
}: {
  items: NativeMethodologyItem[];
  light: boolean;
}) => (
  <View style={styles.stepList}>
    {items.map((item, index) => (
      <View key={item.title} style={[styles.step, light && styles.dividerLight]}>
        <View style={styles.stepHeading}>
          <Text style={styles.stepIndex}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={[styles.stepTitle, light && styles.textLight]}>{item.title}</Text>
        </View>
        <Text style={[styles.stepBody, light && styles.bodyLight]}>{item.detail}</Text>
      </View>
    ))}
  </View>
);

const Section = ({
  index,
  light,
  onLayout,
  pageKind,
  section,
}: {
  index: number;
  light: boolean;
  onLayout: (y: number) => void;
  pageKind: NativeMethodologyPage['kind'];
  section: NativeMethodologySection;
}) => {
  const pvp = pageKind === 'pvp';
  return (
    <View
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      style={[styles.section, light && styles.sectionLight]}
      testID={`methodology-section-${index}`}
    >
      <Text style={[styles.eyebrow, pvp && styles.eyebrowPvp, light && styles.eyebrowLight]}>{section.eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.sectionTitle, light && styles.textLight]}>{section.title}</Text>

      {section.paragraphs?.map((paragraph) => (
        <Text key={paragraph} style={[styles.body, styles.sectionParagraph, light && styles.bodyLight]}>{paragraph}</Text>
      ))}

      {section.items ? <DetailItems items={section.items} light={light} pvp={pvp} /> : null}

      {section.metrics ? (
        <View style={styles.metricGrid}>
          {section.metrics.map((metric) => (
            <View key={metric.name} style={[styles.metric, light && styles.metricLight]}>
              <Text style={[styles.metricName, pvp && styles.metricNamePvp]}>{metric.name}</Text>
              <Text style={[styles.metricDescription, light && styles.bodyLight]}>{metric.description}</Text>
              <Text style={styles.metricUse}>{metric.use}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.steps ? <StepItems items={section.steps} light={light} /> : null}

      {section.callout ? (
        <View style={[styles.callout, light && styles.calloutLight]}>
          <Text style={styles.calloutGlyph}>ϟ</Text>
          <Text style={[styles.calloutText, light && styles.bodyLight]}>{section.callout}</Text>
        </View>
      ) : null}

      {section.facts ? (
        <View style={styles.factGrid}>
          {section.facts.map((fact) => (
            <View key={fact.label} style={[styles.fact, light && styles.metricLight]}>
              <Text style={[styles.factValue, pvp && styles.factValuePvp]}>{fact.value}</Text>
              <Text style={[styles.factLabel, light && styles.bodyLight]}>{fact.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.formulas?.map((formula) => (
        <View key={formula} style={[styles.formula, pvp && styles.formulaPvp, light && styles.formulaLight]}>
          <Text style={[styles.formulaText, light && styles.textLight]}>{formula}</Text>
        </View>
      ))}

      {section.bullets ? (
        <View style={styles.bulletList}>
          {section.bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={[styles.bulletDot, pvp && styles.bulletDotPvp]} />
              <Text style={[styles.bulletText, light && styles.bodyLight]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.validation ? (
        <View style={[styles.validation, pvp && styles.validationPvp, light && styles.validationLight]}>
          <Text style={[styles.validationText, light && styles.textLight]}>{section.validation}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const NativeMethodologyScreen = ({ assetBaseUrl, content, onBack }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const pvp = content.kind === 'pvp';
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<number, number>>({});

  const scrollToSection = (index: number) => {
    const y = sectionOffsets.current[index];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, y - 10) });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: 9 + insets.top, paddingBottom: 104 + insets.bottom }]}
      ref={scrollRef}
      style={[styles.root, light && styles.rootLight]}
      testID="native-methodology-screen"
    >
      <View style={[styles.hero, pvp && styles.heroPvp, light && styles.heroLight]}>
        <View style={styles.heroMain}>
          <View style={[styles.iconShell, light && styles.iconShellLight]}>
            <Image fadeDuration={0}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={{ uri: toAssetUrl(assetBaseUrl, content.iconPath) }}
              style={styles.heroIcon}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, pvp && styles.eyebrowPvp, light && styles.eyebrowLight]}>{content.eyebrow}</Text>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>{content.title}</Text>
            <Text style={[styles.lead, light && styles.bodyLight]}>{content.description}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onBack} style={[styles.back, pvp && styles.backPvp, light && styles.backLight]}>
          <Text style={[styles.backArrow, light && styles.backArrowLight]}>←</Text>
          <Text style={[styles.backLabel, light && styles.backArrowLight]}>{content.returnLabel}</Text>
        </Pressable>
      </View>

      <View accessibilityLabel="Methodology sections" style={[styles.navigation, light && styles.navigationLight]}>
        {content.navigation.map((label, index) => (
          <Pressable
            accessibilityRole="button"
            key={label}
            onPress={() => scrollToSection(index)}
            style={({ pressed }) => [styles.navigationItem, pressed && styles.navigationItemPressed]}
          >
            <Text numberOfLines={2} style={[styles.navigationLabel, light && styles.textLight]}>{label.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sections}>
        {content.sections.map((section, index) => (
          <Section
            index={index}
            key={section.title}
            light={light}
            onLayout={(y) => { sectionOffsets.current[index] = y; }}
            pageKind={content.kind}
            section={section}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={onBack} style={[styles.returnButton, pvp && styles.returnButtonPvp, light && styles.returnButtonLight]}>
          <Text style={[styles.returnButtonText, light && styles.returnButtonTextPvp]}>←  Return to {content.returnLabel.toLowerCase()}</Text>
        </Pressable>
        <Text style={[styles.footerText, light && styles.bodyLight]}>{content.footer}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1012' },
  rootLight: { backgroundColor: '#f8fff9' },
  content: { paddingHorizontal: 9, paddingTop: 9, paddingBottom: 104 },
  textLight: { color: '#102a32' },
  bodyLight: { color: '#385a63' },
  hero: { gap: 14, padding: 15, paddingTop: 11, paddingRight: 10, paddingLeft: 18, borderWidth: 1, borderColor: 'rgba(102,220,220,0.28)', borderRadius: 16, backgroundColor: '#121a1e' },
  heroPvp: { borderColor: 'rgba(114,232,220,0.28)' },
  heroLight: { borderColor: 'rgba(21,139,154,0.24)', backgroundColor: 'rgba(255,255,255,0.82)' },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconShell: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#34474f', borderRadius: 21, backgroundColor: '#1b2529' },
  iconShellLight: { borderColor: '#bfd2d6', backgroundColor: '#f8ffff' },
  heroIcon: { width: 36, height: 36 },
  headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: '#75e6df', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  eyebrowPvp: { color: '#72e8dc' },
  eyebrowLight: { color: '#087d91' },
  title: { marginTop: 3, color: '#f4ffff', fontSize: 23, lineHeight: 26, fontWeight: '900' },
  lead: { marginTop: 1, color: '#b1c4c9', fontSize: 15, lineHeight: 21 },
  back: { minHeight: 42, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(117,230,223,0.35)', borderRadius: 21, backgroundColor: 'rgba(117,230,223,0.07)' },
  backPvp: { borderColor: 'rgba(114,232,220,0.36)', backgroundColor: 'rgba(66,213,194,0.08)' },
  backLight: { backgroundColor: 'rgba(255,255,255,0.7)' },
  backArrow: { color: '#75e6df', fontSize: 18, fontWeight: '900' },
  backArrowLight: { color: '#087d91' },
  backArrowPvp: { color: '#087d91' },
  backLabel: { color: '#75e6df', fontSize: 11, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 10, padding: 5, borderWidth: 1, borderColor: 'rgba(102,220,220,0.18)', borderRadius: 13, backgroundColor: 'rgba(8,15,18,0.92)' },
  navigationLight: { borderColor: 'rgba(21,139,154,0.18)', backgroundColor: 'rgba(255,255,255,0.75)' },
  navigationItem: { width: '32.8%', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 8 },
  navigationItemPressed: { backgroundColor: 'rgba(117,230,223,0.12)' },
  navigationIndex: { color: '#ffbd4a', fontSize: 8, fontWeight: '900' },
  navigationIndexPvp: { color: '#ed79aa' },
  navigationLabel: { color: '#d6e5e8', fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  sections: { marginTop: 8 },
  section: { paddingVertical: 40, paddingHorizontal: 3, borderBottomWidth: 1, borderBottomColor: 'rgba(102,220,220,0.18)' },
  sectionLight: { borderBottomColor: 'rgba(21,139,154,0.18)' },
  sectionTitle: { maxWidth: 340, marginTop: 7, marginBottom: 13, color: '#f3ffff', fontSize: 27, lineHeight: 29, fontWeight: '900' },
  sectionParagraph: { marginBottom: 10 },
  body: { color: '#b6c9cd', fontSize: 17, lineHeight: 25 },
  detailList: { marginTop: 12 },
  detailItem: { flexDirection: 'row', gap: 13, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.11)' },
  dividerLight: { borderTopColor: 'rgba(16,42,50,0.12)' },
  detailIndex: { width: 27, color: '#ffbd4a', fontSize: 11, fontWeight: '900' },
  detailMarker: { fontSize: 20, lineHeight: 23 },
  detailIndexPvp: { color: '#ed79aa' },
  detailIndexLight: { color: '#7a5700' },
  detailIndexPvpLight: { color: '#a3005b' },
  detailCopy: { minWidth: 0, flex: 1 },
  detailTitle: { color: '#f2ffff', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  detailSummary: { marginTop: 3, color: '#e4f4f5', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  metric: { width: '48.9%', minHeight: 150, padding: 11, borderWidth: 1, borderColor: 'rgba(102,220,220,0.18)', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.04)' },
  metricLight: { borderColor: 'rgba(21,139,154,0.18)', backgroundColor: 'rgba(255,255,255,0.7)' },
  metricName: { color: '#75e6df', fontSize: 18, fontWeight: '900' },
  metricNamePvp: { color: '#72e8dc' },
  metricDescription: { marginTop: 7, color: '#b6c9cd', fontSize: 11, lineHeight: 16 },
  metricUse: { marginTop: 'auto', color: '#d49c43', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  stepList: { marginTop: 10 },
  step: { paddingVertical: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.11)' },
  stepHeading: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stepIndex: { color: '#54a9ef', fontSize: 11, lineHeight: 18, fontWeight: '900' },
  stepTitle: { minWidth: 0, flex: 1, color: '#efffff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  stepBody: { marginTop: 6, color: '#b6c9cd', fontSize: 13, lineHeight: 20 },
  callout: { flexDirection: 'row', gap: 10, marginVertical: 13, padding: 13, borderWidth: 1, borderColor: 'rgba(84,169,239,0.3)', borderRadius: 9, backgroundColor: 'rgba(84,169,239,0.08)' },
  calloutLight: { borderColor: 'rgba(34,122,187,0.24)', backgroundColor: 'rgba(84,169,239,0.11)' },
  calloutGlyph: { color: '#69b9ff', fontSize: 20, fontWeight: '900' },
  calloutText: { minWidth: 0, flex: 1, color: '#dcebed', fontSize: 12, lineHeight: 19 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  fact: { width: '48.9%', minHeight: 76, justifyContent: 'center', padding: 11, borderWidth: 1, borderColor: 'rgba(115,204,204,0.2)', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.035)' },
  factValue: { color: '#75e6df', fontSize: 20, fontWeight: '900' },
  factValuePvp: { color: '#72e8dc' },
  factLabel: { marginTop: 3, color: '#adc1c5', fontSize: 10, lineHeight: 14 },
  formula: { overflow: 'hidden', marginTop: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#75e6df', backgroundColor: 'rgba(117,230,223,0.07)' },
  formulaPvp: { borderLeftColor: '#72e8dc', backgroundColor: 'rgba(66,213,194,0.07)' },
  formulaLight: { backgroundColor: 'rgba(54,202,199,0.12)' },
  formulaText: { color: '#efffff', fontSize: 11, lineHeight: 17, fontFamily: 'monospace' },
  bulletList: { gap: 11, marginTop: 8 },
  bulletRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  bulletDot: { width: 7, height: 7, marginTop: 7, borderRadius: 4, backgroundColor: '#75e6df' },
  bulletDotPvp: { backgroundColor: '#ed79aa' },
  bulletText: { minWidth: 0, flex: 1, color: '#b6c9cd', fontSize: 13, lineHeight: 20 },
  validation: { marginTop: 20, padding: 13, borderWidth: 1, borderColor: 'rgba(255,189,74,0.25)', borderRadius: 9, backgroundColor: 'rgba(255,189,74,0.07)' },
  validationPvp: { borderColor: 'rgba(66,213,194,0.27)', backgroundColor: 'rgba(66,213,194,0.07)' },
  validationLight: { backgroundColor: 'rgba(255,255,255,0.62)' },
  validationText: { color: '#ffefd2', fontSize: 12, lineHeight: 19 },
  footer: { gap: 15, paddingTop: 24 },
  returnButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(117,230,223,0.32)', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)' },
  returnButtonPvp: { borderColor: 'rgba(114,232,220,0.36)' },
  returnButtonLight: { backgroundColor: 'rgba(255,255,255,0.72)' },
  returnButtonText: { color: '#75e6df', fontSize: 11, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  returnButtonTextPvp: { color: '#087d91' },
  footerText: { color: '#789397', fontSize: 10, lineHeight: 15 },
});
