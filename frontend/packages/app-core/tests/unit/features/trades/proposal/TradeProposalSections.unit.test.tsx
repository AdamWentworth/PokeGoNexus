import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  TradeProposalActionRow,
  TradeProposalInstancePicker,
  TradeProposalMatchedDetails,
  TradeProposalPokemonCard,
  TradeProposalPokemonDetails,
} from '@/features/trades/proposal/TradeProposalSections';
import type { MatchedInstancePokemon } from '@/pages/Pokemon/features/instances/components/Trade/tradeTargetsHelpers';

vi.mock('@/components/pokemonComponents/CP', () => ({
  default: ({ cp }: { cp: string | number | null }) => <div>cp-{String(cp ?? '')}</div>,
}));

vi.mock('@/components/pokemonComponents/Moves', () => ({
  default: ({
    isShadow,
    isPurified,
  }: {
    isShadow?: boolean;
    isPurified?: boolean;
  }) => (
    <div data-shadow={String(Boolean(isShadow))} data-purified={String(Boolean(isPurified))}>
      moves
    </div>
  ),
}));

vi.mock('@/components/pokemonComponents/LocationCaught', () => ({
  default: () => <div>location-caught</div>,
}));

vi.mock('@/components/pokemonComponents/DateCaught', () => ({
  default: () => <div>date-caught</div>,
}));

const makePokemon = (overrides: Record<string, unknown> = {}): MatchedInstancePokemon =>
  ({
    name: 'Gengar',
    variant_id: '0094-default',
    variantType: 'default',
    currentImage: '/images/gengar.png',
    instanceData: {
      instance_id: 'instance-1',
      nickname: 'Spooky',
      cp: 1234,
      shadow: false,
      purified: false,
    },
    ...overrides,
  }) as unknown as MatchedInstancePokemon;

describe('shared TradeProposalSections', () => {
  it('renders pokemon details with nickname and readonly child fields', () => {
    render(<TradeProposalPokemonDetails pokemon={makePokemon()} showNickname />);

    expect(screen.getByText('Nickname: Spooky')).toBeInTheDocument();
    expect(screen.getByText('cp-1234')).toBeInTheDocument();
    expect(screen.getByText('moves')).toHaveAttribute('data-shadow', 'false');
    expect(screen.getByText('moves')).toHaveAttribute('data-purified', 'false');
    expect(screen.getByText('location-caught')).toBeInTheDocument();
    expect(screen.getByText('date-caught')).toBeInTheDocument();
  });

  it('renders pokemon image badges and fallback placeholder', () => {
    const { rerender } = render(
      <TradeProposalPokemonCard
        pokemon={makePokemon({ variantType: 'dynamax-gigantamax' })}
        prefLucky={true}
        fallbackAlt="Your Pokemon"
      />,
    );

    expect(screen.getByAltText('Lucky')).toBeInTheDocument();
    expect(screen.getByAltText('Dynamax')).toBeInTheDocument();
    expect(screen.getByAltText('G-max')).toBeInTheDocument();
    expect(screen.getByAltText('Gengar')).toHaveAttribute('src', '/images/gengar.png');
    expect(screen.getByText('Gengar')).toBeInTheDocument();

    rerender(
      <TradeProposalPokemonCard
        pokemon={undefined}
        prefLucky={false}
        fallbackAlt="Your Pokemon"
      />,
    );

    expect(screen.getByAltText('Your Pokemon')).toHaveAttribute(
      'src',
      '/images/default/placeholder.png',
    );
  });

  it('wires matched instance picker selection', () => {
    const onInstanceChange = vi.fn();
    const matchedInstances = [
      makePokemon({ instanceData: { instance_id: 'one', nickname: 'One' } }),
      makePokemon({ instanceData: { instance_id: 'two', nickname: 'Two' } }),
    ];

    render(
      <TradeProposalInstancePicker
        matchedInstances={matchedInstances}
        selectedInstanceId="one"
        onInstanceChange={onInstanceChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Choose the instance to trade:'), {
      target: { value: 'two' },
    });

    expect(onInstanceChange).toHaveBeenCalledWith('two');
  });

  it('shows a picker for multiple matches and nickname text for a single match', () => {
    const pokemon = makePokemon();
    const { rerender } = render(
      <TradeProposalMatchedDetails
        pokemon={pokemon}
        matchedInstances={[pokemon, makePokemon({ instanceData: { instance_id: 'two' } })]}
        onInstanceChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Choose the instance to trade:')).toBeInTheDocument();
    expect(screen.queryByText('Nickname: Spooky')).not.toBeInTheDocument();

    rerender(
      <TradeProposalMatchedDetails
        pokemon={pokemon}
        matchedInstances={[pokemon]}
        onInstanceChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Choose the instance to trade:')).not.toBeInTheDocument();
    expect(screen.getByText('Nickname: Spooky')).toBeInTheDocument();
  });

  it('renders action row status and forwards propose clicks', () => {
    const onProposeTrade = vi.fn();
    const { rerender } = render(
      <TradeProposalActionRow
        disabled={true}
        isSubmitting={false}
        formattedStardustCost="1,000,000"
        isSpecialTrade={true}
        isRemoteTrade={true}
        onProposeTrade={onProposeTrade}
      />,
    );

    expect(screen.getByRole('button', { name: 'Propose trade' })).toBeDisabled();
    expect(screen.getByText('1,000,000 Stardust')).toBeInTheDocument();
    expect(screen.getByText('Special trade')).toBeInTheDocument();
    expect(screen.getByText('Remote trade available')).toBeInTheDocument();

    rerender(
      <TradeProposalActionRow
        disabled={false}
        isSubmitting={false}
        formattedStardustCost="800"
        isSpecialTrade={false}
        isRemoteTrade={false}
        onProposeTrade={onProposeTrade}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Propose trade' }));

    expect(onProposeTrade).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Special trade')).not.toBeInTheDocument();
    expect(screen.queryByText('Remote trade available')).not.toBeInTheDocument();
  });
});
