import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  NativeAppLoadingOverlay,
  NativeAppLoadingProvider,
  resolvePostNavigationPaintHoldMs,
  useNativeAppLoading,
} from '../../../src/components/NativeAppLoadingProvider';

let mockScheme: 'dark' | 'light' = 'dark';

jest.mock('../../../src/features/settings/useNativeColorScheme', () => ({
  useNativeColorScheme: () => mockScheme,
}));

const Harness = ({ action }: { action: () => void }) => {
  const { runWithLoading } = useNativeAppLoading();
  return (
    <Pressable accessibilityLabel="Navigate" onPress={() => runWithLoading('route', action)}>
      <Text>Navigate</Text>
    </Pressable>
  );
};

describe('NativeAppLoadingProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockScheme = 'dark';
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('never applies the screenshot hold to an ordinary app route', () => {
    expect(resolvePostNavigationPaintHoldMs(true, '/native/raid')).toBe(0);
    expect(resolvePostNavigationPaintHoldMs(true, '/native/search')).toBe(0);
    expect(resolvePostNavigationPaintHoldMs(false, '/device-smoke/tools')).toBe(0);
    expect(resolvePostNavigationPaintHoldMs(true, '/device-smoke/tools')).toBe(8000);
  });

  it('covers navigation with the canonical spinner through the hide grace period', () => {
    const action = jest.fn();
    const view = render(
      <NativeAppLoadingProvider navigationPath="/native">
        <Harness action={action} />
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>,
    );

    expect(view.getByTestId('native-app-loading-retained-host', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(view.queryByTestId('native-app-loading-overlay')).toBeNull();
    expect(view.getByTestId('native-loading-spinner-dark', {
      includeHiddenElements: true,
    })).toBeTruthy();
    fireEvent.press(view.getByLabelText('Navigate'));
    expect(view.getByTestId('native-app-loading-overlay')).toBeTruthy();
    expect(view.getByTestId('native-loading-spinner-dark', { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('native-app-loading-overlay').props.style)).toMatchObject({
      backgroundColor: '#101a19',
      flex: 1,
    });
    expect(action).toHaveBeenCalledTimes(1);

    fireEvent(view.getByTestId('native-app-loading-host'), 'layout');
    expect(view.getByTestId('native-app-loading-overlay')).toBeTruthy();

    view.rerender(
      <NativeAppLoadingProvider navigationPath="/native/collection">
        <Harness action={action} />
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>,
    );
    act(() => jest.advanceTimersByTime(16));
    act(() => jest.advanceTimersByTime(149));
    expect(view.getByTestId('native-app-loading-overlay')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(view.queryByTestId('native-app-loading-overlay')).toBeNull();
    expect(view.getByTestId('native-app-loading-retained-host', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(view.getByTestId('native-loading-spinner-dark', {
      includeHiddenElements: true,
    })).toBeTruthy();
  });

  it('matches the canonical dark and light overlay surfaces', () => {
    const action = jest.fn();
    const view = render(
      <NativeAppLoadingProvider>
        <Harness action={action} />
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>,
    );

    fireEvent.press(view.getByLabelText('Navigate'));
    expect(StyleSheet.flatten(view.getByTestId('native-app-loading-overlay').props.style)).toMatchObject({
      backgroundColor: '#101a19',
    });

    act(() => jest.runOnlyPendingTimers());
    mockScheme = 'light';
    view.rerender(
      <NativeAppLoadingProvider>
        <Harness action={action} />
        <NativeAppLoadingOverlay />
      </NativeAppLoadingProvider>,
    );
    expect(view.getByTestId('native-loading-spinner-light', { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('native-app-loading-overlay').props.style)).toMatchObject({
      backgroundColor: '#f8fff9',
    });
  });
});
