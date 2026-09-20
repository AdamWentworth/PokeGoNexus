import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { buildNativeCollectionRows } from './collectionModel';
import type { NativeCatalogOrganizerRequest } from './nativeCatalogMutation';
import {
  isNativeCatalogFormCandidate, nativeCatalogChoiceIds, resolveNativeCatalogForm,
  type NativeCatalogCopyChoice, type NativeCatalogFormChoice,
} from './nativeCatalogFormModel';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  instances: Record<string, PokemonInstance>;
  request: NativeCatalogOrganizerRequest;
  isSaving: boolean;
  error: string | null;
  onConfirm: (request: NativeCatalogOrganizerRequest) => Promise<void>;
  onCancel: () => void;
};

export const NativeCatalogFormPicker = ({
  assetBaseUrl, catalog, instances, request, isSaving, error, onConfirm, onCancel,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const resolved = useMemo(() => {
    try {
      return { forms: [...new Set(request.variantIds)].flatMap((id) => {
        const form = resolveNativeCatalogForm(catalog, id);
        return form ? [form] : [];
      }), error: null };
    } catch (cause) {
      return { forms: [], error: cause instanceof Error ? cause.message : 'Unable to load form choices.' };
    }
  }, [catalog, request.variantIds]);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, NativeCatalogFormChoice>>({});
  const [base, setBase] = useState<NativeCatalogCopyChoice | null>(null);
  const [partner, setPartner] = useState<NativeCatalogCopyChoice | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = resolved.forms[index];
  const instancesById = useMemo(() => new Map(Object.entries(instances)
    .map(([key, instance]) => [instance.instance_id || key, instance])), [instances]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isSaving && !submitting.current) onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [isSaving, onCancel]);
  const candidates = useMemo(() => {
    if (!form) return [];
    const reserved = new Set(Object.entries(choices)
      .filter(([id]) => id !== form.variantId)
      .flatMap(([, choice]) => nativeCatalogChoiceIds(choice)));
    const available = Object.fromEntries(Object.entries(instances).filter(([key, instance]) =>
      !reserved.has(instance.instance_id || key) && (isNativeCatalogFormCandidate(instance, form, 'base')
        || (form.kind === 'fusion' && isNativeCatalogFormCandidate(instance, form, 'partner')))));
    return buildNativeCollectionRows(available, catalog, assetBaseUrl)
      .sort((a, b) => (b.cp ?? 0) - (a.cp ?? 0));
  }, [assetBaseUrl, catalog, choices, form, instances]);
  const choose = (side: 'base' | 'partner', choice: NativeCatalogCopyChoice) => {
    if (isSaving || submitting.current) return;
    setLocalError(null);
    if (side === 'base') setBase(choice);
    else setPartner(choice);
  };
  const confirm = async () => {
    if (!form || !base || (form.kind === 'fusion' && !partner) || submitting.current || isSaving) return;
    const choice: NativeCatalogFormChoice = form.kind === 'mega'
      ? { kind: 'mega', base } : { kind: 'fusion', base, partner: partner! };
    const nextChoices = { ...choices, [form.variantId]: choice };
    if (index < resolved.forms.length - 1) {
      setChoices(nextChoices);
      setIndex(index + 1);
      setBase(null); setPartner(null);
      return;
    }
    submitting.current = true;
    try { await onConfirm({ ...request, formChoices: nextChoices }); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'Unable to save these Pokémon.'); }
    finally { submitting.current = false; }
  };
  const title = form?.kind === 'fusion' ? form.fusion.name
    : form ? `${form.mega.primal ? 'Primal' : 'Mega'} ${form.pokemon.name}${form.mega.form ? ` ${form.mega.form}` : ''}`
      : 'Choose Pokémon';
  const subtitle = form?.kind === 'fusion'
    ? 'Choose a base Pokémon and its fusion partner.'
    : 'Evolve a caught copy or create a new one.';
  const ready = Boolean(base && (form?.kind !== 'fusion' || partner));
  const selectedSummary = (copy: NativeCatalogCopyChoice | null) => copy?.kind === 'new' ? 'New copy'
    : copy ? instancesById.get(copy.instanceId)?.nickname || 'Caught copy selected' : 'Choose a copy';
  const textStyle = [styles.text, light && styles.textLight];
  const renderCopies = (side: 'base' | 'partner') => {
    const selected = side === 'base' ? base : partner;
    const other = side === 'base' ? partner : base;
    const rows = form ? candidates.filter((row) => {
      const instance = instancesById.get(row.id);
      return instance && isNativeCatalogFormCandidate(instance, form, side)
        && !(other?.kind === 'existing' && other.instanceId === row.id);
    }) : [];
    const newLabel = form?.kind === 'mega' ? 'Generate and Evolve New'
      : `Create New ${side === 'partner' && form?.kind === 'fusion' ? form.partner.name : form?.pokemon.name ?? 'Pokémon'}`;
    return <FlatList data={rows} key={form?.variantId + side} keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list} renderItem={({ item }) => {
          const instance = instancesById.get(item.id);
          const label = `${item.name}, CP ${item.cp ?? 'unknown'}${instance?.level ? `, level ${instance.level}` : ''}`;
          return <Pressable accessibilityLabel={label} accessibilityRole="radio"
            accessibilityState={{ checked: selected?.kind === 'existing' && selected.instanceId === item.id }}
            disabled={isSaving} onPress={() => choose(side, { kind: 'existing', instanceId: item.id })}
            style={[styles.card, form?.kind === 'fusion' && styles.fusionCard, light && styles.cardLight, selected?.kind === 'existing' && selected.instanceId === item.id && styles.selected]}>
            {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="contain" /> : null}
            <View style={[styles.copy, form?.kind === 'fusion' && styles.fusionCopy]}>
              <Text style={[styles.name, light && styles.textLight]}>{item.name}</Text>
              <Text style={textStyle}>CP {item.cp ?? '—'} · Level {instance?.level ?? '—'}</Text>
              <Text style={textStyle}>IVs {instance?.attack_iv ?? '—'}/{instance?.defense_iv ?? '—'}/{instance?.stamina_iv ?? '—'}</Text>
            </View>
          </Pressable>;
        }}
        ListHeaderComponent={form ? <Pressable accessibilityRole="radio" accessibilityLabel={newLabel}
          accessibilityState={{ checked: selected?.kind === 'new' }} disabled={isSaving}
          onPress={() => choose(side, { kind: 'new' })} style={[styles.card, light && styles.cardLight, selected?.kind === 'new' && styles.selected]}>
          <Text style={[styles.name, light && styles.textLight]}>{newLabel}</Text>
        </Pressable> : null}
        ListEmptyComponent={form ? <Text style={textStyle}>No available caught copies. You can create a new copy above.</Text> : null}
      />;
  };
  return (
    <View accessibilityViewIsModal role="dialog" style={[styles.root, light && styles.rootLight]} testID="native-catalog-form-picker">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{index + 1} / {resolved.forms.length} · {form?.shiny ? 'SHINY FORM' : 'CHOOSE POKÉMON'}</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>{title}</Text>
        <Text style={textStyle}>{subtitle}</Text>
      </View>
      {form?.kind === 'fusion' ? <View style={styles.sides}>
        {(['base', 'partner'] as const).map((side) => <View key={side} style={styles.side}>
          <Text style={[styles.name, light && styles.textLight]}>{side === 'base' ? form.pokemon.name : form.partner.name}</Text>
          <Text style={textStyle}>{selectedSummary(side === 'base' ? base : partner)}</Text>
          {renderCopies(side)}
        </View>)}
      </View> : renderCopies('base')}
      {error || localError || resolved.error ? <Text accessibilityRole="alert" style={styles.error}>{error || localError || resolved.error}</Text> : null}
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.cancel}><Text style={textStyle}>Cancel</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!ready || isSaving} onPress={() => void confirm()} style={[styles.confirm, (!ready || isSaving) && styles.disabled]}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{index < resolved.forms.length - 1 ? 'Continue' : form?.kind === 'fusion' ? 'Fuse Selected Pokémon' : form?.mega.primal ? 'Primal Revert' : 'Mega Evolve'}</Text>}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#142321', padding: 14 }, rootLight: { backgroundColor: '#f4faf6' },
  header: { gap: 7, paddingBottom: 14 }, eyebrow: { color: '#289e86', fontSize: 11, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' }, text: { color: '#cbddd6', fontSize: 13 }, textLight: { color: '#243e37' },
  list: { gap: 10, paddingBottom: 12 }, card: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 2, borderColor: '#465f57', borderRadius: 12, backgroundColor: '#20362f' },
  cardLight: { backgroundColor: '#fff', borderColor: '#aac3ba' }, selected: { borderColor: '#2ac3a3' }, image: { width: 76, height: 76 },
  copy: { flex: 1, gap: 5 }, name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sides: { flex: 1, flexDirection: 'row', gap: 10 }, side: { flex: 1, minWidth: 0, gap: 8 },
  fusionCard: { flexDirection: 'column', alignItems: 'stretch' }, fusionCopy: { flex: 0 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 10 }, cancel: { minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  confirm: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#137e69' },
  confirmText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 }, error: { color: '#ed7385', paddingVertical: 10 },
});
