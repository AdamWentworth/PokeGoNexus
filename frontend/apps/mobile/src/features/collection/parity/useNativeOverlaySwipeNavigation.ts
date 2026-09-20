import {
  AccessibilityInfo,
  Animated,
  Easing,
} from 'react-native';
import {
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useOptionalNativeDevicePreferences } from '../../settings/NativeDevicePreferencesProvider';
import { markNativeUiPerformance } from '../../../observability/nativeUiPerformanceTrace';
import { beginNativeUiInteraction } from '../../../interaction/nativeUiInteractionScheduler';

export type NativeOverlaySwipeDirection = 'previous' | 'next';

const { instanceOverlaySwipe } = collectionExperienceParityContract;
// Fire the native route handoff just ahead of the exit animation's final
// callback. Vite's setTimeout runs independently of CSS; Android/React Native
// otherwise pays a JS callback hop after the same nominal 120 ms and loses a
// few milliseconds at the p95 despite showing identical motion.
const NATIVE_ROUTE_HANDOFF_LEAD_MS = 4;
const ROUTE_HANDOFF_TIMEOUT_MS = 1000;
const swipeEasing = Easing.bezier(...instanceOverlaySwipe.transitionEasing);
const backgroundEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

export const resolveNativeOverlaySwipeDirection = ({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): NativeOverlaySwipeDirection | null => {
  if (Math.abs(deltaX) < instanceOverlaySwipe.navigationDelta) return null;
  if (Math.abs(deltaX) < Math.abs(deltaY) * 0.9) return null;
  return deltaX < 0 ? 'next' : 'previous';
};

export const shouldCaptureNativeOverlaySwipe = ({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): boolean => (
  Math.abs(deltaX) >= instanceOverlaySwipe.axisLockDelta
  && Math.abs(deltaX) >= Math.abs(deltaY) * 0.9
);

const clampDragOffset = (deltaX: number): number => (
  Math.max(
    -instanceOverlaySwipe.maxDragOffset,
    Math.min(instanceOverlaySwipe.maxDragOffset, deltaX),
  )
);

type Args = {
  activeItemKey: string | null;
  disabled?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onTargetCommitted?: () => void;
  onTransitionEnd?: () => void;
  onTransitionStart?: () => void;
};

type Result = {
  backgroundMotionStyle: {
    opacity: Animated.Value;
    transform: { scale: Animated.Value }[];
  };
  isAnimating: boolean;
  motionStyle: { transform: { translateX: Animated.AnimatedAddition<number> }[] };
  navigateNext: () => void;
  navigatePrevious: () => void;
  panEnabled: boolean;
  panGestureEvent: ReturnType<typeof Animated.event>;
  onPanHandlerStateChange: (event: PanGestureHandlerStateChangeEvent) => void;
};

export const useNativeOverlaySwipeNavigation = ({
  activeItemKey,
  disabled = false,
  onNext,
  onPrevious,
  onTargetCommitted,
  onTransitionEnd,
  onTransitionStart,
}: Args): Result => {
  const [translateX] = useState(() => new Animated.Value(0));
  const [dragX] = useState(() => new Animated.Value(0));
  const [backgroundOpacity] = useState(() => new Animated.Value(1));
  const [backgroundScale] = useState(() => new Animated.Value(
    instanceOverlaySwipe.backgroundBaseScale,
  ));
  const [isAnimating, setIsAnimating] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<NativeOverlaySwipeDirection | null>(null);
  const isAnimatingRef = useRef(false);
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const backgroundAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const exitHandoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeHandoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingContentRef = useRef<{
    direction: NativeOverlaySwipeDirection;
    outgoingKey: string | null;
  } | null>(null);
  const navigationStartedAtRef = useRef<number | null>(null);
  const interactionReleaseRef = useRef<(() => void) | null>(null);
  const devicePreferences = useOptionalNativeDevicePreferences();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  const reduceMotion = devicePreferences?.shouldReduceMotion ?? systemReduceMotion;
  const clampedDragX = useMemo(() => dragX.interpolate({
    extrapolate: 'clamp',
    inputRange: [-instanceOverlaySwipe.maxDragOffset, 0, instanceOverlaySwipe.maxDragOffset],
    outputRange: [-instanceOverlaySwipe.maxDragOffset, 0, instanceOverlaySwipe.maxDragOffset],
  }), [dragX]);
  const renderedTranslateX = useMemo(
    () => Animated.add(translateX, clampedDragX),
    [clampedDragX, translateX],
  );

  const animateBackground = useCallback((transitioning: boolean) => {
    backgroundAnimationRef.current?.stop();
    const animation = Animated.parallel([
      Animated.timing(backgroundOpacity, {
        toValue: transitioning ? instanceOverlaySwipe.backgroundTransitionOpacity : 1,
        duration: instanceOverlaySwipe.backgroundOpacityTransitionMs,
        easing: backgroundEasing,
        useNativeDriver: true,
      }),
      Animated.timing(backgroundScale, {
        toValue: transitioning
          ? instanceOverlaySwipe.backgroundTransitionScale
          : instanceOverlaySwipe.backgroundBaseScale,
        duration: instanceOverlaySwipe.backgroundScaleTransitionMs,
        easing: backgroundEasing,
        useNativeDriver: true,
      }),
    ]);
    backgroundAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished && backgroundAnimationRef.current === animation) {
        backgroundAnimationRef.current = null;
      }
    });
  }, [backgroundOpacity, backgroundScale]);

  const finishNavigation = useCallback(() => {
    const startedAt = navigationStartedAtRef.current;
    if (startedAt !== null) {
      markNativeUiPerformance('instance_overlay_navigation_finished', {
        interactionLatencyMs: Date.now() - startedAt,
      });
      navigationStartedAtRef.current = null;
    }
    isAnimatingRef.current = false;
    setIsAnimating(false);
    animateBackground(false);
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = null;
    onTransitionEnd?.();
  }, [animateBackground, onTransitionEnd]);

  const startEntrance = useCallback((direction: NativeOverlaySwipeDirection) => {
    if (exitHandoffTimerRef.current !== null) {
      clearTimeout(exitHandoffTimerRef.current);
      exitHandoffTimerRef.current = null;
    }
    if (routeHandoffTimerRef.current !== null) {
      clearTimeout(routeHandoffTimerRef.current);
      routeHandoffTimerRef.current = null;
    }
    awaitingContentRef.current = null;

    const enterOffset = direction === 'next'
      ? instanceOverlaySwipe.enterOffset
      : -instanceOverlaySwipe.enterOffset;
    translateX.setValue(enterOffset);
    const startedAt = navigationStartedAtRef.current;
    if (startedAt !== null) {
      markNativeUiPerformance('instance_overlay_entrance_started', {
        interactionLatencyMs: Date.now() - startedAt,
      });
    }
    // Unlike CSS, Animated.timing does not need a browser reflow frame between
    // setting its start value and starting a native-driver animation. Waiting
    // for rAF here let the incoming detail tree's image/layout work postpone
    // motion even after the route had committed.
    const animation = Animated.timing(translateX, {
      toValue: 0,
      duration: instanceOverlaySwipe.entryTransitionMs,
      easing: swipeEasing,
      useNativeDriver: true,
    });
    activeAnimationRef.current = animation;
    animation.start(() => {
      activeAnimationRef.current = null;
      finishNavigation();
    });
  }, [finishNavigation, translateX]);

  useLayoutEffect(() => {
    const awaitingContent = awaitingContentRef.current;
    if (
      !awaitingContent
      || !activeItemKey
      || activeItemKey === awaitingContent.outgoingKey
    ) return;

    const startedAt = navigationStartedAtRef.current;
    if (startedAt !== null) {
      markNativeUiPerformance('instance_overlay_target_committed', {
        interactionLatencyMs: Date.now() - startedAt,
        targetKey: activeItemKey,
      });
    }

    startEntrance(awaitingContent.direction);
    onTargetCommitted?.();
  }, [activeItemKey, onTargetCommitted, startEntrance]);

  useEffect(() => () => {
    activeAnimationRef.current?.stop();
    backgroundAnimationRef.current?.stop();
    if (routeHandoffTimerRef.current !== null) {
      clearTimeout(routeHandoffTimerRef.current);
    }
    if (exitHandoffTimerRef.current !== null) {
      clearTimeout(exitHandoffTimerRef.current);
    }
    backgroundOpacity.stopAnimation();
    backgroundScale.stopAnimation();
    dragX.stopAnimation();
    translateX.stopAnimation();
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = null;
  }, [backgroundOpacity, backgroundScale, dragX, translateX]);

  const resetPosition = useCallback(() => {
    if (reduceMotion) {
      translateX.setValue(0);
      return;
    }
    Animated.spring(translateX, {
      toValue: 0,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateX]);

  const navigate = useCallback((direction: NativeOverlaySwipeDirection) => {
    if (disabled) return;
    if (isAnimatingRef.current) {
      setPendingNavigation(direction);
      return;
    }
    const callback = direction === 'next' ? onNext : onPrevious;
    if (!callback) {
      resetPosition();
      return;
    }

    navigationStartedAtRef.current = Date.now();
    markNativeUiPerformance('instance_overlay_navigation_started', {
      direction,
      outgoingKey: activeItemKey,
    });
    onTransitionStart?.();

    if (reduceMotion) {
      backgroundOpacity.setValue(1);
      backgroundScale.setValue(instanceOverlaySwipe.backgroundBaseScale);
      translateX.setValue(0);
      callback();
      finishNavigation();
      return;
    }

    isAnimatingRef.current = true;
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = beginNativeUiInteraction();
    animateBackground(true);
    const exitOffset = direction === 'next'
      ? -instanceOverlaySwipe.exitOffset
      : instanceOverlaySwipe.exitOffset;
    const animation = Animated.timing(translateX, {
      toValue: exitOffset,
      duration: instanceOverlaySwipe.swapDelayMs,
      easing: swipeEasing,
      useNativeDriver: true,
    });
    activeAnimationRef.current = animation;
    let handedOff = false;
    const handOffRoute = () => {
      if (handedOff || !isAnimatingRef.current) return;
      handedOff = true;
      if (exitHandoffTimerRef.current !== null) {
        clearTimeout(exitHandoffTimerRef.current);
        exitHandoffTimerRef.current = null;
      }
      // Expo Router commits setParams asynchronously. Keep the outgoing item
      // offscreen until the screen confirms that the target item replaced it;
      // otherwise the old item visibly slides back in before the route updates.
      awaitingContentRef.current = {
        direction,
        outgoingKey: activeItemKey,
      };
      const startedAt = navigationStartedAtRef.current;
      if (startedAt !== null) {
        markNativeUiPerformance('instance_overlay_exit_finished', {
          interactionLatencyMs: Date.now() - startedAt,
        });
      }
      // Keep the canonical handoff timer free of even the small React update
      // that disables controls. The ref already guards re-entry; publish the
      // accessible disabled state only as the target route is handed off.
      setIsAnimating(true);
      callback();
      routeHandoffTimerRef.current = setTimeout(() => {
        const awaitingContent = awaitingContentRef.current;
        if (awaitingContent) startEntrance(awaitingContent.direction);
      }, ROUTE_HANDOFF_TIMEOUT_MS);
    };
    // Vite performs the content handoff from this canonical timer, not from a
    // CSS transitionend event. Animated's Android completion callback crosses
    // back to JS one or more frames late under load, so use the same clock and
    // let the native transform finish independently on the UI thread.
    exitHandoffTimerRef.current = setTimeout(
      handOffRoute,
      Math.max(0, instanceOverlaySwipe.swapDelayMs - NATIVE_ROUTE_HANDOFF_LEAD_MS),
    );
    animation.start(({ finished }) => {
      if (activeAnimationRef.current === animation) activeAnimationRef.current = null;
      if (!finished) {
        if (exitHandoffTimerRef.current !== null) {
          clearTimeout(exitHandoffTimerRef.current);
          exitHandoffTimerRef.current = null;
        }
        if (handedOff) return;
        finishNavigation();
        resetPosition();
        return;
      }
      handOffRoute();
    });
  }, [
    activeItemKey,
    animateBackground,
    backgroundOpacity,
    backgroundScale,
    disabled,
    finishNavigation,
    onNext,
    onPrevious,
    onTransitionStart,
    reduceMotion,
    resetPosition,
    startEntrance,
    translateX,
  ]);

  useEffect(() => {
    if (isAnimating || !pendingNavigation) return undefined;
    const direction = pendingNavigation;
    const frame = requestAnimationFrame(() => {
      setPendingNavigation(null);
      navigate(direction);
    });
    return () => cancelAnimationFrame(frame);
  }, [isAnimating, navigate, pendingNavigation]);

  // Vite hands drag frames to the browser compositor. Route every Android
  // sample directly into Animated's native graph too. The previous
  // runOnJS(true) gesture made this large detail screen compete with every
  // finger-move frame on the JS thread.
  const panGestureEvent = useMemo(() => Animated.event(
    [{ nativeEvent: { translationX: dragX } }],
    { useNativeDriver: true },
  ), [dragX]);
  const onPanHandlerStateChange = useCallback((
    event: PanGestureHandlerStateChangeEvent,
  ) => {
    const { oldState, state, translationX: rawTranslationX, translationY } = event.nativeEvent;
    if (isAnimatingRef.current) {
      dragX.setValue(0);
      return;
    }
    if (state === State.ACTIVE) {
      translateX.stopAnimation();
      return;
    }
    if (oldState !== State.ACTIVE) return;

    // Transfer the native drag presentation into the transition clock before
    // clearing the gesture clock. Exit/reset motion therefore continues from
    // the finger instead of flashing back to the current instance first.
    const translationX = clampDragOffset(rawTranslationX);
    translateX.setValue(translationX);
    dragX.setValue(0);
    if (state !== State.END) {
      resetPosition();
      return;
    }
    const direction = resolveNativeOverlaySwipeDirection({
      deltaX: rawTranslationX,
      deltaY: translationY,
    });
    if (direction) navigate(direction);
    else resetPosition();
  }, [dragX, navigate, resetPosition, translateX]);

  return {
    backgroundMotionStyle: {
      opacity: backgroundOpacity,
      transform: [{ scale: backgroundScale }],
    },
    isAnimating,
    motionStyle: { transform: [{ translateX: renderedTranslateX }] },
    navigateNext: () => navigate('next'),
    navigatePrevious: () => navigate('previous'),
    onPanHandlerStateChange,
    panEnabled: !disabled && !isAnimating && Boolean(onNext || onPrevious),
    panGestureEvent,
  };
};
