export const isSwipeInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        'button',
        'a',
        '[role="button"]',
        'textarea',
        'select',
        'summary',
        'details',
        '[contenteditable="true"]',
        'input[type="text"]',
        'input[type="number"]',
        'input[type="date"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'input[type="range"]',
        '.mirror',
        '.favorite-component',
        '.background-button',
        '.reset-container',
        '.trade-target-reset-button',
      ].join(', '),
    ),
  );
};

export const resolveSwipeAxis = (
  deltaX: number,
  deltaY: number,
  currentAxis: 'x' | 'y' | null,
): 'x' | 'y' | null => {
  if (currentAxis) return currentAxis;

  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  if (absDeltaX >= 10 && absDeltaX >= absDeltaY * 0.9) {
    return 'x';
  }

  if (absDeltaY >= 14 && absDeltaY > absDeltaX * 1.35) {
    return 'y';
  }

  return null;
};
