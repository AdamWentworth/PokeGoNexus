import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeInstanceDetail } from '../../../../src/features/collection/collectionModel';
import { NativeTradeProposalSheet } from '../../../../src/features/trades/NativeTradeProposalSheet';
import type { NativeTradeProposalSelection } from '../../../../src/features/trades/nativeTradeProposalModel';

const instance = (overrides: Partial<PokemonInstance>): PokemonInstance => ({
  instance_id: 'instance-1',
  variant_id: '0001-default',
  pokemon_id: 1,
  is_caught: true,
  is_for_trade: true,
  is_wanted: false,
  registered: false,
  ...overrides,
} as PokemonInstance);

const detail = (
  name: string,
  pokemonInstance: PokemonInstance,
): NativeInstanceDetail => ({
  row: {
    id: pokemonInstance.instance_id ?? '',
    pokemonId: pokemonInstance.pokemon_id,
    pokedexNumber: pokemonInstance.pokemon_id,
    name,
    imageUri: 'https://pokegonexus.com/pokemon.png',
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: pokemonInstance.is_wanted ? 'wanted' : pokemonInstance.is_for_trade ? 'trade' : 'caught',
    cp: pokemonInstance.cp ?? null,
    favorite: false,
    mostWanted: false,
  },
  instance: pokemonInstance,
  traits: [],
  stats: [],
  ivs: [],
  moves: [],
  provenance: [],
  preferences: [],
  rarity: pokemonInstance.pokemon_id === 150 ? 'Legendary' : 'Common',
});

const mine = instance({
  instance_id: 'mine-charizard',
  variant_id: '0006-default',
  pokemon_id: 6,
  cp: 2_500,
});
const theirs = instance({
  instance_id: 'theirs-mewtwo',
  variant_id: '0150-default',
  pokemon_id: 150,
  shiny: true,
});
const mineDetail = detail('Gigantamax Charizard', mine);
const theirsDetail = detail('Shiny Mewtwo', theirs);
const selection: NativeTradeProposalSelection = {
  kind: 'proposalReady',
  acceptingInstanceId: 'theirs-mewtwo',
  candidateVariantId: '0006-default',
  friendshipLevel: 5,
  luckyRequested: false,
  partnerPokemon: theirsDetail,
  offeredInstances: [mine],
};

const renderSheet = (overrides: Partial<ComponentProps<typeof NativeTradeProposalSheet>> = {}) => {
  const onSubmit = jest.fn().mockResolvedValue({
    trade: { trade_id: 'trade-committed-1', trade_status: 'proposed' },
    affected_instances: {},
  });
  const props: ComponentProps<typeof NativeTradeProposalSheet> = {
    assetBaseUrl: 'https://pokegonexus.com',
    caughtDetails: [],
    currentTrainerInstances: { 'mine-charizard': mine },
    isMarkingForTrade: false,
    partnerInstances: { 'theirs-mewtwo': theirs },
    partnerUsername: 'OtherTrainer',
    offeredDetails: [mineDetail],
    onClose: jest.fn(),
    onMarkForTrade: jest.fn(),
    onSubmit,
    selection,
    ...overrides,
  };
  render(<NativeTradeProposalSheet {...props} />);
  return { ...props, onSubmit };
};

describe('NativeTradeProposalSheet', () => {
  it('keeps mine on the left, theirs on the right, and shows remote independently', () => {
    renderSheet();

    expect(screen.getByTestId('native-trade-proposal-sheet')).toBeTruthy();
    expect(screen.getByText('YOU OFFER')).toBeTruthy();
    expect(screen.getByText('OTHERTRAINER OFFERS')).toBeTruthy();
    expect(screen.getAllByText('Remote trade available').length).toBeGreaterThan(0);
    expect(screen.queryByText('Lucky trade requested')).toBeNull();
  });

  it('does not let friendship below four continue implying Lucky', () => {
    renderSheet({
      selection: { ...selection, friendshipLevel: 4, luckyRequested: true },
    });

    fireEvent.press(screen.getByLabelText('Set friendship to 3 hearts'));

    expect(screen.queryByText('Lucky trade requested')).toBeNull();
    expect(screen.getByText('Lucky unlocks at 4 hearts')).toBeTruthy();
  });

  it('shows success only after the users service returns a committed trade', async () => {
    const { onSubmit } = renderSheet();

    fireEvent.press(screen.getByLabelText('Propose trade'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      username_accepting: 'OtherTrainer',
      pokemon_instance_id_user_proposed: 'mine-charizard',
      pokemon_instance_id_user_accepting: 'theirs-mewtwo',
      trade_friendship_level: 5,
      is_lucky_trade: false,
      is_special_trade: true,
      trade_dust_cost: 40_000,
    })));
    expect(await screen.findByText('Proposal committed')).toBeTruthy();
  });

  it('keeps the sheet open and makes a server rejection obvious', async () => {
    renderSheet({
      onSubmit: jest.fn().mockRejectedValue(new Error('Trade state has changed.')),
    });

    fireEvent.press(screen.getByLabelText('Propose trade'));

    expect(await screen.findByText('Proposal not sent')).toBeTruthy();
    expect(screen.getByText('Trade state has changed.')).toBeTruthy();
    expect(screen.getByTestId('native-trade-proposal-sheet')).toBeTruthy();
  });

  it('keeps a rejected For Trade conversion visible and recoverable', async () => {
    renderSheet({
      caughtDetails: [mineDetail],
      onMarkForTrade: jest.fn().mockRejectedValue(
        new Error('Favorite Pokémon cannot be listed For Trade.'),
      ),
      offeredDetails: [],
      selection: {
        ...selection,
        kind: 'needsTradeSelection',
        caughtInstances: [mine],
      },
    });

    fireEvent.press(screen.getByText('Add to For Trade'));

    expect(await screen.findByText('Pokémon not added')).toBeTruthy();
    expect(screen.getByText('Favorite Pokémon cannot be listed For Trade.')).toBeTruthy();
    expect(screen.getByText('Choose a caught copy')).toBeTruthy();
  });
});
