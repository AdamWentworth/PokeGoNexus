import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import WantedDetails from '@/pages/Pokemon/features/instances/components/Wanted/WantedDetails';

const mocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  updateInstanceDetailsMock: vi.fn(),
  useTradeFilteringMock: vi.fn(),
  toggleEditModeMock: vi.fn(),
  tradeListDisplaySpy: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => mocks.logger,
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (
    selector: (state: { updateInstanceDetails: typeof mocks.updateInstanceDetailsMock }) => unknown,
  ) => selector({ updateInstanceDetails: mocks.updateInstanceDetailsMock }),
}));

vi.mock('@/pages/Pokemon/features/instances/hooks/useTradeFiltering', () => ({
  default: (...args: unknown[]) => mocks.useTradeFilteringMock(...args),
}));

vi.mock('@/pages/Pokemon/features/instances/hooks/useToggleEditModeWanted', () => ({
  toggleEditMode: (...args: unknown[]) => mocks.toggleEditModeMock(...args),
}));

vi.mock('@/components/EditSaveComponent', () => ({
  default: ({
    editMode,
    toggleEditMode,
  }: {
    editMode: boolean;
    toggleEditMode: () => void;
  }) => (
    <button type="button" data-testid="toggle-edit-mode" onClick={toggleEditMode}>
      toggle-{String(editMode)}
    </button>
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/components/Wanted/TradeListDisplay', () => ({
  default: (props: {
    onPokemonClick: (instanceId: string) => void;
    localNotTradeList: Record<string, boolean>;
  }) => {
    mocks.tradeListDisplaySpy(props);
    return (
      <div>
        <div data-testid="not-trade-count">
          {Object.keys(props.localNotTradeList || {}).length}
        </div>
        <button
          type="button"
          data-testid="trade-list-click"
          onClick={() => props.onPokemonClick('0001-default_uuid-1')}
        >
          click trade
        </button>
      </div>
    );
  },
}));

type WantedDetailsProps = React.ComponentProps<typeof WantedDetails>;

const makeProps = (
  overrides: Partial<WantedDetailsProps> = {},
): WantedDetailsProps => ({
  pokemon: {
    variant_id: '0001-default',
    species_name: 'Bulbasaur',
    variantType: 'default',
    currentImage: '/images/bulbasaur.png',
    instanceData: {
      instance_id: '0001-default_uuid-parent',
      variant_id: '0001-default',
      pokemon_id: 1,
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      not_trade_list: {},
      trade_filters: {},
    },
  } as WantedDetailsProps['pokemon'],
  lists: {
    trade: {
      '0001-default_uuid-1': {
        name: 'Bulbasaur',
        species_name: 'Bulbasaur',
      },
    },
  },
  instances: {
    '0001-default_uuid-1': {
      instance_id: '0001-default_uuid-1',
      variant_id: '0001-default',
      pokemon_id: 1,
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
    },
  } as unknown as WantedDetailsProps['instances'],
  sortType: 'name',
  sortMode: 'ascending',
  openTradeOverlay: vi.fn(),
  variants: [
    {
      variant_id: '0001-default',
      species_name: 'Bulbasaur',
      variantType: 'default',
      currentImage: '/images/bulbasaur.png',
      ownershipStatus: {},
    },
  ] as unknown as WantedDetailsProps['variants'],
  isEditable: true,
  ...overrides,
});

describe('WantedDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useTradeFilteringMock.mockReturnValue({
      filteredTradeList: {
        '0001-default_uuid-1': {
          name: 'Bulbasaur',
          species_name: 'Bulbasaur',
        },
      },
      filteredOutPokemon: [],
      updatedLocalTradeFilters: {},
    });

    mocks.toggleEditModeMock.mockImplementation(
      (args: { editMode: boolean; setEditMode: (value: boolean) => void }) => {
        args.setEditMode(!args.editMode);
      },
    );
  });

  it('opens trade overlay with merged variant and instance data on click', () => {
    const props = makeProps();
    render(<WantedDetails {...props} />);

    fireEvent.click(screen.getByTestId('trade-list-click'));

    expect(props.openTradeOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        variant_id: '0001-default',
        ownershipStatus: expect.objectContaining({
          instance_id: '0001-default_uuid-1',
          is_for_trade: true,
        }),
      }),
    );
  });

  it('logs and skips opening overlay when variant is missing', () => {
    const props = makeProps({
      variants: [],
    });
    render(<WantedDetails {...props} />);

    fireEvent.click(screen.getByTestId('trade-list-click'));

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Variant not found for instance id: 0001-default_uuid-1',
    );
    expect(props.openTradeOverlay).not.toHaveBeenCalled();
  });

  it('logs and skips opening overlay when instance is missing', () => {
    const props = makeProps({
      instances: {},
    });
    render(<WantedDetails {...props} />);

    fireEvent.click(screen.getByTestId('trade-list-click'));

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Pokemon instance not found for key: 0001-default_uuid-1',
    );
    expect(props.openTradeOverlay).not.toHaveBeenCalled();
  });

  it('only resets local filters when edit mode is enabled', () => {
    const props = makeProps({
      pokemon: {
        ...makeProps().pokemon,
        instanceData: {
          ...makeProps().pokemon.instanceData,
          not_trade_list: { '0001-default_uuid-1': true },
        },
      } as WantedDetailsProps['pokemon'],
    });
    render(<WantedDetails {...props} />);

    expect(screen.getByTestId('not-trade-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('not-trade-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Edit preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByTestId('not-trade-count')).toHaveTextContent('0');
  });

  it('labels the summary as Pokémon available for this wanted listing', () => {
    render(<WantedDetails {...makeProps({ summaryMode: true })} />);

    expect(screen.getByText('For Trade Pokémon')).toBeInTheDocument();
    expect(screen.queryByText('Acceptable offers')).not.toBeInTheDocument();
  });
});
