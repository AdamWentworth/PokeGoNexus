import {
  beginNativeUiInteraction,
  runAfterNativeUiInteractions,
} from '../../../src/interaction/nativeUiInteractionScheduler';

describe('nativeUiInteractionScheduler', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('holds background work until the active interaction releases', () => {
    const task = jest.fn();
    const release = beginNativeUiInteraction();

    runAfterNativeUiInteractions(task);
    jest.runOnlyPendingTimers();
    expect(task).not.toHaveBeenCalled();

    release();
    jest.runOnlyPendingTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('waits for every overlapping interaction', () => {
    const task = jest.fn();
    const releaseFirst = beginNativeUiInteraction();
    const releaseSecond = beginNativeUiInteraction();

    runAfterNativeUiInteractions(task);
    releaseFirst();
    jest.runOnlyPendingTimers();
    expect(task).not.toHaveBeenCalled();

    releaseSecond();
    jest.runOnlyPendingTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('spreads a post-interaction backlog across separate frame turns', () => {
    const first = jest.fn();
    const second = jest.fn();
    const third = jest.fn();
    const release = beginNativeUiInteraction();

    runAfterNativeUiInteractions(first);
    runAfterNativeUiInteractions(second);
    runAfterNativeUiInteractions(third);
    release();

    jest.advanceTimersByTime(0);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();

    jest.advanceTimersByTime(16);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();

    jest.advanceTimersByTime(16);
    expect(third).toHaveBeenCalledTimes(1);
  });

  it('cancels queued work without leaking it into the next idle period', () => {
    const task = jest.fn();
    const release = beginNativeUiInteraction();
    const scheduled = runAfterNativeUiInteractions(task);

    scheduled.cancel();
    release();
    jest.runOnlyPendingTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('can finish small warm-up batches promptly without entering an idle callback', () => {
    const idleCallback = jest.fn(() => 1);
    const originalIdleCallback = globalThis.requestIdleCallback;
    globalThis.requestIdleCallback = idleCallback;
    const task = jest.fn();

    try {
      runAfterNativeUiInteractions(task, { preferIdle: false });
      jest.runOnlyPendingTimers();

      expect(task).toHaveBeenCalledTimes(1);
      expect(idleCallback).not.toHaveBeenCalled();
    } finally {
      globalThis.requestIdleCallback = originalIdleCallback;
    }
  });
});
