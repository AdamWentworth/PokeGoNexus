import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import { useNativeReducedMotion } from '../features/settings/useNativeMotion';

const TransitionContext = createContext(false);

// Preserve layout and normal ScrollView gestures while a stationary copy of the
// shared header covers the moving pages during a category transition.
export const NativeSlidingPageHeader = ({ children }: { children: ReactNode }) => {
  const sliding = useContext(TransitionContext);
  return <View accessibilityElementsHidden={sliding} aria-hidden={sliding}
    importantForAccessibility={sliding ? 'no-hide-descendants' : 'auto'}
    style={sliding && { opacity: 0 }} pointerEvents={sliding ? 'none' : 'auto'}>{children}</View>;
};

type Page = { key: string; position: number; node: ReactNode };
const SlidePage = ({ page, active, progress, width, children }: {
  page: Page; active: boolean; progress: Animated.Value; width: number; children: ReactNode;
}) => {
  const style = useMemo(() => [StyleSheet.absoluteFill, {
    transform: [{ translateX: Animated.multiply(Animated.subtract(page.position, progress), width) }],
  }], [page.position, progress, width]);
  return <Animated.View accessibilityElementsHidden={!active} aria-hidden={!active}
    importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    pointerEvents={active ? 'auto' : 'none'} testID={`native-keyed-page-${page.key}`} style={style}>
    {children}
  </Animated.View>;
};
const easing = Easing.bezier(...collectionExperienceParityContract.pageTransitionEasing);

/** Keep the outgoing mounted list until its replacement finishes entering.
 * Only visited/in-flight pages are retained; a Pokédex category can contain
 * thousands of entries, so mounting every category at once is unnecessary.
 */
export const NativeKeyedPageSlider = ({
  activeKey, activeIndex, children, overlay,
}: { activeKey: string; activeIndex: number; children: ReactNode; overlay?: ReactNode }) => {
  const reduceMotion = useNativeReducedMotion();
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const [state, setState] = useState({
    key: activeKey, index: activeIndex, position: 0, node: children,
    pages: [{ key: activeKey, position: 0, node: children }] as Page[],
  });
  if (state.key !== activeKey) {
    const existing = state.pages.find((page) => page.key === activeKey);
    const position = existing?.position ?? (activeIndex > state.index
      ? Math.max(...state.pages.map((page) => page.position)) + 1
      : Math.min(...state.pages.map((page) => page.position)) - 1);
    const pages = state.pages.map((page) => page.key === state.key
      ? { ...page, node: state.node } : page);
    setState({ key: activeKey, index: activeIndex, position, node: children, pages: existing
      ? pages : [...pages, { key: activeKey, position, node: children }] });
  } else if (state.node !== children) {
    setState({ ...state, node: children });
  }
  const target = state.position;
  useLayoutEffect(() => {
    let cancelled = false;
    progress.stopAnimation();
    const finish = () => {
      if (cancelled) return;
      setState((current) => current.pages.length === 1 ? current : {
        ...current, pages: current.pages.filter((page) => page.key === current.key),
      });
    };
    if (reduceMotion || width === 0 || state.pages.length === 1) {
      progress.setValue(target);
      finish();
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: target, duration: collectionExperienceParityContract.pageTransitionMs,
      easing, useNativeDriver: true, isInteraction: false,
    });
    animation.start(({ finished }) => { if (finished) finish(); });
    return () => { cancelled = true; animation.stop(); };
  }, [progress, reduceMotion, state.pages.length, target, width]);

  return <TransitionContext.Provider value={state.pages.length > 1}><View style={styles.viewport} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    testID="native-keyed-page-slider">
    {state.pages.map((page) => {
      const active = page.key === activeKey;
      return <SlidePage key={page.key} page={page} active={active} progress={progress} width={width}>
        {active ? children : page.node}
      </SlidePage>;
    })}
    {state.pages.length > 1 ? overlay : null}
  </View></TransitionContext.Provider>;
};

const styles = StyleSheet.create({ viewport: { flex: 1, minHeight: 0, overflow: 'hidden' } });
