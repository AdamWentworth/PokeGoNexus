import { useState } from 'react';
import { Image, Text } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import {
  NATIVE_FILTER_TILE_WARM_BATCH,
  NATIVE_FILTER_TILE_WARM_PERIOD_MS,
  NativeCollectionSearchControls,
  NativeCollectionSearchMenu,
  NativeRetainedCollectionSearchMenu,
} from '../../../../src/features/collection/parity/NativeCollectionSearchControls';

const controls = (query: string, onQueryChange: (value: string) => void) => (
  <NativeCollectionSearchControls
    assetBaseUrl="https://pokegonexus.com"
    inputBackground="#ffffff"
    inputTextColor="#111111"
    menuVisible={false}
    onMenuVisibleChange={jest.fn()}
    onQueryChange={onQueryChange}
    onToggleEvolutionaryLine={jest.fn()}
    query={query}
    showEvolutionaryLine={false}
    textColor="#111111"
  />
);

describe('NativeCollectionSearchMenu', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    cleanup();
    jest.useRealTimers();
  });

  it('exposes filter tiles as real native controls and reports the selected filter', () => {
    const onFilterPress = jest.fn();
    const { getByTestId } = render(
      <NativeCollectionSearchMenu
        assetBaseUrl="https://pokegonexus.com"
        onFilterPress={onFilterPress}
        textColor="#ffffff"
      />,
    );

    expect(getByTestId('native-region-gradient-kanto')).toBeTruthy();
    fireEvent.press(getByTestId('native-collection-filter-shiny'));
    expect(onFilterPress).toHaveBeenCalledWith('Shiny');
  });

  it('warms concealed native filter images in bounded display-frame batches', () => {
    const view = render(
      <NativeRetainedCollectionSearchMenu
        assetBaseUrl="https://pokegonexus.com"
        onFilterPress={jest.fn()}
        textColor="#ffffff"
        visible={false}
      />,
    );

    expect(NATIVE_FILTER_TILE_WARM_BATCH).toBe(2);
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    act(() => jest.advanceTimersByTime(NATIVE_FILTER_TILE_WARM_PERIOD_MS + 1));
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(2);
    act(() => jest.advanceTimersByTime(NATIVE_FILTER_TILE_WARM_PERIOD_MS + 1));
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(4);
  });
});

describe('NativeCollectionSearchControls', () => {
  it('keeps the native input immediately responsive while committing its query', () => {
    const Harness = () => {
      const [query, setQuery] = useState('');
      return (
        <>
          {controls(query, setQuery)}
          <Text testID="committed-query">{query}</Text>
        </>
      );
    };
    const { getByLabelText, getByTestId } = render(<Harness />);

    fireEvent.changeText(getByLabelText('Search Pokémon'), 'char');

    expect(getByLabelText('Search Pokémon').props.value).toBe('char');
    expect(getByTestId('committed-query').props.children).toBe('char');
  });

  it('synchronizes route-driven query changes into its local input', () => {
    const onQueryChange = jest.fn();
    const view = render(controls('', onQueryChange));

    view.rerender(controls('Shiny', onQueryChange));

    expect(view.getByLabelText('Search Pokémon').props.value).toBe('Shiny');
    expect(view.getByLabelText('Clear Pokémon search')).toBeTruthy();
  });
});
