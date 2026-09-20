import { useCallback, useEffect, useMemo, useRef } from 'react';
import { beginNativeUiInteraction } from './nativeUiInteractionScheduler';

// Android reports end-drag just before momentum begins. Keep the reservation
// alive briefly so background warm-up cannot slip into that handoff frame.
export const NATIVE_SCROLL_RELEASE_GRACE_MS = 80;

export const useNativeScrollInteractionReservation = () => {
  const releaseRef = useRef<(() => void) | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelReleaseTimer = useCallback(() => {
    if (!releaseTimerRef.current) return;
    clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
  }, []);
  const release = useCallback(() => {
    cancelReleaseTimer();
    releaseRef.current?.();
    releaseRef.current = null;
  }, [cancelReleaseTimer]);
  const begin = useCallback(() => {
    cancelReleaseTimer();
    if (!releaseRef.current) releaseRef.current = beginNativeUiInteraction();
  }, [cancelReleaseTimer]);
  const endDrag = useCallback(() => {
    cancelReleaseTimer();
    releaseTimerRef.current = setTimeout(() => {
      releaseTimerRef.current = null;
      releaseRef.current?.();
      releaseRef.current = null;
    }, NATIVE_SCROLL_RELEASE_GRACE_MS);
  }, [cancelReleaseTimer]);

  useEffect(() => release, [release]);

  return useMemo(() => ({
    onMomentumScrollBegin: begin,
    onMomentumScrollEnd: release,
    onScrollBeginDrag: begin,
    onScrollEndDrag: endDrag,
  }), [begin, endDrag, release]);
};
