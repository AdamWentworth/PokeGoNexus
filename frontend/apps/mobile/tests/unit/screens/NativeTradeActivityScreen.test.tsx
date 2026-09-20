import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { LayoutAnimation, StyleSheet } from 'react-native';
import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';
import type { NativeInstanceDetail } from '../../../src/features/collection/collectionModel';
import { buildNativeTradeActivityModel } from '../../../src/features/trades/nativeTradeActivityModel';
import type { NativeTradeActivityRow } from '../../../src/features/trades/nativeTradeActivityRows';
import { NativeTradeActivityScreen } from '../../../src/screens/NativeTradeActivityScreen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../../../src/observability/nativeUiInteractionTiming', () => ({
  markNativeUiPerformanceAfterPaint: jest.fn(),
}));

beforeAll(() => {
  jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
});

const detail = (id: string, name: string): NativeInstanceDetail => ({
  row: {
    id,
    pokemonId: 1,
    pokedexNumber: 1,
    name,
    imageUri: `https://pokegonexus.com/${id}.png`,
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'trade',
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  traits: [],
  stats: [],
  ivs: [],
  moves: [],
  provenance: [],
  preferences: [],
});

const buildRow = (
  id: string,
  status: TradeRecord['trade_status'],
  overrides: Partial<TradeRecord> = {},
): NativeTradeActivityRow => {
  const model = buildNativeTradeActivityModel({
    trade_id: id,
    trade_status: status,
    username_proposed: status === 'proposed' && id === 'incoming' ? 'OtherTrainer' : 'AdamZilla',
    username_accepting: status === 'proposed' && id === 'incoming' ? 'AdamZilla' : 'OtherTrainer',
    pokemon_instance_id_user_proposed: `${id}-proposed`,
    pokemon_instance_id_user_accepting: `${id}-accepting`,
    trade_friendship_level: 'Forever',
    trade_dust_cost: 40_000,
    ...overrides,
  }, 'AdamZilla');
  if (!model) throw new Error('Invalid test trade');
  return {
    model,
    currentUserPokemon: detail(model.currentUserInstanceId, `My ${id}`),
    partnerPokemon: detail(model.partnerInstanceId, `Their ${id}`),
  };
};

const rows = [
  buildRow('incoming', 'proposed'),
  buildRow('sent', 'proposed'),
  buildRow('active', 'pending'),
  buildRow('done', 'completed'),
  buildRow('closed', 'cancelled'),
];

const renderScreen = ({
  onAction = jest.fn().mockResolvedValue(undefined),
  onRevealPartner = jest.fn().mockResolvedValue({
    sharingEnabled: true,
    trainerCode: '1234 5678 9012',
    pokemonGoName: 'OtherPogoName',
    coordinationMethod: 'campfire',
    coordinationHandle: 'OtherTrainer',
  }),
  screenRows = rows,
} = {}) => render(
  <NativeTradeActivityScreen
    assetBaseUrl="https://pokegonexus.com"
    error={null}
    isLoading={false}
    onAction={onAction}
    onOpenPreferences={jest.fn()}
    onRetry={jest.fn()}
    onRevealPartner={onRevealPartner}
    rows={screenRows}
  />,
);

describe('NativeTradeActivityScreen', () => {
  it('renders the canonical five stages and starts with incoming offers', () => {
    const { getByTestId, getByText, queryByTestId } = renderScreen();

    expect(getByText('Your trades')).toBeTruthy();
    expect(getByText('Offers')).toBeTruthy();
    expect(getByText('Sent')).toBeTruthy();
    expect(getByText('Active')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
    expect(getByText('Closed')).toBeTruthy();
    expect(queryByTestId('trade-card-incoming')).toBeTruthy();
    expect(queryByTestId('trade-card-sent')).toBeNull();
    const listStyle = StyleSheet.flatten(getByTestId('trade-activity-list').props.contentContainerStyle);
    expect(listStyle.paddingBottom).toBeGreaterThanOrEqual(90);
  });

  it('switches stages immediately and preserves Vite participant headings', () => {
    const { getByTestId, getByText, queryByTestId } = renderScreen();

    fireEvent.press(getByTestId('trade-filter-Proposed'));
    expect(queryByTestId('trade-card-incoming')).toBeNull();
    expect(queryByTestId('trade-card-sent')).toBeTruthy();
    expect(getByText('AdamZilla')).toBeTruthy();
    expect(getByText('OtherTrainer')).toBeTruthy();
    expect(getByText('OFFERED')).toBeTruthy();
    expect(getByText('FOR TRADE')).toBeTruthy();
  });

  it('matches Vite by putting the received Pokémon left on completed trades', () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('trade-filter-Completed'));
    const received = getByTestId('trade-pokemon-card-done-accepting');
    const traded = getByTestId('trade-pokemon-card-done-proposed');
    expect(received).toBeTruthy();
    expect(traded).toBeTruthy();
    expect(getByText('RECEIVED POKÉMON')).toBeTruthy();
    expect(getByText('Their done')).toBeTruthy();
    expect(getByText('TRADED POKÉMON')).toBeTruthy();
    expect(getByText('My done')).toBeTruthy();
  });

  it('preserves Vite disabled completion feedback after this trainer confirms', () => {
    const confirmed = buildRow('confirmed', 'pending', {
      user_proposed_completion_confirmed: true,
    });
    const { getByTestId, getByText } = renderScreen({ screenRows: [confirmed] });

    fireEvent.press(getByTestId('trade-filter-Pending'));
    expect(getByText('Awaiting Partner...')).toBeTruthy();
    expect(getByTestId('trade-action-complete-confirmed').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('matches Vite by showing type and gender identity before expanding complete Pokémon details', () => {
    const detailed = detail('incoming-accepting', 'My incoming');
    detailed.row.typeIconUris = ['https://pokegonexus.com/grass.png', 'https://pokegonexus.com/poison.png'];
    detailed.stats = [
      { label: 'Gender', value: 'Female' },
      { label: 'Weight', value: '6.9 kg' },
      { label: 'Height', value: '0.7 m' },
    ];
    detailed.moves = [{
      label: 'Fast move',
      value: 'Vine Whip',
      legacy: false,
      typeName: 'Grass',
      typeIconUri: 'https://pokegonexus.com/grass.png',
    }];
    detailed.ivs = [
      { label: 'Attack', value: 15 },
      { label: 'Defense', value: 14 },
      { label: 'HP', value: 13 },
    ];
    detailed.provenance = [
      { label: 'Caught near', value: 'Vancouver, BC' },
      { label: 'Caught on', value: '6/15/2026' },
    ];
    const detailedRow = {
      ...rows[0],
      currentUserPokemon: detailed,
    };
    const { getByLabelText, getByTestId, getByText, queryByText } = renderScreen({
      screenRows: [detailedRow],
    });

    expect(getByLabelText('Female')).toBeTruthy();
    expect(getByLabelText('Pokémon types')).toBeTruthy();
    expect(queryByText('Vine Whip')).toBeNull();

    fireEvent.press(getByTestId('trade-pokemon-details-incoming-accepting'));
    expect(getByText('Hide Details')).toBeTruthy();
    expect(getByText('Vine Whip')).toBeTruthy();
    expect(getByText('6.9 kg')).toBeTruthy();
    expect(getByText('STAMINA')).toBeTruthy();
    expect(getByText(/Vancouver, BC/)).toBeTruthy();
    expect(getByText(/6\/15\/2026/)).toBeTruthy();
  });

  it('matches Vite with an explicit empty detail result', () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('trade-pokemon-details-incoming-accepting'));
    expect(getByText('No additional details available.')).toBeTruthy();
  });

  it('requires confirmation and reports a server-confirmed action visibly', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, getByText } = renderScreen({ onAction });

    fireEvent.press(getByTestId('trade-filter-Proposed'));
    fireEvent.press(getByTestId('trade-action-cancel-sent'));
    expect(getByTestId('trade-action-confirmation')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.press(getByText('Cancel trade'));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(rows[1].model, 'cancel'));
    expect(getByText('Trade updated from the server response.')).toBeTruthy();
  });

  it('keeps a failed command visible instead of pretending it succeeded', async () => {
    const onAction = jest.fn().mockRejectedValue(new Error('Trade state has changed.'));
    const { getByTestId, getByText } = renderScreen({ onAction });

    fireEvent.press(getByTestId('trade-action-deny-incoming'));
    fireEvent.press(getByText('Deny offer'));
    await waitFor(() => expect(getByText('Trade state has changed.')).toBeTruthy());
  });

  it('matches Vite by saving satisfaction directly and retaining its selected feedback action', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined);
    const satisfiedRow = buildRow('satisfied', 'completed', { user_1_trade_satisfaction: true });
    const { getByTestId, getByText, queryByTestId } = renderScreen({
      onAction,
      screenRows: [...rows, satisfiedRow],
    });

    fireEvent.press(getByTestId('trade-filter-Completed'));
    fireEvent.press(getByTestId('trade-action-satisfy-done'));

    await waitFor(() => expect(onAction).toHaveBeenCalledWith(rows[3].model, 'satisfy'));
    expect(queryByTestId('trade-action-confirmation')).toBeNull();
    expect(getByText('Thanks for the feedback!')).toBeTruthy();
    expect(getByText('Feedback saved')).toBeTruthy();
    expect(getByTestId('trade-action-satisfy-satisfied').props.accessibilityState.selected).toBe(true);
  });

  it('reveals privacy-bounded external coordination details only for active trades', async () => {
    const onRevealPartner = jest.fn().mockResolvedValue({
      sharingEnabled: true,
      trainerCode: '1234 5678 9012',
      pokemonGoName: 'OtherPogoName',
      coordinationMethod: 'campfire',
      coordinationHandle: 'OtherTrainer',
    });
    const { getByTestId, getByText } = renderScreen({ onRevealPartner });

    fireEvent.press(getByTestId('trade-filter-Pending'));
    fireEvent.press(getByTestId('trade-action-coordinate-active'));
    await waitFor(() => expect(onRevealPartner).toHaveBeenCalledWith('active'));
    expect(getByTestId('trade-partner-information')).toBeTruthy();
    expect(getByText('Coordinate the exchange')).toBeTruthy();
    expect(getByText('Add trainer')).toBeTruthy();
    expect(getByText('Message externally')).toBeTruthy();
    expect(getByText('Trade in Pokémon GO')).toBeTruthy();
    expect(getByText('1234 5678 9012')).toBeTruthy();
    expect(getByText('Campfire')).toBeTruthy();
    expect(getByText(/never send money or account credentials/i)).toBeTruthy();

    fireEvent.press(getByTestId('trade-copy-trainer-code'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('1234 5678 9012'));
    expect(getByText('Copied')).toBeTruthy();
  });
});
