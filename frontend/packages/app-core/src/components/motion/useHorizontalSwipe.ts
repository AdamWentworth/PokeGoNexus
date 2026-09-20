import { useCallback, useEffect, useRef } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

const DIRECTION_LOCK_ANGLE = 30;
const SYSTEM_BACK_GESTURE_EDGE_PX = 24;

export interface UseHorizontalSwipeProps {
  onSwipe?: (direction: 'left' | 'right' | null) => void;
  onDrag?: (distance: number) => void;
  disabled?: boolean;
}

export interface HorizontalSwipeHandlers {
  onTouchStart: (event: ReactTouchEvent) => void;
  onTouchMove: (event: ReactTouchEvent) => void;
  onTouchEnd: (event: ReactTouchEvent) => void;
  onMouseDown?: (event: ReactMouseEvent) => void;
  onMouseMove?: (event: ReactMouseEvent) => void;
  onMouseUp?: (event: ReactMouseEvent) => void;
}

const isInteractiveElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return (
    ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'LABEL'].includes(
      target.tagName,
    ) || target.getAttribute('contentEditable') === 'true'
  );
};

export default function useHorizontalSwipe({
  onSwipe,
  onDrag,
  disabled = false,
}: UseHorizontalSwipeProps): HorizontalSwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const isDragging = useRef(false);
  const directionLock = useRef<'horizontal' | 'vertical' | null>(null);

  const handleStart = useCallback(
    (x: number, y: number, preserveSystemBackGesture = false) => {
      if (disabled || isInteractiveElement(document.elementFromPoint(x, y)))
        return;
      if (
        preserveSystemBackGesture &&
        (x <= SYSTEM_BACK_GESTURE_EDGE_PX ||
          x >= window.innerWidth - SYSTEM_BACK_GESTURE_EDGE_PX)
      ) {
        return;
      }

      startX.current = x;
      startY.current = y;
      lastX.current = x;
      isDragging.current = true;
      directionLock.current = null;
    },
    [disabled],
  );

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (disabled || !isDragging.current) return;

      if (!directionLock.current) {
        const dx = x - startX.current;
        const dy = y - startY.current;
        const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
        directionLock.current =
          angle < DIRECTION_LOCK_ANGLE || angle > 180 - DIRECTION_LOCK_ANGLE
            ? 'horizontal'
            : 'vertical';
      }

      if (directionLock.current !== 'horizontal') return;
      const distance = x - startX.current;
      const maxDistance = window.innerWidth
        * collectionExperienceParityContract.pageSwipeMaxPeekRatio;
      onDrag?.(Math.max(-maxDistance, Math.min(maxDistance, distance)));
      lastX.current = x;
    },
    [disabled, onDrag],
  );

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;

    const distance = lastX.current - startX.current;
    onSwipe?.(
      !disabled
        && Math.abs(distance) > collectionExperienceParityContract.pageSwipeThresholdPx
        ? distance > 0
          ? 'right'
          : 'left'
        : null,
    );
    isDragging.current = false;
    directionLock.current = null;
  }, [disabled, onSwipe]);

  useEffect(() => {
    if (!disabled) return;
    isDragging.current = false;
    directionLock.current = null;
    startX.current = 0;
    startY.current = 0;
    lastX.current = 0;
  }, [disabled]);

  return {
    onTouchStart: (event) => {
      const touch = event.touches[0];
      handleStart(touch.clientX, touch.clientY, true);
    },
    onTouchMove: (event) => {
      const touch = event.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    onTouchEnd: handleEnd,
    ...(import.meta.env.DEV && {
      onMouseDown: (event: ReactMouseEvent) =>
        handleStart(event.clientX, event.clientY),
      onMouseMove: (event: ReactMouseEvent) => {
        if (event.buttons === 1) handleMove(event.clientX, event.clientY);
      },
      onMouseUp: handleEnd,
    }),
  };
}
