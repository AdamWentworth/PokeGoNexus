// usePokemonCardTouchHandlers.ts

import { useRef } from 'react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

interface UseTouchHandlersProps {
  onSelect: () => void;
  onSwipe?: (dir: 'left' | 'right') => void;
  toggleCardHighlight: (key: string) => void;
  setIsFastSelectEnabled: (enabled: boolean) => void;
  isEditable: boolean;
  isFastSelectEnabled: boolean;
  isDisabled: boolean;
  selectKey: string;
}

const LONG_PRESS_MS = collectionExperienceParityContract.cardLongPressMs;
const SWIPE_THRESHOLD = 50;
const MOVE_CANCEL_THRESHOLD = 10;

export function usePokemonCardTouchHandlers({
  onSelect,
  onSwipe,
  toggleCardHighlight,
  setIsFastSelectEnabled,
  isEditable,
  isFastSelectEnabled,
  isDisabled,
  selectKey,
}: UseTouchHandlersProps) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastTouchX = useRef(0);
  const isSwiping = useRef(false);
  const isScrolling = useRef(false);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const touchHandled = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];

    touchHandled.current = false;
    isSwiping.current = false;
    isScrolling.current = false;
    longPressTriggered.current = false;

    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    lastTouchX.current = touch.clientX;

    // Select the initiating card directly because onSelect still belongs to the render
    // where fast-select was disabled.
    if (isEditable && !isDisabled && !isFastSelectEnabled) {
      longPressTimeout.current = setTimeout(() => {
        if (!isSwiping.current && !isScrolling.current) {
          setIsFastSelectEnabled(true);
          toggleCardHighlight(selectKey);
          touchHandled.current = true;
          longPressTriggered.current = true;
        }
      }, LONG_PRESS_MS);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];

    lastTouchX.current = touch.clientX;
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy)) isSwiping.current = true;

    if (Math.abs(dx) > MOVE_CANCEL_THRESHOLD || Math.abs(dy) > MOVE_CANCEL_THRESHOLD) {
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
        longPressTimeout.current = null;
      }
      isScrolling.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }

    const dx = lastTouchX.current - touchStartX.current;
    if (isSwiping.current && Math.abs(dx) > SWIPE_THRESHOLD) {
      const direction = dx < 0 ? 'left' : 'right';
      onSwipe?.(direction);
      touchHandled.current = true;
      return;
    }

    // If we already did a long-press action, do nothing more on touch end.
    if (isDisabled || isScrolling.current || longPressTriggered.current) return;

    // Always route selection/highlight through parent so it picks the correct key (instance_id vs variant).
    onSelect();
    touchHandled.current = true;
  };

  const handleClick = () => {
    // Suppress click that immediately follows a handled touch
    if (touchHandled.current) {
      touchHandled.current = false;
      return;
    }
    if (isDisabled) return;

    // Always defer to parent; it knows whether to open overlay or toggle highlight.
    onSelect();
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
  };
}
