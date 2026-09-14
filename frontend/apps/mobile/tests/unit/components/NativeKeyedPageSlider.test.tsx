import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, StyleSheet, Text } from 'react-native';
import { NativeKeyedPageSlider, NativeSlidingPageHeader } from '../../../src/components/NativeKeyedPageSlider';

const page = (key: string, index: number) => (
  <NativeKeyedPageSlider activeKey={key} activeIndex={index} overlay={<Text>Controls</Text>}>
    <NativeSlidingPageHeader><Text>Controls</Text></NativeSlidingPageHeader>
    <Text>{key} category</Text>
  </NativeKeyedPageSlider>
);
const measure = (view: ReturnType<typeof render>) => {
  fireEvent(view.getByTestId('native-keyed-page-slider'), 'layout', { nativeEvent: { layout: { width: 448 } } });
  fireEvent(view.getByTestId('native-keyed-page-pokemon'), 'layout', { nativeEvent: { layout: { width: 448 } } });
};
const paint = (view: ReturnType<typeof render>, key: string) => {
  fireEvent(view.getByTestId(`native-keyed-page-${key}`), 'layout', { nativeEvent: { layout: { width: 448 } } });
  act(() => jest.runOnlyPendingTimers());
  act(() => jest.runOnlyPendingTimers());
};

describe('NativeKeyedPageSlider', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
  const captureCompletions = () => {
    const callbacks: ((result: { finished: boolean }) => void)[] = [];
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (callback) => { if (callback) callbacks.push(callback); }, stop: jest.fn(), reset: jest.fn(),
    }));
    return { callbacks, timing };
  };

  it('retains both lists and one accessible header until the slide finishes', () => {
    const { callbacks, timing } = captureCompletions();
    const view = render(page('pokemon', 0));
    measure(view);
    expect(timing).not.toHaveBeenCalled();
    view.rerender(page('shiny', 1));
    paint(view, 'shiny');
    expect(view.getByText('pokemon category', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText('pokemon category')).toBeNull();
    expect(view.getByText('shiny category')).toBeTruthy();
    expect(view.getAllByText('Controls')).toHaveLength(1);
    const progress = timing.mock.calls.at(-1)?.[0] as Animated.Value;
    act(() => progress.setValue(224));
    const track = view.UNSAFE_getAllByType(Animated.View).find((node) => node.props.testID === 'native-keyed-page-track');
    const style = StyleSheet.flatten(track?.props.style);
    expect(style.transform[0].translateX.__getValue()).toBe(-224);
    expect(StyleSheet.flatten(view.getByTestId('native-keyed-page-shiny').props.style).left).toBe(448);
    act(() => callbacks.at(-1)?.({ finished: true }));
    expect(view.queryByText('pokemon category', { includeHiddenElements: true })).toBeNull();
    expect(view.getAllByText('Controls')).toHaveLength(1);
  });

  it('ignores a stale completion when tabs reverse before the first slide finishes', () => {
    const { callbacks } = captureCompletions();
    const view = render(page('pokemon', 0));
    measure(view);
    view.rerender(page('shiny', 1));
    paint(view, 'shiny');
    const previous = callbacks.at(-1);
    view.rerender(page('pokemon', 0));
    paint(view, 'pokemon');
    act(() => previous?.({ finished: true }));
    expect(view.getByText('shiny category', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText('pokemon category')).toBeTruthy();
    act(() => callbacks.at(-1)?.({ finished: true }));
    expect(view.queryByText('shiny category', { includeHiddenElements: true })).toBeNull();
  });
});
