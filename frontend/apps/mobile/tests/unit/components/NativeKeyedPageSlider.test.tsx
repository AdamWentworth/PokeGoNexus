import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import { NativeKeyedPageSlider, NativeSlidingPageHeader } from '../../../src/components/NativeKeyedPageSlider';

const page = (key: string, index: number) => (
  <NativeKeyedPageSlider activeKey={key} activeIndex={index} overlay={<Text>Controls</Text>}>
    <NativeSlidingPageHeader><Text>Controls</Text></NativeSlidingPageHeader>
    <Text>{key} category</Text>
  </NativeKeyedPageSlider>
);
const measure = (view: ReturnType<typeof render>) => fireEvent(view.getByTestId('native-keyed-page-slider'),
  'layout', { nativeEvent: { layout: { width: 448 } } });

describe('NativeKeyedPageSlider', () => {
  afterEach(() => jest.restoreAllMocks());
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
    expect(view.getByText('pokemon category', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText('pokemon category')).toBeNull();
    expect(view.getByText('shiny category')).toBeTruthy();
    expect(view.getAllByText('Controls')).toHaveLength(1);
    act(() => callbacks.at(-1)?.({ finished: true }));
    expect(view.queryByText('pokemon category', { includeHiddenElements: true })).toBeNull();
    expect(view.getAllByText('Controls')).toHaveLength(1);
  });

  it('ignores a stale completion when tabs reverse before the first slide finishes', () => {
    const { callbacks } = captureCompletions();
    const view = render(page('pokemon', 0));
    measure(view);
    view.rerender(page('shiny', 1));
    const previous = callbacks.at(-1);
    view.rerender(page('pokemon', 0));
    act(() => previous?.({ finished: true }));
    expect(view.getByText('shiny category', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText('pokemon category')).toBeTruthy();
    act(() => callbacks.at(-1)?.({ finished: true }));
    expect(view.queryByText('shiny category', { includeHiddenElements: true })).toBeNull();
  });
});
