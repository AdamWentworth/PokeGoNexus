import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import TradeTargetsWorkspace from '@/pages/Trades/TradeTargetsWorkspace';

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

const mocks = vi.hoisted(() => ({
  tradePanelProps: [] as Array<Record<string, unknown>>,
  wantedPanelProps: [] as Array<Record<string, unknown>>,
  instancesState: {
    instances: {
      trade1: { instance_id: 'trade1', variant_id: 'v1', is_for_trade: true, cp: 100 },
      wanted1: { instance_id: 'wanted1', variant_id: 'v2', is_wanted: true, cp: 200 },
    },
  },
  tagsState: { tags: { caught: {}, wanted: {} } },
  variantsState: { variants: [], variantsLoading: false },
}));

const tradePokemon = {
  name: 'Pikachu',
  variantType: 'dynamax',
  currentImage: '/pikachu.png',
  instanceData: mocks.instancesState.instances.trade1,
};
const wantedPokemon = {
  name: 'Eevee',
  pokedex_number: 133,
  variant_id: 'v2',
  currentImage: '/eevee.png',
  instanceData: mocks.instancesState.instances.wanted1,
};
const laterTradePokemon = {
  name: 'Eevee',
  variantType: 'gigantamax',
  pokedex_number: 133,
  variant_id: 'v2',
  currentImage: '/eevee.png',
  instanceData: {
    instance_id: 'trade2',
    variant_id: 'v2',
    is_for_trade: true,
    cp: 300,
  },
};

Object.assign(tradePokemon, { pokedex_number: 25, variant_id: 'v1' });

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (state: typeof mocks.instancesState) => unknown) =>
    selector(mocks.instancesState),
}));

vi.mock('@/features/tags/store/useTagsStore', () => ({
  useTagsStore: (selector: (state: typeof mocks.tagsState) => unknown) =>
    selector(mocks.tagsState),
}));

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (state: typeof mocks.variantsState) => unknown) =>
    selector(mocks.variantsState),
}));

vi.mock('@/hooks/filtering/usePokemonOwnershipFilter', () => ({
  getFilteredPokemonsByOwnership: (
    _variants: unknown,
    _instances: unknown,
    filter: string,
  ) => filter === 'trade' ? [laterTradePokemon, tradePokemon] : [wantedPokemon],
}));

vi.mock('@/pages/Pokemon/features/instances/components/Trade/TradeTargetsPanel', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.tradePanelProps.push(props);
    return <div data-testid="existing-trade-targets">For Trade target editor</div>;
  },
}));

vi.mock('@/pages/Pokemon/features/instances/components/Wanted/WantedDetails', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.wantedPanelProps.push(props);
    return <div data-testid="existing-wanted-targets">Wanted target editor</div>;
  },
}));

describe('TradeTargetsWorkspace', () => {
  beforeEach(() => {
    mocks.tradePanelProps.length = 0;
    mocks.wantedPanelProps.length = 0;
    localStorage.setItem('user', JSON.stringify({ username: 'ash' }));
  });

  it('mounts the existing For Trade target editor with the canonical stores', () => {
    render(<TradeTargetsWorkspace />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('existing-trade-targets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'For Trade (2)' })).toHaveClass('active');
    expect(mocks.tradePanelProps.at(-1)?.instances).toBe(mocks.instancesState.instances);
    expect(mocks.tradePanelProps.at(-1)?.lists).toBe(mocks.tagsState.tags);
    expect(
      screen.getAllByRole('button')
        .filter(
          (button) =>
            button.closest('.trade-target-entry-list') &&
            !button.closest('.trade-target-mobile-picker-panel'),
        )
        .map((button) => button.textContent),
    ).toEqual(['Pikachu#0025', 'Eevee#0133']);
    expect(screen.getAllByAltText('Dynamax')).not.toHaveLength(0);
    expect(screen.getAllByAltText('Gigantamax')).not.toHaveLength(0);
  });

  it('switches to the existing Wanted target editor without changing its behavior', async () => {
    render(<TradeTargetsWorkspace />, { wrapper: MemoryRouter });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wanted (1)' }));
    });

    expect(await screen.findByTestId('existing-wanted-targets')).toBeInTheDocument();
    expect(screen.queryByTestId('existing-trade-targets')).not.toBeInTheDocument();
    expect(mocks.wantedPanelProps.at(-1)?.instances).toBe(mocks.instancesState.instances);
    expect(mocks.wantedPanelProps.at(-1)?.lists).toBe(mocks.tagsState.tags);
  });

  it('opens a URL-selected preference mode and instance directly', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/trades?section=preferences&mode=trade&instance=trade2',
        ]}
      >
        <TradeTargetsWorkspace />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('existing-trade-targets')).toBeInTheDocument();
    expect(
      (mocks.tradePanelProps.at(-1)?.pokemon as {
        instanceData?: { instance_id?: string };
      })?.instanceData?.instance_id,
    ).toBe('trade2');
  });
});
