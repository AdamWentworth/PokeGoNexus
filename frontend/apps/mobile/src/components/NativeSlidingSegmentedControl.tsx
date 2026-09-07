import { webCssVarTokens } from '@pokemongonexus/shared-ui-tokens';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useNativeReducedMotion } from '../features/settings/useNativeMotion';

const SEGMENT_BORDER_WIDTH = 1;
const SEGMENT_GAP = 4;
const SEGMENT_PADDING = 4;

export type NativeSlidingSegmentedItem<Value extends string> = {
  accessibilityLabel?: string;
  label: string;
  value: Value;
};

type Props<Value extends string> = {
  accessibilityLabel: string;
  buttonStyle?: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
  indicatorTestID?: string;
  items: readonly NativeSlidingSegmentedItem<Value>[];
  onChange: (value: Value) => void;
  renderItem: (
    item: NativeSlidingSegmentedItem<Value>,
    selected: boolean,
  ) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  value: Value;
};

export const resolveNativeSlidingSegmentMetrics = (
  containerWidth: number,
  itemCount: number,
) => {
  const count = Math.max(1, itemCount);
  const contentWidth = Math.max(
    0,
    containerWidth
      - (SEGMENT_BORDER_WIDTH * 2)
      - (SEGMENT_PADDING * 2)
      - (SEGMENT_GAP * (count - 1)),
  );
  const itemWidth = contentWidth / count;
  return {
    indicatorLeft: SEGMENT_BORDER_WIDTH + SEGMENT_PADDING,
    indicatorWidth: itemWidth,
    itemOffset: itemWidth + SEGMENT_GAP,
  };
};

export const NativeSlidingSegmentedControl = <Value extends string>({
  accessibilityLabel,
  buttonStyle,
  indicatorStyle,
  indicatorTestID,
  items,
  onChange,
  renderItem,
  style,
  testID,
  value,
}: Props<Value>) => {
  const reduceMotion = useNativeReducedMotion();
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const [containerWidth, setContainerWidth] = useState(0);
  const [indicatorPosition] = useState(() => new Animated.Value(selectedIndex));
  const indicatorIndexRef = useRef(selectedIndex);
  const metrics = resolveNativeSlidingSegmentMetrics(containerWidth, items.length);
  const indicatorTranslateX = useMemo(
    () => Animated.multiply(indicatorPosition, metrics.itemOffset),
    [indicatorPosition, metrics.itemOffset],
  );

  const moveIndicator = useCallback((nextIndex: number) => {
    indicatorIndexRef.current = nextIndex;
    indicatorPosition.stopAnimation();
    if (reduceMotion) {
      indicatorPosition.setValue(nextIndex);
      return;
    }
    Animated.timing(indicatorPosition, {
      duration: webCssVarTokens.motionSeconds.fast * 1000,
      easing: Easing.ease,
      isInteraction: false,
      toValue: nextIndex,
      useNativeDriver: true,
    }).start();
  }, [indicatorPosition, reduceMotion]);

  useEffect(() => {
    if (indicatorIndexRef.current !== selectedIndex) {
      moveIndicator(selectedIndex);
      return;
    }
    if (reduceMotion) {
      indicatorPosition.stopAnimation();
      indicatorPosition.setValue(selectedIndex);
    }
  }, [indicatorPosition, moveIndicator, reduceMotion, selectedIndex]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[styles.control, style]}
      testID={testID}
    >
      <Animated.View
        accessibilityElementsHidden
        pointerEvents="none"
        style={[
          styles.indicator,
          indicatorStyle,
          {
            left: metrics.indicatorLeft,
            opacity: metrics.indicatorWidth > 0 ? 1 : 0,
            transform: [{ translateX: indicatorTranslateX }],
            width: metrics.indicatorWidth,
          },
        ]}
        testID={indicatorTestID}
      />
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            aria-selected={selected}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => {
              if (selected) return;
              // Acknowledge the tap on the native animation thread before the
              // parent swaps or recomputes an expensive destination workspace.
              moveIndicator(index);
              onChange(item.value);
            }}
            style={({ pressed }) => [
              styles.button,
              buttonStyle,
              pressed && styles.pressed,
            ]}
          >
            {renderItem(item, selected)}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  control: {
    position: 'relative',
    flexDirection: 'row',
    gap: SEGMENT_GAP,
    padding: SEGMENT_PADDING,
    overflow: 'hidden',
    borderWidth: SEGMENT_BORDER_WIDTH,
  },
  indicator: {
    position: 'absolute',
    zIndex: 0,
    top: SEGMENT_BORDER_WIDTH + SEGMENT_PADDING,
    bottom: SEGMENT_BORDER_WIDTH + SEGMENT_PADDING,
    backgroundColor: '#42d7c4',
  },
  button: {
    zIndex: 1,
    minWidth: 0,
    minHeight: 46,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});
