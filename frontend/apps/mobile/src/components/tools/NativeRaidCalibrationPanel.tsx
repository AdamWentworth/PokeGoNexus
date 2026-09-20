import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  clearNativeRaidObservations,
  loadNativeRaidObservations,
  saveNativeRaidObservations,
  serializeNativeRaidObservations,
  summarizeNativeRaidCalibration,
  type NativeRaidObservation,
  type NativeRaidObservationActual,
} from '../../features/tools/nativeRaidCalibration';
import { useNativeModalAnimation } from '../../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  bossName: string;
  buildObservation: (actual: NativeRaidObservationActual) => NativeRaidObservation | null;
  defaultTrainerCount: number;
  disabled?: boolean;
  modelVersion: number;
  onObservedDodgeRateChange?: (rate: number | null) => void;
  ownerKey: string;
};

type Form = {
  outcome: NativeRaidObservationActual['outcome'];
  trainerCount: string;
  battleSeconds: string;
  remainingBossHpPercent: string;
  faints: string;
  relobbies: string;
  dodgeAttempts: string;
  successfulDodges: string;
  latencyMs: string;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const wholeNumber = (value: string) => Math.max(0, Math.floor(Number(value) || 0));
const initialForm = (trainerCount: number): Form => ({
  outcome: 'cleared',
  trainerCount: String(Math.max(1, trainerCount)),
  battleSeconds: '',
  remainingBossHpPercent: '',
  faints: '0',
  relobbies: '0',
  dodgeAttempts: '0',
  successfulDodges: '0',
  latencyMs: '',
});

export const NativeRaidCalibrationPanel = ({
  bossName,
  buildObservation,
  defaultTrainerCount,
  disabled = false,
  modelVersion,
  onObservedDodgeRateChange,
  ownerKey,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const slideAnimation = useNativeModalAnimation('slide');
  const fadeAnimation = useNativeModalAnimation('fade');
  const [allObservations, setAllObservations] = useState<NativeRaidObservation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => initialForm(defaultTrainerCount));
  const [useObservedDodges, setUseObservedDodges] = useState(false);
  const [error, setError] = useState('');
  const dialogStartedAtRef = useRef<number | null>(null);
  const observations = useMemo(() => allObservations.filter(
    (row) => row.ownerKey === ownerKey && row.modelVersion === modelVersion,
  ), [allObservations, modelVersion, ownerKey]);
  const profile = useMemo(() => summarizeNativeRaidCalibration(observations), [observations]);

  useEffect(() => {
    let active = true;
    void loadNativeRaidObservations().then((rows) => {
      if (!active) return;
      setAllObservations(rows);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const observedDodgesEnabled = profile.canApplyDodgeCalibration && useObservedDodges;
  useEffect(() => {
    onObservedDodgeRateChange?.(observedDodgesEnabled ? profile.dodgeSuccessRate : null);
  }, [observedDodgesEnabled, onObservedDodgeRateChange, profile.dodgeSuccessRate]);
  useEffect(() => () => onObservedDodgeRateChange?.(null), [onObservedDodgeRateChange]);
  useEffect(() => {
    if (!dialogOpen || dialogStartedAtRef.current == null) return;
    markNativeUiPerformanceAfterPaint('raid_calibration_dialog_painted', dialogStartedAtRef.current);
    dialogStartedAtRef.current = null;
  }, [dialogOpen]);

  const setField = (field: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const openLog = () => {
    dialogStartedAtRef.current = Date.now();
    setForm(initialForm(defaultTrainerCount));
    setError('');
    setDialogOpen(true);
  };
  const save = async () => {
    const trainerCount = wholeNumber(form.trainerCount);
    const clearTimeSeconds = Number(form.battleSeconds);
    const dodgeAttempts = wholeNumber(form.dodgeAttempts);
    const successfulDodges = wholeNumber(form.successfulDodges);
    const latencyMs = form.latencyMs.trim() ? Number(form.latencyMs) : null;
    const remainingBossHpPercent = form.remainingBossHpPercent.trim()
      ? Number(form.remainingBossHpPercent)
      : null;
    if (trainerCount < 1 || trainerCount > 20) {
      setError('Trainer count must be between 1 and 20.');
      return;
    }
    if (!Number.isFinite(clearTimeSeconds) || clearTimeSeconds < 1 || clearTimeSeconds > 1800) {
      setError('Battle time must be between 1 and 1800 seconds.');
      return;
    }
    if (successfulDodges > dodgeAttempts) {
      setError('Successful dodges cannot exceed attempted dodges.');
      return;
    }
    if (latencyMs != null && (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 5000)) {
      setError('Latency must be between 0 and 5000 ms.');
      return;
    }
    if (remainingBossHpPercent != null && (
      !Number.isFinite(remainingBossHpPercent) || remainingBossHpPercent < 0 || remainingBossHpPercent > 100
    )) {
      setError('Remaining boss HP must be between 0 and 100%.');
      return;
    }
    const observation = buildObservation({
      outcome: form.outcome,
      trainerCount,
      clearTimeSeconds,
      remainingBossHpPercent: form.outcome === 'timed-out' ? remainingBossHpPercent : null,
      faints: wholeNumber(form.faints),
      relobbies: wholeNumber(form.relobbies),
      dodgeAttempts,
      successfulDodges,
      latencyMs,
    });
    if (!observation) {
      setError('A prediction could not be produced for this raid.');
      return;
    }
    setAllObservations(await saveNativeRaidObservations([observation, ...allObservations]));
    setDialogOpen(false);
  };
  const clear = async () => {
    setAllObservations(await clearNativeRaidObservations(ownerKey));
    setUseObservedDodges(false);
    setClearOpen(false);
  };

  return (
    <View accessibilityLabel="Observed raid calibration" style={[styles.panel, light && styles.panelLight]}>
      <View style={styles.heading}>
        <Text style={styles.icon}>⌁</Text>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, light && styles.textLight]}>Battle calibration</Text>
          <Text style={[styles.subtitle, light && styles.mutedLight]}>
            {!loaded ? 'Loading device raid log…' : profile.sampleCount === 0 ? 'No raids logged on this device' : `Private to this device${profile.medianLatencyMs == null ? '' : ` · ${Math.round(profile.medianLatencyMs)} ms median`}`}
          </Text>
        </View>
      </View>

      {profile.sampleCount > 0 ? (
        <View accessibilityLabel="Raid calibration metrics" style={styles.metrics}>
          {[
            ['RAIDS', String(profile.sampleCount)],
            ['EXACT PARTIES', String(profile.exactPartySampleCount)],
            ['TTW ERROR', profile.clearSampleCount ? percent(profile.meanAbsoluteTimingErrorPercent) : '—'],
            ['P90 ERROR', profile.clearSampleCount ? `${Math.round(profile.p90AbsoluteTimingErrorSeconds)}s` : '—'],
            ['OUTCOME', percent(profile.predictedOutcomeAccuracy)],
            ['DODGE', profile.dodgeAttempts ? percent(profile.dodgeSuccessRate) : '—'],
          ].map(([label, value]) => (
            <View key={label} style={[styles.metric, light && styles.controlLight]}><Text style={[styles.metricLabel, light && styles.mutedLight]}>{label}</Text><Text style={[styles.metricValue, light && styles.textLight]}>{value}</Text></View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={openLog} style={[styles.log, disabled && styles.disabled]}><Text style={styles.logText}>◷  Log raid</Text></Pressable>
        {profile.sampleCount > 0 ? <>
          <View style={[styles.observedToggle, light && styles.controlLight]}><Text style={[styles.observedText, light && styles.textLight]}>Use observed dodges</Text><Switch accessibilityLabel="Use observed dodges" disabled={!profile.canApplyDodgeCalibration} onValueChange={setUseObservedDodges} value={observedDodgesEnabled} /></View>
          <Pressable accessibilityLabel="Export observed raid data" accessibilityRole="button" onPress={() => void Share.share({ message: serializeNativeRaidObservations(observations, modelVersion), title: 'Pokémon Go Nexus raid observations' })} style={[styles.iconButton, light && styles.controlLight]}><Text style={[styles.iconButtonText, light && styles.textLight]}>⇧</Text></Pressable>
          <Pressable accessibilityLabel="Clear observed raid data" accessibilityRole="button" onPress={() => setClearOpen(true)} style={[styles.iconButton, light && styles.controlLight]}><Text style={styles.clearText}>⌫</Text></Pressable>
        </> : null}
      </View>

      <Modal animationType={slideAnimation} onRequestClose={() => setDialogOpen(false)} transparent visible={dialogOpen}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, light && styles.dialogLight]}>
            <View style={styles.dialogHeading}><View style={styles.headingCopy}><Text style={styles.eyebrow}>OBSERVED BATTLE</Text><Text numberOfLines={1} style={[styles.dialogTitle, light && styles.textLight]}>{bossName}</Text></View><Pressable accessibilityLabel="Close raid log" accessibilityRole="button" onPress={() => setDialogOpen(false)} style={[styles.close, light && styles.controlLight]}><Text style={[styles.closeText, light && styles.textLight]}>×</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <View accessibilityLabel="Raid outcome" style={styles.segmented}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: form.outcome === 'cleared' }} onPress={() => setField('outcome', 'cleared')} style={[styles.segment, form.outcome === 'cleared' && styles.segmentActive]}><Text style={[styles.segmentText, form.outcome === 'cleared' && styles.segmentTextActive]}>Cleared</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: form.outcome === 'timed-out' }} onPress={() => setField('outcome', 'timed-out')} style={[styles.segment, form.outcome === 'timed-out' && styles.segmentFailed]}><Text style={styles.segmentText}>Timed out</Text></Pressable>
              </View>
              <View style={styles.inputRow}><NumberField label="TRAINERS" light={light} onChange={(value) => setField('trainerCount', value)} value={form.trainerCount} /><NumberField decimal label="BATTLE TIME (SECONDS)" light={light} onChange={(value) => setField('battleSeconds', value)} value={form.battleSeconds} /></View>
              {form.outcome === 'timed-out' ? <NumberField decimal label="BOSS HP LEFT % (OPTIONAL)" light={light} onChange={(value) => setField('remainingBossHpPercent', value)} value={form.remainingBossHpPercent} /> : null}
              <View style={styles.inputRow}><NumberField label="FAINTS" light={light} onChange={(value) => setField('faints', value)} value={form.faints} /><NumberField label="RELOBBIES" light={light} onChange={(value) => setField('relobbies', value)} value={form.relobbies} /></View>
              <View style={styles.inputRow}><NumberField label="DODGES ATTEMPTED" light={light} onChange={(value) => setField('dodgeAttempts', value)} value={form.dodgeAttempts} /><NumberField label="DODGES SUCCESSFUL" light={light} onChange={(value) => setField('successfulDodges', value)} value={form.successfulDodges} /></View>
              <NumberField label="MEASURED LATENCY (MS, OPTIONAL)" light={light} onChange={(value) => setField('latencyMs', value)} value={form.latencyMs} />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <View style={styles.footer}><Text style={[styles.saved, light && styles.mutedLight]}>Saved only on this device</Text><Pressable accessibilityRole="button" onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>Save result</Text></Pressable></View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType={fadeAnimation} onRequestClose={() => setClearOpen(false)} transparent visible={clearOpen}>
        <View style={styles.backdrop}><View style={[styles.confirm, light && styles.dialogLight]}><Text style={[styles.dialogTitle, light && styles.textLight]}>Clear raid observations?</Text><Text style={[styles.dialogLead, light && styles.mutedLight]}>This removes your private calibration log stored on this device.</Text><View style={styles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setClearOpen(false)} style={[styles.cancel, light && styles.controlLight]}><Text style={[styles.cancelText, light && styles.textLight]}>Keep log</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void clear()} style={styles.destructive}><Text style={styles.saveText}>Clear log</Text></Pressable></View></View></View>
      </Modal>
    </View>
  );
};

const NumberField = ({ decimal = false, label, light, onChange, value }: { decimal?: boolean; label: string; light: boolean; onChange: (value: string) => void; value: string }) => (
  <View style={styles.field}><Text style={[styles.fieldLabel, light && styles.mutedLight]}>{label}</Text><TextInput accessibilityLabel={label.toLocaleLowerCase()} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} onChangeText={onChange} style={[styles.input, light && styles.inputLight]} value={value} /></View>
);

const styles = StyleSheet.create({
  panel: { gap: 10, borderWidth: 1, borderColor: '#355052', borderRadius: 11, padding: 10, backgroundColor: '#172223' },
  panelLight: { borderColor: '#c5d7d7', backgroundColor: '#eef5f4' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingCopy: { minWidth: 0, flex: 1 },
  icon: { color: '#50ddd4', fontSize: 22, fontWeight: '900' },
  title: { color: '#fff', fontSize: 12, fontWeight: '900' },
  subtitle: { marginTop: 1, color: '#9fb1b2', fontSize: 9 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metric: { width: '31.8%', gap: 2, borderWidth: 1, borderColor: '#405354', borderRadius: 8, padding: 7, backgroundColor: '#101819' },
  metricLabel: { color: '#91a4a5', fontSize: 6.5, fontWeight: '900' },
  metricValue: { color: '#fff', fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  log: { minHeight: 40, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#2fd6d0' },
  logText: { color: '#061314', fontSize: 10, fontWeight: '900' },
  observedToggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#435657', borderRadius: 999, paddingLeft: 10, backgroundColor: '#101819' },
  observedText: { color: '#e4eeee', fontSize: 8, fontWeight: '800' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#435657', borderRadius: 20, backgroundColor: '#101819' },
  iconButtonText: { color: '#e6f1f1', fontSize: 18, fontWeight: '900' },
  clearText: { color: '#f07186', fontSize: 18, fontWeight: '900' },
  disabled: { opacity: .4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, .72)' },
  dialog: { maxHeight: '92%', gap: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 24, backgroundColor: '#101819' },
  dialogLight: { backgroundColor: '#fff' },
  dialogHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#4edcd3', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  dialogTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  dialogLead: { color: '#9fb1b2', fontSize: 10.5, lineHeight: 15 },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#435657', borderRadius: 21, backgroundColor: '#202a2b' },
  closeText: { color: '#fff', fontSize: 25 },
  form: { gap: 10, paddingBottom: 8 },
  segmented: { flexDirection: 'row', gap: 5, borderRadius: 12, padding: 4, backgroundColor: '#202a2b' },
  segment: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: '#2bbf8c' },
  segmentFailed: { backgroundColor: '#7e2c3b' },
  segmentText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  segmentTextActive: { color: '#061314' },
  inputRow: { flexDirection: 'row', gap: 8 },
  field: { minWidth: 0, flex: 1, gap: 5 },
  fieldLabel: { color: '#91a4a5', fontSize: 7.5, fontWeight: '900', letterSpacing: .5 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#45595a', borderRadius: 10, paddingHorizontal: 12, color: '#fff', backgroundColor: '#1b2526', fontSize: 13, fontWeight: '800' },
  inputLight: { borderColor: '#b9caca', color: '#142629', backgroundColor: '#f2f7f7' },
  error: { color: '#ff9bad', fontSize: 10, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saved: { minWidth: 0, flex: 1, color: '#91a4a5', fontSize: 8.5 },
  save: { minHeight: 44, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 17, backgroundColor: '#2fd6d0' },
  saveText: { color: '#071214', fontSize: 10, fontWeight: '900' },
  confirm: { gap: 10, margin: 14, marginBottom: 24, borderRadius: 16, padding: 15, backgroundColor: '#172223' },
  confirmActions: { flexDirection: 'row', gap: 8 },
  cancel: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#46595a', borderRadius: 999, backgroundColor: '#202a2b' },
  cancelText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  destructive: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#df5770' },
  controlLight: { borderColor: '#bfd0d0', backgroundColor: '#fff' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#657879' },
});
