import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RaidRosterSummary } from '@pokemongonexus/app-core/raid-roster';
import type { MaxRosterSummary } from '@pokemongonexus/app-core/max-roster';
import type { NativeRosterScope } from '../../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../NativeUiIcon';

type Props = {
  summary: RaidRosterSummary | MaxRosterSummary;
  scope: NativeRosterScope;
  signedIn: boolean;
  loading: boolean;
  onChange: (scope: NativeRosterScope) => void;
};

export const NativeRosterScopeControl = ({ summary, scope, signedIn, loading, onChange }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const raid = 'attackers' in summary;
  const details = loading ? `Loading your ${raid ? 'raid' : 'Max'} roster` : [
    raid
      ? `${summary.eligibleCount} raid-ready entries from ${summary.caughtCount} caught.`
      : `${summary.eligibleCount} Max-ready entries from ${summary.caughtCount} caught Max Pokémon.`,
    raid ? "Uses each copy's current level, IVs, CP, and recorded moves." : "Uses each copy's recorded level, IVs, Fast Move, and Max Move levels.",
    raid && summary.projectedFormCount > 0 ? `${summary.projectedFormCount} available fusion, crowned, or Mega form entries included.` : '',
    summary.incompleteEntryCount > 0 ? `${summary.incompleteEntryCount}${raid ? ' caught entries' : ''} need complete battle details before ranking.` : '',
    raid && summary.hiddenPowerEstimatedCount > 0 ? `${summary.hiddenPowerEstimatedCount} Hidden Power rolls use a marked type estimate.` : '',
    summary.unmappedCount > 0 ? `${summary.unmappedCount} could not be matched to the current catalog.` : '',
  ].filter(Boolean).join(' ');

  return (
    <View accessibilityLabel={raid ? 'Raid attacker roster' : 'Max Battle roster'} style={[styles.roster, light && styles.rosterLight]}>
      {(['catalog', 'owned'] as const).map((value) => {
        const selected = scope === value;
        const owned = value === 'owned';
        const label = owned ? 'MY POKÉMON' : 'ALL POKÉMON';
        const count = loading ? '…' : String(summary.eligibleCount);
        const color = selected ? '#071313' : light ? '#172124' : '#edf6f5';
        return (
          <Pressable
            accessibilityLabel={`${label}${owned && selected ? ` ${count}` : ''}`}
            accessibilityHint={owned ? signedIn ? details : 'Sign in to rank your caught Pokémon' : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: owned && !signedIn }}
            disabled={owned && !signedIn}
            key={value}
            onPress={() => onChange(value)}
            style={[styles.button, light && styles.buttonLight, selected && styles.selected, owned && !signedIn && styles.disabled]}
          >
            {selected ? <LinearGradient colors={['#42d5c2', '#67e0aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" style={StyleSheet.absoluteFill} /> : null}
            <NativeUiIcon color={color} name={owned ? 'trainers' : 'catalog'} size={14} />
            <Text style={[styles.label, { color }]}>{label}</Text>
            {owned && selected ? <Text accessibilityLiveRegion="polite" style={styles.count}>{count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  roster: { flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: '#315253', borderRadius: 9, padding: 5, backgroundColor: '#101919' },
  rosterLight: { borderColor: '#9fb8b8', backgroundColor: '#f8fcfb' },
  button: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#435455', borderRadius: 999, overflow: 'hidden', backgroundColor: '#111919' },
  buttonLight: { borderColor: '#9fb2b2', backgroundColor: '#f2f7f6' },
  selected: { borderColor: '#42d5c2' },
  label: { fontSize: 10, fontWeight: '900' },
  count: { minWidth: 22, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(7,18,20,0.22)', borderRadius: 999, color: '#071313', backgroundColor: 'rgba(7,18,20,0.14)', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.48 },
});
