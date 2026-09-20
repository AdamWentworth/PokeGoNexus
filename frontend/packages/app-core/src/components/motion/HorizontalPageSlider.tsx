import React, {
  Children,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import './HorizontalPageSlider.css';

type SliderSizing = 'content' | 'fill';

export interface HorizontalPageSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  activeIndex: number;
  children: ReactNode;
  dragOffset?: number;
  isDragging?: boolean;
  sizing?: SliderSizing;
  transform?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
  viewportClassName?: string;
  trackClassName?: string;
  panelClassName?: string;
}

const mergeClassNames = (...classNames: Array<string | undefined | false>) =>
  classNames.filter(Boolean).join(' ');

const HorizontalPageSlider: React.FC<HorizontalPageSliderProps> = ({
  activeIndex,
  children,
  className,
  dragOffset = 0,
  isDragging = false,
  sizing = 'content',
  transform,
  viewportRef,
  viewportClassName,
  trackClassName,
  panelClassName,
  style,
  ...viewportProps
}) => {
  const panels = Children.toArray(children);
  const safeActiveIndex = Math.max(
    0,
    Math.min(activeIndex, Math.max(0, panels.length - 1)),
  );
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalViewportRef.current = node;
      if (viewportRef) viewportRef.current = node;
    },
    [viewportRef],
  );

  useLayoutEffect(() => {
    if (sizing !== 'content') {
      setContentHeight(null);
      return undefined;
    }

    const activePanel = panelRefs.current[safeActiveIndex];
    if (!activePanel) return undefined;

    const updateHeight = () => {
      const nextHeight =
        activePanel.scrollHeight || activePanel.getBoundingClientRect().height;
      setContentHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateHeight);
    observer.observe(activePanel);
    return () => observer.disconnect();
  }, [safeActiveIndex, sizing]);

  const sliderTransform =
    transform ??
    `translate3d(calc(${-safeActiveIndex * 100}% + ${dragOffset}px), 0, 0)`;
  const viewportStyle: React.CSSProperties = {
    ...style,
    ...(sizing === 'content' && contentHeight !== null
      ? { height: contentHeight }
      : {}),
  };

  return (
    <div
      {...viewportProps}
      ref={setViewportRef}
      className={mergeClassNames(
        'horizontal-page-slider',
        `horizontal-page-slider--${sizing}`,
        isDragging && 'horizontal-page-slider--dragging',
        viewportClassName,
        className,
      )}
      style={viewportStyle}
    >
      <div
        className={mergeClassNames(
          'horizontal-page-slider__track',
          trackClassName,
        )}
        style={{
          transform: sliderTransform,
          transition: isDragging
            ? 'none'
            : 'transform var(--motion-page-duration, 300ms) var(--motion-page-easing, cubic-bezier(0.25, 0.46, 0.45, 0.94))',
        }}
      >
        {panels.map((panel, index) => {
          const isActive = index === safeActiveIndex;
          return (
            <div
              key={index}
              ref={(node) => {
                panelRefs.current[index] = node;
              }}
              className={mergeClassNames(
                'horizontal-page-slider__panel',
                panelClassName,
              )}
              aria-hidden={!isActive}
              inert={isActive ? undefined : true}
              data-active={isActive ? 'true' : 'false'}
            >
              {panel}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HorizontalPageSlider;
