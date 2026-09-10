import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import {
  NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
  NativeHorizontalPageSlider,
  type NativeHorizontalPageSliderHandle,
  resolveNativeHorizontalDragHandoffOffset,
  resolveNativeHorizontalPageOffset,
  resolveNativeHorizontalSwipeIndex,
} from '../../../src/components/NativeHorizontalPageSlider';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

describe('NativeHorizontalPageSlider', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the canonical Vite page transition duration', () => {
    expect(NATIVE_HORIZONTAL_PAGE_TRANSITION_MS).toBe(
      collectionExperienceParityContract.pageTransitionMs,
    );
  });

  it('opens on the active page while keeping all Vite-parity panels warm', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <NativeHorizontalPageSlider activeIndex={1} onIndexChange={jest.fn()}>
        <Text>Tags panel</Text>
        <Text>Pokémon panel</Text>
        <Text>Wishlist panel</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    expect(queryByText('Tags panel')).toBeNull();
    expect(queryByText('Pokémon panel')).toBeTruthy();
    expect(queryByText('Wishlist panel')).toBeNull();
    expect(getByText('Tags panel', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('Wishlist panel', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('native-horizontal-page-1').props.pointerEvents).toBe('auto');
  });

  it('moves accessibility and touch ownership with the canonical active page', async () => {
    const onIndexChange = jest.fn();
    const view = render(
      <NativeHorizontalPageSlider activeIndex={0} onIndexChange={onIndexChange}>
        <Text>Tags panel</Text>
        <Text>Pokémon panel</Text>
        <Text>Wishlist panel</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    view.rerender(
      <NativeHorizontalPageSlider activeIndex={2} onIndexChange={onIndexChange}>
        <Text>Tags panel</Text>
        <Text>Pokémon panel</Text>
        <Text>Wishlist panel</Text>
      </NativeHorizontalPageSlider>,
    );

    expect(view.getByTestId('native-horizontal-page-0', { includeHiddenElements: true })
      .props.pointerEvents).toBe('none');
    expect(view.getByTestId('native-horizontal-page-2').props.pointerEvents).toBe('auto');
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('resolves native scroll offsets to bounded page indexes', () => {
    expect(resolveNativeHorizontalPageOffset({
      offsetX: 824,
      panelCount: 3,
      width: 412,
    })).toBe(2);
    expect(resolveNativeHorizontalPageOffset({
      offsetX: 410,
      panelCount: 3,
      width: 412,
    })).toBe(1);
    expect(resolveNativeHorizontalPageOffset({
      offsetX: 5000,
      panelCount: 3,
      width: 412,
    })).toBe(2);
  });

  it('uses Vite\'s exact swipe threshold and keeps edge swipes bounded', () => {
    expect(resolveNativeHorizontalSwipeIndex({
      currentIndex: 1,
      panelCount: 3,
      translationX: -100,
    })).toBe(1);
    expect(resolveNativeHorizontalSwipeIndex({
      currentIndex: 1,
      panelCount: 3,
      translationX: -101,
    })).toBe(2);
    expect(resolveNativeHorizontalSwipeIndex({
      currentIndex: 0,
      panelCount: 3,
      translationX: 150,
    })).toBe(0);
  });

  it('streams collection drag frames through the native Animated driver', async () => {
    const scrollX = new Animated.Value(412);
    const dragX = new Animated.Value(0);
    const animatedEvent = jest.spyOn(Animated, 'event');
    const { getByTestId } = render(
      <NativeHorizontalPageSlider
        activeIndex={1}
        dragX={dragX}
        onIndexChange={jest.fn()}
        scrollX={scrollX}
      >
        <Text>Tags panel</Text>
        <Text>Pokémon panel</Text>
        <Text>Wishlist panel</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    expect(animatedEvent).toHaveBeenCalledWith(
      [{ nativeEvent: { translationX: dragX } }],
      { useNativeDriver: true },
    );
    expect(getByTestId('native-horizontal-page-pan')).toBeTruthy();
  });

  it('hands settling off from the clamped finger position instead of the old page', () => {
    expect(resolveNativeHorizontalDragHandoffOffset({
      baseOffset: 412,
      maxPeekDistance: 123.6,
      translationX: -120,
    })).toBe(532);
    expect(resolveNativeHorizontalDragHandoffOffset({
      baseOffset: 412,
      maxPeekDistance: 123.6,
      translationX: -500,
    })).toBe(535.6);
  });

  it('uses one shared animated value without forcing full-page bitmap snapshots', async () => {
    const scrollX = new Animated.Value(412);
    const multiply = jest.spyOn(Animated, 'multiply');
    const { getByTestId } = render(
      <NativeHorizontalPageSlider
        activeIndex={1}
        onIndexChange={jest.fn()}
        scrollX={scrollX}
      >
        <Text>Tags panel</Text>
        <Text>Pokémon panel</Text>
        <Text>Wishlist panel</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    const slider = getByTestId('native-horizontal-page-slider');
    const track = getByTestId('native-horizontal-page-track');
    const trackStyle = StyleSheet.flatten(track.props.style);
    expect(slider.props.onScroll).toBeUndefined();
    expect(track.props.renderToHardwareTextureAndroid).not.toBe(true);
    expect(track.props.shouldRasterizeIOS).not.toBe(true);
    expect(getByTestId('native-horizontal-page-0', { includeHiddenElements: true })
      .props.renderToHardwareTextureAndroid).not.toBe(true);
    expect(getByTestId('native-horizontal-page-1')
      .props.renderToHardwareTextureAndroid).not.toBe(true);
    expect(trackStyle.transform[0].translateX).toBeDefined();
    expect(multiply).toHaveBeenCalledWith(scrollX, -1);
  });

  it('keeps inactive pages out of touch and accessibility navigation', async () => {
    const { getByTestId } = render(
      <NativeHorizontalPageSlider activeIndex={1} onIndexChange={jest.fn()}>
        <Text>Friends panel</Text>
        <Text>Find panel</Text>
        <Text>Blocked panel</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());

    expect(getByTestId('native-horizontal-page-0', { includeHiddenElements: true }).props).toEqual(
      expect.objectContaining({
        accessibilityElementsHidden: true,
        'aria-hidden': true,
        importantForAccessibility: 'no-hide-descendants',
        pointerEvents: 'none',
      }),
    );
    expect(getByTestId('native-horizontal-page-1').props).toEqual(
      expect.objectContaining({
        accessibilityElementsHidden: false,
        'aria-hidden': false,
        importantForAccessibility: 'auto',
        pointerEvents: 'auto',
      }),
    );
    expect(getByTestId('native-horizontal-page-2', { includeHiddenElements: true }).props).toEqual(
      expect.objectContaining({
        accessibilityElementsHidden: true,
        'aria-hidden': true,
        importantForAccessibility: 'no-hide-descendants',
        pointerEvents: 'none',
      }),
    );
  });

  it('synchronizes shared header progress when a tab changes the page programmatically', async () => {
    const scrollX = new Animated.Value(0);
    const timing = jest.spyOn(Animated, 'timing');
    const ref = createRef<NativeHorizontalPageSliderHandle>();
    render(
      <NativeHorizontalPageSlider
        activeIndex={0}
        onIndexChange={jest.fn()}
        ref={ref}
        scrollX={scrollX}
      >
        <Text>Trade Preferences</Text>
        <Text>Trade Activity</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    act(() => ref.current?.setPage(1));
    expect(timing).toHaveBeenCalledWith(scrollX, expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
      isInteraction: false,
      toValue: 412,
      useNativeDriver: true,
    }));
    act(() => ref.current?.setPage(0));
    expect(timing).toHaveBeenLastCalledWith(scrollX, expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
      isInteraction: false,
      toValue: 0,
      useNativeDriver: true,
    }));
  });

  it('updates the shared indicator immediately when reduced motion disables the page animation', async () => {
    const scrollX = new Animated.Value(0);
    const setValue = jest.spyOn(scrollX, 'setValue');
    const onComplete = jest.fn();
    const ref = createRef<NativeHorizontalPageSliderHandle>();
    render(
      <NativeHorizontalPageSlider
        activeIndex={0}
        onIndexChange={jest.fn()}
        ref={ref}
        scrollX={scrollX}
      >
        <Text>Tags</Text>
        <Text>Pokémon</Text>
      </NativeHorizontalPageSlider>,
    );

    await act(async () => Promise.resolve());
    act(() => ref.current?.setPage(1, false, onComplete));
    expect(setValue).toHaveBeenLastCalledWith(412);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 1])('realigns the rendered track after a long native swipe in direction %i', async (direction) => {
    const scrollX = new Animated.Value(412);
    const dragX = new Animated.Value(0);
    const ref = createRef<NativeHorizontalPageSliderHandle>();
    const view = render(
      <NativeHorizontalPageSlider activeIndex={1} onIndexChange={jest.fn()} ref={ref} scrollX={scrollX} dragX={dragX}>
        <Text>Tags</Text>
        <Text>Pokémon</Text>
        <Text>Wishlist</Text>
      </NativeHorizontalPageSlider>,
    );
    await act(async () => undefined);
    const track = view.UNSAFE_getAllByType(Animated.View)
      .find((node) => node.props.testID === 'native-horizontal-page-track');
    const translation = StyleSheet.flatten(track?.props.style).transform[0].translateX as { __getValue: () => number };
    const peek = 412 * collectionExperienceParityContract.pageSwipeMaxPeekRatio;
    expect(translation.__getValue()).toBe(-412);
    act(() => dragX.setValue(direction * 300));
    expect(translation.__getValue()).toBeCloseTo(-412 + direction * peek);
    // Resetting a diffClamp after exceeding its limit retains an opposite
    // displacement. The rendered page must line up exactly after every reset.
    act(() => ref.current?.setPage(1, false));
    expect(translation.__getValue()).toBe(-412);
    act(() => ref.current?.setPage(2, false));
    expect(translation.__getValue()).toBe(-824);
  });
});
