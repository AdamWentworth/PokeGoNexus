import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, FlatList, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativePokedexScreen } from '../../../src/screens/NativePokedexScreen';

jest.mock('../../../src/observability/nativeUiInteractionTiming', () => ({
  markNativeUiPerformanceAfterPaint: jest.fn(),
}));

const entry = { id: '0001-shiny', pokemonId: 1, pokedexNumber: 1, name: 'Shiny Bulbasaur', imageUri: '/bulbasaur.png', typeIconUris: [], maxKind: null, category: 'shiny' as const, generation: 1, instanceRegistered: true, manualRegistrationIds: [], registered: true, registeredFacets: [{}], released: true, registeredSpecies: true, supportedGenders: ['Male', 'Female'] as ('Male' | 'Female')[] };
const unreleasedEntry = {
  ...entry,
  id: '0002-shiny',
  instanceRegistered: false,
  name: 'Shiny Futuremon',
  pokedexNumber: 2,
  pokemonId: 2,
  registered: false,
  registeredFacets: [],
  released: false,
};
const johtoEntry = {
  ...entry,
  id: '0152-shiny',
  name: 'Shiny Chikorita',
  pokedexNumber: 152,
  pokemonId: 152,
  generation: 2,
};
const shadowEntry = {
  ...entry,
  category: 'shadow' as const,
  id: '0001-shadow',
  name: 'Shadow Bulbasaur',
};
const johtoShadowEntry = {
  ...johtoEntry,
  category: 'shadow' as const,
  id: '0152-shadow',
  name: 'Shadow Chikorita',
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('NativePokedexScreen', () => {
  it('supports region, category, and query filtering and opens an exact entry', () => {
    const onOpenEntry = jest.fn();
    const onSetRegistrations = jest.fn();
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexScreen assetBaseUrl="https://pokegonexus.com" entries={[entry]} onBack={jest.fn()} onOpenEntry={onOpenEntry} onRetry={jest.fn()} onSetRegistrations={onSetRegistrations} /></SafeAreaProvider>);
    expect(screen.getByText('Pokédex')).toBeTruthy();
    fireEvent.press(screen.getByText('Shiny'));
    expect(screen.getByLabelText('Advanced Pokédex filters')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open Kanto'));
    fireEvent.changeText(screen.getByLabelText('Search Pokédex'), 'bulba');
    fireEvent.press(screen.getByText('Register all'));
    expect(screen.getByText('Register every visible entry?')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Register all')[1]);
    expect(onSetRegistrations).toHaveBeenCalledWith([
      expect.objectContaining({ entryId: entry.id, registrationId: entry.id }),
    ], true);
    fireEvent.press(screen.getByLabelText('Open Shiny Bulbasaur'));
    expect(onOpenEntry).toHaveBeenCalledWith(entry, {});
  });

  it('keeps gender and size filters mutually exclusive like the web Pokédex', () => {
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexScreen assetBaseUrl="https://pokegonexus.com" entries={[entry]} onBack={jest.fn()} onOpenEntry={jest.fn()} onRetry={jest.fn()} onSetRegistrations={jest.fn()} /></SafeAreaProvider>);
    fireEvent.press(screen.getByLabelText('Advanced Pokédex filters'));
    fireEvent.press(screen.getByRole('button', { name: 'Male' }));
    expect(screen.getByRole('button', { name: 'Male' }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Female' }));
    expect(screen.getByRole('button', { name: 'Male' }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole('button', { name: 'Female' }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'XXS' }));
    fireEvent.press(screen.getByRole('button', { name: 'XXL' }));
    expect(screen.getByRole('button', { name: 'XXS' }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole('button', { name: 'XXL' }).props.accessibilityState.selected).toBe(true);
  });

  it('shows unreleased species without opening or manually registering them', () => {
    const onOpenEntry = jest.fn();
    const onSetRegistrations = jest.fn();
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexScreen assetBaseUrl="https://pokegonexus.com" entries={[entry, unreleasedEntry]} onBack={jest.fn()} onOpenEntry={onOpenEntry} onRetry={jest.fn()} onSetRegistrations={onSetRegistrations} /></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Shiny'));
    fireEvent.press(screen.getByLabelText('Open Kanto'));

    expect(screen.getByText('Unreleased')).toBeTruthy();
    expect(screen.getByLabelText('Open Shiny Futuremon').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByLabelText('Register Shiny Futuremon')).toBeNull();
    fireEvent.press(screen.getByText('Register all'));
    fireEvent.press(screen.getAllByText('Register all')[1]);
    expect(onSetRegistrations).toHaveBeenCalledWith([
      expect.objectContaining({ entryId: entry.id }),
    ], true);
    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it('keeps every populated region in the detail index and independently collapses sections', () => {
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexScreen assetBaseUrl="https://pokegonexus.com" entries={[entry, johtoEntry]} onBack={jest.fn()} onOpenEntry={jest.fn()} onRetry={jest.fn()} onSetRegistrations={jest.fn()} /></SafeAreaProvider>);

    fireEvent.press(screen.getByText('Shiny'));
    fireEvent.press(screen.getByLabelText('Open Johto'));

    expect(screen.getByLabelText('Kanto region section')).toBeTruthy();
    expect(screen.getByLabelText('Johto region section')).toBeTruthy();
    expect(screen.getByLabelText('Open Shiny Bulbasaur')).toBeTruthy();
    expect(screen.getByLabelText('Open Shiny Chikorita')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Collapse Kanto Shiny'));
    expect(screen.getByLabelText('Expand Kanto Shiny')).toBeTruthy();
    expect(screen.queryByLabelText('Open Shiny Bulbasaur')).toBeNull();
    expect(screen.getByLabelText('Open Shiny Chikorita')).toBeTruthy();

    fireEvent.press(screen.getByText('‹ All regions'));
    expect(screen.getByLabelText('Open Kanto')).toBeTruthy();
    expect(screen.getByLabelText('Open Johto')).toBeTruthy();
  });

  it('preserves position on category filters and only smooth-scrolls for explicit region navigation', () => {
    const requestFrame = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexScreen assetBaseUrl="https://pokegonexus.com" entries={[entry, johtoEntry, shadowEntry, johtoShadowEntry]} onBack={jest.fn()} onOpenEntry={jest.fn()} onRetry={jest.fn()} onSetRegistrations={jest.fn()} /></SafeAreaProvider>);

    fireEvent.press(screen.getByText('Shiny'));
    expect(scrollToIndex).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Open Johto'));
    expect(scrollToIndex).toHaveBeenCalledWith({
      animated: true,
      index: expect.any(Number),
      viewPosition: 0,
    });

    scrollToIndex.mockClear();
    fireEvent.press(screen.getByText('Shadow'));
    expect(scrollToIndex).not.toHaveBeenCalled();
    scrollToIndex.mockRestore();
    requestFrame.mockRestore();
  });
});


test('handles contextual Android Back only while focused, then removes the listener', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const remove = jest.fn();
  const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  const onBack = jest.fn();
  const props = { assetBaseUrl: 'https://pokegonexus.com', entries: [entry], onBack, onOpenEntry: jest.fn(), onRetry: jest.fn(), onSetRegistrations: jest.fn() };
  const wrapper = (focused: boolean) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><NativePokedexScreen {...props} isFocused={focused} /></SafeAreaProvider>;
  const view = render(wrapper(true));
  fireEvent.press(screen.getByText('Shiny'));
  fireEvent.press(screen.getByLabelText('Open Kanto'));
  act(() => { expect(add.mock.calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
  expect(screen.getByLabelText('Open Kanto')).toBeTruthy();
  expect(onBack).not.toHaveBeenCalled();
  act(() => { add.mock.calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: 0 }); });
  expect(onBack).toHaveBeenCalledTimes(1);
  const calls = add.mock.calls.length;
  view.rerender(wrapper(false));
  expect(remove).toHaveBeenCalled();
  expect(add).toHaveBeenCalledTimes(calls);
  add.mockRestore();
  platform.restore();
});
