import { Animated, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeSearchHubHeader } from '../../../../src/features/search/NativeSearchHubHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

describe('NativeSearchHubHeader', () => {
  it('keeps Pokémon and trainer discovery in one coordinated pager', () => {
    const onViewChange = jest.fn();
    const view = render(
      <NativeSearchHubHeader
        activeView="pokemon"
        onViewChange={onViewChange}
        scrollX={new Animated.Value(0)}
      />,
    );

    expect(view.getByRole('tab', { name: 'Pokémon search' }).props.accessibilityState)
      .toEqual({ selected: true });
    fireEvent.press(view.getByRole('tab', { name: 'Trainer search' }));
    expect(onViewChange).toHaveBeenCalledWith('trainers');
  });

  it('drives its single indicator from the horizontal page offset', () => {
    const view = render(
      <NativeSearchHubHeader
        activeView="trainers"
        onViewChange={jest.fn()}
        scrollX={new Animated.Value(412)}
      />,
    );
    const indicator = view.getByTestId('native-search-hub-indicator');
    expect(StyleSheet.flatten(indicator.props.style).transform).toBeTruthy();
    expect(view.getAllByTestId('native-search-hub-indicator')).toHaveLength(1);
  });
});
