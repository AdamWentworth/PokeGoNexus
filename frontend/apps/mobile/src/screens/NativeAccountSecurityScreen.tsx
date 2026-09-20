import type { AccountSecuritySummary, OAuthProvider } from '@pokemongonexus/shared-contracts/auth';
import { useEffect, useRef, useState, type RefObject } from 'react';
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
import { NativeBackIcon } from '../components/NativeBackIcon';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import { NativeSocialProviderIcon } from '../components/NativeSocialProviderIcon';
import { NativeSettingsWorkspaceNav } from '../components/NativeSettingsWorkspaceNav';
import { NativeUiIcon, type NativeUiIconName } from '../components/NativeUiIcon';
import {
  nativeOAuthProviderLabel,
  type NativeAccountSecurityDraft,
} from '../features/settings/nativeAccountSecurityModel';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
} from '../observability/nativeUiInteractionTiming';

type Confirmation =
  | { kind: 'delete'; title: string; body: string; confirmLabel: string }
  | { kind: 'revoke'; title: string; body: string; confirmLabel: string }
  | { kind: 'unlink'; provider: OAuthProvider; title: string; body: string; confirmLabel: string };

type Props = {
  draft: NativeAccountSecurityDraft;
  error?: string | null;
  feedback?: { tone: 'success' | 'error'; text: string } | null;
  isLoading?: boolean;
  onBack: () => void;
  onChange: (draft: NativeAccountSecurityDraft) => void;
  onConnectProvider: (provider: OAuthProvider) => void;
  onDeleteAccount: () => void;
  onDismissFeedback?: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onRevokeAllSessions: () => void;
  onSignOut: () => void;
  onUnlinkProvider: (provider: OAuthProvider) => void;
  onUpdateAccount: () => void;
  pendingAction?: string | null;
  security: AccountSecuritySummary | null;
};

type FieldProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words';
  help?: string;
  icon?: NativeUiIconName;
  label: string;
  light: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  inputRef?: RefObject<TextInput | null>;
  secureTextEntry?: boolean;
  value: string;
};

const AccountField = ({
  autoCapitalize = 'none',
  help,
  icon,
  label,
  light,
  onChangeText,
  placeholder,
  inputRef,
  secureTextEntry,
  value,
}: FieldProps) => (
  <View style={styles.field}>
    <View style={styles.fieldLabelRow}>
      {icon ? <NativeUiIcon color={light ? '#49666b' : '#92c7cc'} name={icon} size={13} /> : null}
      <Text style={[styles.fieldLabel, light && styles.labelLight]}>{label}</Text>
    </View>
    <TextInput
      accessibilityLabel={label}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={light ? '#69777a' : '#829397'}
      ref={inputRef}
      secureTextEntry={secureTextEntry}
      style={[styles.input, light && styles.inputLight, light && styles.textLight]}
      value={value}
    />
    {help ? <Text style={[styles.help, light && styles.mutedLight]}>{help}</Text> : null}
  </View>
);

const providerGlyphStyle = (provider: OAuthProvider) => {
  if (provider === 'google') return styles.providerGoogle;
  if (provider === 'discord') return styles.providerDiscord;
  return styles.providerFacebook;
};

export const NativeAccountSecurityScreen = ({
  draft,
  error = null,
  feedback = null,
  isLoading = false,
  onBack,
  onChange,
  onConnectProvider,
  onDeleteAccount,
  onDismissFeedback,
  onOpenSettings,
  onRetry,
  onRevokeAllSessions,
  onSignOut,
  onUnlinkProvider,
  onUpdateAccount,
  pendingAction = null,
  security,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationPasswordRef = useRef<TextInput>(null);
  const feedbackPerformanceRef = useRef<{ event: string; startedAt: number } | null>(null);
  const working = Boolean(pendingAction);
  const update = <K extends keyof NativeAccountSecurityDraft>(
    key: K,
    value: NativeAccountSecurityDraft[K],
  ) => onChange({ ...draft, [key]: value });
  const clearTextInputFocus = () => {
    Keyboard.dismiss();
  };
  const beginConfirmation = (next: Confirmation) => {
    const startedAt = captureNativeUiInteractionStart();
    clearTextInputFocus();
    setConfirmation(next);
    markNativeUiPerformanceAfterPaint('account_confirmation_painted', startedAt);
  };
  const dismissConfirmation = () => {
    confirmationPasswordRef.current?.blur();
    clearTextInputFocus();
    setConfirmation(null);
  };

  const confirmAction = () => {
    if (!confirmation) return;
    const action = confirmation;
    dismissConfirmation();
    feedbackPerformanceRef.current = action.kind === 'unlink'
      ? { event: 'account_provider_result_painted', startedAt: captureNativeUiInteractionStart() }
      : null;
    if (action.kind === 'delete') onDeleteAccount();
    if (action.kind === 'revoke') onRevokeAllSessions();
    if (action.kind === 'unlink') onUnlinkProvider(action.provider);
  };

  useEffect(() => {
    if (!feedback || feedbackPerformanceRef.current === null) return;
    const pending = feedbackPerformanceRef.current;
    feedbackPerformanceRef.current = null;
    markNativeUiPerformanceAfterPaint(pending.event, pending.startedAt);
  }, [feedback]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, light && styles.rootLight]}
      testID="native-account-security-screen"
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 12 + insets.top, paddingBottom: 144 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        testID="native-account-security-content"
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={[styles.back, light && styles.backLight]}>
            <NativeBackIcon color={light ? '#172124' : '#ffffff'} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Account</Text>
          </View>
        </View>

        <NativeSettingsWorkspaceNav active="account" onOpenAccount={() => {}} onOpenSettings={onOpenSettings} />

        {isLoading ? (
          <View style={styles.status}><ActivityIndicator color="#35a8ff" /><Text style={[styles.statusText, light && styles.mutedLight]}>Loading account security…</Text></View>
        ) : null}
        {error ? (
          <View accessibilityRole="alert" style={[styles.feedback, styles.feedbackError]}>
            <Text style={styles.feedbackText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        <View style={[styles.section, styles.firstSection, light && styles.sectionLight]}>
          <View style={[styles.sectionHeader, light && styles.sectionHeaderLight]}>
            <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>LOGIN IDENTITY</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Account details</Text></View>
            <NativeUiIcon color="#42d7c6" name="key" size={30} />
          </View>
          <AccountField icon="user" label="Username" light={light} onChangeText={(value) => update('username', value)} value={draft.username} />
          {security?.hasPassword ? (
            <AccountField
              help="Required when changing your email or password, signing out every device, or deleting your account."
              label="Current password"
              light={light}
              onChangeText={(value) => update('currentPassword', value)}
              placeholder="Required for security changes"
              secureTextEntry
              value={draft.currentPassword}
            />
          ) : (
            <View style={[styles.info, light && styles.infoLight]}><Text style={[styles.infoText, light && styles.textLight]}>Your recent provider sign-in confirms sensitive actions because this account has no password.</Text></View>
          )}
          <AccountField icon="email" label="Email" light={light} onChangeText={(value) => update('email', value)} value={draft.email} />
          <AccountField label="New password" light={light} onChangeText={(value) => update('newPassword', value)} placeholder="Leave blank to keep current password" secureTextEntry value={draft.newPassword} />
          <AccountField label="Confirm new password" light={light} onChangeText={(value) => update('confirmNewPassword', value)} secureTextEntry value={draft.confirmNewPassword} />
          <Pressable accessibilityRole="button" disabled={working} onPress={() => {
            clearTextInputFocus();
            feedbackPerformanceRef.current = {
              event: 'account_update_result_painted',
              startedAt: captureNativeUiInteractionStart(),
            };
            onUpdateAccount();
          }} style={[styles.primary, working && styles.disabled]}>
            <View style={styles.buttonLabel}><NativeUiIcon color="#061617" name="key" size={15} /><Text style={styles.primaryText}>{pendingAction === 'account' ? 'Saving…' : 'Update account'}</Text></View>
          </Pressable>
        </View>

        <View style={[styles.section, light && styles.sectionLight]}>
          <View style={[styles.sectionHeader, light && styles.sectionHeaderLight]}>
            <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>SIGN-IN METHODS</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Connected accounts</Text></View>
            <NativeUiIcon color="#42d7c6" name="key" size={30} />
          </View>
          <Text style={[styles.sectionCopy, light && styles.mutedLight]}>Verified providers open this same Pokémon Go Nexus account.</Text>
          {(['google', 'discord', 'facebook'] as OAuthProvider[]).map((provider) => {
            const identity = security?.providers.find((candidate) => candidate.provider === provider);
            const label = nativeOAuthProviderLabel(provider);
            return (
              <View key={provider} style={[styles.provider, light && styles.providerLight]}>
                <View style={[styles.providerGlyph, providerGlyphStyle(provider)]}>
                  <NativeSocialProviderIcon provider={provider} size={21} />
                </View>
                <View style={styles.providerCopy}>
                  <Text style={[styles.providerTitle, light && styles.textLight]}>{label}</Text>
                  <Text numberOfLines={2} style={[styles.help, light && styles.mutedLight]}>{identity ? identity.email || 'Verified provider identity' : 'Not connected'}</Text>
                </View>
                <Pressable
                  accessibilityLabel={`${identity ? 'Disconnect' : 'Connect'} ${label}`}
                  accessibilityRole="button"
                  disabled={working}
                  onPress={() => {
                    if (identity) {
                      beginConfirmation({
                        kind: 'unlink',
                        provider,
                        title: `Disconnect ${label}?`,
                        body: `You will no longer be able to sign in with ${label}.`,
                        confirmLabel: 'Disconnect',
                      });
                      return;
                    }
                    clearTextInputFocus();
                    feedbackPerformanceRef.current = {
                      event: 'account_provider_result_painted',
                      startedAt: captureNativeUiInteractionStart(),
                    };
                    onConnectProvider(provider);
                  }}
                  style={[styles.compactAction, light && styles.compactActionLight, working && styles.disabled]}
                >
                  <Text style={[styles.compactActionText, light && styles.textLight]}>{pendingAction === `provider-${provider}` ? 'Working…' : identity ? 'Disconnect' : 'Connect'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={[styles.section, light && styles.sectionLight]}>
          <View style={[styles.sectionHeader, light && styles.sectionHeaderLight]}>
            <View><Text style={[styles.sectionEyebrow, light && styles.labelLight]}>SESSION</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Sign out</Text></View>
            <NativeUiIcon color="#42d7c6" name="sign-out" size={30} />
          </View>
          <Text style={[styles.sectionCopy, light && styles.mutedLight]}>End this session and clear locally stored account data from this device.</Text>
          <Pressable accessibilityRole="button" disabled={working} onPress={() => { clearTextInputFocus(); onSignOut(); }} style={[styles.secondary, light && styles.secondaryLight, working && styles.disabled]}>
            <View style={styles.buttonLabel}><NativeUiIcon color={light ? '#172124' : '#ffffff'} name="sign-out" size={15} /><Text style={[styles.secondaryText, light && styles.textLight]}>Sign out</Text></View>
          </Pressable>
          <View style={[styles.sessionSummary, light && styles.providerLight]}>
            <NativeUiIcon color="#42d7c6" name="laptop" size={30} />
            <View style={styles.providerCopy}><Text style={[styles.providerTitle, light && styles.textLight]}>{security?.activeSessions ?? '—'} active sessions</Text><Text style={[styles.help, light && styles.mutedLight]}>Includes this device while its session is active.</Text></View>
          </View>
          <Pressable accessibilityLabel="Sign out every device" accessibilityRole="button" disabled={working} onPress={() => beginConfirmation({ kind: 'revoke', title: 'Sign out every device?', body: 'Every active session for this account will be revoked, including this device.', confirmLabel: 'Sign out every device' })} style={[styles.secondary, light && styles.secondaryLight, working && styles.disabled]}>
            <View style={styles.buttonLabel}><NativeUiIcon color={light ? '#172124' : '#ffffff'} name="laptop" size={15} /><Text style={[styles.secondaryText, light && styles.textLight]}>{pendingAction === 'revoke' ? 'Signing out…' : 'Sign out every device'}</Text></View>
          </Pressable>
        </View>

        <View style={[styles.section, styles.dangerSection, light && styles.dangerSectionLight]}>
          <View style={[styles.sectionHeader, light && styles.sectionHeaderLight]}>
            <View><Text style={styles.dangerEyebrow}>PERMANENT ACTION</Text><Text style={[styles.sectionTitle, light && styles.textLight]}>Delete account</Text></View>
            <NativeUiIcon color="#ef6a7e" name="trash" size={30} />
          </View>
          <Text style={[styles.sectionCopy, light && styles.mutedLight]}>Permanently remove your sign-in account, catalog, profile, trades, friendships, preferences, and active sessions.</Text>
          <Pressable accessibilityLabel="Permanently delete account" accessibilityRole="button" disabled={working} onPress={() => beginConfirmation({ kind: 'delete', title: 'Permanently delete your account?', body: 'Your account and all Pokémon Go Nexus data will be removed. This cannot be undone.', confirmLabel: 'Delete account' })} style={[styles.dangerButton, working && styles.disabled]} testID="native-account-delete-button"><View style={styles.buttonLabel}><NativeUiIcon color="#ffffff" name="trash" size={15} /><Text style={styles.dangerButtonText}>{pendingAction === 'delete' ? 'Deleting…' : 'Delete account'}</Text></View></Pressable>
        </View>
      </ScrollView>

      {feedback && !confirmation ? (
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

      <NativeConfirmationDialog
        body={confirmation?.body ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        isPending={working}
        onCancel={dismissConfirmation}
        onConfirm={confirmAction}
        title={confirmation?.title ?? 'Confirm action'}
        tone={confirmation?.kind === 'delete' ? 'danger' : 'default'}
        visible={Boolean(confirmation)}
      >
        {confirmation && security?.hasPassword ? (
          <AccountField
            help="Required to confirm this security change."
            icon="key"
            label="Current password"
            light={light}
            onChangeText={(value) => update('currentPassword', value)}
            placeholder="Enter your account password"
            inputRef={confirmationPasswordRef}
            secureTextEntry
            value={draft.currentPassword}
          />
        ) : confirmation ? (
          <View style={[styles.info, light && styles.infoLight]}>
            <Text style={[styles.infoText, light && styles.textLight]}>
              Your recent provider sign-in confirms this change. You do not need a separate password.
            </Text>
          </View>
        ) : null}
      </NativeConfirmationDialog>
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
  title: { color: '#f7fbfa', fontSize: 25, fontWeight: '900' },
  section: { gap: 14, paddingTop: 20, paddingHorizontal: 14, paddingBottom: 14, borderWidth: 1, borderColor: '#315052', borderRadius: 10, backgroundColor: '#171c1d' },
  firstSection: { marginTop: 4 },
  sectionLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: '#315052' },
  sectionHeaderLight: { borderBottomColor: '#9bb8b1' },
  sectionEyebrow: { color: '#92c7cc', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { marginTop: 6, color: '#f7fbfa', fontSize: 21, fontWeight: '900' },
  sectionCopy: { color: '#9db5b4', fontSize: 13, lineHeight: 18 },
  field: { gap: 5 },
  fieldLabelRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 5 },
  fieldLabel: { color: '#92c7cc', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#456265', borderRadius: 8, backgroundColor: '#202728', color: '#f7fbfa', fontSize: 14, fontWeight: '700' },
  inputLight: { borderColor: '#9bb8b1', backgroundColor: '#f9fffa' },
  help: { color: '#9db5b4', fontSize: 11, lineHeight: 15 },
  primary: { minWidth: 170, minHeight: 44, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#42d7c6' },
  primaryText: { color: '#061617', fontSize: 14, fontWeight: '900' },
  buttonLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  info: { padding: 11, borderLeftWidth: 3, borderLeftColor: '#42d7c6', borderRadius: 6, backgroundColor: '#102526' },
  infoLight: { backgroundColor: '#eaf8f6' },
  infoText: { color: '#f7fbfa', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  provider: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#202728' },
  providerLight: { borderColor: '#9bb8b1', backgroundColor: '#e3efe8' },
  providerGlyph: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  providerGoogle: { backgroundColor: '#ffffff' },
  providerDiscord: { backgroundColor: '#5865f2' },
  providerFacebook: { backgroundColor: '#1877f2' },
  providerCopy: { flex: 1, minWidth: 0 },
  providerTitle: { color: '#f7fbfa', fontSize: 14, fontWeight: '900' },
  compactAction: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#587174', borderRadius: 8, backgroundColor: '#171f20' },
  compactActionLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  compactActionText: { color: '#f7fbfa', fontSize: 12, fontWeight: '900' },
  sessionSummary: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#202728' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#536467', borderRadius: 8, backgroundColor: '#202728' },
  secondaryLight: { borderColor: '#9bb8b1', backgroundColor: '#e3efe8' },
  secondaryText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  dangerSection: { borderColor: '#81414b', backgroundColor: '#23171a' },
  dangerSectionLight: { borderColor: '#d7939d', backgroundColor: '#fff7f8' },
  dangerEyebrow: { color: '#ef6a7e', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dangerButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#cf4057' },
  dangerButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
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
  textLight: { color: '#2f4744' },
  labelLight: { color: '#28636a' },
  mutedLight: { color: '#4b625e' },
  disabled: { opacity: 0.5 },
});
