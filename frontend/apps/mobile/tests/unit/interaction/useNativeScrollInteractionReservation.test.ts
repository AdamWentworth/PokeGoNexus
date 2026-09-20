import { act, renderHook } from '@testing-library/react-native';
import {
  NATIVE_SCROLL_RELEASE_GRACE_MS,
  useNativeScrollInteractionReservation,
} from '../../../src/interaction/useNativeScrollInteractionReservation';
import { beginNativeUiInteraction } from '../../../src/interaction/nativeUiInteractionScheduler';

jest.mock('../../../src/interaction/nativeUiInteractionScheduler', () => ({
  beginNativeUiInteraction: jest.fn(),
}));

const mockBeginNativeUiInteraction = jest.mocked(beginNativeUiInteraction);

describe('useNativeScrollInteractionReservation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps background work paused across the drag-to-momentum handoff', () => {
    const release = jest.fn();
    mockBeginNativeUiInteraction.mockReturnValue(release);
    const { result } = renderHook(() => useNativeScrollInteractionReservation());

    act(() => result.current.onScrollBeginDrag());
    expect(mockBeginNativeUiInteraction).toHaveBeenCalledTimes(1);

    act(() => result.current.onScrollEndDrag());
    act(() => jest.advanceTimersByTime(NATIVE_SCROLL_RELEASE_GRACE_MS - 1));
    expect(release).not.toHaveBeenCalled();

    act(() => result.current.onMomentumScrollBegin());
    act(() => jest.advanceTimersByTime(NATIVE_SCROLL_RELEASE_GRACE_MS));
    expect(release).not.toHaveBeenCalled();

    act(() => result.current.onMomentumScrollEnd());
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases a drag that does not begin momentum', () => {
    const release = jest.fn();
    mockBeginNativeUiInteraction.mockReturnValue(release);
    const { result } = renderHook(() => useNativeScrollInteractionReservation());

    act(() => result.current.onScrollBeginDrag());
    act(() => result.current.onScrollEndDrag());
    act(() => jest.advanceTimersByTime(NATIVE_SCROLL_RELEASE_GRACE_MS));

    expect(release).toHaveBeenCalledTimes(1);
  });
});
