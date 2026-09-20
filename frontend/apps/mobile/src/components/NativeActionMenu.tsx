import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Appearance,
  BackHandler,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Line,
  Path,
} from 'react-native-svg';
import {
  useOptionalNativeDevicePreferences,
} from '../features/settings/NativeDevicePreferencesProvider';
import { useOptionalNativeSession } from '../auth/NativeSessionContext';
import { useNativeFriendsQuery } from '../features/social/socialQueries';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { useNativeAppLoading } from './NativeAppLoadingProvider';
import {
  NATIVE_ACTION_MENU_DESTINATIONS as DESTINATIONS,
  toNativeActionMenuAssetUrl as toAssetUrl,
} from './nativeActionMenuAssets';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';
import {
  actionMenuExperienceParityContract,
  themeSwitchExperienceParityContract,
} from '@pokemongonexus/shared-ui-tokens';
import { beginNativeUiInteraction } from '../interaction/nativeUiInteractionScheduler';

type Props = {
  assetBaseUrl: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
  /** Overrides the live session for isolated visual/device fixtures. */
  signedIn?: boolean;
  /** Supplies deterministic friend-request state to isolated visual/device fixtures. */
  pendingFriendCount?: number;
  visible: boolean;
};

const SUPPORT_GLYPHS = ['compass', 'question', 'info', 'shield', 'book'] as const;
type SupportGlyphName = typeof SUPPORT_GLYPHS[number];
const SUPPORT_DESTINATIONS = actionMenuExperienceParityContract.supportDestinations.map(
  (destination, index) => ({
    ...destination,
    glyph: SUPPORT_GLYPHS[index] ?? 'book',
  }),
);

const ACTION_MENU_NAVIGATION_SOURCE = 'action-menu-navigation';
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CSS_EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const THEME_STAR_PATH = 'M 0 10 C 10 10,10 10,0 10 C 10 10,10 10,10 20 C 10 10,10 10,20 10 C 10 10,10 10,10 0 C 10 10,10 10,0 10 Z';

const THEME_STARS = [
  { delay: 300, left: 3, size: 20, top: 2 },
  { delay: 0, left: 3, size: 6, top: 16 },
  { delay: 600, left: 10, size: 12, top: 20 },
  { delay: 1300, left: 18, size: 18, top: 0 },
] as const;

const THEME_CLOUDS = [
  { color: '#cccccc', delay: 1000, left: 30, size: 40, top: 15 },
  { color: '#cccccc', delay: 1000, left: 44, size: 20, top: 10 },
  { color: '#cccccc', delay: 1000, left: 18, size: 30, top: 24 },
  { color: '#eeeeee', delay: 0, left: 36, size: 40, top: 18 },
  { color: '#eeeeee', delay: 0, left: 48, size: 20, top: 14 },
  { color: '#eeeeee', delay: 0, left: 22, size: 30, top: 26 },
] as const;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

export const getNativeActionMenuGeometry = (
  width: number,
  height: number,
  bottomInset: number,
) => {
  const short = height <= 620;
  const shortestSide = Math.min(width, height);
  const iconSize = short
    ? clamp(height * 0.14, 54, 78)
    : clamp(width * 0.08, 66, 150);
  const closeBottom = Math.max(20, bottomInset);
  return {
    bottomCornerMaxWidth: Math.max(96, (width / 2) - 49),
    closeBottom,
    closeSize: width <= 480
      ? clamp(width * 0.12, 50, 80)
      : width < 768
        ? clamp(width * 0.1, 60, 90)
        : clamp(width * 0.035, 60, 80),
    closedDestinationY: (height / 2) - Math.max(25, bottomInset),
    columnOffset: clamp(shortestSide * 0.24, 112, 250),
    cornerBottom: Math.max(16, bottomInset),
    cornerIconSize: clamp(width * 0.04, 30, 40),
    destinationFontSize: short
      ? clamp(height * 0.028, 12.48, 16.8)
      : clamp(width * 0.015, 16.8, 28),
    destinationHeight: iconSize + 38,
    destinationWidth: clamp(width * 0.28, 92, 160),
    iconSize,
    rowOffset: short
      ? clamp(height * 0.22, 90, 126)
      : clamp(shortestSide * 0.22, 116, 220),
    smallUtilityFontSize: clamp(width * 0.0125, 12.48, 16.8),
    supportPanelWidth: width <= 520
      ? Math.max(240, width - 16)
      : Math.min(304, width - 32),
    utilityFontSize: width <= 520 ? 14.4 : clamp(width * 0.015, 15.2, 20),
  };
};

const ShareGlyph = ({ color }: { color: string }) => (
  <Svg height={20} viewBox="0 0 24 24" width={20}>
    <Line stroke={color} strokeLinecap="round" strokeWidth={2.6} x1={7} x2={17} y1={8} y2={5} />
    <Line stroke={color} strokeLinecap="round" strokeWidth={2.6} x1={7} x2={17} y1={16} y2={19} />
    <Circle cx={5} cy={12} fill={color} r={3.1} />
    <Circle cx={19} cy={4} fill={color} r={3.1} />
    <Circle cx={19} cy={20} fill={color} r={3.1} />
  </Svg>
);

const HelpGlyph = ({ color }: { color: string }) => (
  <Svg height={20} viewBox="0 0 24 24" width={20}>
    <Path
      d="M3 4.5h6.1A3.9 3.9 0 0 1 12 5.8v14.1a4.7 4.7 0 0 0-3.5-1.4H3v-14Zm18 0h-6.1A3.9 3.9 0 0 0 12 5.8v14.1a4.7 4.7 0 0 1 3.5-1.4H21v-14Z"
      fill={color}
    />
  </Svg>
);

const SupportGlyph = ({ color, name }: { color: string; name: SupportGlyphName }) => {
  if (name === 'compass') {
    return (
      <Svg height={14} viewBox="0 0 24 24" width={14}>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" fill={color} />
      </Svg>
    );
  }
  if (name === 'question') {
    return (
      <Svg height={14} viewBox="0 0 24 24" width={14}>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Path d="M9.7 9a2.5 2.5 0 1 1 3.3 2.36c-.8.3-1 .8-1 1.64" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
        <Circle cx={12} cy={17} fill={color} r={1.1} />
      </Svg>
    );
  }
  if (name === 'info') {
    return (
      <Svg height={14} viewBox="0 0 24 24" width={14}>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={7.7} fill={color} r={1.1} />
        <Line stroke={color} strokeLinecap="round" strokeWidth={2} x1={12} x2={12} y1={11} y2={17} />
      </Svg>
    );
  }
  if (name === 'shield') {
    return (
      <Svg height={14} viewBox="0 0 24 24" width={14}>
        <Path d="M12 3 20 6v5.4c0 4.7-3.1 7.7-8 9.6-4.9-1.9-8-4.9-8-9.6V6l8-3Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2} />
        <Path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg height={14} viewBox="0 0 24 24" width={14}>
      <Path d="M4.5 4.5H10a2 2 0 0 1 2 2V20a3.5 3.5 0 0 0-3.5-3.5h-4v-12Zm15 0H14a2 2 0 0 0-2 2V20a3.5 3.5 0 0 1 3.5-3.5h4v-12Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2} />
    </Svg>
  );
};

export const NativeThemeSwitch = ({
  active,
  dark,
  onPress,
  reduceMotion,
}: {
  active: boolean;
  dark: boolean;
  onPress: () => void;
  reduceMotion: boolean;
}) => {
  const [progress] = useState(() => new Animated.Value(dark ? 1 : 0));
  const [decorationProgress] = useState(() => new Animated.Value(dark ? 1 : 0));
  const [moonRotation] = useState(() => new Animated.Value(dark ? 1 : 0));
  const [orbColorProgress] = useState(() => new Animated.Value(dark ? 1 : 0));
  const [lightCloudProgress] = useState(() => new Animated.Value(0));
  const [darkCloudProgress] = useState(() => new Animated.Value(0));
  const [starProgress] = useState(() => THEME_STARS.map(() => new Animated.Value(0)));
  const slideRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotationRef = useRef<Animated.CompositeAnimation | null>(null);
  const targetDarkRef = useRef(dark);
  const pressStartedAtRef = useRef<number | null>(null);

  const animateToTheme = useCallback((nextDark: boolean) => {
    targetDarkRef.current = nextDark;
    const pressStartedAt = pressStartedAtRef.current;
    pressStartedAtRef.current = null;
    markNativeUiPerformance('theme_switch_animation_started', {
      interactionLatencyMs: pressStartedAt === null ? undefined : Date.now() - pressStartedAt,
      targetTheme: nextDark ? 'dark' : 'light',
    });
    // Vite does not declare a background-color transition on .sun-moon.
    orbColorProgress.setValue(nextDark ? 1 : 0);
    slideRef.current?.stop();
    rotationRef.current?.stop();

    if (!active || reduceMotion) {
      progress.setValue(nextDark ? 1 : 0);
      decorationProgress.setValue(nextDark ? 1 : 0);
      moonRotation.setValue(nextDark ? 1 : 0);
      return;
    }

    // The global theme change repaints most of the app. Restrict this
    // transition to opacity and transform so Android can keep it moving on
    // the native animation thread while React performs that repaint.
    slideRef.current = Animated.parallel([
      // Vite: .sun-moon { transition: transform 0.5s ease; }
      Animated.timing(progress, {
        duration: themeSwitchExperienceParityContract.slideTransitionMs,
        easing: CSS_EASE,
        isInteraction: false,
        toValue: nextDark ? 1 : 0,
        useNativeDriver: true,
      }),
      // Vite's track, stars, and moon dots transition over 0.4s ease.
      Animated.timing(decorationProgress, {
        duration: themeSwitchExperienceParityContract.decorationTransitionMs,
        easing: CSS_EASE,
        isInteraction: false,
        toValue: nextDark ? 1 : 0,
        useNativeDriver: true,
      }),
    ]);
    rotationRef.current = nextDark
      ? Animated.sequence([
        Animated.delay(themeSwitchExperienceParityContract.moonRotationDelayMs),
        Animated.timing(moonRotation, {
          duration: themeSwitchExperienceParityContract.moonRotationMs,
          easing: CSS_EASE_IN_OUT,
          isInteraction: false,
          toValue: 1,
          useNativeDriver: true,
        }),
      ])
      : Animated.timing(moonRotation, {
        duration: 0,
        isInteraction: false,
        toValue: 0,
        useNativeDriver: true,
    });
    slideRef.current.start();
    rotationRef.current.start();
  }, [active, decorationProgress, moonRotation, orbColorProgress, progress, reduceMotion]);

  useLayoutEffect(() => {
    if (!active) {
      targetDarkRef.current = dark;
      slideRef.current?.stop();
      rotationRef.current?.stop();
      progress.setValue(dark ? 1 : 0);
      decorationProgress.setValue(dark ? 1 : 0);
      moonRotation.setValue(dark ? 1 : 0);
      orbColorProgress.setValue(dark ? 1 : 0);
      return;
    }

    // A press starts the visual transition before it asks the provider to
    // repaint the app. Do not restart that transition when the provider's
    // matching prop update arrives on the following frame.
    if (targetDarkRef.current !== dark) animateToTheme(dark);
  }, [active, animateToTheme, dark, decorationProgress, moonRotation, orbColorProgress, progress]);

  useEffect(() => () => {
    slideRef.current?.stop();
    rotationRef.current?.stop();
  }, []);

  useEffect(() => {
    const ambientValues = [lightCloudProgress, darkCloudProgress, ...starProgress];
    if (!active || reduceMotion) {
      ambientValues.forEach((value) => value.setValue(0));
      return undefined;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const animations: Animated.CompositeAnimation[] = [];
    const startCloudLoop = (value: Animated.Value, delay: number) => {
      const start = () => {
        const animation = Animated.loop(Animated.sequence([
          Animated.timing(value, { duration: 2400, easing: Easing.linear, toValue: 1, useNativeDriver: true }),
          Animated.timing(value, { duration: 2400, easing: Easing.linear, toValue: -1, useNativeDriver: true }),
          Animated.timing(value, { duration: 1200, easing: Easing.linear, toValue: 0, useNativeDriver: true }),
        ]));
        animations.push(animation);
        animation.start();
      };
      if (delay > 0) timers.push(setTimeout(start, delay));
      else start();
    };
    // Let the canonical 300 ms menu fan claim the interaction frame first;
    // these purely ambient loops can begin once every control is in place.
    timers.push(setTimeout(() => {
      startCloudLoop(lightCloudProgress, 0);
      startCloudLoop(darkCloudProgress, 1000);

      starProgress.forEach((value, index) => {
        const start = () => {
          const animation = Animated.loop(Animated.timing(value, {
            duration: 2000,
            easing: Easing.linear,
            toValue: 1,
            useNativeDriver: true,
          }));
          animations.push(animation);
          animation.start();
        };
        const delay = THEME_STARS[index]?.delay ?? 0;
        if (delay > 0) timers.push(setTimeout(start, delay));
        else start();
      });
    }, 320));

    return () => {
      timers.forEach(clearTimeout);
      animations.forEach((animation) => animation.stop());
    };
  }, [active, darkCloudProgress, lightCloudProgress, reduceMotion, starProgress]);

  const cloudTranslate = (delay: number) => (
    delay > 0 ? darkCloudProgress : lightCloudProgress
  ).interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, 4] });

  const handlePress = () => {
    const nextDark = !targetDarkRef.current;
    pressStartedAtRef.current = Date.now();
    onPress();
    // Give the control immediate native-thread feedback. The matching prop
    // update from the menu's optimistic palette will not restart this motion.
    animateToTheme(nextDark);
  };

  return (
    <Pressable
      aria-checked={dark}
      accessibilityLabel={`Use ${dark ? 'light' : 'dark'} theme`}
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      onPress={handlePress}
      style={styles.themeSwitch}
      testID="native-theme-switch"
    >
      <View
        pointerEvents="none"
        style={styles.themeTrack}
        testID="native-theme-switch-track"
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.themeDarkTrack, { opacity: decorationProgress }]}
          testID="native-theme-switch-dark-track"
        />
        <Animated.View
          style={[
            styles.themeStars,
            {
              opacity: decorationProgress,
              transform: [{
                translateY: decorationProgress.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }),
              }],
            },
          ]}
          testID="native-theme-stars"
        >
          {THEME_STARS.map((star, index) => (
            <Animated.View
              key={`${star.left}:${star.top}:${star.size}`}
              style={{
                position: 'absolute',
                left: star.left,
                top: star.top,
                transform: [{
                  scale: starProgress[index].interpolate({
                    inputRange: [0, 0.4, 0.8, 1],
                    outputRange: [1, 1.2, 0.8, 1],
                  }),
                }],
              }}
              testID={`native-theme-star-${index + 1}`}
            >
              <Svg height={star.size} viewBox="0 0 20 20" width={star.size}>
                <Path d={THEME_STAR_PATH} fill="#ffffff" />
              </Svg>
            </Animated.View>
          ))}
        </Animated.View>
        <Animated.View
          style={[
            styles.themeOrbMover,
            {
              transform: [{
                translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }),
              }],
            },
          ]}
          testID="native-theme-sun-moon"
        >
          <Animated.View
            style={[
              styles.themeOrbRotation,
              {
                transform: [{
                  rotate: moonRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                }],
              },
            ]}
          >
            {[43, 55, 60].map((size, index) => (
              <View
                key={size}
                style={[
                  styles.themeLightRay,
                  {
                    height: size,
                    left: [-8, -13, -18][index],
                    top: [-8, -13, -18][index],
                    width: size,
                  },
                ]}
                testID={`native-theme-light-ray-${index + 1}`}
              />
            ))}
            <View style={styles.themeSunDisc} />
            <Animated.View style={[styles.themeMoonDisc, { opacity: orbColorProgress }]} />
            {THEME_CLOUDS.map((cloud, index) => (
              <Animated.View
                key={`${cloud.color}:${cloud.left}:${cloud.top}:${cloud.size}`}
                style={{
                  position: 'absolute',
                  left: cloud.left,
                  top: cloud.top,
                  zIndex: 2,
                  width: cloud.size,
                  height: cloud.size,
                  borderRadius: cloud.size / 2,
                  backgroundColor: cloud.color,
                  transform: [{ translateX: cloudTranslate(cloud.delay) }],
                }}
                testID={`native-theme-cloud-${index + 1}`}
              />
            ))}
            <Animated.View style={[styles.moonCrater, styles.moonCraterOne, { opacity: decorationProgress }]} />
            <Animated.View style={[styles.moonCrater, styles.moonCraterTwo, { opacity: decorationProgress }]} />
            <Animated.View style={[styles.moonCrater, styles.moonCraterThree, { opacity: decorationProgress }]} />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
};

const NativeProfileButton = ({
  assetBaseUrl,
  bottom,
  count,
  iconSize,
  light,
  labelFontSize,
  maxWidth,
  onPress,
  palette,
}: {
  assetBaseUrl: string;
  bottom: number;
  count: number;
  iconSize: number;
  light: boolean;
  labelFontSize: number;
  maxWidth: number;
  onPress: () => void;
  palette: typeof DARK;
}) => {
  const normalizedCount = Math.max(0, Math.floor(count));
  const accessibilityLabel = normalizedCount > 0
    ? `Profile, ${normalizedCount} pending friend ${normalizedCount === 1 ? 'request' : 'requests'}`
    : 'Profile';
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.cornerButton,
        styles.profileButton,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          bottom,
          maxWidth,
        },
      ]}
      testID="native-action-menu-profile"
    >
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.15}
        minimumFontScale={0.85}
        numberOfLines={1}
        style={[styles.cornerLabel, { color: palette.text, fontSize: labelFontSize }]}
      >
        Profile
      </Text>
      <View style={styles.profileImageWrap}>
        <Image
          fadeDuration={0}
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/profile-icon.png') }}
          style={[
            styles.cornerImage,
            { height: iconSize, width: iconSize },
            light && styles.cornerImageLight,
          ]}
          testID="native-action-menu-profile-icon"
        />
        {normalizedCount > 0 ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.notification, { borderColor: palette.surface }]}>
            <Text maxFontSizeMultiplier={1} style={styles.notificationText}>
              {normalizedCount > 9 ? '9+' : normalizedCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const LiveNativeProfileButton = ({ viewerId, ...props }: Omit<Parameters<typeof NativeProfileButton>[0], 'count'> & { viewerId: string }) => {
  const friendsQuery = useNativeFriendsQuery(viewerId);
  return <NativeProfileButton {...props} count={friendsQuery.data?.incoming.length ?? 0} />;
};

export const NativeActionMenu = ({
  assetBaseUrl,
  onClose,
  onNavigate,
  pendingFriendCount = 0,
  signedIn,
  visible,
}: Props) => {
  const insets = useSafeAreaInsets();
  const scheme = useNativeColorScheme();
  const devicePreferences = useOptionalNativeDevicePreferences();
  const { runWithLoading, setLoadingSource } = useNativeAppLoading();
  const session = useOptionalNativeSession();
  const isSignedIn = signedIn ?? Boolean(session?.user);
  const reduceMotion = devicePreferences?.shouldReduceMotion ?? false;
  const { height, width } = useWindowDimensions();
  const [supportOpen, setSupportOpen] = useState(false);
  const [optimisticScheme, setOptimisticScheme] = useState<'dark' | 'light' | null>(null);
  const [menuProgress] = useState(() => new Animated.Value(0));
  const [supportProgress] = useState(() => new Animated.Value(0));
  const closingRef = useRef(false);
  const menuInteractionReleaseRef = useRef<(() => void) | null>(null);
  const themeCommitFrameRef = useRef<number | null>(null);
  const themeSwitchStartedAtRef = useRef<number | null>(null);
  const previousSchemeRef = useRef(scheme);
  const displayedScheme = optimisticScheme ?? scheme;
  const previousDisplayedSchemeRef = useRef(displayedScheme);
  const light = displayedScheme === 'light';

  const palette = light ? LIGHT : DARK;
  const {
    bottomCornerMaxWidth,
    closeBottom,
    closeSize,
    closedDestinationY,
    columnOffset,
    cornerBottom,
    cornerIconSize,
    destinationFontSize,
    destinationHeight,
    destinationWidth,
    iconSize,
    rowOffset,
    smallUtilityFontSize,
    supportPanelWidth,
    utilityFontSize,
  } = getNativeActionMenuGeometry(width, height, insets.bottom);
  const topInset = Math.max(16, insets.top);

  useLayoutEffect(() => {
    if (previousSchemeRef.current === scheme) return;
    previousSchemeRef.current = scheme;
    markNativeUiPerformance('theme_palette_committed', { theme: scheme });
  }, [scheme]);

  useLayoutEffect(() => {
    if (previousDisplayedSchemeRef.current === displayedScheme) return;
    previousDisplayedSchemeRef.current = displayedScheme;
    const startedAt = themeSwitchStartedAtRef.current;
    themeSwitchStartedAtRef.current = null;
    markNativeUiPerformance('theme_visible_palette_committed', {
      interactionLatencyMs: startedAt === null ? undefined : Date.now() - startedAt,
      theme: displayedScheme,
    });
  }, [displayedScheme]);

  useEffect(() => () => {
    if (themeCommitFrameRef.current !== null) {
      cancelAnimationFrame(themeCommitFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      menuInteractionReleaseRef.current?.();
      menuInteractionReleaseRef.current = null;
      menuProgress.setValue(0);
      closingRef.current = false;
      return undefined;
    }

    menuInteractionReleaseRef.current?.();
    menuInteractionReleaseRef.current = beginNativeUiInteraction();

    if (reduceMotion) {
      menuProgress.setValue(1);
      const frame = requestAnimationFrame(() => {
        menuInteractionReleaseRef.current?.();
        menuInteractionReleaseRef.current = null;
      });
      return () => {
        cancelAnimationFrame(frame);
        menuInteractionReleaseRef.current?.();
        menuInteractionReleaseRef.current = null;
      };
    }

    closingRef.current = false;
    menuProgress.setValue(0);
    markNativeUiPerformance('action_menu_animation_started');
    const animation = Animated.timing(menuProgress, {
      // Android has already paid the separate Modal-window presentation cost
      // by the time this effect runs. Beginning immediately keeps the perceived
      // entrance aligned with Vite instead of adding its browser-only delay a
      // second time on native.
      delay: 0,
      duration: actionMenuExperienceParityContract.motion.openMs,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      menuInteractionReleaseRef.current?.();
      menuInteractionReleaseRef.current = null;
      if (finished) {
        markNativeUiPerformance('action_menu_animation_finished');
      }
    });
    return () => {
      animation.stop();
      menuInteractionReleaseRef.current?.();
      menuInteractionReleaseRef.current = null;
    };
  }, [menuProgress, reduceMotion, visible]);

  useEffect(() => {
    if (!supportOpen) {
      supportProgress.setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      supportProgress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(supportProgress, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, supportOpen, supportProgress]);

  const navigate = (path: string) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setSupportOpen(false);
    markNativeUiPerformance('action_menu_destination_pressed', { path });
    // The root loader is permanently mounted and decoded. Reveal that single
    // retained surface, allow it one actual paint, then start destination work.
    // This avoids a phase-resetting handoff between menu and root spinners.
    setLoadingSource(ACTION_MENU_NAVIGATION_SOURCE, true);
    markNativeUiPerformance('action_menu_navigation_feedback_started', { path });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      onClose();
      runWithLoading(ACTION_MENU_NAVIGATION_SOURCE, () => {
        onNavigate(path);
      });
    }));
  };
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setSupportOpen(false);
    if (reduceMotion) {
      onClose();
      return;
    }
    menuInteractionReleaseRef.current?.();
    menuInteractionReleaseRef.current = beginNativeUiInteraction();
    Animated.timing(menuProgress, {
      duration: actionMenuExperienceParityContract.motion.closeMs,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      menuInteractionReleaseRef.current?.();
      menuInteractionReleaseRef.current = null;
      if (finished) onClose();
    });
  }, [menuProgress, onClose, reduceMotion]);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (supportOpen) {
        setSupportOpen(false);
        return true;
      }
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close, supportOpen, visible]);
  const toggleTheme = () => {
    const nextTheme = light ? 'dark' : 'light';
    themeSwitchStartedAtRef.current = Date.now();
    markNativeUiPerformance('theme_switch_pressed', {
      currentTheme: displayedScheme,
      reduceMotion,
    });
    // The full-screen menu is the only visible surface. Paint its next palette
    // in this input update, then let the much more expensive route tree catch
    // up on the following frame behind it.
    setOptimisticScheme(nextTheme);
    if (themeCommitFrameRef.current !== null) {
      cancelAnimationFrame(themeCommitFrameRef.current);
    }
    themeCommitFrameRef.current = requestAnimationFrame(() => {
      themeCommitFrameRef.current = null;
      if (devicePreferences?.setColorTheme) devicePreferences.setColorTheme(nextTheme);
      else if (devicePreferences) devicePreferences.toggleColorTheme();
      else Appearance.setColorScheme(nextTheme);
      // This update is batched with the provider update. The already-painted
      // optimistic palette remains on screen while the route tree renders.
      setOptimisticScheme(null);
    });
  };

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      accessibilityLabel="Quick navigation"
      accessibilityViewIsModal={visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.overlay,
        {
          backgroundColor: palette.gradientEnd,
          elevation: visible ? 24 : -1,
          opacity: menuProgress,
          zIndex: visible ? 2000 : -1,
        },
      ]}
      testID="native-action-menu"
    >
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
          testID="native-action-menu-background"
        />

        {isSignedIn ? (
          <Pressable
            accessibilityLabel="Share Trade Board"
            accessibilityRole="button"
            onPress={() => navigate('/trade-board')}
            style={[
              styles.cornerButton,
              styles.tradeBoardButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                top: topInset,
              },
            ]}
          >
            <ShareGlyph color={palette.trade} />
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.15}
                minimumFontScale={0.9}
                numberOfLines={2}
              style={[
                styles.cornerLabel,
                styles.tradeBoardLabel,
                { color: palette.text, fontSize: smallUtilityFontSize },
              ]}
            >
              Share Trade Board
            </Text>
          </Pressable>
        ) : null}

        <View
          style={[styles.settingsCluster, { top: topInset }]}
          testID="native-action-menu-settings-cluster"
        >
          <Pressable
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() => navigate('/settings')}
            style={[
              styles.cornerButton,
              styles.settingsButton,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.15}
              minimumFontScale={0.85}
              numberOfLines={1}
              style={[styles.cornerLabel, { color: palette.text, fontSize: utilityFontSize }]}
            >
              Settings
            </Text>
            <Image
              fadeDuration={0}
              source={{ uri: toAssetUrl(assetBaseUrl, '/images/btn_settings.png') }}
              style={[
                styles.cornerImage,
                { height: cornerIconSize, width: cornerIconSize },
                light && styles.cornerImageLight,
              ]}
            />
          </Pressable>
          <NativeThemeSwitch
            active={visible}
            dark={!light}
            onPress={toggleTheme}
            reduceMotion={reduceMotion}
          />
        </View>

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {DESTINATIONS.map((destination) => {
            const [column, row] = destination.position;
            const left = (width / 2) - (destinationWidth / 2);
            const top = (height / 2) - (destinationHeight / 2);
            return (
              <Animated.View
                key={destination.path}
                style={[
                  styles.destination,
                  {
                    height: destinationHeight,
                    left,
                    opacity: menuProgress,
                    top,
                    transform: [
                      {
                        translateX: menuProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, column * columnOffset],
                        }),
                      },
                      {
                        translateY: menuProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [closedDestinationY, row * rowOffset],
                        }),
                      },
                    ],
                    width: destinationWidth,
                  },
                ]}
                testID={`native-action-menu-item-${destination.path === '/' ? 'home' : destination.path.slice(1)}`}
              >
                <Pressable
                  accessibilityLabel={destination.label}
                  accessibilityRole="button"
                  onPress={() => navigate(destination.path)}
                  style={({ pressed }) => [styles.destinationPressable, pressed && styles.pressed]}
                  testID={`native-action-menu-destination-${destination.path === '/' ? 'home' : destination.path.slice(1)}`}
                >
                  <Image
                    fadeDuration={0}
                    resizeMode="contain"
                    source={{ uri: toAssetUrl(assetBaseUrl, destination.icon) }}
                    style={{ height: iconSize, width: iconSize }}
                  />
                  <Text
                    adjustsFontSizeToFit
                    maxFontSizeMultiplier={1.15}
                    minimumFontScale={0.78}
                    numberOfLines={1}
                    style={[
                      styles.destinationLabel,
                      { color: palette.text, fontSize: destinationFontSize, width: destinationWidth },
                    ]}
                  >
                    {destination.label}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {isSignedIn ? (
          session?.user ? (
            <LiveNativeProfileButton
              assetBaseUrl={assetBaseUrl}
              bottom={cornerBottom}
              iconSize={cornerIconSize}
              labelFontSize={utilityFontSize}
              light={light}
              maxWidth={bottomCornerMaxWidth}
              onPress={() => navigate('/profile')}
              palette={palette}
              viewerId={session.user.user_id}
            />
          ) : (
            <NativeProfileButton
              assetBaseUrl={assetBaseUrl}
              bottom={cornerBottom}
              count={pendingFriendCount}
              iconSize={cornerIconSize}
              labelFontSize={utilityFontSize}
              light={light}
              maxWidth={bottomCornerMaxWidth}
              onPress={() => navigate('/profile')}
              palette={palette}
            />
          )
        ) : (
          <View style={[styles.guestAuthCluster, { bottom: cornerBottom }]}>
            {[
              ['Register', '/register', '/images/register-icon.png'],
              ['Login', '/login', '/images/login-icon.png'],
            ].map(([label, path, icon]) => (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="button"
                key={path}
                onPress={() => navigate(path)}
                style={[
                  styles.cornerButton,
                  styles.guestAuthButton,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={1.15}
                  minimumFontScale={0.85}
                  numberOfLines={1}
                  style={[styles.cornerLabel, { color: palette.text, fontSize: utilityFontSize }]}
                >
                  {label}
                </Text>
                <Image
                  fadeDuration={0}
                  source={{ uri: toAssetUrl(assetBaseUrl, icon) }}
                  style={[styles.guestAuthImage, light && styles.cornerImageLight]}
                />
              </Pressable>
            ))}
          </View>
        )}

        <View
          style={[styles.supportCluster, { bottom: cornerBottom }]}
          testID="native-action-menu-support-cluster"
        >
          {supportOpen ? (
            <Animated.View
              style={[
                styles.supportPanel,
                {
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                  marginRight: width <= 520 ? -8 : 0,
                  opacity: supportProgress,
                  transform: [{
                    translateY: supportProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6.4, 0],
                    }),
                  }, {
                    scale: supportProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  }],
                  width: supportPanelWidth,
                },
              ]}
              testID="native-action-menu-support-panel"
            >
              <Text style={[styles.supportEyebrow, { color: palette.focus }]}>LEARN &amp; SUPPORT</Text>
              {SUPPORT_DESTINATIONS.map(({ glyph, label, path }) => (
                <Pressable
                  accessibilityRole="button"
                  key={path}
                  onPress={() => navigate(path)}
                  style={({ pressed }) => [styles.supportLink, pressed && styles.pressed]}
                >
                  <View style={styles.supportLinkIcon} testID={`native-support-glyph-${glyph}`}>
                    <SupportGlyph color={palette.focus} name={glyph} />
                  </View>
                  <Text style={[styles.supportLinkText, { color: palette.text }]}>{label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}
          <Pressable
            accessibilityLabel="Learn and support"
            accessibilityRole="button"
            accessibilityState={{ expanded: supportOpen }}
            onPress={() => setSupportOpen((current) => !current)}
            style={[
              styles.cornerButton,
              styles.helpButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                maxWidth: bottomCornerMaxWidth,
              },
            ]}
          >
            <HelpGlyph color={palette.focus} />
            <Text
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.15}
              minimumFontScale={0.8}
              numberOfLines={1}
              style={[styles.cornerLabel, { color: palette.text, fontSize: smallUtilityFontSize }]}
            >
              Learn &amp; support
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={close}
          style={[
            styles.closeButton,
            {
              bottom: closeBottom,
              height: closeSize,
              marginLeft: -(closeSize / 2),
              width: closeSize,
            },
          ]}
          testID="native-action-menu-close"
        >
          <Image
            fadeDuration={0}
            resizeMode="contain"
            source={{
              uri: toAssetUrl(
                assetBaseUrl,
                light ? '/images/close-button-light.png' : '/images/close-button.png',
              ),
            }}
            style={{ height: closeSize, width: closeSize }}
          />
        </Pressable>
    </Animated.View>
  );
};

const DARK = {
  border: 'rgba(111, 217, 207, 0.44)',
  focus: '#82eee3',
  gradientEnd: '#34807d',
  gradientStart: '#111111',
  panel: 'rgba(17, 17, 17, 0.92)',
  surface: 'rgba(7, 27, 31, 0.72)',
  text: '#f7fcff',
  trade: '#63e2b4',
};

const LIGHT = {
  border: 'rgba(64, 126, 128, 0.42)',
  focus: '#006c78',
  gradientEnd: '#8fcfc7',
  gradientStart: '#f8fbff',
  panel: 'rgba(248, 251, 255, 0.92)',
  surface: 'rgba(255, 255, 255, 0.74)',
  text: '#173b42',
  trade: '#087454',
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  destination: { position: 'absolute' },
  destinationPressable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  destinationLabel: {
    marginTop: 3,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  cornerButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  cornerLabel: { minWidth: 0, flexShrink: 1, fontWeight: '800', lineHeight: 17 },
  tradeBoardLabel: { maxWidth: 84, lineHeight: 14, textAlign: 'left' },
  cornerImage: { resizeMode: 'contain' },
  cornerImageLight: { padding: 4, borderRadius: 20, backgroundColor: '#214f55' },
  tradeBoardButton: {
    position: 'absolute',
    left: 16,
    zIndex: 5,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  settingsButton: { gap: 8, paddingLeft: 10, paddingRight: 10, paddingVertical: 7 },
  settingsCluster: {
    position: 'absolute',
    right: 16,
    zIndex: 5,
    alignItems: 'flex-end',
    gap: 7,
  },
  themeSwitch: {
    width: themeSwitchExperienceParityContract.trackWidth,
    minHeight: themeSwitchExperienceParityContract.touchHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTrack: {
    width: themeSwitchExperienceParityContract.trackWidth,
    height: themeSwitchExperienceParityContract.trackHeight,
    overflow: 'hidden',
    borderRadius: themeSwitchExperienceParityContract.trackHeight / 2,
    backgroundColor: '#2196f3',
  },
  themeDarkTrack: {
    borderRadius: themeSwitchExperienceParityContract.trackHeight / 2,
    backgroundColor: '#000000',
  },
  themeOrbMover: { position: 'absolute', top: 4, left: 4, width: 26, height: 26 },
  themeOrbRotation: { width: 26, height: 26 },
  themeSunDisc: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    borderRadius: 13,
    backgroundColor: '#fff200',
  },
  themeMoonDisc: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    borderRadius: 13,
    backgroundColor: '#f8fbff',
  },
  themeStars: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: themeSwitchExperienceParityContract.trackHeight,
  },
  themeLightRay: {
    position: 'absolute',
    zIndex: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  moonCrater: {
    position: 'absolute',
    zIndex: 4,
    borderRadius: 999,
    backgroundColor: '#8b9299',
  },
  moonCraterOne: { top: 3, left: 10, width: 6, height: 6 },
  moonCraterTwo: { top: 10, left: 2, width: 10, height: 10 },
  moonCraterThree: { top: 18, left: 16, width: 3, height: 3 },
  profileButton: {
    position: 'absolute',
    left: 16,
    zIndex: 5,
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 7,
  },
  profileImageWrap: { position: 'relative' },
  notification: {
    position: 'absolute',
    top: -7,
    right: -9,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderRadius: 999,
    backgroundColor: '#e94f68',
  },
  notificationText: { color: '#ffffff', fontSize: 10, fontWeight: '900', lineHeight: 12 },
  guestAuthCluster: {
    position: 'absolute',
    left: 16,
    zIndex: 6,
    alignItems: 'flex-start',
    gap: 7,
  },
  guestAuthButton: {
    minWidth: 116,
    justifyContent: 'space-between',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 7,
  },
  guestAuthImage: { width: 28, height: 28, resizeMode: 'contain' },
  supportCluster: { position: 'absolute', right: 16, zIndex: 6, alignItems: 'flex-end' },
  supportPanel: {
    marginBottom: 8,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 21,
    elevation: 12,
  },
  supportEyebrow: { paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  supportLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  supportLinkIcon: { width: 25, alignItems: 'center', justifyContent: 'center' },
  supportLinkText: { fontSize: 13.12, fontWeight: '800' },
  helpButton: { gap: 7, paddingHorizontal: 10, paddingVertical: 9 },
  closeButton: { position: 'absolute', left: '50%', zIndex: 10 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
