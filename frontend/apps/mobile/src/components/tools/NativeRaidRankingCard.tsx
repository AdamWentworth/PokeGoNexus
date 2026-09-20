import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { formatSeconds } from '@pokemongonexus/app-core/raid-model';
import type {
  NativeCombatEntry,
  NativeRaidAttackerLevel,
} from '../../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';

type Props = {
  assetBaseUrl: string;
  attackerLevel?: NativeRaidAttackerLevel;
  entry: NativeCombatEntry;
  expanded: boolean;
  onToggle: () => void;
  primaryMetric?: 'cp' | 'dps' | 'edps' | 'er' | 'tdo';
  rank: number;
};

const formatOutcomeCount = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const formatOutcomeLabel = (value: number, singular: string) => `${formatOutcomeCount(value)} ${value === 1 ? singular : singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`}`;

const uri = (base: string, value: string | null) => {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
};

export const NativeRaidRankingCard = ({ assetBaseUrl, attackerLevel = '50.0', entry, expanded, onToggle, primaryMetric = 'edps', rank }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const compact = useWindowDimensions().width <= 520;
  const counter = entry.counter ?? null;
  const rankingMetric = {
    cp: { label: 'CP', value: entry.cp.toLocaleString() },
    dps: { label: 'DPS', value: entry.dps.toFixed(1) },
    edps: { label: 'eDPS', value: entry.score.toFixed(1) },
    er: { label: 'ER', value: entry.er.toFixed(2) },
    tdo: { label: 'TDO', value: Math.round(entry.tdo).toLocaleString() },
  }[primaryMetric];
  const primaryLabel = rankingMetric.label;
  const primaryValue = rankingMetric.value;
  const detailRows = [
    ['eDPS', entry.score.toFixed(1)],
    ['DPS', entry.dps.toFixed(1)],
    ['TDO', Math.round(entry.tdo).toLocaleString()],
    ['ER', entry.er.toFixed(2)],
    ['CP', entry.cp.toLocaleString()],
  ];
  if (counter) {
    const distribution = entry.raidCounterScore?.simulationDistribution;
    const clearSeconds = distribution?.timeToWinSeconds.p50 ?? counter.soloTimeSeconds;
    const faints = distribution?.faints.p50 ?? counter.faints;
    const relobbies = distribution?.relobbies.p50 ?? counter.relobbies;
    const clearTimeDetail = distribution
      ? `Expected clear time ${formatSeconds(clearSeconds)}. Likely range ${formatSeconds(distribution.timeToWinSeconds.p10)} to ${formatSeconds(distribution.timeToWinSeconds.p90)}. Based on ${distribution.sampleCount} modeled outcomes.`
      : `Expected clear time ${formatSeconds(clearSeconds)}.`;
    const durabilityDetail = distribution
      ? `Expected ${formatOutcomeLabel(faints, 'faint')} and ${formatOutcomeLabel(relobbies, 'relobby')}. High estimate ${formatOutcomeLabel(distribution.faints.p90, 'faint')} and ${formatOutcomeLabel(distribution.relobbies.p90, 'relobby')}. Based on ${distribution.sampleCount} modeled outcomes.`
      : `Expected ${formatOutcomeLabel(faints, 'faint')} and ${formatOutcomeLabel(relobbies, 'relobby')}.`;
    return (
      <View accessibilityLabel={`Rank ${rank}, ${entry.name} raid counter`} style={[styles.counterCard, light && styles.cardLight]}>
        <View style={[styles.rank, rank === 1 && styles.rankGold, rank === 2 && styles.rankSilver, rank === 3 && styles.rankBronze]}><Text style={[styles.rankText, rank <= 3 && styles.rankTopText]}>{rank}</Text></View>
        <Image fadeDuration={0} resizeMode="contain" source={{ uri: uri(assetBaseUrl, entry.imageUri) }} style={styles.counterImage} />
        <View style={styles.counterMain}>
          <Text numberOfLines={1} style={[styles.counterName, light && styles.textLight]}>{entry.name}</Text>
          <View style={styles.counterMoves}>{[entry.fastMove, entry.chargedMove].map((move, index) => <View accessibilityLabel={`${index === 0 ? 'Fast' : 'Charged'} move: ${move?.name ?? 'Unknown'}, ${move?.type_name || move?.type || 'unknown'} type`} key={`${move?.move_id ?? 'move'}-${index}`} style={styles.counterMove}>{(move?.type_name || move?.type) ? <Image fadeDuration={0} accessibilityElementsHidden source={{ uri: uri(assetBaseUrl, `/images/types/${(move.type_name || move.type).trim().toLocaleLowerCase()}.png`) }} style={styles.moveType} /> : null}<Text numberOfLines={1} style={[styles.counterMoveName, light && styles.textLight]}>{move?.name ?? '—'}</Text></View>)}</View>
          <Text numberOfLines={1} style={[styles.counterMeta, light && styles.mutedLight]}>CP {entry.cp.toLocaleString()}{entry.rosterDetail ? ` · ${entry.rosterDetail}` : ` at level ${attackerLevel.replace('.0', '')}`}</Text>
        </View>
        <View style={styles.counterStats}>
          <View style={styles.counterStat}><Text style={[styles.statLabel, light && styles.mutedLight]}>DPS</Text><Text style={[styles.counterStatValue, light && styles.textLight]}>{entry.score.toFixed(1)} DPS</Text></View>
          <View style={styles.counterStat}><Text style={[styles.statLabel, light && styles.mutedLight]}>TRAINERS</Text><Text style={[styles.counterStatValue, light && styles.textLight]}>{counter.trainersNeeded} trainer{counter.trainersNeeded === 1 ? '' : 's'}</Text></View>
          <View accessibilityLabel={clearTimeDetail} style={styles.counterStat}><Text style={[styles.statLabel, light && styles.mutedLight]}>CLEAR</Text><Text style={[styles.counterStatValue, light && styles.textLight]}>{formatSeconds(clearSeconds)}</Text></View>
          <View accessibilityLabel={durabilityDetail} style={styles.counterStat}><Text style={[styles.statLabel, light && styles.mutedLight]}>FAINTS</Text><Text style={[styles.counterStatValue, light && styles.textLight]}>{formatOutcomeLabel(faints, 'faint')}</Text>{relobbies > 0 ? <Text style={[styles.counterRelobbies, light && styles.mutedLight]}>{formatOutcomeLabel(relobbies, 'relobby')}</Text> : null}</View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.card, light && styles.cardLight]}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} all raid stats for ${entry.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={[styles.summary, compact && styles.summaryCompact]}
      >
        <View style={[styles.rank, compact && styles.rankCompact, rank === 1 && styles.rankGold, rank === 2 && styles.rankSilver, rank === 3 && styles.rankBronze]}><Text style={[styles.rankText, rank <= 3 && styles.rankTopText]}>{rank}</Text></View>
        <Image fadeDuration={0} resizeMode="contain" source={{ uri: uri(assetBaseUrl, entry.imageUri) }} style={styles.image} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact, light && styles.textLight]}>{entry.name}</Text>
          <Text numberOfLines={1} style={[styles.types, compact && styles.typesCompact, light && styles.mutedLight]}>{entry.types.join(' / ') || 'Unknown type'}</Text>
          {entry.rosterDetail ? <Text numberOfLines={1} style={[styles.roster, compact && styles.rosterCompact, light && styles.accentLight]}>{entry.rosterDetail}</Text> : null}
        </View>
        <View style={[styles.primaryMetric, compact && styles.primaryMetricCompact]}>
          <Text style={[styles.metricLabel, light && styles.accentLight]}>{primaryLabel}</Text>
          <Text style={[styles.metricValue, light && styles.textLight]}>{primaryValue}</Text>
          <Text style={[styles.expandHint, light && styles.mutedLight]}>{expanded ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>
      <View style={[styles.summaryStrip, light && styles.summaryStripLight]}>
        <Text style={[styles.summaryMetricLabel, light && styles.accentLight]}>{primaryLabel}</Text>
        <Text style={[styles.summaryMetricValue, light && styles.textLight]}>{primaryValue}</Text>
        <Text style={[styles.summaryHint, light && styles.mutedLight]}>{expanded ? 'Hide extra stats' : 'Tap for all stats'}</Text>
        <Text style={[styles.summaryChevron, light && styles.mutedLight]}>{expanded ? '⌃' : '⌄'}</Text>
      </View>
      <View style={[styles.moves, light && styles.movesLight]}>
        {[entry.fastMove, entry.chargedMove].map((move, index) => (
          <View key={`${move?.move_id ?? 'move'}-${index}`} style={[styles.moveCell, (index === 0 ? entry.fastMatchesType : entry.chargedMatchesType) && styles.moveCellTypeMatch]}>
            {(move?.type_name || move?.type) ? (
              <Image fadeDuration={0}
                accessibilityElementsHidden
                source={{ uri: uri(assetBaseUrl, `/images/types/${(move.type_name || move.type).trim().toLocaleLowerCase()}.png`) }}
                style={styles.moveType}
              />
            ) : null}
            <Text numberOfLines={1} style={[styles.move, light && styles.textLight]}>{move?.name ?? (index === 0 ? 'Fast Move' : 'Charged Move')}</Text>
          </View>
        ))}
      </View>
      {expanded ? (
        <View style={[styles.details, light && styles.detailsLight]}>
          {detailRows.map(([label, value]) => (
            <View key={label} style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, light && styles.textLight]}>{value}</Text></View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  counterCard: { marginBottom: 7, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#334c4e', borderRadius: 12, padding: 8, backgroundColor: '#11191a' },
  counterImage: { width: 52, height: 52 },
  counterMain: { minWidth: 0, flex: 1 },
  counterName: { color: '#fff', fontSize: 14, fontWeight: '900' },
  counterMoves: { flexDirection: 'row', gap: 6, marginTop: 3 },
  counterMove: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 3 },
  counterMoveName: { maxWidth: 92, color: '#dce9e9', fontSize: 8.5, fontWeight: '800' },
  counterMeta: { marginTop: 3, color: '#9badad', fontSize: 8.5 },
  counterStats: { width: '100%', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#263b3c', paddingTop: 7 },
  counterStat: { minWidth: 0, flex: 1, gap: 1, alignItems: 'center' },
  counterStatValue: { color: '#fff', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  counterRelobbies: { color: '#9badad', fontSize: 7.5, textAlign: 'center' },
  card: { marginTop: 1, marginBottom: 7, overflow: 'hidden', borderWidth: 1, borderColor: '#334c4e', borderRadius: 12, paddingBottom: 8, backgroundColor: '#11191a' },
  cardLight: { borderColor: '#bccdcd', backgroundColor: '#fff' },
  summary: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 7 },
  summaryCompact: { minHeight: 67, paddingTop: 4 },
  rank: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#2a3738' },
  rankCompact: { width: 32, height: 32, borderRadius: 16 },
  rankGold: { backgroundColor: '#f3cf63' },
  rankSilver: { backgroundColor: '#d9e7ea' },
  rankBronze: { backgroundColor: '#d99156' },
  rankTopText: { color: '#16120a' },
  rankText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  image: { width: 57, height: 57 },
  copy: { minWidth: 0, flex: 1 },
  name: { color: '#fff', fontSize: 13, fontWeight: '900' },
  nameCompact: { fontSize: 16, lineHeight: 19 },
  types: { marginTop: 1, color: '#9badad', fontSize: 8.5, fontWeight: '800', textTransform: 'capitalize' },
  typesCompact: { fontSize: 10.5, lineHeight: 13 },
  roster: { marginTop: 3, color: '#5ed9cf', fontSize: 8.5, fontWeight: '800' },
  rosterCompact: { marginTop: 0, fontSize: 10, lineHeight: 13 },
  primaryMetric: { minWidth: 47, alignItems: 'flex-end' },
  primaryMetricCompact: { display: 'none' },
  metricLabel: { color: '#62ded5', fontSize: 7.5, fontWeight: '900' },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  trainers: { marginTop: 1, color: '#9badad', fontSize: 7.5, fontWeight: '800' },
  expandHint: { color: '#91a2a3', fontSize: 12 },
  summaryStrip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, marginHorizontal: 8, paddingHorizontal: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#263b3c', borderRadius: 7, backgroundColor: '#102223' },
  summaryStripLight: { borderColor: '#d6e1e1', backgroundColor: '#ffffff' },
  summaryMetricLabel: { color: '#62ded5', fontSize: 7.5, fontWeight: '900' },
  summaryMetricValue: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  summaryHint: { flex: 1, color: '#dce9e9', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  summaryChevron: { color: '#91a2a3', fontSize: 12 },
  moves: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 32, marginHorizontal: 8, borderTopWidth: 1, borderTopColor: '#263b3c' },
  movesLight: { borderTopColor: '#d6e1e1' },
  moveCell: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moveCellTypeMatch: { borderRadius: 7, backgroundColor: 'rgba(47,214,208,.13)' },
  move: { minWidth: 0, maxWidth: '72%', color: '#dce9e9', fontSize: 9.5, fontWeight: '800' },
  moveType: { width: 18, height: 18 },
  details: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: '#263b3c', padding: 9, backgroundColor: '#0d1415' },
  detailsLight: { borderTopColor: '#d6e1e1', backgroundColor: '#f2f7f7' },
  stat: { minWidth: 43 },
  statLabel: { color: '#829697', fontSize: 7, fontWeight: '900' },
  statValue: { color: '#fff', fontSize: 11, fontWeight: '900' },
  openButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#267f75' },
  openButtonText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#657879' },
  accentLight: { color: '#08766b' },
});
