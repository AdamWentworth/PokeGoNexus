import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TurboModuleRegistry,
  useWindowDimensions,
} from 'react-native';
import type { TurboModule } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OAuthProvider } from '@pokemongonexus/shared-contracts/auth';
import type { Coordinates, LocationSuggestion } from '@pokemongonexus/shared-contracts/location';
import Svg, { Path } from 'react-native-svg';
import {
  buildNativeRegistrationRequest,
  createNativeRegistrationDraft,
  type NativeRegistrationDraft,
  validateNativeRegistrationStep,
} from '../features/auth/nativeRegistrationModel';
import { NativeLocationAutocompleteInput } from '../components/NativeLocationAutocompleteInput';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { NativeSocialProviderIcon } from '../components/NativeSocialProviderIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  NativeRegistrationLocationOptions,
  NativeRegistrationLocationPicker,
} from '../components/NativeRegistrationLocationPicker';
import { getNativeLocationOptions } from '../services/locationApi';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  initialDraft?: Partial<NativeRegistrationDraft>;
  notice?: string | null;
  onBackToLogin: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onRegister: (request: ReturnType<typeof buildNativeRegistrationRequest>) => Promise<void>;
  onOAuthStart: (provider: OAuthProvider) => Promise<{ code: string; email: string }>;
  onOAuthRegister: (
    code: string,
    request: Omit<ReturnType<typeof buildNativeRegistrationRequest>, 'email' | 'password'>,
  ) => Promise<void>;
  onRegistered: () => void;
  getCurrentCoordinates?: () => Promise<Coordinates>;
  getLocationOptions?: (latitude: number, longitude: number) => Promise<LocationSuggestion[]>;
};

type NativeLocationTurboModule = TurboModule & {
  getCurrentPosition: () => Promise<{
    coords: { latitude: number; longitude: number };
  }>;
  requestPermissions: () => Promise<void>;
};

const getNativeCurrentCoordinates = async (): Promise<Coordinates> => {
  if (Platform.OS === 'web') throw new Error('Device location is available in the installed app.');
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const allowed = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      || result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    if (!allowed) throw new Error('Location permission was not granted. You can type a place or choose it on the map.');
  }
  // Use MapLibre's already-linked location TurboModule directly. Importing
  // the package index on demand also evaluates every code-generated map view,
  // which Fast Refresh can attempt to register a second time.
  const locationModule = TurboModuleRegistry.get<NativeLocationTurboModule>('MLRNLocationModule');
  if (!locationModule) throw new Error('Device location is unavailable. You can type a place or choose it on the map.');
  if (Platform.OS === 'ios') await locationModule.requestPermissions();
  const position = await locationModule.getCurrentPosition();
  if (!position) throw new Error('Your current location is unavailable. You can type a place or choose it on the map.');
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
};

const SOCIAL_PROVIDERS: { provider: OAuthProvider; label: string }[] = [
  { provider: 'google', label: 'Sign up with Google' },
  { provider: 'discord', label: 'Sign up with Discord' },
  { provider: 'facebook', label: 'Sign up with Facebook' },
];

const STEP_COPY = [
  ['YOUR ACCOUNT', 'Choose how trainers know you here.'],
  ['PROTECT YOUR ACCOUNT', 'Use a strong password you do not use elsewhere.'],
  ['POKÉMON GO IDENTITY', 'Help friends recognize you. These details stay optional.'],
  ['YOUR AREA', 'Add a broad location to find nearby trainers, or do it later.'],
  ['READY TO JOIN', 'Review your details and create your trainer account.'],
] as const;

export const NativeRegisterScreen = ({
  getCurrentCoordinates = getNativeCurrentCoordinates,
  getLocationOptions = getNativeLocationOptions,
  initialDraft,
  notice = null,
  onBackToLogin,
  onOpenPrivacy,
  onOpenTerms,
  onOAuthRegister,
  onOAuthStart,
  onRegister,
  onRegistered,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const [draft, setDraft] = useState(() => ({
    ...createNativeRegistrationDraft(),
    ...initialDraft,
  }));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [method, setMethod] = useState<'email' | 'oauth' | null>(null);
  const [oauthCode, setOAuthCode] = useState<string | null>(null);
  const [oauthProvider, setOAuthProvider] = useState<OAuthProvider | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationSuggestion[]>([]);
  const [locationOptionsOpen, setLocationOptionsOpen] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const patch = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'username' && current.useUsernameAsPokemonGoName) {
        next.pokemonGoName = String(value);
      }
      return next;
    });
    setError(null);
  };
  const toggleUsernameAsPokemonGoName = () => {
    const startedAt = Date.now();
    setDraft((current) => {
      const enabled = !current.useUsernameAsPokemonGoName;
      return {
        ...current,
        pokemonGoName: enabled ? current.username : '',
        useUsernameAsPokemonGoName: enabled,
      };
    });
    setError(null);
    markNativeUiPerformanceAfterPaint('auth_registration_same_name_painted', startedAt);
  };
  const updateTypedLocation = (location: string) => {
    setDraft((current) => ({
      ...current,
      allowLocation: false,
      coordinates: null,
      location,
    }));
    setError(null);
  };
  const loadLocationOptions = async (coordinates: Coordinates, showStandaloneOptions: boolean) => {
    setLocationBusy(true);
    setLocationOptions([]);
    try {
      const options = await getLocationOptions(coordinates.latitude, coordinates.longitude);
      setLocationOptions(options);
      if (showStandaloneOptions && options.length > 0) setLocationOptionsOpen(true);
      if (options.length === 0) {
        setError('No broad place names were found for those coordinates. Try another point or type a place.');
      }
    } catch {
      setError('Unable to fetch location options. Please try again.');
    } finally {
      setLocationBusy(false);
    }
  };
  const toggleDeviceLocation = async () => {
    if (locationBusy) return;
    if (draft.allowLocation) {
      setDraft((current) => ({ ...current, allowLocation: false, coordinates: null }));
      setLocationOptions([]);
      setLocationOptionsOpen(false);
      return;
    }
    setError(null);
    setLocationBusy(true);
    try {
      const coordinates = await getCurrentCoordinates();
      setDraft((current) => ({ ...current, allowLocation: true, coordinates }));
      setLocationBusy(false);
      await loadLocationOptions(coordinates, true);
    } catch (caught) {
      setLocationBusy(false);
      setError(caught instanceof Error ? caught.message : 'Your current location is unavailable.');
    }
  };
  const selectMapCoordinates = (coordinates: Coordinates) => {
    setDraft((current) => ({ ...current, allowLocation: false, coordinates }));
    setError(null);
    void loadLocationOptions(coordinates, false);
  };
  const selectLocationOption = (location: LocationSuggestion) => {
    setDraft((current) => ({ ...current, location: location.displayName }));
    setLocationMapOpen(false);
    setLocationOptionsOpen(false);
    setLocationOptions([]);
    setError(null);
  };
  const continueOrSubmit = async () => {
    if (submitting) return;
    const validationError = step < 4 ? validateNativeRegistrationStep(draft, step) : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    if (step < 4) {
      const startedAt = Date.now();
      setStep((current) => method === 'oauth' && current === 0 ? 2 : current + 1);
      markNativeUiPerformanceAfterPaint('auth_registration_step_painted', startedAt);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const request = buildNativeRegistrationRequest(draft);
      if (method === 'oauth' && oauthCode) {
        const { email: _email, password: _password, ...oauthRequest } = request;
        await onOAuthRegister(oauthCode, oauthRequest);
      } else {
        await onRegister(request);
      }
      onRegistered();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account could not be created.');
    } finally {
      setSubmitting(false);
    }
  };
  const [eyebrow, description] = STEP_COPY[step] ?? STEP_COPY[0];
  const visibleSteps = method === 'oauth' ? [0, 2, 3, 4] : [0, 1, 2, 3, 4];
  const visibleStepIndex = Math.max(0, visibleSteps.indexOf(step));

  const startOAuth = async (provider: OAuthProvider) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const pending = await onOAuthStart(provider);
      setDraft((current) => ({ ...current, email: pending.email, password: '', confirmPassword: '' }));
      setOAuthCode(pending.code);
      setOAuthProvider(provider);
      setMethod('oauth');
      setStep(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Provider registration could not start.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectEmailRegistration = () => {
    const startedAt = Date.now();
    setMethod('email');
    markNativeUiPerformanceAfterPaint('auth_registration_method_painted', startedAt);
  };

  return (
    <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.root, light && styles.rootLight, compact && styles.rootCompact, compact && light && styles.rootCompactLight]} testID="native-register-screen">
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.content, compact && styles.contentCompact, { paddingTop: (compact ? 21 : 28) + insets.top, paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, light && styles.cardLight, compact && styles.cardCompact, compact && light && styles.cardCompactLight]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.brandEyebrow, light && styles.accentLight]}>TRAINER REGISTRATION</Text>
              <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact, light && styles.textLight]}>Create your account</Text>
              {!compact || method ? <Text style={[styles.subtitle, light && styles.mutedLight]}>A few quick steps, then your trainer journey begins.</Text> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onBackToLogin} style={[styles.signInButton, light && styles.secondaryLight]}>
              <Text style={[styles.signInText, light && styles.textLight]}>Sign in</Text>
            </Pressable>
          </View>
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={[styles.notice, light && styles.noticeLight]}>
              {notice}
            </Text>
          ) : null}
          {method ? (
            <>
              <View accessibilityLabel={`Step ${visibleStepIndex + 1} of ${visibleSteps.length}`} style={styles.progress}>
                {visibleSteps.map((stepNumber, index) => <View key={stepNumber} style={[styles.progressSegment, index <= visibleStepIndex && styles.progressActive]} />)}
              </View>
              <View style={styles.stepHeading}>
                <Text style={[styles.stepEyebrow, light && styles.accentLight]}>{eyebrow}</Text>
                <Text style={[styles.stepDescription, light && styles.mutedLight]}>{description}</Text>
              </View>
            </>
          ) : null}

          {!method ? (
            <View style={[styles.methodPicker, compact && styles.methodPickerCompact]}>
              {!compact ? <>
                <Text style={[styles.stepEyebrow, light && styles.accentLight]}>CHOOSE A SIGN-UP METHOD</Text>
                <Text style={[styles.methodTitle, light && styles.textLight]}>Start your trainer account</Text>
                <Text style={[styles.stepDescription, light && styles.mutedLight]}>Use a trusted provider or your email address.</Text>
              </> : null}
              {SOCIAL_PROVIDERS.map(({ provider, label }) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  key={provider}
                  onPress={() => void startOAuth(provider)}
                  style={[
                    styles.socialButton,
                    compact && styles.methodButtonCompact,
                    provider === 'google' && styles.googleButton,
                    provider === 'discord' && styles.discordButton,
                    provider === 'facebook' && styles.facebookButton,
                  ]}
                >
                  <View style={styles.socialGlyph}>
                    <NativeSocialProviderIcon provider={provider} />
                  </View>
                  <Text style={[styles.socialText, provider === 'google' && styles.googleText]}>{label}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" disabled={submitting} onPress={selectEmailRegistration} style={[styles.emailButton, compact && styles.methodButtonCompact, light && styles.secondaryLight]}>
                <View style={styles.emailButtonContent}>
                  <Svg height={18} viewBox="0 0 24 24" width={18}>
                    <Path d="M20 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" fill={light ? '#39504e' : '#ffffff'} />
                  </Svg>
                  <Text style={[styles.emailButtonText, light && styles.textLight]}>Continue with email</Text>
                </View>
              </Pressable>
              <Text style={[styles.providerNote, compact && styles.providerNoteCompact, light && styles.mutedLight]}>Your provider verifies your email. You will still choose a Pokémon Go Nexus username.</Text>
            </View>
          ) : null}

          {method && step === 0 ? (
            <View style={styles.fields}>
              <Field label="Username" light={light}>
                <TextInput
                  accessibilityLabel="Username"
                  autoCapitalize="none"
                  autoComplete="username-new"
                  onChangeText={(value) => patch('username', value.replace(/\s+/g, ''))}
                  onSubmitEditing={() => {
                    if (method === 'email') emailInputRef.current?.focus();
                    else void continueOrSubmit();
                  }}
                  placeholder="Choose a unique username"
                  placeholderTextColor="#718087"
                  returnKeyType={method === 'email' ? 'next' : 'done'}
                  style={[styles.input, light && styles.inputLight]}
                  submitBehavior="submit"
                  value={draft.username}
                />
              </Field>
              <Text style={[styles.help, light && styles.mutedLight]}>3–15 letters, numbers, or underscores.</Text>
              {method === 'email' ? (
                <Field label="Email" light={light}>
                  <TextInput
                    accessibilityLabel="Email"
                    autoCapitalize="none"
                    autoComplete="email"
                    inputMode="email"
                    onChangeText={(value) => patch('email', value)}
                    onSubmitEditing={() => void continueOrSubmit()}
                    placeholder="you@example.com"
                    placeholderTextColor="#718087"
                    ref={emailInputRef}
                    returnKeyType="done"
                    style={[styles.input, light && styles.inputLight]}
                    submitBehavior="blurAndSubmit"
                    value={draft.email}
                  />
                </Field>
              ) : (
                <View style={[styles.verifiedEmail, light && styles.secondaryLight]}>
                  <Text style={[styles.reviewLabel, light && styles.accentLight]}>{oauthProvider?.toLocaleUpperCase()} VERIFIED EMAIL</Text>
                  <Text style={[styles.reviewValue, light && styles.textLight]}>{draft.email}</Text>
                </View>
              )}
            </View>
          ) : null}

          {method === 'email' && step === 1 ? (
            <View style={styles.fields}>
              <Field label="Password" light={light}>
                <View>
                  <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete="new-password" onChangeText={(value) => patch('password', value)} placeholder="Create a password" placeholderTextColor="#718087" secureTextEntry={!passwordVisible} style={[styles.input, styles.passwordInput, light && styles.inputLight]} value={draft.password} />
                  <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} onPress={() => setPasswordVisible((current) => !current)} style={styles.eye}><Text style={[styles.eyeText, light && styles.mutedLight]}>{passwordVisible ? 'Hide' : 'Show'}</Text></Pressable>
                </View>
              </Field>
              <Field label="Confirm password" light={light}>
                <TextInput accessibilityLabel="Confirm password" autoCapitalize="none" autoComplete="new-password" onChangeText={(value) => patch('confirmPassword', value)} placeholder="Enter it again" placeholderTextColor="#718087" secureTextEntry={!passwordVisible} style={[styles.input, light && styles.inputLight]} value={draft.confirmPassword} />
              </Field>
              <View style={[styles.rules, light && styles.secondaryLight]}>
                <Text style={[styles.rulesText, light && styles.mutedLight]}>8+ characters · uppercase · lowercase · number · symbol</Text>
              </View>
            </View>
          ) : null}

          {method && step === 2 ? (
            <View style={styles.fields}>
              <Pressable
                accessibilityLabel={`Use ${draft.username || 'my username'} as my Pokémon GO name`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.useUsernameAsPokemonGoName }}
                onPress={toggleUsernameAsPokemonGoName}
                style={({ pressed }) => [styles.choice, light && styles.secondaryLight, pressed && styles.pressed]}
              >
                <View style={styles.choiceCopy}>
                  <Text style={[styles.choiceTitle, light && styles.textLight]}>Use {draft.username || 'my username'} as my Pokémon GO name</Text>
                  <Text style={[styles.choiceDetail, light && styles.mutedLight]}>One name across Pokémon Go Nexus and Pokémon GO.</Text>
                </View>
                <View style={[styles.checkbox, draft.useUsernameAsPokemonGoName && styles.checkboxChecked]}>
                  {draft.useUsernameAsPokemonGoName ? <Text style={styles.checkboxGlyph}>✓</Text> : null}
                </View>
              </Pressable>
              <Field label="Pokémon GO name" light={light}>
                <TextInput accessibilityLabel="Pokémon GO name" autoCapitalize="none" editable={!draft.useUsernameAsPokemonGoName} onChangeText={(value) => patch('pokemonGoName', value.replace(/\s+/g, ''))} placeholder="Optional" placeholderTextColor="#718087" style={[styles.input, draft.useUsernameAsPokemonGoName && styles.inputDisabled, light && styles.inputLight]} value={draft.pokemonGoName} />
              </Field>
              <Field label="Trainer code" light={light}>
                <TextInput accessibilityLabel="Trainer code" inputMode="numeric" maxLength={14} onChangeText={(value) => {
                  const clean = value.replace(/\D/g, '').slice(0, 12);
                  patch('trainerCode', clean.replace(/(\d{4})(?=\d)/g, '$1 '));
                }} placeholder="0000 0000 0000" placeholderTextColor="#718087" style={[styles.input, light && styles.inputLight]} value={draft.trainerCode} />
              </Field>
              <Text style={[styles.help, light && styles.mutedLight]}>You can add or change both later from Profile.</Text>
            </View>
          ) : null}

          {method && step === 3 ? (
            <View style={styles.fields}>
              <Field label="City or place" light={light}>
                <NativeLocationAutocompleteInput
                  accessibilityLabel="City or place"
                  light={light}
                  onChangeText={updateTypedLocation}
                  placeholder="City, region, country"
                  value={draft.location}
                />
              </Field>
              <Pressable
                accessibilityLabel="Use this device’s location"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.allowLocation, busy: locationBusy }}
                disabled={locationBusy}
                onPress={() => void toggleDeviceLocation()}
                style={({ pressed }) => [styles.choice, light && styles.secondaryLight, pressed && styles.pressed]}
              >
                <View style={styles.choiceCopy}>
                  <Text style={[styles.choiceTitle, light && styles.textLight]}>Use this device’s location</Text>
                  <Text style={[styles.choiceDetail, light && styles.mutedLight]}>Ask the phone for coordinates now. Exact coordinates stay private.</Text>
                </View>
                {locationBusy ? <ActivityIndicator color="#2098ff" /> : (
                  <View style={[styles.checkbox, draft.allowLocation && styles.checkboxChecked]}>
                    {draft.allowLocation ? <Text style={styles.checkboxGlyph}>✓</Text> : null}
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={draft.allowLocation || locationBusy}
                onPress={() => {
                  setLocationOptions([]);
                  setLocationMapOpen(true);
                }}
                style={[styles.mapButton, light && styles.secondaryLight, draft.allowLocation && styles.disabled]}
              >
                <NativeUiIcon color={light ? '#005bb5' : '#58abff'} name="map" size={18} />
                <Text style={[styles.mapButtonText, light && styles.accentLight]}>{draft.coordinates ? 'Adjust map position' : 'Choose on map'}</Text>
              </Pressable>
              {draft.coordinates ? (
                <Text accessibilityLabel="Coordinates selected" style={[styles.coordinateStatus, light && styles.mutedLight]}>
                  Coordinates selected · {draft.allowLocation ? 'from this device' : 'from map'}
                </Text>
              ) : null}
            </View>
          ) : null}

          {method && step === 4 ? (
            <View style={styles.review}>
              <ReviewRow label="ACCOUNT" light={light} onPress={() => setStep(0)} value={draft.username} />
              <ReviewRow label="EMAIL" light={light} onPress={() => setStep(0)} value={draft.email} />
              <ReviewRow label="TRAINER" light={light} onPress={() => setStep(2)} value={draft.pokemonGoName || 'Add later'} />
              <ReviewRow label="TRAINER CODE" light={light} onPress={() => setStep(2)} value={draft.trainerCode || 'Add later'} />
              <ReviewRow label="AREA" light={light} onPress={() => setStep(3)} value={draft.location || 'Add later'} />
              <Text style={[styles.agreement, light && styles.mutedLight]}>By creating an account, you agree to the{' '}<Text accessibilityRole="link" onPress={onOpenTerms} style={[styles.link, light && styles.accentLight]}>Terms</Text>{' '}and acknowledge the{' '}<Text accessibilityRole="link" onPress={onOpenPrivacy} style={[styles.link, light && styles.accentLight]}>Privacy Policy</Text>.</Text>
            </View>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={[styles.error, light && styles.errorLight]}>{error}</Text> : null}
          {method ? (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => {
                setError(null);
                if (step === 0) {
                  setMethod(null);
                  setOAuthCode(null);
                  setOAuthProvider(null);
                } else {
                  setStep((current) => method === 'oauth' && current === 2 ? 0 : current - 1);
                }
              }} style={[styles.backButton, light && styles.secondaryLight]}><Text style={[styles.backText, light && styles.textLight]}>‹ Back</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void continueOrSubmit()} style={styles.continueButton}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>{step === 4 ? 'Create account ✓' : 'Continue ›'}</Text>}</Pressable>
            </View>
          ) : submitting ? <ActivityIndicator color="#2098ff" style={styles.methodLoading} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <NativeRegistrationLocationPicker
      coordinates={draft.coordinates}
      light={light}
      loading={locationBusy}
      locations={locationOptions}
      onClose={() => {
        setLocationMapOpen(false);
        setLocationOptions([]);
      }}
      onSelectCoordinates={selectMapCoordinates}
      onSelectLocation={selectLocationOption}
      visible={locationMapOpen}
    />
    <NativeRegistrationLocationOptions
      light={light}
      locations={locationOptions}
      onClose={() => {
        setLocationOptionsOpen(false);
        setLocationOptions([]);
      }}
      onSelectLocation={selectLocationOption}
      visible={locationOptionsOpen}
    />
    </>
  );
};

const Field = ({ children, label, light }: { children: React.ReactNode; label: string; light: boolean }) => <View style={styles.field}><Text style={[styles.label, light && styles.textLight]}>{label}</Text>{children}</View>;
const ReviewRow = ({ label, light, onPress, value }: { label: string; light: boolean; onPress: () => void; value: string }) => <Pressable accessibilityRole="button" onPress={onPress} style={[styles.reviewRow, light && styles.secondaryLight]}><View style={styles.reviewCopy}><Text style={[styles.reviewLabel, light && styles.accentLight]}>{label}</Text><Text numberOfLines={1} style={[styles.reviewValue, light && styles.textLight]}>{value}</Text></View><Text style={[styles.edit, light && styles.accentLight]}>Edit</Text></Pressable>;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07111e' }, rootLight: { backgroundColor: '#f8fff9' },
  rootCompact: { backgroundColor: '#202224' }, rootCompactLight: { backgroundColor: '#eaf7f1' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 28 },
  contentCompact: { justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 21 },
  card: { width: '100%', maxWidth: 760, alignSelf: 'center', borderWidth: 1, borderColor: '#4179a1', borderRadius: 20, padding: 18, backgroundColor: '#202428' },
  cardLight: { borderColor: '#9bc2df', backgroundColor: '#fff' },
  cardCompact: { borderWidth: 0, borderRadius: 0, padding: 0, backgroundColor: 'transparent' },
  cardCompactLight: { backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, headerCopy: { flex: 1 },
  brandEyebrow: { color: '#2098ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  accentLight: { color: '#005bb5' },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' }, subtitle: { color: '#b3bec5', fontSize: 13, lineHeight: 18 },
  titleCompact: { fontSize: 26 },
  signInButton: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: '#68747b', borderRadius: 999, paddingHorizontal: 15, backgroundColor: '#282d31' }, signInText: { color: '#fff', fontWeight: '900' },
  progress: { flexDirection: 'row', gap: 5, marginVertical: 16 }, progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#485157' }, progressActive: { backgroundColor: '#2098ff' },
  stepHeading: { marginBottom: 12 }, stepEyebrow: { color: '#2098ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, stepDescription: { marginTop: 3, color: '#b3bec5', fontSize: 13 },
  fields: { gap: 10 }, field: { gap: 5 }, label: { color: '#f7fafb', fontSize: 13, fontWeight: '900' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#59666d', borderRadius: 11, paddingHorizontal: 14, color: '#f7fafb', backgroundColor: '#14191c', fontSize: 16 }, inputLight: { borderColor: '#aebdc4', color: '#152126', backgroundColor: '#fff' },
  passwordInput: { paddingRight: 62 }, eye: { position: 'absolute', right: 5, top: 4, minWidth: 52, height: 44, alignItems: 'center', justifyContent: 'center' }, eyeText: { color: '#b3bec5', fontSize: 12, fontWeight: '900' },
  help: { marginTop: -5, color: '#9caab0', fontSize: 11 }, rules: { borderRadius: 10, padding: 11, backgroundColor: '#17252d' }, rulesText: { color: '#afc6d1', fontSize: 11, fontWeight: '700' },
  choice: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, backgroundColor: '#172126' }, choiceCopy: { flex: 1 }, choiceTitle: { color: '#fff', fontWeight: '900' }, choiceDetail: { marginTop: 3, color: '#a7b6bd', fontSize: 11, lineHeight: 15 },
  mapButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#56636a', borderRadius: 11, backgroundColor: '#252b2f' },
  mapButtonText: { color: '#58abff', fontSize: 13, fontWeight: '900' },
  coordinateStatus: { marginTop: -3, color: '#a7b6bd', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#708087', borderRadius: 5, backgroundColor: '#101719' },
  checkboxChecked: { borderColor: '#2098ff', backgroundColor: '#2098ff' },
  checkboxGlyph: { color: '#fff', fontSize: 16, fontWeight: '900', lineHeight: 19 },
  inputDisabled: { opacity: 0.62 },
  pressed: { opacity: 0.72 },
  review: { gap: 8 }, reviewRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#414d52', borderRadius: 11, padding: 10, backgroundColor: '#181e21' }, reviewCopy: { flex: 1, minWidth: 0 }, reviewLabel: { color: '#2098ff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, reviewValue: { color: '#fff', fontSize: 14, fontWeight: '900' }, edit: { color: '#2098ff', fontWeight: '900' },
  agreement: { color: '#a7b6bd', fontSize: 11, lineHeight: 16, textAlign: 'center' }, link: { color: '#2098ff', fontWeight: '900' },
  error: { marginTop: 12, borderWidth: 1, borderColor: '#ef6077', borderRadius: 10, padding: 11, color: '#ffd5dc', backgroundColor: '#451923', fontWeight: '700' }, errorLight: { color: '#8f2638', backgroundColor: '#fff0f3' },
  notice: { marginTop: 12, borderWidth: 1, borderColor: '#2dd4bf', borderRadius: 10, padding: 11, color: '#ccfbf1', backgroundColor: '#123b37', fontWeight: '700', lineHeight: 19 },
  noticeLight: { color: '#155e55', backgroundColor: '#e7fff9' },
  actions: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  backButton: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#56636a', borderRadius: 11, paddingHorizontal: 16, backgroundColor: '#252b2f' }, backText: { color: '#fff', fontWeight: '900' },
  continueButton: { minWidth: 142, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 18, backgroundColor: '#0b86ee' }, continueText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryLight: { borderColor: '#b5c1c6', backgroundColor: '#f5f8f9' }, textLight: { color: '#142126' }, mutedLight: { color: '#5e7077' },
  methodPicker: { gap: 10, paddingTop: 4 },
  methodPickerCompact: { gap: 14, paddingTop: 38 },
  methodTitle: { color: '#fff', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  socialButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 16 },
  methodButtonCompact: { minHeight: 76, borderRadius: 15 },
  googleButton: { borderWidth: 1, borderColor: '#d9dee4', backgroundColor: '#fff' },
  discordButton: { backgroundColor: '#5865f2' },
  facebookButton: { backgroundColor: '#1265d6' },
  socialGlyph: { width: 29, alignItems: 'center', justifyContent: 'center' },
  socialText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  googleText: { color: '#202124' },
  emailButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#68747b', borderRadius: 12, backgroundColor: '#282d31' },
  emailButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  emailButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  providerNote: { color: '#a7b6bd', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  providerNoteCompact: { marginTop: 17, paddingHorizontal: 4, fontWeight: '700' },
  verifiedEmail: { gap: 3, borderWidth: 1, borderColor: '#3d5964', borderRadius: 11, padding: 12, backgroundColor: '#172126' },
  methodLoading: { marginTop: 12 },
});
