import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import type {
  DragEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  TouchEventHandler,
} from 'react';
import type { OverlayPokemon } from './overlayTypes';
import { isSwipeInteractiveTarget } from './overlaySwipe';
import {
  createActiveSwipeState,
  createInactiveSwipeState,
  getNavigationOffsets,
  getOverlayMotionStyle,
  getSwipeEndDirection,
  getSwipeMoveResult,
  type SwipeDirection,
} from './overlaySwipeNavigationState';

export type SwipeCaptureHandlers = {
  onDragStart: DragEventHandler<HTMLDivElement>;
  onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
  onPointerUpCapture: PointerEventHandler<HTMLDivElement>;
  onPointerMoveCapture: PointerEventHandler<HTMLDivElement>;
  onMouseDownCapture: MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture: MouseEventHandler<HTMLDivElement>;
  onMouseMoveCapture: MouseEventHandler<HTMLDivElement>;
  onTouchStartCapture: TouchEventHandler<HTMLDivElement>;
  onTouchEndCapture: TouchEventHandler<HTMLDivElement>;
  onTouchMoveCapture: TouchEventHandler<HTMLDivElement>;
};

type UseOverlaySwipeNavigationArgs = {
  isNavigableOverlay: boolean;
  previousPokemon: OverlayPokemon | null;
  nextPokemon: OverlayPokemon | null;
  navigateToPokemon: (target: OverlayPokemon | null) => void;
};

export const useOverlaySwipeNavigation = ({
  isNavigableOverlay,
  previousPokemon,
  nextPokemon,
  navigateToPokemon,
}: UseOverlaySwipeNavigationArgs) => {
  const navTimeoutsRef = useRef<number[]>([]);
  const swipeStateRef = useRef(createInactiveSwipeState());
  const swipeAxisRef = useRef<'x' | 'y' | null>(null);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);

  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [swipeTransitionEnabled, setSwipeTransitionEnabled] = useState(false);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [isBackgroundTransitioning, setIsBackgroundTransitioning] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isHorizontalSwiping, setIsHorizontalSwiping] = useState(false);
  const [ignorePointerEvents, setIgnorePointerEvents] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIgnorePointerEvents(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const scheduleNavTimeout = useCallback((handler: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      navTimeoutsRef.current = navTimeoutsRef.current.filter((id) => id !== timeoutId);
      handler();
    }, delayMs);
    navTimeoutsRef.current.push(timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      navTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      navTimeoutsRef.current = [];
    };
  }, []);

  const resetSwipeState = useCallback(() => {
    swipeStateRef.current = createInactiveSwipeState();
    swipeAxisRef.current = null;
    setIsSwiping(false);
    setIsHorizontalSwiping(false);
  }, []);

  const resetMotionForIncomingPokemon = useCallback(() => {
    navTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    navTimeoutsRef.current = [];
    setSwipeOffsetX(0);
    setSwipeTransitionEnabled(false);
    setIsSwipeAnimating(false);
    setIsBackgroundTransitioning(false);
    setIsHorizontalSwiping(false);
  }, []);

  const animateNavigation = useCallback(
    (direction: SwipeDirection) => {
      if (!isNavigableOverlay) return;
      if (isSwipeAnimating) return;

      const target = direction === 'next' ? nextPokemon : previousPokemon;
      if (!target) {
        setSwipeTransitionEnabled(true);
        setSwipeOffsetX(0);
        return;
      }

      const { exitOffset, enterOffset } = getNavigationOffsets(direction);

      setIsSwipeAnimating(true);
      setSwipeTransitionEnabled(true);
      setSwipeOffsetX(exitOffset);
      setIsBackgroundTransitioning(true);

      scheduleNavTimeout(() => {
        navigateToPokemon(target);
        setSwipeTransitionEnabled(false);
        setSwipeOffsetX(enterOffset);

        requestAnimationFrame(() => {
          setSwipeTransitionEnabled(true);
          setSwipeOffsetX(0);
        });

        scheduleNavTimeout(() => {
          setIsSwipeAnimating(false);
          setIsBackgroundTransitioning(false);
        }, collectionExperienceParityContract.instanceOverlaySwipe.entryTransitionMs);
      }, collectionExperienceParityContract.instanceOverlaySwipe.swapDelayMs);
    },
    [
      isNavigableOverlay,
      isSwipeAnimating,
      navigateToPokemon,
      nextPokemon,
      previousPokemon,
      scheduleNavTimeout,
    ],
  );

  const handleNavigatePrevious = useCallback(() => {
    animateNavigation('previous');
  }, [animateNavigation]);

  const handleNavigateNext = useCallback(() => {
    animateNavigation('next');
  }, [animateNavigation]);

  const cancelSwipeAndResetOffset = useCallback(() => {
    if (!swipeStateRef.current.active) return;
    setSwipeTransitionEnabled(true);
    setSwipeOffsetX(0);
    resetSwipeState();
  }, [resetSwipeState]);

  const beginSwipe = useCallback(
    (target: EventTarget | null, clientX: number, clientY: number) => {
      if (!isNavigableOverlay) return;
      if (isSwipeInteractiveTarget(target)) return;
      if (swipeStateRef.current.active) return;
      if (isSwipeAnimating) return;

      swipeStateRef.current = createActiveSwipeState(clientX, clientY);
      swipeAxisRef.current = null;
      setIsSwiping(true);
      setSwipeTransitionEnabled(false);
    },
    [isNavigableOverlay, isSwipeAnimating],
  );

  const moveSwipe = useCallback(
    (clientX: number, clientY: number): boolean => {
      const swipeState = swipeStateRef.current;
      if (!swipeState.active || isSwipeAnimating) return false;

      const moveResult = getSwipeMoveResult(
        swipeState,
        clientX,
        clientY,
        swipeAxisRef.current,
      );
      swipeAxisRef.current = moveResult.axis;
      if (!moveResult.horizontal) return false;

      setIsHorizontalSwiping(true);
      setSwipeOffsetX(moveResult.offsetX);
      return true;
    },
    [isSwipeAnimating],
  );

  const endSwipe = useCallback(
    (clientX: number, _clientY: number) => {
      const swipeState = swipeStateRef.current;
      if (!swipeState.active) return;

      const direction = getSwipeEndDirection(swipeState, clientX, swipeAxisRef.current);

      if (direction) {
        animateNavigation(direction);
      } else {
        setSwipeTransitionEnabled(true);
        setSwipeOffsetX(0);
      }

      resetSwipeState();
    },
    [animateNavigation, resetSwipeState],
  );

  const handleOverlayPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (isSwipeInteractiveTarget(event.target)) return;

      event.stopPropagation();
      if (event.pointerType === 'mouse') {
        event.preventDefault();
      }
      if (isNavigableOverlay) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an enhancement; window listeners still track drag.
        }
      }
      beginSwipe(event.target, event.clientX, event.clientY);
    },
    [beginSwipe, isNavigableOverlay],
  );

  const handleOverlayPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      if (isNavigableOverlay) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore capture release failures.
        }
      }
      endSwipe(event.clientX, event.clientY);
    },
    [endSwipe, isNavigableOverlay],
  );

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      const horizontalSwipe = moveSwipe(event.clientX, event.clientY);
      if (horizontalSwipe) {
        event.preventDefault();
      }
    },
    [moveSwipe],
  );

  const handleOverlayMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (isSwipeInteractiveTarget(event.target)) return;

      event.stopPropagation();
      event.preventDefault();
      beginSwipe(event.target, event.clientX, event.clientY);
    },
    [beginSwipe],
  );

  const handleOverlayMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      endSwipe(event.clientX, event.clientY);
    },
    [endSwipe],
  );

  const handleOverlayMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      moveSwipe(event.clientX, event.clientY);
    },
    [moveSwipe],
  );

  const handleOverlayTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (isSwipeInteractiveTarget(event.target)) return;

      event.stopPropagation();
      const touch = event.touches[0];
      if (!touch) return;
      beginSwipe(event.target, touch.clientX, touch.clientY);
    },
    [beginSwipe],
  );

  const handleOverlayTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      const touch = event.changedTouches[0];
      if (!touch) return;
      endSwipe(touch.clientX, touch.clientY);
    },
    [endSwipe],
  );

  const handleOverlayTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeStateRef.current.active) return;
      event.stopPropagation();
      const touch = event.touches[0];
      if (!touch) return;
      const horizontalSwipe = moveSwipe(touch.clientX, touch.clientY);
      if (horizontalSwipe) {
        event.preventDefault();
      }
    },
    [moveSwipe],
  );

  useEffect(() => {
    if (!isSwiping) return;

    const onWindowMouseMove = (event: MouseEvent) => {
      const horizontalSwipe = moveSwipe(event.clientX, event.clientY);
      if (horizontalSwipe) {
        event.preventDefault();
      }
    };
    const onWindowMouseUp = (event: MouseEvent) => {
      endSwipe(event.clientX, event.clientY);
    };
    const onWindowTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const horizontalSwipe = moveSwipe(touch.clientX, touch.clientY);
      if (horizontalSwipe && event.cancelable) {
        event.preventDefault();
      }
    };
    const onWindowTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      endSwipe(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [endSwipe, isSwiping, moveSwipe]);

  useEffect(() => {
    if (!isNavigableOverlay) return;

    const isWithinOverlay = (target: EventTarget | null): boolean => {
      const root = overlayRootRef.current;
      return target instanceof Node && root ? root.contains(target) : false;
    };

    const onDocumentPointerDown = (event: PointerEvent) => {
      if (ignorePointerEvents) return;
      if (!isWithinOverlay(event.target)) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (isSwipeInteractiveTarget(event.target)) return;
      if (event.pointerType === 'mouse' && event.cancelable) {
        event.preventDefault();
      }
      beginSwipe(event.target, event.clientX, event.clientY);
    };

    const onDocumentPointerMove = (event: PointerEvent) => {
      if (!isWithinOverlay(event.target) && !swipeStateRef.current.active) return;
      const horizontalSwipe = moveSwipe(event.clientX, event.clientY);
      if (horizontalSwipe && event.cancelable) {
        event.preventDefault();
      }
    };

    const onDocumentPointerUp = (event: PointerEvent) => {
      if (!swipeStateRef.current.active) return;
      endSwipe(event.clientX, event.clientY);
    };

    const onDocumentPointerCancel = () => {
      cancelSwipeAndResetOffset();
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, { capture: true });
    document.addEventListener('pointermove', onDocumentPointerMove, { capture: true });
    document.addEventListener('pointerup', onDocumentPointerUp, { capture: true });
    document.addEventListener('pointercancel', onDocumentPointerCancel, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('pointermove', onDocumentPointerMove, true);
      document.removeEventListener('pointerup', onDocumentPointerUp, true);
      document.removeEventListener('pointercancel', onDocumentPointerCancel, true);
    };
  }, [
    beginSwipe,
    cancelSwipeAndResetOffset,
    endSwipe,
    ignorePointerEvents,
    isNavigableOverlay,
    moveSwipe,
  ]);

  const overlayMotionStyle = useMemo(
    () =>
      getOverlayMotionStyle({
        isNavigableOverlay,
        swipeOffsetX,
        swipeTransitionEnabled,
      }),
    [isNavigableOverlay, swipeOffsetX, swipeTransitionEnabled],
  );

  const swipeCaptureHandlers: SwipeCaptureHandlers = {
    onDragStart: (event) => {
      if (isNavigableOverlay) {
        event.preventDefault();
      }
    },
    onPointerDownCapture: handleOverlayPointerDown,
    onPointerUpCapture: handleOverlayPointerUp,
    onPointerMoveCapture: handleOverlayPointerMove,
    onMouseDownCapture: handleOverlayMouseDown,
    onMouseUpCapture: handleOverlayMouseUp,
    onMouseMoveCapture: handleOverlayMouseMove,
    onTouchStartCapture: handleOverlayTouchStart,
    onTouchEndCapture: handleOverlayTouchEnd,
    onTouchMoveCapture: handleOverlayTouchMove,
  };

  const hasPreviousPokemon = Boolean(previousPokemon);
  const hasNextPokemon = Boolean(nextPokemon);

  return {
    canNavigateNext: hasNextPokemon && !isSwipeAnimating,
    canNavigatePrevious: hasPreviousPokemon && !isSwipeAnimating,
    cancelSwipeAndResetOffset,
    handleNavigateNext,
    handleNavigatePrevious,
    hasNextPokemon,
    hasPreviousPokemon,
    ignorePointerEvents,
    isBackgroundTransitioning,
    isHorizontalSwiping,
    isSwipeAnimating,
    isSwiping,
    overlayMotionStyle,
    overlayRootRef,
    resetMotionForIncomingPokemon,
    swipeCaptureHandlers,
  };
};
