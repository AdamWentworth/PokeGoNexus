import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TradeProposalComposer } from '@/features/trades/proposal';
import type {
  MatchedInstancePokemon,
  TradeProposalPayload,
} from '@/pages/Pokemon/features/instances/components/Trade/tradeTargetsHelpers';

const mocks = vi.hoisted(() => ({
  proposeTrade: vi.fn(),
  alert: vi.fn(),
  getStoredUsername: vi.fn(),
  useCalculateStardustCost: vi.fn(),
  toastSuccess: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/feedback', () => ({
  feedback: {
    success: mocks.toastSuccess,
  },
}));

vi.mock('@/features/trades/store/useTradeStore', () => ({
  useTradeStore: (
    selector: (state: { proposeTrade: typeof mocks.proposeTrade }) => unknown,
  ) => selector({ proposeTrade: mocks.proposeTrade }),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    alert: mocks.alert,
  }),
}));

vi.mock('@/utils/storage', () => ({
  getStoredUsername: mocks.getStoredUsername,
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => mocks.logger,
}));

vi.mock('@/pages/Pokemon/features/instances/hooks/useCalculateStardustCost', () => ({
  default: (...args: unknown[]) => mocks.useCalculateStardustCost(...args),
}));

vi.mock('@/pages/Pokemon/features/instances/components/Wanted/FriendshipManager', () => ({
  default: ({
    friendship_level,
    pref_lucky,
  }: {
    friendship_level: number;
    pref_lucky: boolean;
  }) => (
    <div>
      friendship-{friendship_level}
      {pref_lucky ? '-lucky' : ''}
    </div>
  ),
}));

vi.mock('@/components/pokemonComponents/CP', () => ({
  default: ({ cp }: { cp: string | number | null }) => <div>cp-{String(cp ?? '')}</div>,
}));

vi.mock('@/components/pokemonComponents/Moves', () => ({
  default: () => <div>moves</div>,
}));

vi.mock('@/components/pokemonComponents/LocationCaught', () => ({
  default: () => <div>location-caught</div>,
}));

vi.mock('@/components/pokemonComponents/DateCaught', () => ({
  default: () => <div>date-caught</div>,
}));

vi.mock('@/components/CloseButton', () => ({
  default: ({
    onClick,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
    >
      Close
    </button>
  ),
}));

const makePokemon = (
  name: string,
  instanceId: string,
  overrides: Record<string, unknown> = {},
): MatchedInstancePokemon =>
  ({
    name,
    variant_id: `${instanceId}-variant`,
    variantType: 'default',
    currentImage: `/images/${name}.png`,
    instanceData: {
      instance_id: instanceId,
      nickname: `${name} Nick`,
      cp: 1234,
      shadow: false,
      purified: false,
    },
    ...overrides,
  }) as unknown as MatchedInstancePokemon;

describe('shared TradeProposalComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a proposal using the selected matched instance', async () => {
    mocks.proposeTrade.mockResolvedValue({ success: true, tradeId: 'trade-1' });
    mocks.alert.mockResolvedValue(undefined);
    mocks.getStoredUsername.mockReturnValue('proposer');
    mocks.useCalculateStardustCost.mockReturnValue({
      stardustCost: 800,
      isSpecialTrade: true,
      isRegisteredTrade: false,
    });
    const onClose = vi.fn();
    const wanted = makePokemon('Gengar', 'wanted-1', { variant_id: 'gengar-variant' });
    const matchedOne = makePokemon('Haunter', 'matched-1');
    const matchedTwo = makePokemon('Gastly', 'matched-2');

    render(
      <TradeProposalComposer
        context={{
          partnerUsername: 'acceptor',
          requestedPokemon: wanted,
          candidateOffers: {
            matchedInstances: [matchedOne, matchedTwo],
          } as TradeProposalPayload,
          requestedPreferences: { friendship_level: 3, pref_lucky: true },
          ownedInstances: {},
          relatedInstances: {},
        }}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Propose trade' })).not.toBeDisabled();
    });

    const exchangeParties = screen
      .getByRole('region', { name: 'Pokémon exchange' })
      .querySelectorAll('.trade-proposal-party');
    expect(exchangeParties[0]).toHaveTextContent('You offer');
    expect(exchangeParties[0]).toHaveTextContent('Haunter');
    expect(exchangeParties[1]).toHaveTextContent('acceptor offers');
    expect(exchangeParties[1]).toHaveTextContent('Gengar');
    expect(screen.getByText(/does not provide messaging/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Choose the instance to trade:'), {
      target: { value: 'matched-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Propose trade' }));

    await waitFor(() => {
      expect(mocks.proposeTrade).toHaveBeenCalledTimes(1);
    });

    expect(mocks.proposeTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        username_proposed: 'proposer',
        username_accepting: 'acceptor',
        pokemon_instance_id_user_proposed: 'matched-2',
        pokemon_instance_id_user_accepting: 'wanted-1',
        is_special_trade: true,
        is_registered_trade: false,
        is_lucky_trade: true,
        trade_dust_cost: 800,
        trade_friendship_level: 3,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Trade proposal sent to acceptor.');
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits a five-heart remote trade and confirms it visibly', async () => {
    let resolveProposal: ((value: { success: true; tradeId: string }) => void) | undefined;
    mocks.proposeTrade.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProposal = resolve;
        }),
    );
    mocks.getStoredUsername.mockReturnValue('proposer');
    mocks.useCalculateStardustCost.mockReturnValue({
      stardustCost: 40_000,
      isSpecialTrade: true,
      isRegisteredTrade: false,
    });
    const onClose = vi.fn();

    render(
      <TradeProposalComposer
        context={{
          partnerUsername: 'forever-friend',
          requestedPokemon: makePokemon('Pikachu', 'partner-pikachu'),
          candidateOffers: {
            matchedInstances: [makePokemon('Charizard', 'my-charizard')],
          },
          requestedPreferences: { friendship_level: 5 },
          ownedInstances: {},
          relatedInstances: {},
        }}
        onClose={onClose}
      />,
    );

    const submit = await screen.findByRole('button', { name: 'Propose trade' });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mocks.proposeTrade).toHaveBeenCalledWith(
        expect.objectContaining({ trade_friendship_level: 5 }),
      );
      expect(screen.getByRole('button', { name: 'Sending proposal…' })).toBeDisabled();
    });

    resolveProposal?.({ success: true, tradeId: 'remote-trade' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Trade proposal sent to forever-friend.',
      );
    });
  });

  it('closes only the composer when its close control is used', () => {
    mocks.useCalculateStardustCost.mockReturnValue({
      stardustCost: 1000,
      isSpecialTrade: true,
      isRegisteredTrade: false,
    });
    const onClose = vi.fn();

    render(
      <TradeProposalComposer
        context={{
          partnerUsername: 'acceptor',
          requestedPokemon: makePokemon('Pikachu', 'wanted-pikachu'),
          candidateOffers: {
            matchedInstances: [makePokemon('Gigantamax Charizard', 'offered-charizard')],
          },
          ownedInstances: {},
          relatedInstances: {},
        }}
        onClose={onClose}
      />,
    );

    const close = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(close);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the authoritative rejection reason instead of a generic failure', async () => {
    mocks.proposeTrade.mockResolvedValue({
      success: false,
      error: 'trade state has changed',
    });
    mocks.alert.mockResolvedValue(undefined);
    mocks.getStoredUsername.mockReturnValue('proposer');
    mocks.useCalculateStardustCost.mockReturnValue({
      stardustCost: 800,
      isSpecialTrade: false,
      isRegisteredTrade: true,
    });

    render(
      <TradeProposalComposer
        context={{
          partnerUsername: 'acceptor',
          requestedPokemon: makePokemon('Pikachu', 'partner-pikachu'),
          candidateOffers: {
            matchedInstances: [makePokemon('Bulbasaur', 'my-bulbasaur')],
          },
          requestedPreferences: { friendship_level: 3 },
          ownedInstances: {},
          relatedInstances: {},
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propose trade' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        expect.stringContaining('already involved in an active trade'),
      );
    });
  });

  it('does not submit a listing without a partner instance id', async () => {
    mocks.alert.mockResolvedValue(undefined);
    mocks.getStoredUsername.mockReturnValue('proposer');
    mocks.useCalculateStardustCost.mockReturnValue({
      stardustCost: 800,
      isSpecialTrade: false,
      isRegisteredTrade: true,
    });
    const partnerPokemon = makePokemon('Pikachu', 'partner-pikachu');
    partnerPokemon.instanceData.instance_id = '';

    render(
      <TradeProposalComposer
        context={{
          partnerUsername: 'acceptor',
          requestedPokemon: partnerPokemon,
          candidateOffers: {
            matchedInstances: [makePokemon('Bulbasaur', 'my-bulbasaur')],
          },
          requestedPreferences: { friendship_level: 3 },
          ownedInstances: {},
          relatedInstances: {},
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propose trade' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        expect.stringContaining('missing its Pokémon instance'),
      );
    });
    expect(mocks.proposeTrade).not.toHaveBeenCalled();
  });
});
