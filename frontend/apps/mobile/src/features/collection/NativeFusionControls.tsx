import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeInstanceDetail } from './collectionModel';
import { useNativeModalAnimation } from '../settings/useNativeMotion';

type FusionOption = NonNullable<NativeInstanceDetail['fusionOptions']>[number];

/** Vite's Fuse/Separate affordances and explicit, cancellable partner selection. */
export function NativeFusionControls({
  assetBaseUrl, detail, editing, fused, fusionId, fusedWith, palette, onFuse, onSeparate,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  editing: boolean;
  fused: boolean;
  fusionId: number | null;
  fusedWith: string | null;
  palette: { panel: string; border: string; text: string; secondary: string; input: string };
  onFuse: (option: FusionOption, partnerId: string) => void;
  onSeparate: () => void;
}) {
  const animationType = useNativeModalAnimation('fade');
  const [pending, setPending] = useState<{ option: FusionOption; partnerId: string | null } | null>(null);
  const preferredPartner = useRef(fusedWith);
  const options = detail.fusionOptions ?? [];
  const selected = options.find((option) => option.id === fusionId);
  const partner = selected?.partnerRows.find((candidate) => candidate.id === fusedWith)
    ?? detail.fusionPartnerRow;
  const close = () => setPending(null);
  const glyph = (id: number) => `${assetBaseUrl.replace(/\/$/, '')}/media/images/fusion_${id}.png`;
  if (!fused && options.length === 0) return null;

  return (
    <View style={styles.controls} testID="native-instance-fusion-controls">
      {fused ? (
        <Pressable
          accessibilityLabel="Separate"
          accessibilityRole="button"
          accessibilityState={{ disabled: !editing }}
          disabled={!editing}
          onPress={() => { preferredPartner.current = fusedWith; onSeparate(); }}
          style={[styles.pill, !editing && styles.disabled]}
        >
          <FusionButtonBackground />
          {detail.appearanceImageUris?.base ? <Image accessibilityElementsHidden source={{ uri: detail.appearanceImageUris.base }} style={styles.partnerIcon} resizeMode="contain" /> : null}
          <Text style={styles.pillText}>SEPARATE</Text>
          {partner?.imageUri ? <Image accessibilityElementsHidden source={{ uri: partner.imageUri }} style={styles.partnerIcon} resizeMode="contain" /> : null}
        </Pressable>
      ) : options.map((option) => (
        <Pressable
          accessibilityLabel={`Fuse ${option.name}`}
          accessibilityHint={editing ? 'Select a fusion partner' : 'Enable edit mode to fuse this Pokémon'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !editing }}
          disabled={!editing}
          key={option.id}
          onPress={() => setPending({
            option,
            partnerId: option.partnerRows.find((candidate) => candidate.id === preferredPartner.current)?.id
              ?? option.partnerRows[0]?.id ?? null,
          })}
          style={[styles.pill, styles.optionPill, !editing && styles.disabled]}
        >
          <FusionButtonBackground />
          <Image accessibilityElementsHidden source={{ uri: glyph(option.id) }} style={styles.glyph} resizeMode="contain" />
          <Text style={[styles.pillText, styles.optionText]}>FUSE {option.name.toUpperCase()}</Text>
          <Image accessibilityElementsHidden source={{ uri: option.imageUri ?? glyph(option.id) }} style={styles.partnerIcon} resizeMode="contain" />
        </Pressable>
      ))}
      <Modal animationType={animationType} onRequestClose={close} statusBarTranslucent transparent visible={pending != null && editing}>
        <View accessibilityViewIsModal style={styles.backdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss fusion partner selector" onPress={close} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: palette.panel, borderColor: palette.border }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Select Fusion Partner</Text>
            <ScrollView contentContainerStyle={styles.candidates}>
              {pending?.option.partnerRows.map((candidate) => (
                <Pressable
                  accessibilityLabel={`${candidate.name}, CP ${candidate.cp ?? '--'}, level ${candidate.level ?? '--'}, ${candidate.backgroundName ?? 'No BG'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: candidate.id === pending.partnerId }}
                  key={candidate.id}
                  onPress={() => setPending({ ...pending, partnerId: candidate.id })}
                  style={[styles.card, { backgroundColor: palette.input, borderColor: candidate.id === pending.partnerId ? '#8be39e' : palette.border }]}
                  testID={`native-fusion-partner-${candidate.id}`}
                >
                  {candidate.imageUri ? <Image accessibilityElementsHidden source={{ uri: candidate.imageUri }} style={styles.candidateImage} resizeMode="contain" /> : null}
                  <View style={styles.identity}>
                    <Text numberOfLines={2} style={[styles.name, { color: palette.text }]}>{candidate.name}</Text>
                    <Text numberOfLines={1} style={[styles.subtitle, { color: palette.secondary }]}>{candidate.speciesName}</Text>
                  </View>
                  <View style={styles.stats}>
                    <Text style={[styles.stat, { color: palette.text }]}>CP {candidate.cp ?? '--'}</Text>
                    <Text style={[styles.stat, { color: palette.text }]}>LVL {candidate.level ?? '--'}</Text>
                  </View>
                  <View style={styles.background}>
                    {candidate.locationBackgroundUri ? <>
                      <Image accessibilityElementsHidden source={{ uri: candidate.locationBackgroundUri }} style={styles.backgroundImage} />
                      <Text numberOfLines={2} style={[styles.backgroundName, { color: palette.secondary }]}>{candidate.backgroundName}</Text>
                    </> : <Text style={[styles.backgroundName, { color: palette.secondary }]}>No BG</Text>}
                  </View>
                </Pressable>
              ))}
              {pending?.option.partnerRows.length === 0 ? <Text style={{ color: palette.text }}>No available caught partner for {pending.option.name}.</Text> : null}
            </ScrollView>
            <View style={[styles.actions, { borderColor: palette.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel fusion" onPress={close} style={[styles.cancel, { borderColor: palette.border }]}>
                <Text style={[styles.pillText, { color: palette.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fuse"
                accessibilityState={{ disabled: !pending?.partnerId }}
                disabled={!pending?.partnerId}
                onPress={() => {
                  if (!pending?.partnerId) return;
                  preferredPartner.current = pending.partnerId;
                  onFuse(pending.option, pending.partnerId);
                  close();
                }}
                style={[styles.pill, styles.confirm, !pending?.partnerId && styles.disabled]}
              >
                <FusionButtonBackground />
                <Text style={styles.pillText}>FUSE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FusionButtonBackground = () => <LinearGradient
  pointerEvents="none"
  colors={['#a2db96', '#a2db96', '#28c7a4', '#28c7a4']}
  locations={[0, 0.15, 0.85, 1]}
  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
  style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
/>;

const styles = StyleSheet.create({
  controls: { width: '100%', alignItems: 'center', gap: 10, paddingVertical: 10 },
  pill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#8be39e' },
  optionPill: { minWidth: 210, maxWidth: '100%' },
  pillText: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '700', letterSpacing: 0.4 },
  optionText: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.58 },
  glyph: { width: 26, height: 26 },
  partnerIcon: { width: 36, height: 36 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '82%', borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  title: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  candidates: { gap: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  candidateImage: { width: 54, height: 54 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  stats: { alignItems: 'flex-end', gap: 2 },
  stat: { fontSize: 12, fontWeight: '600' },
  background: { width: 66, alignItems: 'center', gap: 3 },
  backgroundImage: { width: 66, height: 38, borderRadius: 8 },
  backgroundName: { fontSize: 9, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  cancel: { minWidth: 96, minHeight: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  confirm: { minWidth: 96 },
});
