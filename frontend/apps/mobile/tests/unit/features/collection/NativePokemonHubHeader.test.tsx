import { Animated, Easing, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createRef } from 'react';
import {
  NativePokemonHubHeader,
  type NativePokemonHubHeaderHandle,
  type NativePokemonHubView,
} from '../../../../src/features/collection/NativePokemonHubHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

const renderHeader = (
  activeView: NativePokemonHubView,
  onViewChange = jest.fn(),
) => render(
  <NativePokemonHubHeader
    activeView={activeView}
    backgroundColor="#111"
    collectionCount={3285}
    onViewChange={onViewChange}
    secondaryTextColor="#abbbb8"
    textColor="#fff"
  />,
);

describe('NativePokemonHubHeader', () => {
  it('uses one persistent indicator that moves between the three canonical tabs', () => {
    const view = renderHeader('inventory');
    const firstIndicator = view.getByTestId('native-pokemon-hub-indicator');
    const firstStyle = StyleSheet.flatten(firstIndicator.props.style);

    expect(firstStyle.transform[0].translateX).toBeDefined();

    view.rerender(
      <NativePokemonHubHeader
        activeView="wishlist"
        backgroundColor="#111"
        collectionCount={3285}
        onViewChange={jest.fn()}
        secondaryTextColor="#abbbb8"
        textColor="#fff"
      />,
    );

    const lastIndicator = view.getByTestId('native-pokemon-hub-indicator');
    const lastStyle = StyleSheet.flatten(lastIndicator.props.style);
    expect(view.getAllByTestId('native-pokemon-hub-indicator')).toHaveLength(1);
    expect(lastStyle.transform[0].translateX).toBeDefined();
  });

  it('routes tab presses through the shared page controller', () => {
    const onViewChange = jest.fn();
    const view = renderHeader('pokemon', onViewChange);

    fireEvent.press(view.getByRole('tab', { name: /wishlist/i }));

    expect(onViewChange).toHaveBeenCalledWith('wishlist');
  });

  it('matches Vite\'s independent CSS-ease underline after active view changes', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const view = render(
      <NativePokemonHubHeader
        activeView="pokemon"
        backgroundColor="#111"
        collectionCount={3285}
        onViewChange={jest.fn()}
        secondaryTextColor="#aaa"
        textColor="#fff"
      />,
    );
    view.rerender(
      <NativePokemonHubHeader
        activeView="wishlist"
        backgroundColor="#111"
        collectionCount={3285}
        onViewChange={jest.fn()}
        secondaryTextColor="#aaa"
        textColor="#fff"
      />,
    );

    expect(timing).toHaveBeenLastCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: 300,
        easing: Easing.ease,
        isInteraction: false,
        toValue: 2,
        useNativeDriver: true,
      }),
    );
    timing.mockRestore();
  });

  it('starts the independent underline immediately before parent bookkeeping commits', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const ref = createRef<NativePokemonHubHeaderHandle>();
    render(
      <NativePokemonHubHeader
        activeView="inventory"
        backgroundColor="#111"
        collectionCount={3285}
        onViewChange={jest.fn()}
        ref={ref}
        secondaryTextColor="#aaa"
        textColor="#fff"
      />,
    );
    timing.mockClear();

    act(() => ref.current?.setView('pokemon'));

    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: 300,
        easing: Easing.ease,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    timing.mockRestore();
  });

  it('matches the canonical fast-select header without changing pages', () => {
    const onClearSelection = jest.fn();
    const onSelectAll = jest.fn();
    const onViewChange = jest.fn();
    const view = render(
      <NativePokemonHubHeader
        activeView="pokemon"
        backgroundColor="#111"
        collectionCount={3285}
        onClearSelection={onClearSelection}
        onSelectAll={onSelectAll}
        onViewChange={onViewChange}
        secondaryTextColor="#aaa"
        selectionBackgroundColor="#34807d"
        selectionCount={2}
        textColor="#fff"
      />,
    );

    fireEvent.press(view.getByRole('button', { name: 'X' }));
    fireEvent.press(view.getByRole('button', { name: 'SELECT ALL' }));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onViewChange).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(view.getByTestId('native-pokemon-hub-indicator').props.style)
      .transform[0].translateX).toBeCloseTo(392 / 3);
  });

  it('preserves the canonical foreign-catalog context and return action', () => {
    const onReturnToContext = jest.fn();
    const view = render(
      <NativePokemonHubHeader
        activeView="pokemon"
        backgroundColor="#111"
        catalogOwner="OtherTrainer"
        collectionCount={12}
        onReturnToContext={onReturnToContext}
        onViewChange={jest.fn()}
        secondaryTextColor="#aaa"
        textColor="#fff"
      />,
    );

    expect(view.getByLabelText("Viewing OtherTrainer's catalog")).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Back to results' }));
    expect(onReturnToContext).toHaveBeenCalledTimes(1);
  });
});
