import { fireEvent, render, screen } from '@testing-library/react-native';
import { webCssVarTokens } from '@pokemongonexus/shared-ui-tokens';
import { Animated, Easing, Text } from 'react-native';
import {
  NativeSlidingSegmentedControl,
  resolveNativeSlidingSegmentMetrics,
} from '../../../src/components/NativeSlidingSegmentedControl';

const items = [
  { label: 'First view', value: 'first' },
  { label: 'Second view', value: 'second' },
] as const;

describe('NativeSlidingSegmentedControl', () => {
  it('matches the two-column geometry used by the Vite segmented control', () => {
    expect(resolveNativeSlidingSegmentMetrics(374, 2)).toEqual({
      indicatorLeft: 5,
      indicatorWidth: 180,
      itemOffset: 184,
    });
  });

  it('starts the shared native-thread transition before changing expensive content', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onChange = jest.fn();
    render(
      <NativeSlidingSegmentedControl
        accessibilityLabel="Example views"
        indicatorTestID="example-indicator"
        items={items}
        onChange={onChange}
        renderItem={(item) => <Text>{item.label}</Text>}
        testID="example-switcher"
        value="first"
      />,
    );
    timing.mockClear();

    fireEvent(
      screen.getByTestId('example-switcher'),
      'layout',
      { nativeEvent: { layout: { height: 56, width: 374, x: 0, y: 0 } } },
    );
    fireEvent.press(screen.getByText('Second view'));

    expect(screen.getByTestId('example-indicator', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: webCssVarTokens.motionSeconds.fast * 1000,
        easing: Easing.ease,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    expect(timing.mock.invocationCallOrder[0])
      .toBeLessThan(onChange.mock.invocationCallOrder[0]);
    expect(onChange).toHaveBeenCalledWith('second');
    timing.mockRestore();
  });
});
