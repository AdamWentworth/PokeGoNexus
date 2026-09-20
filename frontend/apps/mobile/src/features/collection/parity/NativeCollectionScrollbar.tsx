import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNativeScrollInteractionReservation } from '../../../interaction/useNativeScrollInteractionReservation';
import { toNativeCollectionImageSource } from './nativeCollectionImageSource';

// Canonical PokemonMenu/CustomScrollbar.tsx and .css dimensions and timing.
const THUMB_HEIGHT = 60;
const TRACK_FRACTION = 0.85;
const HIDE_DELAY_MS = 1000;
const FADE_MS = 500;

export type NativeCollectionScrollbarHandle = {
  setViewportHeight: (height: number) => void;
  setContentHeight: (height: number) => void;
  beginScroll: () => void;
  endScroll: () => void;
  reset: () => void;
};

type Props = {
  assetBaseUrl: string;
  enabled: boolean;
  scrollY: Animated.Value;
  onSeek: (offset: number) => void;
  onSeekEnd: (offset: number) => void;
};

export const NativeCollectionScrollbar = memo(forwardRef<NativeCollectionScrollbarHandle, Props>(
  function NativeCollectionScrollbar({ assetBaseUrl, enabled, scrollY, onSeek, onSeekEnd }, ref) {
    const [viewportHeight, setViewportHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const [visible, setVisible] = useState(false);
    const [opacity] = useState(() => new Animated.Value(0));
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const drag = useRef<{ start: number | null; delta: number; offset: number } | null>(null);
    const interaction = useNativeScrollInteractionReservation();
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    const travel = Math.max(0, viewportHeight * TRACK_FRACTION - THUMB_HEIGHT);
    const scrollable = enabled && viewportHeight > 0 && maxOffset > 0 && travel > 0;

    const cancelHide = useCallback(() => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }, []);

    const show = useCallback(() => {
      cancelHide();
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1, duration: FADE_MS, useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      }).start();
    }, [cancelHide, opacity]);

    const hideAfterIdle = useCallback(() => {
      cancelHide();
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        if (drag.current) return;
        Animated.timing(opacity, {
          toValue: 0, duration: FADE_MS, useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }).start(({ finished }) => { if (finished) setVisible(false); });
      }, HIDE_DELAY_MS);
    }, [cancelHide, opacity]);

    const reset = useCallback(() => {
      drag.current = null;
      interaction.onMomentumScrollEnd();
      cancelHide();
      opacity.stopAnimation();
      opacity.setValue(0);
      setVisible(false);
    }, [cancelHide, interaction, opacity]);

    useImperativeHandle(ref, () => ({
      setViewportHeight, setContentHeight, beginScroll: show, endScroll: hideAfterIdle, reset,
    }), [hideAfterIdle, reset, show]);

    // A filter, hidden search overlay, or rotation invalidates the old drag scale.
    useEffect(() => { reset(); }, [reset, enabled, contentHeight, viewportHeight]);
    useEffect(() => () => {
      cancelHide();
      opacity.stopAnimation();
      drag.current = null;
    }, [cancelHide, opacity]);

    const moveDrag = useCallback(() => {
      const current = drag.current;
      if (!current || current.start === null || travel <= 0) return;
      current.offset = Math.max(0, Math.min(maxOffset, current.start + current.delta / travel * maxOffset));
      onSeek(current.offset);
    }, [maxOffset, onSeek, travel]);

    const pan = useMemo(() => Gesture.Pan()
      .withTestId('native-collection-scrollbar-pan')
      .enabled(scrollable && visible)
      // Claim the thumb immediately, before the surrounding horizontal page pan.
      .minDistance(0)
      .runOnJS(true)
      .onStart(() => {
        show();
        interaction.onScrollBeginDrag();
        const current = { start: null as number | null, delta: 0, offset: 0 };
        drag.current = current;
        // Read the native animation value once when grabbed, including during
        // momentum. Ordinary list frames have no JS listener or React updates.
        scrollY.stopAnimation((offset) => {
          if (drag.current !== current) return;
          current.start = Math.max(0, Math.min(maxOffset, offset));
          moveDrag(); // Also stops any list momentum at the grabbed position.
        });
      })
      .onUpdate((event) => {
        if (!drag.current) return;
        drag.current.delta = event.translationY;
        moveDrag();
      })
      .onFinalize(() => {
        const current = drag.current;
        drag.current = null;
        if (current && current.start !== null) onSeekEnd(current.offset);
        interaction.onScrollEndDrag();
        hideAfterIdle();
      }), [hideAfterIdle, interaction, maxOffset, moveDrag, onSeekEnd, scrollable, scrollY, show, visible]);

    const translateY = useMemo(() => scrollY.interpolate({
      inputRange: [0, Math.max(1, maxOffset)],
      outputRange: [0, travel],
      extrapolate: 'clamp',
    }), [maxOffset, scrollY, travel]);

    if (!scrollable) return null;

    return (
      <View pointerEvents="box-none" style={styles.track}>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityActions={[
              { name: 'increment', label: 'Scroll down one page' },
              { name: 'decrement', label: 'Scroll up one page' },
            ]}
            accessibilityHint="Drag up or down to move through the Pokémon list"
            accessibilityLabel="Scroll Pokémon list"
            accessibilityRole="adjustable"
            onAccessibilityAction={(event) => {
              const direction = event.nativeEvent.actionName === 'increment' ? 1
                : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
              if (!direction) return;
              scrollY.stopAnimation((offset) => {
                const next = Math.max(0, Math.min(maxOffset, offset + direction * viewportHeight));
                show();
                onSeek(next);
                onSeekEnd(next);
                hideAfterIdle();
              });
            }}
            pointerEvents={visible ? 'auto' : 'none'}
            style={[styles.thumb, { opacity, transform: [{ translateY }] }]}
            testID="native-collection-scrollbar-thumb"
          >
            <Image
              accessible={false}
              resizeMode="contain"
              source={toNativeCollectionImageSource(assetBaseUrl, '/images/scroll.png')}
              style={styles.image}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
));

const styles = StyleSheet.create({
  track: { position: 'absolute', right: 0, top: 0, bottom: '15%', width: 40 },
  thumb: { position: 'absolute', top: 0, right: 0, width: 40, height: THUMB_HEIGHT },
  image: { width: '100%', height: '100%' },
});
