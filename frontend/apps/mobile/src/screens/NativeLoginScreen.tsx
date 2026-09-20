import { useState } from 'react';
import {
  ActivityIndicator,
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
import { NativeUiIcon } from '../components/NativeUiIcon';
import { ApiClientError } from '@pokemongonexus/shared-api-client';
import { theme } from '../ui/theme';
import { NativeSocialProviderIcon } from '../components/NativeSocialProviderIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type NativeLoginScreenProps = {
  notice?: string | null;
  onOpenPasswordReset: () => void;
  onSignIn: (username: string, password: string) => Promise<void>;
  onSocialSignIn: (provider: NativeLoginProvider) => Promise<void>;
  onSignedIn: () => void;
};

export type NativeLoginProvider = 'google' | 'discord' | 'facebook';

const SOCIAL_PROVIDERS: {
  label: string;
  provider: NativeLoginProvider;
}[] = [
  { label: 'Login with Google', provider: 'google' },
  { label: 'Login with Discord', provider: 'discord' },
  { label: 'Login with Facebook', provider: 'facebook' },
];

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiClientError && error.status === 401) {
    return 'That username, email, or password was not recognized.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Sign in could not be completed. Please try again.';
};

export const NativeLoginScreen = ({
  notice = null,
  onOpenPasswordReset,
  onSignIn,
  onSocialSignIn,
  onSignedIn,
}: NativeLoginScreenProps) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    username?: string;
  }>({});

  const submit = async () => {
    if (isSubmitting) return;
    const nextFieldErrors: typeof fieldErrors = {};
    if (!username.trim()) {
      nextFieldErrors.username = 'Username or Email is required.';
    } else if (
      username.includes('@')
      && !/^([a-zA-Z0-9_.+-])+@([a-zA-Z0-9-]+\.)+([a-zA-Z0-9]{2,4})+$/.test(username)
    ) {
      nextFieldErrors.username = 'Please enter a valid email address.';
    }
    if (!password) nextFieldErrors.password = 'Password is required.';
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onSignIn(username, password);
      onSignedIn();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSocial = async (provider: NativeLoginProvider) => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onSocialSignIn(provider);
      onSignedIn();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    const startedAt = Date.now();
    setPasswordVisible((visible) => !visible);
    markNativeUiPerformanceAfterPaint('auth_login_password_visibility_painted', startedAt);
  };

  const openPasswordReset = () => {
    const startedAt = Date.now();
    onOpenPasswordReset();
    markNativeUiPerformanceAfterPaint('auth_recovery_open_painted', startedAt);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-login-screen"
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingTop: 20 + insets.top, paddingBottom: 92 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, light && styles.cardLight]}>
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={[styles.notice, light && styles.noticeLight]}>
              {notice}
            </Text>
          ) : null}

          <Text style={[styles.label, light && styles.labelLight]}>Username or email</Text>
          <TextInput
            accessibilityLabel="Username or email"
            autoCapitalize="none"
            autoComplete="username"
            editable={!isSubmitting}
            onChangeText={setUsername}
            placeholder="Username or Email"
            placeholderTextColor="#64748b"
            returnKeyType="next"
            style={styles.input}
            value={username}
          />
          {fieldErrors.username ? (
            <Text accessibilityLiveRegion="polite" role="alert" style={[styles.fieldError, light && styles.fieldErrorLight]}>
              {fieldErrors.username}
            </Text>
          ) : null}

          <Text style={[styles.label, light && styles.labelLight]}>Password</Text>
          <View style={styles.passwordField}>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholder="Password"
              placeholderTextColor="#64748b"
              returnKeyType="go"
              secureTextEntry={!passwordVisible}
              style={[styles.input, styles.passwordInput]}
              value={password}
            />
            <Pressable
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
              accessibilityState={{ selected: passwordVisible }}
              onPress={togglePasswordVisibility}
              style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
            >
              <NativeUiIcon color="#536b75" name="eye" size={18} />
            </Pressable>
          </View>
          {fieldErrors.password ? (
            <Text accessibilityLiveRegion="polite" role="alert" style={[styles.fieldError, light && styles.fieldErrorLight]}>
              {fieldErrors.password}
            </Text>
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" role="alert" style={[styles.error, light && styles.errorLight]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[styles.primaryButton, isSubmitting && styles.disabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Login</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={openPasswordReset}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <Text style={[styles.resetButtonText, light && styles.resetButtonTextLight]}>Reset Password</Text>
          </Pressable>

          <View style={styles.socialButtons}>
            {SOCIAL_PROVIDERS.map(({ label, provider }) => (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                key={provider}
                onPress={() => void submitSocial(provider)}
                style={({ pressed }) => [
                  styles.socialButton,
                  provider === 'google' && styles.googleButton,
                  provider === 'discord' && styles.discordButton,
                  provider === 'facebook' && styles.facebookButton,
                  pressed && styles.socialPressed,
                ]}
              >
                <View style={styles.socialGlyph}>
                  <NativeSocialProviderIcon provider={provider} />
                </View>
                <Text style={[
                  styles.socialButtonText,
                  provider === 'google' && styles.googleButtonText,
                ]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f0f0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 92,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#555d61',
    borderRadius: 8,
    padding: 22,
    backgroundColor: '#222222',
  },
  cardLight: { borderColor: '#d7e5df', backgroundColor: '#e5f5ec' },
  label: { marginTop: 9, marginBottom: 2, color: '#ffffff', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  labelLight: { color: '#25443a' },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#c5ccd5',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  passwordToggle: { position: 'absolute', top: 5, right: 5, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  passwordToggleText: { color: '#52606d', fontSize: 18, fontWeight: '900' },
  fieldError: { color: '#fda4af', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  fieldErrorLight: { color: '#9f1239' },
  error: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fb7185',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    color: '#fecdd3',
    backgroundColor: '#4c0519',
    lineHeight: 20,
  },
  errorLight: { color: '#8d1e32', backgroundColor: '#fff0f3' },
  notice: {
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#2dd4bf',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    color: '#ccfbf1',
    backgroundColor: '#134e4a',
    lineHeight: 20,
  },
  noticeLight: { color: '#075b50', backgroundColor: '#e6fffa' },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 11,
    borderRadius: 12,
    backgroundColor: '#0067c9',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  resetButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: 10,
  },
  resetButtonText: { color: '#58abff', fontSize: 15, fontWeight: '900' },
  resetButtonTextLight: { color: '#005bb5' },
  socialButtons: { gap: 12, marginTop: 1 },
  socialButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent', borderRadius: 12 },
  googleButton: { borderColor: '#d8dce1', backgroundColor: '#ffffff' },
  discordButton: { backgroundColor: '#5865f2' },
  facebookButton: { backgroundColor: '#1265d6' },
  socialGlyph: { width: 29, alignItems: 'center', justifyContent: 'center' },
  socialButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  googleButtonText: { color: '#202124' },
  socialPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  pressed: { opacity: 0.72 },
});
