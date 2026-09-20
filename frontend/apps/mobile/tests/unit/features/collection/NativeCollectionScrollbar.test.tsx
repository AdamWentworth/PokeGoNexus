import { createRef } from 'react';
import { Animated, FlatList } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import {
  NativeCollectionParityFixture,
  type NativeCollectionParityFixtureHandle,
} from '../../../../src/features/collection/parity/NativeCollectionParityFixture';
import { NativeCollectionScrollbar } from '../../../../src/features/collection/parity/NativeCollectionScrollbar';

const thumb = () => screen.getByTestId('native-collection-scrollbar-thumb', { includeHiddenElements: true });

const mountGrid = (initialScrollOffset = 0) => {
  const onScrollOffsetChange = jest.fn();
  const ref = createRef<NativeCollectionParityFixtureHandle>();
  const view = render(<NativeCollectionParityFixture
    initialScrollOffset={initialScrollOffset}
    onScrollOffsetChange={onScrollOffsetChange}
    ref={ref}
  />);
  const list = view.UNSAFE_getByType(FlatList);
  const seek = jest.spyOn(list.instance, 'scrollToOffset').mockImplementation(() => undefined);
  const grid = screen.getByTestId('native-collection-grid');
  fireEvent(grid, 'layout', { nativeEvent: { layout: { width: 412, height: 600 } } });
  fireEvent(grid, 'contentSizeChange', 412, 6600);
  fireEvent(grid, 'scrollBeginDrag');
  const scrollY = view.UNSAFE_getByType(NativeCollectionScrollbar).props.scrollY as Animated.Value;
  // Jest has no native Animated getValue bridge. Preserve the value itself and
  // emulate only the one-shot native read used when a finger grabs the thumb.
  jest.spyOn(scrollY, 'stopAnimation').mockImplementation((callback) => {
    callback?.((scrollY as Animated.Value & { __getValue: () => number }).__getValue());
  });
  return { ...view, grid, list, seek, ref, scrollY, onScrollOffsetChange };
};

const dragThumb = async (delta: number, cancelled = false) => {
  fireEvent(screen.getByTestId('native-collection-grid'), 'scrollBeginDrag');
  await act(async () => undefined); // RNGH installs enabled/updated handlers asynchronously.
  act(() => {
    fireGestureHandler(getByGestureTestId('native-collection-scrollbar-pan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 0 },
      { state: State.ACTIVE, translationY: delta },
      { state: cancelled ? State.CANCELLED : State.END, translationY: delta },
    ]);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('drags the actual virtualized list halfway and persists only the completed seek', async () => {
  const { seek, onScrollOffsetChange } = mountGrid();
  // 600px viewport -> 510px track minus the 60px thumb = 450px travel.
  await dragThumb(225);
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 3000 });
  expect(onScrollOffsetChange).toHaveBeenCalledTimes(1);
  expect(onScrollOffsetChange).toHaveBeenLastCalledWith(3000);
});

it('clamps drags at both ends and resets the thumb and list together', async () => {
  const { seek, ref, onScrollOffsetChange } = mountGrid();
  await dragThumb(900);
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 6000 });
  act(() => ref.current?.resetScroll());
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 0 });
  expect(onScrollOffsetChange).toHaveBeenLastCalledWith(0);
  await dragThumb(-900);
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 0 });
});

it('grabs the current native position during momentum without a per-frame JS listener', async () => {
  const animateEvent = jest.spyOn(Animated, 'event');
  const { seek, scrollY } = mountGrid(1200);
  // Native Animated reports the value on demand; the last settled offset is stale.
  jest.spyOn(scrollY, 'stopAnimation').mockImplementation((callback) => callback?.(2400));
  await dragThumb(45);
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 3000 });
  expect(animateEvent).toHaveBeenCalledWith(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );
});

it('ignores a late native position read after the finger is released', async () => {
  const { seek, scrollY, onScrollOffsetChange } = mountGrid();
  let respond: ((offset: number) => void) | undefined;
  jest.spyOn(scrollY, 'stopAnimation').mockImplementation((callback) => { respond = callback; });
  await dragThumb(225);
  act(() => respond?.(1200));
  expect(seek).not.toHaveBeenCalled();
  expect(onScrollOffsetChange).not.toHaveBeenCalled();
});

it('releases a cancelled drag and persists the last position reached', async () => {
  const { seek, onScrollOffsetChange } = mountGrid();
  await dragThumb(90, true);
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 1200 });
  expect(onScrollOffsetChange).toHaveBeenLastCalledWith(1200);
  act(() => jest.advanceTimersByTime(1600));
  expect(thumb().props.pointerEvents).toBe('none');
});

it('shows during scrolling, fades after idle, and cannot intercept taps while hidden', () => {
  const { grid } = mountGrid();
  expect(thumb().props.pointerEvents).toBe('auto');
  act(() => jest.advanceTimersByTime(3000));
  expect(thumb().props.pointerEvents).toBe('auto');
  fireEvent(grid, 'scrollEndDrag', { nativeEvent: { contentOffset: { y: 100 } } });
  act(() => jest.advanceTimersByTime(1600));
  expect(thumb().props.pointerEvents).toBe('none');
  fireEvent(grid, 'scrollBeginDrag');
  expect(thumb().props.pointerEvents).toBe('auto');
});

it('uses new viewport/content measurements and disappears for short results or search controls', async () => {
  const { grid, seek } = mountGrid();
  fireEvent(grid, 'layout', { nativeEvent: { layout: { width: 800, height: 400 } } });
  fireEvent(grid, 'contentSizeChange', 800, 2400);
  await dragThumb(140); // half of the resized 280px thumb travel
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 1000 });
  fireEvent(screen.getByLabelText('Search Pokémon'), 'focus');
  expect(screen.queryByTestId('native-collection-scrollbar-thumb', { includeHiddenElements: true })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Search Pokémon'), 'char');
  expect(thumb()).toBeTruthy();
  fireEvent(grid, 'contentSizeChange', 800, 400);
  expect(screen.queryByTestId('native-collection-scrollbar-thumb', { includeHiddenElements: true })).toBeNull();
  fireEvent(grid, 'contentSizeChange', 800, 0);
  expect(screen.queryByTestId('native-collection-scrollbar-thumb', { includeHiddenElements: true })).toBeNull();
});

it('supports accessible page adjustments from a restored scroll position', () => {
  const { seek, onScrollOffsetChange } = mountGrid(1200);
  fireEvent(thumb(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 1800 });
  expect(onScrollOffsetChange).toHaveBeenLastCalledWith(1800);
  fireEvent(thumb(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(seek).toHaveBeenLastCalledWith({ animated: false, offset: 1200 });
});
