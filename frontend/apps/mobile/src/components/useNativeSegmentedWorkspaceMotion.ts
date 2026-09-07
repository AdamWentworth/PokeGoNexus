import { webCssVarTokens } from '@pokemongonexus/shared-ui-tokens';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useNativeReducedMotion } from '../features/settings/useNativeMotion';

// Vite acknowledges segmented-workspace changes with its fast motion token.
// Keep the Native content on the same clock as the segmented indicator while
// moving only the workspace beneath the shared product header and tabs.
export const NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX = 16;
export const NATIVE_SEGMENTED_WORKSPACE_TRANSITION_MS = (
  webCssVarTokens.motionSeconds.fast * 1_000
);

export const useNativeSegmentedWorkspaceMotion = (activeIndex: number) => {
  const reduceMotion = useNativeReducedMotion();
  const previousIndexRef = useRef(activeIndex);
  const [translateX] = useState(() => new Animated.Value(0));

  useLayoutEffect(() => {
    const previousIndex = previousIndexRef.current;
    if (previousIndex === activeIndex) return;
    previousIndexRef.current = activeIndex;
    translateX.stopAnimation();

    if (reduceMotion) {
      translateX.setValue(0);
      return;
    }

    translateX.setValue(
      (activeIndex > previousIndex ? 1 : -1)
        * NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX,
    );
    let animation: Animated.CompositeAnimation | null = null;
    // Workspace changes can replace a FlatList with a ScrollView (PvP). Give
    // Fabric one frame to attach the destination tree before connecting the
    // native animation node; connecting during the replacement commit can
    // target the just-unmounted host view.
    const frame = requestAnimationFrame(() => {
      animation = Animated.timing(translateX, {
        duration: NATIVE_SEGMENTED_WORKSPACE_TRANSITION_MS,
        easing: Easing.ease,
        isInteraction: false,
        toValue: 0,
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.stop();
    };
  }, [activeIndex, reduceMotion, translateX]);

  const contentStyle = useMemo(() => ({
    transform: [{ translateX }],
  }), [translateX]);
  const stationaryStyle = useMemo(() => ({
    transform: [{ translateX: Animated.multiply(translateX, -1) }],
  }), [translateX]);

  return { contentStyle, stationaryStyle };
};
