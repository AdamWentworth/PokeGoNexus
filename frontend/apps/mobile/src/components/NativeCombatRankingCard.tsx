import { memo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MaxRankingEntry } from '@pokemongonexus/app-core/max-battle-model';
import type { NativeCombatEntry } from '../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = { assetBaseUrl: string; entry: NativeCombatEntry; metricLabel: string; rank: number; onPress?: () => void };
const uri = (base: string, value: string | null) => { if (!value) return undefined; try { return new URL(value, base).toString(); } catch { return undefined; } };
const whole = (value: number) => Math.round(value).toLocaleString();
const decimal = (value: number, digits = 1) => value.toFixed(digits).replace(/\.0+$/, '');
const titleCase = (value: string) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const moveSummary = (entry: MaxRankingEntry) => {
  if (entry.role === 'tank') {
    return entry.maxGuardLevel > 0
      ? { icon: null, label: `Max Guard L${entry.maxGuardLevel} · ${entry.maxGuardHp} shield HP` }
      : { icon: null, label: 'Max Guard locked' };
  }
  if (entry.role === 'healing') {
    return { icon: null, label: `Max Spirit L${entry.maxSpiritLevel} · ${Math.round(entry.maxSpiritRate * 100)}% HP` };
  }
  return {
    icon: `/images/types/${entry.maxMoveType}.png`,
    label: entry.maxForm === 'special' || entry.maxForm === 'gigantamax'
      ? entry.maxMoveName
      : `Max Move · ${titleCase(entry.maxMoveType)}`,
  };
};

const roleMetrics = (entry: MaxRankingEntry) => {
  if (entry.role === 'tank') {
    return entry.bossBenchmark
      ? [
        ['Max cycles', decimal(entry.bossBenchmark.meterCyclesSurvived)],
        ['Next Max', `${decimal(entry.bossBenchmark.meterCycleSeconds)}s`],
        ['With Guard', `${decimal(entry.bossBenchmark.guardedMeterCyclesSurvived)} cycles`],
      ]
      : [
        ['Effective bulk', whole(entry.effectiveBulk)],
        ['HP', entry.hp.toLocaleString()],
        ['Defense', whole(entry.defense)],
      ];
  }
  if (entry.role === 'healing') {
    return [
      [`Spirit L${entry.maxSpiritLevel} / ally`, `${entry.healPerAlly} HP`],
      ['All 4 active', `${entry.teamHeal} HP`],
      entry.bossBenchmark
        ? ['Max cycles', decimal(entry.bossBenchmark.meterCyclesSurvived)]
        : ['Incoming damage', `${decimal(entry.incomingMultiplier, 3)}x`],
    ];
  }
  return entry.bossBenchmark
    ? [
      ['Max hit', `${entry.bossBenchmark.maxHitDamage} HP`],
      ['Effectiveness', `${decimal(entry.outgoingMultiplier, 3)}x`],
      ['Attack', whole(entry.attack)],
    ]
    : [
      ['Attack index', whole(entry.attackIndex)],
      ['Max power', entry.maxMovePower.toLocaleString()],
      ['Attack', whole(entry.attack)],
    ];
};

export const NativeCombatRankingCard = memo(function NativeCombatRankingCard({ assetBaseUrl, entry, metricLabel, rank, onPress }: Props) {
  const light = useNativeColorScheme() === 'light';
  const max = entry.maxRanking;
  const summary = max ? moveSummary(max) : null;
  const metrics = max ? roleMetrics(max) : [];
  const fastType = max?.fastMove.type_name?.trim().toLocaleLowerCase()
    || max?.fastMove.type?.trim().toLocaleLowerCase()
    || 'normal';
  const nickname = max?.variant.instanceData?.nickname?.trim();
  return (
    <Pressable
      accessibilityLabel={`Rank ${rank}, ${entry.name}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, light && styles.cardLight, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={[styles.rank, rank <= 3 && styles.rankTop]}><Text style={styles.rankText}>{rank}</Text></View>
        <View style={styles.stage}>
          {entry.imageUri ? <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: uri(assetBaseUrl, entry.imageUri) }} style={styles.image} transition={0} /> : null}
          {entry.maxKind ? <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: uri(assetBaseUrl, `/images/${entry.maxKind}.png`) }} style={styles.maxIcon} transition={0} /> : null}
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={[styles.name, light && styles.textLight]}>{entry.name}</Text>
          {max?.personalized ? (
            <View style={styles.ownedDetails}>
              {nickname ? <Text numberOfLines={1} style={[styles.nickname, light && styles.accentLight]}>{nickname}</Text> : null}
              <Text numberOfLines={1} style={[styles.ownedMeta, light && styles.mutedLight]}>
                CP {whole(max.cp)} · Level {max.levelLabel}{max.ivPercent == null ? '' : ` · ${max.ivPercent}% IV`}
              </Text>
            </View>
          ) : null}
          {summary ? (
            <View style={[styles.maxMove, light && styles.maxMoveLight]}>
              {summary.icon ? <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: uri(assetBaseUrl, summary.icon) }} style={styles.moveTypeIcon} transition={0} /> : null}
              <Text numberOfLines={1} style={[styles.maxMoveText, light && styles.textLight]}>{summary.label}</Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={[styles.moves, light && styles.mutedLight]}>{entry.fastMove?.name ?? 'Fast Move'} · {entry.chargedMove?.name ?? 'Charged Move'}</Text>
          )}
          {max ? (
            <View style={styles.fastMove}>
              <Text style={[styles.fastLabel, light && styles.mutedLight]}>FAST</Text>
              <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: uri(assetBaseUrl, `/images/types/${fastType}.png`) }} style={styles.fastIcon} transition={0} />
              <Text numberOfLines={1} style={[styles.fastName, light && styles.textLight]}>{max.fastMove.name}</Text>
              <Text style={[styles.fastSeconds, light && styles.mutedLight]}>{decimal(max.meterSeconds)}s</Text>
            </View>
          ) : <Text style={[styles.metric, light && styles.accentLight]}>{metricLabel}: {entry.score.toFixed(1)}</Text>}
        </View>
        {!max ? <Text style={[styles.cp, light && styles.blueLight]}>CP {entry.cp.toLocaleString()}</Text> : null}
      </View>
      {max ? (
        <View style={styles.metrics}>
          {metrics.map(([label, value], index) => (
            <View key={label} style={[styles.metricCell, light && styles.metricCellLight]}>
              <Text numberOfLines={1} style={[styles.metricCellLabel, light && styles.mutedLight]}>{label}</Text>
              <Text numberOfLines={1} style={[styles.metricCellValue, light && styles.textLight, index === 0 && styles.primaryMetric, light && index === 0 && styles.accentLight]}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}, (previous, next) => (
  previous.assetBaseUrl === next.assetBaseUrl
  && previous.entry === next.entry
  && previous.metricLabel === next.metricLabel
  && previous.rank === next.rank
  && Boolean(previous.onPress) === Boolean(next.onPress)
));
const styles = StyleSheet.create({
  card: { minHeight: 100, gap: 6, marginBottom: 7, borderWidth: 1, borderColor: '#34434b', borderRadius: 8, padding: 7, backgroundColor: '#1a2021' },
  cardLight: { borderColor: '#c1cdd3', backgroundColor: '#fff' },
  pressed: { opacity: .72 },
  topRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rank: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#29343a' },
  rankTop: { backgroundColor: '#c09119' },
  rankText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  stage: { width: 58, height: 60, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  maxIcon: { position: 'absolute', right: -1, top: -1, width: 19, height: 19 },
  copy: { minWidth: 0, flex: 1, gap: 2 },
  name: { color: '#fff', fontSize: 14, lineHeight: 16, fontWeight: '900' },
  textLight: { color: '#14232a' },
  mutedLight: { color: '#64757d' },
  ownedDetails: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 5 },
  nickname: { color: '#66ddcf', fontSize: 9, fontWeight: '900' },
  ownedMeta: { color: '#9aa8af', fontSize: 8.5, fontWeight: '800' },
  maxMove: { minWidth: 0, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2e6c68', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#13312e' },
  maxMoveLight: { borderColor: '#8cbfba', backgroundColor: '#e5f6f3' },
  maxMoveText: { minWidth: 0, flexShrink: 1, color: '#c8f4f3', fontSize: 9, fontWeight: '900' },
  moveTypeIcon: { width: 14, height: 14 },
  fastMove: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 3 },
  fastLabel: { color: '#7fa3a6', fontSize: 7, fontWeight: '900' },
  fastIcon: { width: 12, height: 12 },
  fastName: { minWidth: 0, flex: 1, color: '#d8e9e9', fontSize: 9, fontWeight: '900' },
  fastSeconds: { color: '#7fa3a6', fontSize: 8, fontWeight: '900' },
  moves: { marginTop: 3, color: '#9aa8af', fontSize: 9.5 },
  metric: { marginTop: 6, color: '#39caa0', fontSize: 11, fontWeight: '900' },
  accentLight: { color: '#08766b' },
  cp: { alignSelf: 'flex-start', color: '#299cf5', fontSize: 9, fontWeight: '900' },
  blueLight: { color: '#005bb5' },
  metrics: { flexDirection: 'row', gap: 4 },
  metricCell: { minWidth: 0, minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#293235', borderRadius: 6, paddingHorizontal: 3, backgroundColor: '#202728' },
  metricCellLight: { borderColor: '#d7e0e2', backgroundColor: '#f7fafb' },
  metricCellLabel: { color: '#89a9ac', fontSize: 7, fontWeight: '900', textTransform: 'uppercase' },
  metricCellValue: { marginTop: 2, color: '#f1f7f7', fontSize: 10, fontWeight: '900' },
  primaryMetric: { color: '#68ded1' },
});
