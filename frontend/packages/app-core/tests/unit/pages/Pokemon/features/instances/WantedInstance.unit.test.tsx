import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WantedInstance from '@/pages/Pokemon/features/instances/WantedInstance';

const mocks = vi.hoisted(() => ({
  updateDetails: vi.fn(),
  alert: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (
    selector: (state: { updateInstanceDetails: typeof mocks.updateDetails }) => unknown,
  ) => selector({ updateInstanceDetails: mocks.updateDetails }),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ alert: mocks.alert }),
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => mocks.logger,
}));

vi.mock('@/utils/imageHelpers', () => ({
  determineImageUrl: () => '/images/wanted.png',
}));

vi.mock('@/pages/Pokemon/features/instances/sections/ImageStage', () => ({
  default: ({
    selectedBackground,
    dynamax,
    gigantamax,
    isLucky,
  }: {
    selectedBackground: { background_id: number } | null;
    dynamax: boolean;
    gigantamax: boolean;
    isLucky: boolean;
  }) => (
    <div
      data-testid="image-stage"
      data-background={selectedBackground?.background_id ?? 'none'}
      data-dynamax={String(dynamax)}
      data-gigantamax={String(gigantamax)}
      data-lucky={String(isLucky)}
    />
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/sections/IdentityRow', () => ({
  default: ({ eyebrow }: { eyebrow?: string }) => <div>{eyebrow}</div>,
}));

vi.mock('@/pages/Pokemon/features/instances/components/Wanted/FriendshipManager', () => ({
  default: ({
    friendship,
    setFriendship,
    setIsLucky,
    editMode,
  }: {
    friendship: number;
    setFriendship: (value: number) => void;
    setIsLucky: (value: boolean) => void;
    editMode: boolean;
  }) => (
    <div>
      <span>{friendship}/5 hearts</span>
      {editMode ? (
        <button
          type="button"
          onClick={() => {
            setFriendship(5);
            setIsLucky(true);
          }}
        >
          Require remote lucky trade
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@/components/pokemonComponents/Gender', () => ({
  default: ({ onGenderChange }: { onGenderChange: (value: string) => void }) => (
    <button type="button" onClick={() => onGenderChange('Female')}>
      Set female
    </button>
  ),
}));

vi.mock('@/components/pokemonComponents/Moves', () => ({
  default: ({
    editMode,
    onMovesChange,
  }: {
    editMode: boolean;
    onMovesChange: (value: {
      fastMove: number;
      chargedMove1: number;
      chargedMove2: null;
    }) => void;
  }) =>
    editMode ? (
      <button
        type="button"
        onClick={() =>
          onMovesChange({ fastMove: 11, chargedMove1: 22, chargedMove2: null })
        }
      >
        Set desired moves
      </button>
    ) : null,
}));

vi.mock('@/pages/Pokemon/features/instances/sections/TradeBackgroundModal', () => ({
  default: ({
    showBackgrounds,
    onSelectBackground,
  }: {
    showBackgrounds: boolean;
    onSelectBackground: (background: {
      background_id: number;
      image_url: string;
    }) => void;
  }) =>
    showBackgrounds ? (
      <button
        type="button"
        onClick={() =>
          onSelectBackground({ background_id: 7, image_url: '/images/bg.png' })
        }
      >
        Select Vancouver background
      </button>
    ) : null,
}));

const makePokemon = (overrides: Record<string, unknown> = {}) =>
  ({
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variant_id: '0001-default',
    variantType: 'default',
    sizes: {
      pokedex_height: 1,
      pokedex_weight: 6,
      height_standard_deviation: 0.25,
      weight_standard_deviation: 1.5,
      height_xxs_threshold: 0.5,
      height_xs_threshold: 0.75,
      height_xl_threshold: 1.25,
      height_xxl_threshold: 1.5,
      weight_xxs_threshold: 4,
      weight_xs_threshold: 5,
      weight_xl_threshold: 8,
      weight_xxl_threshold: 9,
    },
    backgrounds: [
      {
        background_id: 7,
        image_url: '/images/bg.png',
        name: 'Vancouver',
        location: 'Vancouver',
        date: '',
        costume_id: 0,
      },
    ],
    moves: [],
    instanceData: {
      instance_id: 'wanted-instance-1',
      variant_id: '0001-default',
      nickname: null,
      gender: null,
      weight: null,
      height: null,
      fast_move_id: null,
      charged_move1_id: null,
      charged_move2_id: null,
      friendship_level: 3,
      pref_lucky: false,
      most_wanted: false,
      location_card: '7',
      dynamax: true,
      gigantamax: false,
      shadow: false,
      purified: false,
      ...overrides,
    },
  }) as any;

describe('WantedInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateDetails.mockResolvedValue(undefined);
    mocks.alert.mockResolvedValue(undefined);
  });

  it('uses the shared listing presentation while keeping wanted-only conditions', async () => {
    render(<WantedInstance pokemon={makePokemon()} isEditable compactListingView />);

    expect(document.querySelector('.wanted-instance--caught-layout')).not.toBeNull();
    expect(screen.getByText('Wanted')).toBeInTheDocument();
    const wantedConditions = screen.getByText('Wanted conditions').closest('section');
    const imageStage = screen.getByTestId('image-stage');
    expect(wantedConditions).not.toBeNull();
    if (!wantedConditions) throw new Error('Wanted conditions section was not rendered');
    expect(
      Boolean(wantedConditions.compareDocumentPosition(imageStage) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(document.querySelector('.wanted-instance__requirements')).toBeNull();
    expect(wantedConditions).toContainElement(
      screen.getByRole('button', { name: 'Edit wanted listing' }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('image-stage')).toHaveAttribute('data-background', '7');
    });
    expect(screen.getByTestId('image-stage')).toHaveAttribute('data-dynamax', 'true');
  });

  it('edits and saves wanted conditions and Pokémon requirements together', async () => {
    const onPreviewInstanceDataChange = vi.fn();
    render(
      <WantedInstance
        pokemon={makePokemon()}
        isEditable
        onPreviewInstanceDataChange={onPreviewInstanceDataChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit wanted listing' }));

    expect(document.querySelector('.wanted-instance__requirements')).not.toBeNull();
    expect(document.querySelector('.wanted-instance__requirements .level-gender-row')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Wanted weight' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Wanted height' })).toBeInTheDocument();
    const backgroundButton = screen.getByRole('button', { name: 'Choose special background' });
    expect(backgroundButton.closest('.wanted-instance__conditions')).not.toBeNull();
    expect(
      backgroundButton.closest('.wanted-instance__condition-right-actions'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Require remote lucky trade' }));
    expect(onPreviewInstanceDataChange).toHaveBeenLastCalledWith({
      pref_lucky: true,
      most_wanted: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Most Wanted' }));
    expect(onPreviewInstanceDataChange).toHaveBeenLastCalledWith({
      pref_lucky: true,
      most_wanted: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set female' }));
    fireEvent.click(screen.getByRole('button', { name: 'XL weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'XXS height' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set desired moves' }));
    fireEvent.click(backgroundButton);
    fireEvent.click(screen.getByRole('button', { name: 'Select Vancouver background' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save wanted listing' }));

    await waitFor(() => {
      expect(mocks.updateDetails).toHaveBeenCalledWith(
        'wanted-instance-1',
        expect.objectContaining({
          gender: 'Female',
          weight: null,
          height: null,
          wanted_size_preferences: {
            weight: {
              category: 'XL',
              min: 8,
              max: 9,
              min_inclusive: false,
              max_inclusive: true,
            },
            height: {
              category: 'XXS',
              min: null,
              max: 0.5,
              min_inclusive: false,
              max_inclusive: false,
            },
          },
          fast_move_id: 11,
          charged_move1_id: 22,
          friendship_level: 5,
          pref_lucky: true,
          most_wanted: true,
          location_card: '7',
        }),
      );
    });
    expect(screen.getByRole('button', { name: 'Edit wanted listing' })).toBeInTheDocument();
  });

  it('keeps edit mode open and reports a failed save', async () => {
    mocks.updateDetails.mockRejectedValueOnce(new Error('offline'));
    render(<WantedInstance pokemon={makePokemon()} isEditable />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit wanted listing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save wanted listing' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'An error occurred while updating the wanted Pokémon. Please try again.',
      );
    });
    expect(screen.getByRole('button', { name: 'Save wanted listing' })).toBeInTheDocument();
  });

  it('rejects a background from the wrong costume pool', async () => {
    const pokemon = makePokemon({ costume_id: 7, location_card: null });
    pokemon.variantType = 'costume_7';
    render(
      <WantedInstance
        pokemon={pokemon}
        isEditable
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit wanted listing' }));
    expect(
      screen.queryByRole('button', { name: 'Choose special background' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save wanted listing' }));

    await waitFor(() => {
      expect(mocks.updateDetails).toHaveBeenCalledWith(
        'wanted-instance-1',
        expect.objectContaining({ location_card: null }),
      );
    });
  });

  it('keeps another trainer catalog view read-only and compact', () => {
    render(<WantedInstance pokemon={makePokemon()} isEditable={false} catalogView />);

    expect(document.querySelector('.wanted-instance--catalog-view')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit wanted listing' })).not.toBeInTheDocument();
    expect(screen.getByText('Wanted')).toBeInTheDocument();
    expect(screen.getByText('3/5 hearts')).toBeInTheDocument();
    expect(screen.queryByText('Most Wanted')).not.toBeInTheDocument();
  });

  it('keeps a priority listing visually Wanted and changes only its priority toggle', () => {
    render(
      <WantedInstance
        pokemon={makePokemon({ most_wanted: true })}
        isEditable={false}
        catalogView
      />,
    );

    expect(screen.getByText('Wanted')).toBeInTheDocument();
    expect(screen.getByText('Most Wanted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Most Wanted' })).toBeDisabled();
    expect(document.querySelector('.wanted-instance--most-wanted')).toBeNull();
  });

  it('reveals only meaningful desired details outside edit mode', () => {
    const { rerender } = render(
      <WantedInstance
        pokemon={makePokemon({ gender: 'Any' })}
        isEditable={false}
        catalogView
      />,
    );
    expect(document.querySelector('.wanted-instance__requirements')).toBeNull();

    rerender(
      <WantedInstance
        key="specific-wanted"
        pokemon={makePokemon({ gender: 'Any', weight: 8.5 })}
        isEditable={false}
        catalogView
      />,
    );
    expect(document.querySelector('.wanted-instance__requirements')).not.toBeNull();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('XL')).toBeInTheDocument();
    expect(document.querySelector('.level-gender-row')).toBeNull();
  });

  it('uses canonical size categories before legacy numeric values', () => {
    render(
      <WantedInstance
        pokemon={makePokemon({
          weight: 3.5,
          wanted_size_preferences: {
            weight: {
              category: 'XL',
              min: 8,
              max: 9,
              min_inclusive: false,
              max_inclusive: true,
            },
            height: null,
          },
        })}
        isEditable={false}
        catalogView
      />,
    );

    expect(screen.getByText('XL')).toBeInTheDocument();
    expect(screen.queryByText('XXS')).not.toBeInTheDocument();
  });
});
