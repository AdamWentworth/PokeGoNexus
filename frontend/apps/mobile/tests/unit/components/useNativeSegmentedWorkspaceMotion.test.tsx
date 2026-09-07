import { act, render } from '@testing-library/react-native';
import { Animated, Easing, View } from 'react-native';
import {
  NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX,
  NATIVE_SEGMENTED_WORKSPACE_TRANSITION_MS,
  useNativeSegmentedWorkspaceMotion,
} from '../../../src/components/useNativeSegmentedWorkspaceMotion';

const Harness = ({ activeIndex }: { activeIndex: number }) => {
  const motion = useNativeSegmentedWorkspaceMotion(activeIndex);
  return (
    <Animated.View style={motion.contentStyle} testID="moving-workspace">
      <Animated.View style={motion.stationaryStyle} testID="stationary-header">
        <View />
      </Animated.View>
    </Animated.View>
  );
};

describe('useNativeSegmentedWorkspaceMotion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('moves a forward and backward workspace on the same native clock as its segmented control', () => {
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      reset: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const view = render(<Harness activeIndex={0} />);

    view.rerender(<Harness activeIndex={1} />);
    expect(setValue).toHaveBeenLastCalledWith(NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX);
    act(() => jest.runOnlyPendingTimers());
    expect(timing).toHaveBeenLastCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: NATIVE_SEGMENTED_WORKSPACE_TRANSITION_MS,
        easing: Easing.ease,
        isInteraction: false,
        toValue: 0,
        useNativeDriver: true,
      }),
    );

    view.rerender(<Harness activeIndex={0} />);
    expect(setValue).toHaveBeenLastCalledWith(-NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX);
  });
});
