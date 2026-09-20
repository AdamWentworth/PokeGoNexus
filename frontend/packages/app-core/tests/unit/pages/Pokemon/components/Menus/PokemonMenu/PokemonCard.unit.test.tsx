import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import PokemonCard from '@/pages/Pokemon/components/Menus/PokemonMenu/PokemonCard';

const { pokemonImagePresentationSpy } = vi.hoisted(() => ({
  pokemonImagePresentationSpy: vi.fn(),
}));

vi.mock('@/components/pokemonComponents/CP', () => ({
  default: () => <div data-testid="cp-component" />,
}));

vi.mock('@/pages/Pokemon/components/Menus/PokemonMenu/PokemonImagePresentation', () => ({
  default: (props: unknown) => {
    pokemonImagePresentationSpy(props);
    return <div data-testid="pokemon-image-presentation" />;
  },
}));

vi.mock('@/pages/Pokemon/components/Menus/PokemonMenu/SelectChip', () => ({
  default: ({ onToggle }: { onToggle: () => void }) => (
    <button type="button" data-testid="select-chip" onClick={onToggle}>
      select
    </button>
  ),
}));

function makePokemon(overrides: Record<string, unknown> = {}) {
  return {
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variant_id: '0001-default',
    variantType: 'default',
    currentImage: '/images/1.png',
    pokedex_number: 1,
    cp50: 1115,
    type_1_icon: '/images/type-grass.png',
    type_2_icon: '/images/type-poison.png',
    type1_name: 'Grass',
    type2_name: 'Poison',
    attack: 118,
    defense: 111,
    stamina: 128,
    image_url: '/images/1.png',
    image_url_shadow: '/images/1-shadow.png',
    image_url_shiny: '/images/1-shiny.png',
    image_url_shiny_shadow: '/images/1-shiny-shadow.png',
    costumes: [],
    moves: [],
    fusion: [],
    backgrounds: [],
    megaEvolutions: [],
    raid_boss: [],
    evolves_from: [],
    sizes: {
      pokedex_height: 0.7,
      pokedex_weight: 6.9,
      height_standard_deviation: 0.1,
      weight_standard_deviation: 0.1,
      height_xxs_threshold: 0.1,
      height_xs_threshold: 0.2,
      height_xl_threshold: 1.0,
      height_xxl_threshold: 1.2,
      weight_xxs_threshold: 1.0,
      weight_xs_threshold: 2.0,
      weight_xl_threshold: 10.0,
      weight_xxl_threshold: 12.0,
    },
    max: [],
    sprite_url: null,
    instanceData: {
      favorite: false,
    },
    ...overrides,
  } as unknown as React.ComponentProps<typeof PokemonCard>['pokemon'];
}

function renderCard(pokemonOverrides: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const toggleCardHighlight = vi.fn();
  const setIsFastSelectEnabled = vi.fn();

  render(
    <PokemonCard
      pokemon={makePokemon(pokemonOverrides)}
      onSelect={onSelect}
      onSwipe={vi.fn()}
      toggleCardHighlight={toggleCardHighlight}
      setIsFastSelectEnabled={setIsFastSelectEnabled}
      isEditable={true}
      isFastSelectEnabled={false}
      isHighlighted={false}
      tagFilter=""
      sortType="name"
      variantByPokemonId={new Map()}
    />,
  );

  return { onSelect, toggleCardHighlight, setIsFastSelectEnabled };
}

describe('PokemonCard', () => {
  it('enters fast-select after the shared collection hold duration', () => {
    vi.useFakeTimers();
    const { toggleCardHighlight, setIsFastSelectEnabled } = renderCard({
      instanceData: { instance_id: 'instance-123' },
    });
    const card = screen.getByRole('button', { name: /view bulbasaur details/i });

    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 20 }] });
    vi.advanceTimersByTime(collectionExperienceParityContract.cardLongPressMs - 1);
    expect(setIsFastSelectEnabled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setIsFastSelectEnabled).toHaveBeenCalledWith(true);
    expect(toggleCardHighlight).toHaveBeenCalledWith('instance-123');
    vi.useRealTimers();
  });

  it('uses variant_id as fallback key for modifier-click selection', () => {
    const { toggleCardHighlight, setIsFastSelectEnabled } = renderCard({
      instanceData: {},
      variant_id: '0001-default',
    });

    const card = screen.getByRole('button', { name: /select bulbasaur/i });
    fireEvent.click(card, { ctrlKey: true });

    expect(setIsFastSelectEnabled).toHaveBeenCalledWith(true);
    expect(toggleCardHighlight).toHaveBeenCalledWith('0001-default');
  });

  it('uses instance_id when present for keyboard selection and supports enter-to-open', () => {
    const { onSelect, toggleCardHighlight, setIsFastSelectEnabled } = renderCard({
      instanceData: { instance_id: 'instance-123' },
    });

    const card = screen.getByRole('button', { name: /view bulbasaur details/i });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(setIsFastSelectEnabled).toHaveBeenCalledWith(true);
    expect(toggleCardHighlight).toHaveBeenCalledWith('instance-123');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('describes catalog activation as selection and owned activation as viewing details', () => {
    const { rerender } = render(
      <PokemonCard
        pokemon={makePokemon({ instanceData: {} })}
        onSelect={vi.fn()}
        onSwipe={vi.fn()}
        toggleCardHighlight={vi.fn()}
        setIsFastSelectEnabled={vi.fn()}
        isEditable={true}
        isFastSelectEnabled={false}
        isHighlighted={false}
        tagFilter=""
        sortType="name"
        variantByPokemonId={new Map()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Select Bulbasaur. Press Space to select it for tagging.',
      }),
    ).toBeInTheDocument();

    rerender(
      <PokemonCard
        pokemon={makePokemon({ instanceData: { instance_id: 'instance-123' } })}
        onSelect={vi.fn()}
        onSwipe={vi.fn()}
        toggleCardHighlight={vi.fn()}
        setIsFastSelectEnabled={vi.fn()}
        isEditable={true}
        isFastSelectEnabled={false}
        isHighlighted={false}
        tagFilter=""
        sortType="name"
        variantByPokemonId={new Map()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'View Bulbasaur details. Press Space to select it for tagging.',
      }),
    ).toBeInTheDocument();
  });

  it('uses the red-orange Most Wanted star instead of Favorite on wanted cards', () => {
    const { rerender } = render(
      <PokemonCard
        pokemon={makePokemon({
          instanceData: {
            instance_id: 'wanted-1',
            is_wanted: true,
            most_wanted: true,
            favorite: true,
          },
        })}
        onSelect={vi.fn()}
        onSwipe={vi.fn()}
        toggleCardHighlight={vi.fn()}
        setIsFastSelectEnabled={vi.fn()}
        isEditable
        isFastSelectEnabled={false}
        isHighlighted={false}
        tagFilter="Wanted"
        sortType="name"
        variantByPokemonId={new Map()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Most Wanted' })).toHaveClass(
      'most-wanted-icon',
    );
    expect(screen.queryByAltText('Favorite')).not.toBeInTheDocument();

    rerender(
      <PokemonCard
        pokemon={makePokemon({
          instanceData: {
            instance_id: 'wanted-1',
            is_wanted: true,
            most_wanted: false,
          },
        })}
        onSelect={vi.fn()}
        onSwipe={vi.fn()}
        toggleCardHighlight={vi.fn()}
        setIsFastSelectEnabled={vi.fn()}
        isEditable
        isFastSelectEnabled={false}
        isHighlighted={false}
        tagFilter="Wanted"
        sortType="name"
        variantByPokemonId={new Map()}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Most Wanted' })).not.toBeInTheDocument();
  });

  it('renders mega-prefixed display names in catalog cards for mega instances', () => {
    renderCard({
      name: 'Shiny Tyranitar',
      species_name: 'Tyranitar',
      variantType: 'shiny',
      instanceData: {
        shiny: true,
        is_mega: true,
        mega_form: null,
      },
    });

    expect(screen.getByRole('heading', { name: 'Shiny Mega Tyranitar' })).toBeInTheDocument();
  });

  it('uses fusion variant backgrounds for fused location backdrop IDs (including combo IDs)', () => {
    pokemonImagePresentationSpy.mockClear();

    renderCard({
      pokemon_id: 800,
      variantType: 'fusion_1',
      fusion_id: 1,
      fusion: [
        {
          fusion_id: 1,
          name: 'Dawn Wings Necrozma',
          base_pokemon_id1: 800,
          base_pokemon_id2: 792,
          backgrounds: [
            {
              background_id: 19,
              image_url: '/images/backgrounds/wormhole_moon.png',
              name: 'GoFest2024 Wormhole Moon',
              costume_id: 0,
              date: '',
              location: '',
            },
          ],
          background_combo_rules: [],
        },
      ],
      backgrounds: [],
      instanceData: {
        location_card: '19',
        is_fused: true,
        fusion_form: 'Dawn Wings Necrozma',
      },
    });

    const renderProps = pokemonImagePresentationSpy.mock.calls.at(-1)?.[0] as
      | { locationBackground?: { background_id?: number } }
      | undefined;

    expect(renderProps?.locationBackground?.background_id).toBe(19);
  });

  it('renders mega types on card when mega is active', () => {
    renderCard({
      megaEvolutions: [
        {
          id: 1,
          form: 'X',
          date_available: '2019-01-01T00:00:00Z',
          mega_energy_cost: 200,
          type1_name: 'Fire',
          type2_name: 'Dragon',
          type_1_id: 10,
          type_2_id: 3,
        },
      ],
      instanceData: {
        is_mega: true,
        mega: true,
        mega_form: 'X',
      },
    });

    expect(screen.getByAltText('Fire')).toHaveAttribute('src', '/images/types/fire.png');
    expect(screen.getByAltText('Dragon')).toHaveAttribute('src', '/images/types/dragon.png');
  });

  it('renders fusion types on card when fusion is active', () => {
    renderCard({
      fusion: [
        {
          fusion_id: 3,
          date_available: '2025-02-21T00:00:00Z',
          base_pokemon_id1: 1,
          base_pokemon_id2: 2,
          name: 'Test Fusion',
          type_1_id: 3,
          type_2_id: 12,
          type1_name: 'Dragon',
          type2_name: 'Ice',
        },
      ],
      instanceData: {
        is_fused: true,
        fusion_form: 'Test Fusion',
        fusion: { fusion_id: 3 },
      },
    });

    expect(screen.getByAltText('Dragon')).toHaveAttribute('src', '/images/types/dragon.png');
    expect(screen.getByAltText('Ice')).toHaveAttribute('src', '/images/types/ice.png');
  });

  it('drops base secondary type on card when mega form is single-typed', () => {
    renderCard({
      type1_name: 'Steel',
      type2_name: 'Rock',
      type_1_icon: '/images/types/steel.png',
      type_2_icon: '/images/types/rock.png',
      megaEvolutions: [
        {
          id: 2,
          form: null,
          date_available: '2019-01-01T00:00:00Z',
          mega_energy_cost: 200,
          type1_name: 'Steel',
          type_1_id: 17,
        },
      ],
      instanceData: {
        is_mega: true,
        mega: true,
        mega_form: null,
      },
    });

    expect(screen.getByAltText('Steel')).toHaveAttribute('src', '/images/types/steel.png');
    expect(screen.queryByAltText('Rock')).not.toBeInTheDocument();
  });
});
