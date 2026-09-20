import { useCallback, useMemo, useState } from 'react';
import { Animated, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/** Share the page track's native clock with a stationary workspace indicator. */
export const useNativeWorkspaceMotion = (initialIndex = 0) => {
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [scrollX] = useState(() => new Animated.Value(initialIndex * windowWidth));
  const progress = useMemo(() => Animated.divide(scrollX, Math.max(width, 1)), [scrollX, width]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setWidth(nextWidth);
  }, []);
  return { onLayout, progress, scrollX };
};
