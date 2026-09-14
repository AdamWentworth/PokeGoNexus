import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { NativeTrainerWorkspaceNav } from '../../../src/components/NativeTrainerWorkspaceNav';

describe('NativeTrainerWorkspaceNav', () => {
  it('moves a single selected background with the content animation, including halfway through a slide', () => {
    const scrollX = new Animated.Value(0);
    const view = render(<NativeTrainerWorkspaceNav
      active="profile"
      onOpenFriends={jest.fn()}
      onOpenProfile={jest.fn()}
      progress={Animated.divide(scrollX, 412)}
    />);
    fireEvent(view.getByTestId('native-trainer-workspace-nav'), 'layout', {
      nativeEvent: { layout: { width: 384, height: 50 } },
    });
    const transform = () => StyleSheet.flatten(view.getByTestId('native-trainer-workspace-indicator').props.style).transform[0].translateX;
    expect(transform()).toBe(0);
    act(() => scrollX.setValue(206));
    expect(transform()).toBe(94);
    act(() => scrollX.setValue(412));
    expect(transform()).toBe(188);
  });
  it('keeps the current workspace selected and opens the adjacent workspace', () => {
    const onOpenFriends = jest.fn();
    const onOpenProfile = jest.fn();
    const view = render(
      <NativeTrainerWorkspaceNav
        active="profile"
        onOpenFriends={onOpenFriends}
        onOpenProfile={onOpenProfile}
      />,
    );
    expect(view.getByRole('tab', { name: 'Profile' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(view.getByRole('tab', { name: 'Profile' }));
    expect(onOpenProfile).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('tab', { name: 'Friends' }));
    expect(onOpenFriends).toHaveBeenCalledTimes(1);
  });
});
