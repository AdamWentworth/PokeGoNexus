import { fireEvent, render } from '@testing-library/react-native';
import { Animated, Dimensions, Image, Modal, StyleSheet } from 'react-native';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import {
  NATIVE_SORT_OPTION_EASING,
  NATIVE_SORT_OVERLAY_EASING,
  NativeCollectionSortMenu,
} from '../../../../src/features/collection/parity/NativeCollectionSortMenu';

let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let mockReduceMotion = true;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock('../../../../src/features/settings/NativeDevicePreferencesProvider', () => ({
  useOptionalNativeDevicePreferences: () => ({ shouldReduceMotion: mockReduceMotion }),
}));

jest.mock('../../../../src/features/settings/useNativeColorScheme', () => ({
  useNativeColorScheme: () => 'dark',
}));

describe('NativeCollectionSortMenu', () => {
  beforeEach(() => {
    mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    mockReduceMotion = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a full-parent native gradient through the Android system window', () => {
    const view = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        open
        sort="number"
      />,
    );

    expect(view.UNSAFE_getByType(Modal).props.hardwareAccelerated).toBe(true);
    expect(view.getByTestId('native-collection-sort-menu-background').props.colors).toHaveLength(2);
    expect(StyleSheet.flatten(view.getByTestId('native-collection-sort-menu-background').props.style)).toMatchObject({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    });
  });

  it('can use the existing full-screen host without creating an Android window', () => {
    const view = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        open
        presentation="inline"
        sort="number"
      />,
    );

    expect(view.UNSAFE_queryByType(Modal)).toBeNull();
    expect(StyleSheet.flatten(view.getByTestId('native-collection-sort-menu').props.style)).toMatchObject({
      bottom: 0,
      elevation: 24,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 2000,
    });
  });

  it('keeps the close control above a real bottom safe-area inset', () => {
    mockSafeAreaInsets = { top: 42, right: 0, bottom: 34, left: 0 };
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const { getByLabelText, getByText } = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={onClose}
        onSelect={onSelect}
        open
        sort="number"
      />,
    );

    expect(StyleSheet.flatten(getByLabelText('Close sort menu').props.style).bottom).toBe(34);
    fireEvent.press(getByText('NAME'));
    expect(onSelect).toHaveBeenCalledWith('name');
    fireEvent.press(getByLabelText('Close sort menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pins the rendered Vite phone geometry and themed close artwork', () => {
    const view = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        open
        sort="number"
      />,
    );

    expect(StyleSheet.flatten(view.getByLabelText('Sort Pokémon').props.style)).toMatchObject({
      gap: 20,
      maxWidth: '86%',
      transform: [{ translateY: 91 }],
      width: 250,
    });
    expect(StyleSheet.flatten(view.getByRole('radio', { name: 'RECENT' }).props.style)).toMatchObject({
      gap: 10,
      padding: 15,
    });
    const nameIcon = view.UNSAFE_getAllByType(Image).find((node) => (
      node.props.source.uri.includes('/images/sorting/name.png')
    ));
    expect(StyleSheet.flatten(nameIcon?.props.style)).toMatchObject({ height: 16, width: 35 });
    const closeImage = view.getByLabelText('Close sort menu').findByType(Image);
    expect(closeImage.props.source.uri).toContain('/images/close-button.png');
    expect(StyleSheet.flatten(closeImage.props.style)).toEqual({ height: 50, width: 50 });
  });

  it('dismisses when the empty Vite backdrop is pressed', () => {
    const onClose = jest.fn();
    const view = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={onClose}
        onSelect={jest.fn()}
        open
        sort="number"
      />,
    );

    fireEvent.press(view.getByTestId(
      'native-collection-sort-backdrop',
      { includeHiddenElements: true },
    ));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('owns the exact Vite overlay and staggered-row motion on the native driver', () => {
    mockReduceMotion = false;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const timing = jest.spyOn(Animated, 'timing');
    const stagger = jest.spyOn(Animated, 'stagger');
    const interpolate = jest.spyOn(Animated.Value.prototype, 'interpolate');
    const { getByTestId, rerender } = render(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        open
        sort="number"
        visible
      />,
    );

    const { sortMenuMotion } = collectionExperienceParityContract;
    expect(StyleSheet.flatten(getByTestId('native-collection-sort-menu').props.style).opacity)
      .toBe(0);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: sortMenuMotion.overlayTransitionMs,
      easing: NATIVE_SORT_OVERLAY_EASING,
      isInteraction: false,
      toValue: 1,
      useNativeDriver: true,
    }));
    expect(stagger).toHaveBeenCalledWith(sortMenuMotion.optionStaggerMs, expect.any(Array));
    expect(timing.mock.calls.filter(([, config]) => (
      config.duration === sortMenuMotion.optionTransitionMs
      && config.easing === NATIVE_SORT_OPTION_EASING
      && config.isInteraction === false
      && config.toValue === 1
      && config.useNativeDriver === true
    ))).toHaveLength(6);
    expect(interpolate).toHaveBeenCalledWith({
      inputRange: [0, 1],
      outputRange: [Dimensions.get('window').height, 0],
    });

    rerender(
      <NativeCollectionSortMenu
        assetBaseUrl="https://pokegonexus.com"
        direction="ascending"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        open={false}
        sort="number"
        visible
      />,
    );
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: sortMenuMotion.overlayTransitionMs,
      easing: NATIVE_SORT_OVERLAY_EASING,
      isInteraction: false,
      toValue: 0,
      useNativeDriver: true,
    }));
  });
});
