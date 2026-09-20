import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NativeTradeBoardModel } from '../../../src/features/tradeBoard/nativeTradeBoardModel';
import { NativeTradeBoardScreen } from '../../../src/screens/NativeTradeBoardScreen';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const model: NativeTradeBoardModel = {
  boardUrl: 'https://pokegonexus.com/trade-board/Misty',
  generatedAt: '2026-08-25T00:00:00.000Z',
  includeTrade: true,
  includeWanted: true,
  pokemonGoName: 'MistyGO',
  tradeCount: 2,
  tradeEntries: [{ id: 'trade-1', imageUri: '/charizard.png', locationBackgroundUri: null, luckyRequested: false, maxKind: 'gigantamax', mostWanted: false, name: 'Gigantamax Charizard', pokedexNumber: 6, quantity: 2 }],
  username: 'Misty',
  wantedCount: 1,
  wantedEntries: [{ id: 'wanted-1', imageUri: '/blastoise.png', locationBackgroundUri: null, luckyRequested: true, maxKind: null, mostWanted: true, name: 'Shiny Blastoise', pokedexNumber: 9, quantity: 1 }],
};

const renderBoard = () => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
    <NativeTradeBoardScreen
      assetBaseUrl="https://pokegonexus.com"
      model={model}
      onActionMenuPress={jest.fn()}
      onBack={jest.fn()}
      onOpenLiveBoard={jest.fn()}
      onOpenCollection={jest.fn()}
      onRetry={jest.fn()}
    />
  </SafeAreaProvider>,
);

describe('NativeTradeBoardScreen', () => {
  it('previews both listing groups and lets either section be hidden without leaving native', () => {
    renderBoard();
    expect(screen.getByText('Trade Board')).toBeTruthy();
    expect(screen.getByText(/View live board/)).toBeTruthy();
    expect(screen.getByText('Gigantamax Charizard')).toBeTruthy();
    expect(screen.getByText('Shiny Blastoise')).toBeTruthy();
    expect(screen.getByText('Gigantamax Charizard').props.allowFontScaling).toBe(false);
    expect(screen.getByText('Shiny Blastoise').props.allowFontScaling).toBe(false);

    fireEvent.press(screen.getByLabelText('Include Looking For Pokémon'));
    expect(screen.queryByText('Shiny Blastoise')).toBeNull();
    expect(screen.getByText('Gigantamax Charizard')).toBeTruthy();
    expect(screen.getByText('Copy live link')).toBeTruthy();
    expect(screen.getByText('Share board image')).toBeTruthy();
  });

  it('matches the owner identity, theme, section-invariant, and QR controls from Vite', () => {
    renderBoard();
    expect(screen.getByText('Pokémon GO: MistyGO')).toBeTruthy();
    expect(screen.getByLabelText("QR code for this trainer's live trade board")).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Show my Pokémon GO name'));
    expect(screen.queryByText('Pokémon GO: MistyGO')).toBeNull();

    fireEvent.press(screen.getByText('Nexus Light'));
    expect(screen.getByTestId('native-trade-board-theme-brand-light').props.accessibilityState)
      .toMatchObject({ checked: true });

    fireEvent.press(screen.getByLabelText('Include Looking For Pokémon'));
    fireEvent.press(screen.getByLabelText('Include For Trade Pokémon'));
    expect(screen.getByText('Keep at least one Trade Board section selected.')).toBeTruthy();
    expect(screen.getByLabelText('Include For Trade Pokémon').props.accessibilityState)
      .toMatchObject({ checked: true });
  });

  it('renders a useful empty state for a board without listings', () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeTradeBoardScreen
          assetBaseUrl="https://pokegonexus.com"
          model={{ ...model, tradeCount: 0, tradeEntries: [], wantedCount: 0, wantedEntries: [] }}
          onActionMenuPress={jest.fn()}
          onBack={jest.fn()}
          onOpenCollection={jest.fn()}
          onRetry={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Your Trade Board needs a listing')).toBeTruthy();
    expect(screen.getByText('Add Pokémon listings')).toBeTruthy();
  });

  it.each([
    ['private', 'This Trade Board is private', 'View public profile'],
    ['not-found', 'Trade Board not found', 'Search for a trainer'],
    ['error', 'We couldn’t load this Trade Board', 'Try again'],
  ] as const)('renders the canonical %s public failure state', (errorKind, title, action) => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeTradeBoardScreen
          assetBaseUrl="https://pokegonexus.com"
          editable={false}
          error="Network failed"
          errorKind={errorKind}
          model={null}
          onBack={jest.fn()}
          onOpenCollection={jest.fn()}
          onOpenProfile={jest.fn()}
          onRetry={jest.fn()}
          onSearchTrainers={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(action)).toBeTruthy();
  });

  it('renders the standalone public board without owner composer controls or global navigation', async () => {
    const onOpenCreateBoard = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeTradeBoardScreen
          assetBaseUrl="https://pokegonexus.com"
          editable={false}
          model={model}
          onBack={jest.fn()}
          onOpenCreateBoard={onOpenCreateBoard}
          onOpenHelp={jest.fn()}
          onOpenCollection={jest.fn()}
          onOpenTradeListings={jest.fn()}
          onOpenWantedListings={jest.fn()}
          onRetry={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    expect(screen.queryByLabelText('Open action menu')).toBeNull();
    expect(screen.getByText('LIVE COMMUNITY LISTING')).toBeTruthy();
    expect(screen.getByText('@Misty’s Trade Board')).toBeTruthy();
    expect(screen.getByText('Community Trade Board')).toBeTruthy();
    expect(screen.getByText('AVAILABLE POKÉMON')).toBeTruthy();
    expect(screen.getByText('WANTED POKÉMON')).toBeTruthy();
    expect(screen.getByText('Looking for these Pokémon · 1 marked Most Wanted.')).toBeTruthy();
    expect(screen.getByText('Scan for the live board')).toBeTruthy();
    expect(screen.getAllByText('2 For Trade').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1 Looking For').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Join Pokémon Go Nexus  →')).toBeTruthy();
    expect(screen.queryByText('Share your Trade Board')).toBeNull();
    expect(screen.queryByLabelText('Include For Trade Pokémon')).toBeNull();
    expect(screen.queryByText('Share board image')).toBeNull();

    fireEvent.press(screen.getByLabelText('Copy live Trade Board link'));
    expect(await screen.findByText('Live Trade Board link copied.')).toBeTruthy();

    fireEvent.press(screen.getByText('Join Pokémon Go Nexus  →'));
    expect(onOpenCreateBoard).toHaveBeenCalledTimes(1);
  });
});
