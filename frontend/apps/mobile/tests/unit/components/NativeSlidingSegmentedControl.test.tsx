import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { webCssVarTokens } from '@pokemongonexus/shared-ui-tokens';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
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

  it('follows the content track halfway through a slide without a competing animation', () => {
    const scrollX = new Animated.Value(0);
    const timing = jest.spyOn(Animated, 'timing');
    const onChange = jest.fn();
    const view = render(<NativeSlidingSegmentedControl
      accessibilityLabel="Example views"
      indicatorTestID="example-indicator"
      items={items}
      onChange={onChange}
      progress={Animated.divide(scrollX, 390)}
      renderItem={(item) => <Text>{item.label}</Text>}
      testID="example-switcher"
      value="first"
    />);
    fireEvent(view.getByTestId('example-switcher'), 'layout', {
      nativeEvent: { layout: { width: 374, height: 56 } },
    });
    const offset = () => StyleSheet.flatten(view.getByTestId('example-indicator', { includeHiddenElements: true }).props.style).transform[0].translateX;
    expect(offset()).toBe(0);
    act(() => scrollX.setValue(195));
    expect(offset()).toBe(92);
    act(() => scrollX.setValue(390));
    expect(offset()).toBe(184);
    timing.mockClear();
    fireEvent.press(view.getByText('Second view'));
    expect(onChange).toHaveBeenCalledWith('second');
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
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
