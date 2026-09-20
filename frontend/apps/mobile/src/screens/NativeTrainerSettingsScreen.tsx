import type {
  FriendRequestPermission,
  ProfileVisibility,
  TradeCoordinationMethod,
  TrainerCodeVisibility,
} from '@pokemongonexus/shared-contracts/users';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { NativeBackIcon } from '../components/NativeBackIcon';
import { NativeThemeSwitch } from '../components/NativeActionMenu';
import { NativeOptionPicker, type NativeOptionPickerEntry } from '../components/NativeOptionPicker';
import { NativeSettingsWorkspaceNav } from '../components/NativeSettingsWorkspaceNav';
import {
  changeNativeCoordinationMethod,
  type NativeTrainerPreferencesDraft,
} from '../features/social/nativeTrainerPreferencesModel';
import type { NativeColorTheme } from '../features/settings/nativeDevicePreferences';
import type { NativeSyncSettingsSummary } from '../features/settings/nativeSyncSettingsModel';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type PickerKey =
  | 'profileVisibility'
  | 'collectionVisibility'
  | 'friendRequestPermission'
  | 'trainerCodeVisibility'
  | 'coordinationMethod';

type Props = {
  draft: NativeTrainerPreferencesDraft | null;
  error?: string | null;
  feedback?: { tone: 'success' | 'error'; text: string } | null;
  colorTheme: NativeColorTheme;
  isLoading?: boolean;
  isSaving?: boolean;
  onBack: () => void;
  onChange: (draft: NativeTrainerPreferencesDraft) => void;
  onDismissFeedback?: () => void;
  onChangeColorTheme: (theme: NativeColorTheme) => void;
  onChangeReduceMotion: (value: boolean) => void;
  onOpenAccount: () => void;
  onRetry: () => void;
  onRetrySync: () => void;
  onSaveCoordination: () => void;
  onSavePrivacy: () => void;
  reduceMotion: boolean;
  syncSummary: NativeSyncSettingsSummary;
};

const VISIBILITY_OPTIONS: NativeOptionPickerEntry[] = [
  { key: 'public', label: 'Everyone' },
  { key: 'friends', label: 'Friends only' },
  { key: 'private', label: 'Only me' },
];
const FRIEND_OPTIONS: NativeOptionPickerEntry[] = [
  { key: 'everyone', label: 'Allow requests' },
  { key: 'nobody', label: 'Do not allow requests' },
];
const COORDINATION_OPTIONS: NativeOptionPickerEntry[] = [
  { key: 'campfire', label: 'Campfire', description: 'Recommended for Niantic Friends and direct messages.' },
  { key: 'discord', label: 'Discord' },
  { key: 'other', label: 'Another community or app' },
  { key: 'none', label: 'Do not share coordination details' },
];
const labelFor = (options: NativeOptionPickerEntry[], value: string): string => (
  options.find((option) => option.key === value)?.label ?? value
);

const PrivacyShieldIcon = () => (
  <Svg height={28} viewBox="0 0 24 24" width={28}>
    <Path
      d="M12 2.8 20 6v5.25c0 5.1-3.15 8.55-8 10.1-4.85-1.55-8-5-8-10.1V6l8-3.2Zm0 3.15L7 7.9v3.35c0 3.35 1.85 5.7 5 6.95V5.95Z"
      fill="#42d7c6"
    />
  </Svg>
);

const PrivacyLockIcon = () => (
  <Svg height={18} viewBox="0 0 24 24" width={18}>
    <Path d="M7.5 10V7.8a4.5 4.5 0 0 1 9 0V10h1.2c.72 0 1.3.58 1.3 1.3v7.4c0 .72-.58 1.3-1.3 1.3H6.3c-.72 0-1.3-.58-1.3-1.3v-7.4c0-.72.58-1.3 1.3-1.3h1.2Zm2 0h5V7.8a2.5 2.5 0 0 0-5 0V10Z" fill="#9db5b4" />
  </Svg>
);

type SelectionFieldProps = {
  description?: string;
  label: string;
  onPress: () => void;
  value: string;
  light: boolean;
};

const SelectionField = ({ description, label, light, onPress, value }: SelectionFieldProps) => (
  <View style={styles.field}>
    <Text style={[styles.fieldLabel, light && styles.labelLight]}>{label}</Text>
    <Pressable
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.select, light && styles.selectLight]}
    >
      <Text style={[styles.selectText, light && styles.textLight]}>{value}</Text>
      <Text style={[styles.chevron, light && styles.labelLight]}>⌄</Text>
    </Pressable>
    {description ? <Text style={[styles.help, light && styles.mutedLight]}>{description}</Text> : null}
  </View>
);

type ToggleFieldProps = {
  description?: string;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
  disabled?: boolean;
  light: boolean;
};

const ToggleField = ({ description, disabled, label, light, onChange, value }: ToggleFieldProps) => (
  <Pressable
    aria-checked={value}
    accessibilityLabel={label}
    accessibilityRole="switch"
    accessibilityState={{ checked: value, disabled }}
    disabled={disabled}
    onPress={() => onChange(!value)}
    style={({ pressed }) => [styles.toggleRow, light && styles.toggleRowLight, disabled && styles.disabled, pressed && styles.pressed]}
  >
    <View style={styles.toggleCopy}>
      <View style={styles.toggleLabelRow}>
        <Svg height={17} viewBox="0 0 24 24" width={17}>
          <Path d="M2.4 12s3.2-5 9.6-5 9.6 5 9.6 5-3.2 5-9.6 5-9.6-5-9.6-5Z" fill="none" stroke={light ? '#53666f' : '#dce9e6'} strokeWidth={1.9} />
          <Path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" fill={light ? '#53666f' : '#dce9e6'} />
        </Svg>
        <Text style={[styles.toggleLabel, light && styles.textLight]}>{label}</Text>
      </View>
      {description ? <Text style={[styles.help, light && styles.mutedLight]}>{description}</Text> : null}
    </View>
    <View style={[styles.toggleCheck, light && styles.toggleCheckLight, value && styles.toggleCheckActive]}>
      {value ? <Text style={styles.toggleCheckMark}>✓</Text> : null}
    </View>
  </Pressable>
);

export const NativeTrainerSettingsScreen = ({
  colorTheme,
  draft,
  error = null,
  feedback = null,
  isLoading = false,
  isSaving = false,
  onBack,
  onChangeColorTheme,
  onChangeReduceMotion,
  onChange,
  onDismissFeedback,
  onOpenAccount,
  onRetry,
  onRetrySync,
  onSaveCoordination,
  onSavePrivacy,
  reduceMotion,
  syncSummary,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const coordinationHandleRef = useRef<TextInput>(null);
  const feedbackPerformanceRef = useRef<number | null>(null);

  const clearTextInputFocus = () => {
    coordinationHandleRef.current?.blur();
    Keyboard.dismiss();
  };
  const openPicker = (nextPicker: PickerKey) => {
    const startedAt = Date.now();
    clearTextInputFocus();
    setPicker(nextPicker);
    markNativeUiPerformanceAfterPaint('settings_picker_painted', startedAt);
  };

  useEffect(() => {
    if (!feedback || feedbackPerformanceRef.current === null) return;
    const startedAt = feedbackPerformanceRef.current;
    feedbackPerformanceRef.current = null;
    markNativeUiPerformanceAfterPaint('settings_save_result_painted', startedAt);
  }, [feedback]);

  const update = <K extends keyof NativeTrainerPreferencesDraft>(
    key: K,
    value: NativeTrainerPreferencesDraft[K],
  ) => {
    if (!draft) return;
    onChange({ ...draft, [key]: value });
  };

  const pickerConfig = picker ? ({
    profileVisibility: {
      title: 'Profile visibility', options: VISIBILITY_OPTIONS, selected: draft?.profileVisibility ?? 'private',
      select: (key: string) => update('profileVisibility', key as ProfileVisibility),
    },
    collectionVisibility: {
      title: 'Pokémon visibility', options: VISIBILITY_OPTIONS, selected: draft?.collectionVisibility ?? 'private',
      select: (key: string) => update('collectionVisibility', key as ProfileVisibility),
    },
    friendRequestPermission: {
      title: 'Friend requests', options: FRIEND_OPTIONS, selected: draft?.friendRequestPermission ?? 'nobody',
      select: (key: string) => update('friendRequestPermission', key as FriendRequestPermission),
    },
    trainerCodeVisibility: {
      title: 'Trainer code visibility', options: VISIBILITY_OPTIONS, selected: draft?.trainerCodeVisibility ?? 'private',
      select: (key: string) => update('trainerCodeVisibility', key as TrainerCodeVisibility),
    },
    coordinationMethod: {
      title: 'Preferred coordination method', options: COORDINATION_OPTIONS, selected: draft?.coordinationMethod ?? 'none',
      select: (key: string) => { if (draft) onChange(changeNativeCoordinationMethod(draft, key as TradeCoordinationMethod)); },
    },
  } as const)[picker] : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, light && styles.rootLight]}
      testID="native-trainer-settings-screen"
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 12 + insets.top, paddingBottom: 96 + insets.bottom }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={clearTextInputFocus}
        testID="native-trainer-settings-content"
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={[styles.back, light && styles.backLight]}>
            <NativeBackIcon color={light ? '#172124' : '#ffffff'} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Settings</Text>
          </View>
        </View>

        <NativeSettingsWorkspaceNav active="settings" onOpenAccount={onOpenAccount} onOpenSettings={() => {}} />

        {isLoading ? (
          <View style={styles.status}><ActivityIndicator color="#35a8ff" /><Text style={[styles.statusText, light && styles.mutedLight]}>Loading settings…</Text></View>
        ) : null}
        {error ? (
          <View accessibilityRole="alert" style={[styles.feedback, styles.feedbackError]}>
            <Text style={styles.feedbackText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        {draft ? (
          <>
            <View style={[styles.section, light && styles.sectionLight]}>
              <View style={styles.sectionHeader}>
                <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>WHO CAN SEE YOU</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Privacy</Text></View>
                <PrivacyShieldIcon />
              </View>
              <SelectionField label="Profile visibility" light={light} onPress={() => openPicker('profileVisibility')} value={labelFor(VISIBILITY_OPTIONS, draft.profileVisibility)} description="Controls your trainer card and profile statistics." />
              <SelectionField label="Pokémon visibility" light={light} onPress={() => openPicker('collectionVisibility')} value={labelFor(VISIBILITY_OPTIONS, draft.collectionVisibility)} description="Controls access to your public Pokémon catalog." />
              <SelectionField label="Friend requests" light={light} onPress={() => openPicker('friendRequestPermission')} value={labelFor(FRIEND_OPTIONS, draft.friendRequestPermission)} />
              <SelectionField label="Trainer code visibility" light={light} onPress={() => openPicker('trainerCodeVisibility')} value={labelFor(VISIBILITY_OPTIONS, draft.trainerCodeVisibility)} description="Accepted-trade sharing is configured separately below." />
              <ToggleField label="Show Pokémon GO name" light={light} onChange={(value) => {
                const startedAt = Date.now();
                update('showPokemonGoName', value);
                markNativeUiPerformanceAfterPaint('settings_toggle_result_painted', startedAt);
              }} value={draft.showPokemonGoName} />
              <ToggleField label="Show profile location" light={light} onChange={(value) => {
                const startedAt = Date.now();
                update('showLocation', value);
                markNativeUiPerformanceAfterPaint('settings_toggle_result_painted', startedAt);
              }} value={draft.showLocation} />
              <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => {
                clearTextInputFocus();
                feedbackPerformanceRef.current = Date.now();
                onSavePrivacy();
              }} style={[styles.save, isSaving && styles.disabled]}>
                <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save privacy'}</Text>
              </Pressable>
            </View>

            <View style={[styles.note, light && styles.noteLight]}><PrivacyLockIcon /><Text style={[styles.noteText, light && styles.textLight]}>Private account data is never shown on public profiles.</Text></View>

            <View style={[styles.section, light && styles.sectionLight]}>
              <View style={styles.sectionHeader}>
                <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>AFTER AN OFFER IS ACCEPTED</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Trade coordination</Text></View>
                <Text style={styles.sectionIcon}>◌</Text>
              </View>
              <Text style={[styles.sectionCopy, light && styles.mutedLight]}>Pokémon Go Nexus does not provide messaging. Choose how an accepted trade partner can connect with you.</Text>
              <SelectionField label="Preferred coordination method" light={light} onPress={() => openPicker('coordinationMethod')} value={labelFor(COORDINATION_OPTIONS, draft.coordinationMethod)} description="Campfire is recommended for Niantic Friends and direct messages." />
              {draft.coordinationMethod !== 'none' ? (
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, light && styles.labelLight]}>{draft.coordinationMethod === 'campfire' ? 'Campfire username or Niantic ID (optional)' : draft.coordinationMethod === 'discord' ? 'Discord username' : 'Community or app handle'}</Text>
                  <TextInput
                    accessibilityLabel="Coordination handle"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={80}
                    onChangeText={(value) => update('coordinationHandle', value)}
                    placeholder="Platform username—not an email or phone number"
                    placeholderTextColor={light ? '#69777a' : '#829397'}
                    ref={coordinationHandleRef}
                    style={[styles.input, light && styles.inputLight, light && styles.textLight]}
                    value={draft.coordinationHandle}
                  />
                </View>
              ) : null}
              <ToggleField disabled={draft.coordinationMethod === 'none'} label="Share with accepted trade partners" light={light} onChange={(value) => {
                const startedAt = Date.now();
                update('shareTradeContact', value);
                markNativeUiPerformanceAfterPaint('settings_toggle_result_painted', startedAt);
              }} value={draft.shareTradeContact} />
              <View style={[styles.coordinationNote, light && styles.coordinationNoteLight]}><Text style={[styles.noteText, light && styles.textLight]}>These details are never added to search results. They become available only while a trade is accepted and active.</Text></View>
              <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => {
                clearTextInputFocus();
                feedbackPerformanceRef.current = Date.now();
                onSaveCoordination();
              }} style={[styles.save, isSaving && styles.disabled]}>
                <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save coordination'}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <View style={[styles.section, light && styles.sectionLight]}>
          <View style={styles.sectionHeader}>
            <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>THIS DEVICE</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Display</Text></View>
            <Text style={styles.sectionIcon}>{colorTheme === 'light' ? '☀' : '☾'}</Text>
          </View>
          <View style={[styles.themeRow, light && styles.toggleRowLight]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleLabel, light && styles.textLight]}>Color theme</Text>
              <Text style={[styles.help, styles.themeHelp, light && styles.mutedLight]}>
                Stored on this device and shared by every native screen.
              </Text>
            </View>
            <NativeThemeSwitch
              active
              dark={colorTheme === 'dark'}
              onPress={() => {
                const startedAt = Date.now();
                onChangeColorTheme(colorTheme === 'dark' ? 'light' : 'dark');
                markNativeUiPerformanceAfterPaint('theme_visible_palette_committed', startedAt);
              }}
              reduceMotion={reduceMotion}
            />
          </View>
          <ToggleField
            description="Use simpler page and instance transitions. Android's accessibility preference is also honored."
            label="Reduce motion"
            light={light}
            onChange={(value) => {
              const startedAt = Date.now();
              onChangeReduceMotion(value);
              markNativeUiPerformanceAfterPaint('settings_toggle_result_painted', startedAt);
            }}
            value={reduceMotion}
          />
        </View>

        <View style={[styles.section, light && styles.sectionLight]}>
          <View style={styles.sectionHeader}>
            <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>THIS DEVICE</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Pokémon synchronization</Text></View>
            <Text style={styles.sectionIcon}>↻</Text>
          </View>
          <View accessibilityLiveRegion="polite" style={[styles.syncRow, light && styles.toggleRowLight]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.syncTitle, light && styles.textLight]}>{syncSummary.title}</Text>
              <Text style={[styles.help, light && styles.mutedLight]}>{syncSummary.detail}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!syncSummary.canRetry}
              onPress={onRetrySync}
              style={[styles.syncRetry, light && styles.syncRetryLight, !syncSummary.canRetry && styles.disabled]}
            >
              <Text style={[styles.syncRetryText, light && styles.textLight]}>Retry now</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {feedback && !picker ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.feedback,
            styles.feedbackOverlay,
            { bottom: 12 },
            feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <Text style={styles.feedbackText}>{feedback.text}</Text>
          {onDismissFeedback ? (
            <Pressable accessibilityLabel="Dismiss message" accessibilityRole="button" onPress={onDismissFeedback} style={styles.feedbackDismissButton}>
              <Text style={styles.feedbackDismiss}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <NativeOptionPicker
        onClose={() => { clearTextInputFocus(); setPicker(null); }}
        onSelect={(entry) => {
          const startedAt = Date.now();
          pickerConfig?.select(entry.key);
          setPicker(null);
          markNativeUiPerformanceAfterPaint('settings_selection_result_painted', startedAt);
        }}
        options={pickerConfig?.options ?? []}
        selectedKey={pickerConfig?.selected ?? null}
        title={pickerConfig?.title ?? 'Setting'}
        visible={Boolean(pickerConfig)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#081012' },
  rootLight: { backgroundColor: '#f8fff9' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12, paddingHorizontal: 12 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#456265', borderRadius: 10, backgroundColor: '#171f20' },
  backLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#35a8ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#f7fbfa', fontSize: 25, fontWeight: '900' },
  feedback: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderWidth: 1, borderRadius: 10 },
  feedbackOverlay: { position: 'absolute', right: 12, left: 12, maxWidth: 736, alignSelf: 'center', zIndex: 4 },
  feedbackSuccess: { borderColor: '#2fbd79', backgroundColor: '#13372b' },
  feedbackError: { borderColor: '#ef5b72', backgroundColor: '#3a1820' },
  feedbackText: { flex: 1, color: '#ffffff', fontSize: 13, fontWeight: '800' },
  feedbackDismissButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  feedbackDismiss: { color: '#ffffff', fontSize: 24 },
  retry: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: { color: '#ffffff', fontWeight: '900' },
  status: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: '#9db5b4', fontWeight: '800' },
  section: { gap: 12, marginTop: 5, padding: 19, borderWidth: 1, borderColor: '#315052', borderRadius: 10, backgroundColor: '#171c1d' },
  sectionLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#315052' },
  sectionEyebrow: { color: '#92c7cc', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#f7fbfa', fontSize: 21, fontWeight: '900' },
  sectionIcon: { color: '#42d7c6', fontSize: 28 },
  sectionCopy: { color: '#9db5b4', fontSize: 13, lineHeight: 18 },
  field: { gap: 5 },
  fieldLabel: { color: '#92c7cc', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  select: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderWidth: 1, borderColor: '#456265', borderRadius: 8, backgroundColor: '#202728' },
  selectLight: { borderColor: '#9bb8b1', backgroundColor: '#e3efe8' },
  selectText: { color: '#f7fbfa', fontSize: 14, fontWeight: '800' },
  chevron: { color: '#9db5b4', fontSize: 21 },
  help: { color: '#9db5b4', fontSize: 12, lineHeight: 17, textAlign: 'right' },
  toggleRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: '#315052', borderRadius: 8, backgroundColor: '#202728' },
  themeRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: '#315052', borderRadius: 8, backgroundColor: '#202728' },
  themeHelp: { textAlign: 'left' },
  toggleRowLight: { borderColor: '#9bb8b1', backgroundColor: '#e3efe8' },
  toggleCopy: { flex: 1, gap: 2 },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { color: '#f7fbfa', fontSize: 13, fontWeight: '900' },
  toggleCheck: { width: 22, height: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#718284', borderRadius: 2, backgroundColor: '#263234' },
  toggleCheckLight: { borderColor: '#9bb8b1', backgroundColor: '#f9fffa' },
  toggleCheckActive: { borderColor: '#42d7c6', backgroundColor: '#42d7c6' },
  toggleCheckMark: { color: '#0a3b39', fontSize: 17, lineHeight: 19, fontWeight: '900' },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: '#456265', borderRadius: 8, backgroundColor: '#202728', color: '#f7fbfa', fontSize: 14, fontWeight: '700' },
  inputLight: { borderColor: '#9bb8b1', backgroundColor: '#f9fffa' },
  save: { minWidth: 148, minHeight: 40, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#42d7c6' },
  saveText: { color: '#061617', fontSize: 14, fontWeight: '900' },
  note: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#11191a' },
  noteLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  noteIcon: { color: '#42d7c6', fontSize: 23 },
  noteText: { flex: 1, color: '#f7fbfa', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  coordinationNote: { padding: 11, borderLeftWidth: 3, borderLeftColor: '#42d7c6', borderRadius: 6, backgroundColor: '#102526' },
  coordinationNoteLight: { backgroundColor: '#eaf8f6' },
  syncRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1, borderColor: '#315052', borderRadius: 8, backgroundColor: '#202728' },
  syncTitle: { color: '#f7fbfa', fontSize: 14, fontWeight: '900' },
  syncRetry: { minHeight: 44, minWidth: 86, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#42d7c6', borderRadius: 8, backgroundColor: '#163b3a' },
  syncRetryLight: { backgroundColor: '#eaf8f6' },
  syncRetryText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  textLight: { color: '#2f4744' },
  labelLight: { color: '#28636a' },
  mutedLight: { color: '#4b625e' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});
