import type { CSSProperties } from 'react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

import { resolveSwipeAxis } from './overlaySwipe';

export type SwipeAxis = 'x' | 'y' | null;
export type SwipeDirection = 'previous' | 'next';

export type SwipeState = {
  active: boolean;
  startX: number;
  startY: number;
};

export type SwipeMoveResult = {
  axis: SwipeAxis;
  horizontal: boolean;
  offsetX: number;
};

const { instanceOverlaySwipe } = collectionExperienceParityContract;
const OVERLAY_MOTION_TRANSITION = `transform ${instanceOverlaySwipe.entryTransitionMs}ms cubic-bezier(${instanceOverlaySwipe.transitionEasing.join(', ')})`;

export const createInactiveSwipeState = (): SwipeState => ({
  active: false,
  startX: 0,
  startY: 0,
});

export const createActiveSwipeState = (clientX: number, clientY: number): SwipeState => ({
  active: true,
  startX: clientX,
  startY: clientY,
});

export const clampSwipeOffsetX = (deltaX: number): number =>
  Math.max(
    -instanceOverlaySwipe.maxDragOffset,
    Math.min(instanceOverlaySwipe.maxDragOffset, deltaX),
  );

export const getSwipeMoveResult = (
  swipeState: SwipeState,
  clientX: number,
  clientY: number,
  currentAxis: SwipeAxis,
): SwipeMoveResult => {
  if (!swipeState.active) {
    return {
      axis: currentAxis,
      horizontal: false,
      offsetX: 0,
    };
  }

  const deltaX = clientX - swipeState.startX;
  const deltaY = clientY - swipeState.startY;
  const axis = resolveSwipeAxis(deltaX, deltaY, currentAxis);

  return {
    axis,
    horizontal: axis === 'x',
    offsetX: axis === 'x' ? clampSwipeOffsetX(deltaX) : 0,
  };
};

export const getSwipeEndDirection = (
  swipeState: SwipeState,
  clientX: number,
  currentAxis: SwipeAxis,
): SwipeDirection | null => {
  if (!swipeState.active) return null;

  const deltaX = clientX - swipeState.startX;
  if (currentAxis !== 'x' || Math.abs(deltaX) < instanceOverlaySwipe.navigationDelta) {
    return null;
  }

  return deltaX < 0 ? 'next' : 'previous';
};

export const getNavigationOffsets = (
  direction: SwipeDirection,
): { exitOffset: number; enterOffset: number } => ({
  exitOffset: direction === 'next'
    ? -instanceOverlaySwipe.exitOffset
    : instanceOverlaySwipe.exitOffset,
  enterOffset: direction === 'next'
    ? instanceOverlaySwipe.enterOffset
    : -instanceOverlaySwipe.enterOffset,
});

export const getOverlayMotionStyle = ({
  isNavigableOverlay,
  swipeOffsetX,
  swipeTransitionEnabled,
}: {
  isNavigableOverlay: boolean;
  swipeOffsetX: number;
  swipeTransitionEnabled: boolean;
}): CSSProperties | undefined => {
  if (!isNavigableOverlay) return undefined;

  return {
    transform: `translateX(${swipeOffsetX}px)`,
    transition: swipeTransitionEnabled ? OVERLAY_MOTION_TRANSITION : 'none',
  };
};
