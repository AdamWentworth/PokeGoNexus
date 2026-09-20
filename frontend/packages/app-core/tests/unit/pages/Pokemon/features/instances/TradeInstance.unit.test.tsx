import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TradeInstance from '@/pages/Pokemon/features/instances/TradeInstance';

const mocks = vi.hoisted(() => ({
  updateDetailsMock: vi.fn(),
  alertMock: vi.fn(),
  validateMock: vi.fn(),
  resetErrorsMock: vi.fn(),
  controllerMock: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (
    selector: (state: { updateInstanceDetails: typeof mocks.updateDetailsMock }) => unknown,
  ) => selector({ updateInstanceDetails: mocks.updateDetailsMock }),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    alert: mocks.alertMock,
  }),
}));

vi.mock('@/pages/Pokemon/features/instances/hooks/useValidation', () => ({
  default: () => ({
    errors: {},
    validate: mocks.validateMock,
    resetErrors: mocks.resetErrorsMock,
  }),
}));

vi.mock('@/pages/Pokemon/features/instances/hooks/useTradeInstanceController', () => ({
  useTradeInstanceController: (...args: unknown[]) => mocks.controllerMock(...args),
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => mocks.logger,
}));

describe('TradeInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateMock.mockReturnValue({
      validationErrors: {},
      computedValues: {},
    });
    mocks.controllerMock.mockReturnValue({
      editMode: false,
      setEditMode: vi.fn(),
      nickname: 'OfferMon',
      cp: '1234',
      gender: 'Male',
      weight: 12.3,
      height: 1.1,
      dynamax: false,
      gigantamax: false,
      showMaxOptions: false,
      maxAttack: '',
      setMaxAttack: vi.fn(),
      maxGuard: '',
      setMaxGuard: vi.fn(),
      maxSpirit: '',
      setMaxSpirit: vi.fn(),
      moves: {
        fastMove: 1,
        chargedMove1: 2,
        chargedMove2: null,
      },
      ivs: {
        Attack: 15,
        Defense: 14,
        Stamina: 13,
      },
      areIVsEmpty: false,
      level: 35,
      locationCaught: 'Vancouver, BC',
      dateCaught: '2025-01-02',
      showBackgrounds: false,
      setShowBackgrounds: vi.fn(),
      selectedBackground: null,
      currentBaseStats: { attack: 1, defense: 1, stamina: 1 },
      currentImage: '/images/pokemon.png',
      applyComputedValues: vi.fn(),
      handleGenderChange: vi.fn(),
      handleCPChange: vi.fn(),
      handleNicknameChange: vi.fn(),
      handleWeightChange: vi.fn(),
      handleHeightChange: vi.fn(),
      handleMovesChange: vi.fn(),
      handleIvChange: vi.fn(),
      handleLevelChange: vi.fn(),
      handleLocationCaughtChange: vi.fn(),
      handleDateCaughtChange: vi.fn(),
      handleBackgroundSelect: vi.fn(),
      handleToggleMaxOptions: vi.fn(),
    });
  });

  it('renders the trade offer with the caught-style section stack, ribbon, and full meta panel', () => {
    render(
      <TradeInstance
        pokemon={
          {
            pokemon_id: 1,
            name: 'Bulbasaur',
            species_name: 'Bulbasaur',
            variant_id: '0001-default',
            variantType: 'default',
            type1_name: 'Grass',
            type2_name: 'Poison',
            type_1_icon: '/images/types/grass.png',
            type_2_icon: '/images/types/poison.png',
            backgrounds: [{ background_id: 1, image_url: '/images/bg.png', name: 'BG' }],
            max: [],
            moves: [],
            instanceData: {
              instance_id: 'uuid-1',
              location_caught: 'Vancouver, BC',
              date_caught: '2025-01-02',
              is_for_trade: true,
            },
          } as any
        }
        isEditable={true}
      />,
    );

    expect(document.querySelector('.trade-instance--caught-layout')).not.toBeNull();
    expect(document.querySelector('.background-select-row--header')).toBeNull();
    expect(document.querySelector('.background-select-row--row')).toBeNull();
    expect(screen.getByLabelText('Caught date 2025 01-02')).toBeInTheDocument();
    expect(screen.getByText('CAUGHT')).toBeInTheDocument();
    expect(screen.getByText('Vancouver, BC')).toBeInTheDocument();
    expect(screen.getByText('2025-01-02')).toBeInTheDocument();
    expect(screen.queryByText('favorite')).not.toBeInTheDocument();
    expect(screen.queryByText('lucky')).not.toBeInTheDocument();
    expect(screen.queryByText('purify')).not.toBeInTheDocument();
    expect(screen.queryByText('Offering')).not.toBeInTheDocument();
  });

  it('only shows the background selector while editing', () => {
    const pokemon = {
      pokemon_id: 1,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
      variant_id: '0001-default',
      variantType: 'default',
      backgrounds: [{
        background_id: 1,
        image_url: '/images/bg.png',
        name: 'BG',
        costume_id: 0,
        date: '',
        location: '',
      }],
      max: [],
      moves: [],
      instanceData: { instance_id: 'uuid-1', is_for_trade: true },
    } as any;

    const { unmount } = render(<TradeInstance pokemon={pokemon} isEditable />);
    const viewController = mocks.controllerMock.mock.results[0]?.value;
    expect(document.querySelector('.background-select-row--header')).toBeNull();
    unmount();

    mocks.controllerMock.mockReturnValue({ ...viewController, editMode: true });
    render(<TradeInstance pokemon={pokemon} isEditable />);
    expect(document.querySelector('.background-select-row--header')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose special background' }));
    expect(viewController.setShowBackgrounds).toHaveBeenCalledTimes(1);
  });

  it('shows a real level but omits an empty level in the compact listing view', () => {
    const pokemon = {
      pokemon_id: 1,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
      variant_id: '0001-default',
      variantType: 'default',
      backgrounds: [],
      max: [],
      moves: [],
      instanceData: { instance_id: 'uuid-1', is_for_trade: true },
    } as any;

    const { unmount } = render(
      <TradeInstance pokemon={pokemon} isEditable compactListingView />,
    );
    expect(screen.getByText('For Trade')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    unmount();

    mocks.controllerMock.mockReturnValue({
      ...mocks.controllerMock.mock.results[0]?.value,
      level: null,
    });
    render(<TradeInstance pokemon={pokemon} isEditable compactListingView />);

    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('1-51 (0.5 steps)')).not.toBeInTheDocument();

    const nullLevelController = mocks.controllerMock.mock.results.at(-1)?.value;
    mocks.controllerMock.mockReturnValue({
      ...nullLevelController,
      editMode: true,
      level: null,
    });
    render(<TradeInstance pokemon={pokemon} isEditable compactListingView />);

    expect(screen.getByPlaceholderText('1-51 (0.5 steps)')).toBeInTheDocument();
  });
});
