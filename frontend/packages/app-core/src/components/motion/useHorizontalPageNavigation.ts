import { useRef, useState } from 'react';

import useHorizontalSwipe from './useHorizontalSwipe';

export interface UseHorizontalPageNavigationProps<T extends string> {
  pages: readonly T[];
  activePage: T;
  onChange: (page: T) => void;
  disabled?: boolean;
}

export default function useHorizontalPageNavigation<T extends string>({
  pages,
  activePage,
  onChange,
  disabled = false,
}: UseHorizontalPageNavigationProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = Math.max(0, pages.indexOf(activePage));

  const swipeHandlers = useHorizontalSwipe({
    disabled,
    onSwipe: (direction) => {
      const nextIndex =
        direction === 'left'
          ? Math.min(pages.length - 1, activeIndex + 1)
          : direction === 'right'
            ? Math.max(0, activeIndex - 1)
            : activeIndex;
      if (nextIndex !== activeIndex) onChange(pages[nextIndex]);
      setDragOffset(0);
      setIsDragging(false);
    },
    onDrag: (distance) => {
      const width = viewportRef.current?.offsetWidth ?? window.innerWidth;
      const maxDistance = width * 0.3;
      const isDraggingPastStart = activeIndex === 0 && distance > 0;
      const isDraggingPastEnd =
        activeIndex === pages.length - 1 && distance < 0;
      const edgeResistance =
        isDraggingPastStart || isDraggingPastEnd ? 0.22 : 1;
      setDragOffset(
        Math.max(
          -maxDistance,
          Math.min(maxDistance, distance * edgeResistance),
        ),
      );
      setIsDragging(true);
    },
  });

  return {
    activeIndex,
    dragOffset,
    isDragging,
    swipeHandlers,
    viewportRef,
  };
}
