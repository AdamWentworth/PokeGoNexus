import { act, fireEvent, render } from '@testing-library/react-native';
import {
  Animated,
  Easing,
  StyleSheet,
  processColor,
} from 'react-native';
import {
  getNativeActionMenuGeometry,
  NativeActionMenu,
} from '../../../src/components/NativeActionMenu';
import {
  NativeAppLoadingOverlay,
  NativeAppLoadingProvider,
} from '../../../src/components/NativeAppLoadingProvider';
import {
  actionMenuExperienceParityContract,
  themeSwitchExperienceParityContract,
} from '@pokemongonexus/shared-ui-tokens';

const mockToggleColorTheme = jest.fn();
let mockColorTheme: 'dark' | 'light' = 'light';
let mockShouldReduceMotion = false;
let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock('../../../src/features/settings/NativeDevicePreferencesProvider', () => ({
  useOptionalNativeDevicePreferences: () => ({
    colorTheme: mockColorTheme,
    shouldReduceMotion: mockShouldReduceMotion,
    toggleColorTheme: mockToggleColorTheme,
  }),
}));

describe('NativeActionMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockColorTheme = 'light';
    mockShouldReduceMotion = false;
    mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('renders the same nine primary destinations as the canonical action menu', () => {
    const { getByLabelText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    for (const { label } of actionMenuExperienceParityContract.primaryDestinations) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('uses a full-parent native gradient instead of a percentage-sized SVG background', () => {
    const { getByTestId } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    expect(getByTestId('native-action-menu-background').props.colors).toHaveLength(2);
    expect(StyleSheet.flatten(getByTestId('native-action-menu-background').props.style)).toMatchObject({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    });
  });

  it('starts immediately after Android presents the modal and fans on the native UI thread', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        delay: 0,
        duration: actionMenuExperienceParityContract.motion.openMs,
        useNativeDriver: true,
      }),
    );
    timing.mockRestore();
  });

  it('reverses the fan before closing', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={onClose}
        onNavigate={jest.fn()}
        signedIn
        visible
      />,
    );

    act(() => jest.advanceTimersByTime(375));
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(actionMenuExperienceParityContract.motion.closeMs));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('paints navigation feedback before closing the menu and routing a corner action', () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();
    const { getByLabelText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={onClose}
        onNavigate={onNavigate}
        signedIn
        visible
      />,
    );

    fireEvent.press(getByLabelText('Share Trade Board'));
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(32));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(onNavigate.mock.invocationCallOrder[0] ?? Infinity);
    expect(onNavigate).toHaveBeenCalledWith('/trade-board');
  });

  it('reveals the single retained root loader before closing and routing', () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();
    const view = render(
      <NativeAppLoadingProvider>
        <NativeActionMenu
          assetBaseUrl="https://pokegonexus.com"
          onClose={onClose}
          onNavigate={onNavigate}
          visible
        />
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>,
    );

    expect(view.getByTestId('native-app-loading-retained-host', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(view.queryByTestId('native-app-loading-overlay')).toBeNull();
    fireEvent.press(view.getByLabelText('Search'));
    expect(view.getByTestId('native-app-loading-overlay')).toBeTruthy();
    expect(view.getAllByTestId(/native-loading-spinner-/, { includeHiddenElements: true }))
      .toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(32));
    expect(view.getByTestId('native-app-loading-overlay')).toBeTruthy();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/search');
    fireEvent(view.getByTestId('native-app-loading-host'), 'layout');
  });

  it('opens support links in place and preserves the canonical theme control', () => {
    const onNavigate = jest.fn();
    const { getByLabelText, getByText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={onNavigate}
        visible
      />,
    );

    fireEvent.press(getByLabelText('Learn and support'));
    fireEvent.press(getByText('FAQ'));
    act(() => jest.advanceTimersByTime(32));
    expect(onNavigate).toHaveBeenCalledWith('/faq');

    fireEvent.press(getByLabelText(/Use .* theme/));
    expect(mockToggleColorTheme).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(17));
    expect(mockToggleColorTheme).toHaveBeenCalledTimes(1);
  });

  it('paints and slides immediately before synchronizing the expensive route tree', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const view = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );
    timing.mockClear();
    expect(view.getByTestId('native-action-menu-background').props.colors).toEqual([
      processColor('#f8fbff'),
      processColor('#8fcfc7'),
    ]);

    fireEvent.press(view.getByTestId('native-theme-switch'));

    expect(view.getByTestId('native-action-menu-background').props.colors).toEqual([
      processColor('#111111'),
      processColor('#34807d'),
    ]);
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: themeSwitchExperienceParityContract.slideTransitionMs,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: themeSwitchExperienceParityContract.decorationTransitionMs,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    const slideConfig = timing.mock.calls.find(
      ([, config]) => config.duration === themeSwitchExperienceParityContract.slideTransitionMs,
    )?.[1];
    const cssEase = Easing.bezier(0.25, 0.1, 0.25, 1);
    expect(slideConfig?.easing?.(0.25)).toBeCloseTo(cssEase(0.25), 6);
    expect(slideConfig?.easing?.(0.5)).toBeCloseTo(cssEase(0.5), 6);
    expect(mockToggleColorTheme).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(17));
    expect(mockToggleColorTheme).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  it('matches the canonical Vite theme-switch layers and touch geometry', () => {
    const view = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    expect(StyleSheet.flatten(view.getByTestId('native-theme-switch').props.style)).toMatchObject({
      minHeight: themeSwitchExperienceParityContract.touchHeight,
      width: themeSwitchExperienceParityContract.trackWidth,
    });
    expect(StyleSheet.flatten(view.getByTestId('native-theme-switch-track').props.style)).toMatchObject({
      borderRadius: 17,
      height: themeSwitchExperienceParityContract.trackHeight,
      width: themeSwitchExperienceParityContract.trackWidth,
    });
    expect(view.getAllByTestId(/native-theme-light-ray-/)).toHaveLength(3);
    expect(view.getAllByTestId(/native-theme-cloud-/)).toHaveLength(6);
    expect(view.getAllByTestId(/native-theme-star-/)).toHaveLength(4);
  });

  it('starts every destination at the Poké Ball and fans into the canonical radial grid', () => {
    const { getByTestId } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    const raid = StyleSheet.flatten(getByTestId('native-action-menu-item-raid').props.style);
    const home = StyleSheet.flatten(getByTestId('native-action-menu-item-home').props.style);
    const rankings = StyleSheet.flatten(getByTestId('native-action-menu-item-rankings').props.style);

    expect(raid.left).toBe(home.left);
    expect(raid.top).toBe(home.top);
    expect(rankings.left).toBe(home.left);
    expect(rankings.top).toBe(home.top);
    expect(getNativeActionMenuGeometry(412, 915, 0)).toMatchObject({
      closeBottom: 20,
      closeSize: 50,
      closedDestinationY: 432.5,
      columnOffset: 112,
      cornerBottom: 16,
      cornerIconSize: 30,
      destinationFontSize: 16.8,
      rowOffset: 116,
      supportPanelWidth: 396,
    });
  });

  it('keeps the bottom corner actions clear of the centered close control', () => {
    const { getByLabelText, getByTestId } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        signedIn
        visible
      />,
    );

    expect(StyleSheet.flatten(getByLabelText('Profile').props.style).maxWidth).toBe(157);
    expect(StyleSheet.flatten(getByLabelText('Learn and support').props.style).maxWidth).toBe(157);
    expect(StyleSheet.flatten(getByLabelText('Profile').props.style).bottom).toBe(16);
    expect(StyleSheet.flatten(getByTestId('native-action-menu-profile-icon').props.style)).toMatchObject({
      height: 30,
      width: 30,
    });
    expect(StyleSheet.flatten(getByTestId('native-action-menu-close').props.style)).toMatchObject({
      bottom: 20,
      height: 50,
      width: 50,
    });
  });

  it('honors real top and bottom safe-area insets for every edge control', () => {
    mockSafeAreaInsets = { top: 42, right: 0, bottom: 34, left: 0 };
    const { getByLabelText, getByTestId } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        signedIn
        visible
      />,
    );

    expect(StyleSheet.flatten(getByLabelText('Share Trade Board').props.style).top).toBe(42);
    expect(StyleSheet.flatten(getByTestId('native-action-menu-settings-cluster').props.style).top).toBe(42);
    expect(StyleSheet.flatten(getByLabelText('Profile').props.style).bottom).toBe(34);
    expect(StyleSheet.flatten(getByTestId('native-action-menu-support-cluster').props.style).bottom).toBe(34);
    expect(StyleSheet.flatten(getByTestId('native-action-menu-close').props.style).bottom).toBe(34);
  });

  it('uses the canonical full-width mobile support panel and distinct support glyphs', () => {
    const { getByLabelText, getByTestId } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    fireEvent.press(getByLabelText('Learn and support'));
    expect(StyleSheet.flatten(getByTestId('native-action-menu-support-panel').props.style)).toMatchObject({
      marginRight: -8,
      width: 396,
    });
    for (const glyph of ['compass', 'question', 'info', 'shield', 'book']) {
      expect(getByTestId(`native-support-glyph-${glyph}`)).toBeTruthy();
    }
  });

  it('matches the canonical pending friend-request badge and accessible profile label', () => {
    const { getByLabelText, getByText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        pendingFriendCount={12}
        signedIn
        visible
      />,
    );

    expect(getByLabelText('Profile, 12 pending friend requests')).toBeTruthy();
    expect(getByText('9+', { includeHiddenElements: true })).toBeTruthy();
  });

  it('does not run the custom entrance animation when reduced motion is requested', () => {
    mockShouldReduceMotion = true;
    const timing = jest.spyOn(Animated, 'timing');

    render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={jest.fn()}
        visible
      />,
    );

    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });

  it.each([
    ['Register', '/register'],
    ['Login', '/login'],
  ] as const)('matches the canonical signed-out %s action', (label, path) => {
    const onNavigate = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <NativeActionMenu
        assetBaseUrl="https://pokegonexus.com"
        onClose={jest.fn()}
        onNavigate={onNavigate}
        signedIn={false}
        visible
      />,
    );

    expect(getByLabelText('Register')).toBeTruthy();
    expect(getByLabelText('Login')).toBeTruthy();
    expect(queryByLabelText('Profile')).toBeNull();
    expect(queryByLabelText('Share Trade Board')).toBeNull();

    fireEvent.press(getByLabelText(label));
    act(() => jest.advanceTimersByTime(32));
    expect(onNavigate).toHaveBeenCalledWith(path);
  });
});
