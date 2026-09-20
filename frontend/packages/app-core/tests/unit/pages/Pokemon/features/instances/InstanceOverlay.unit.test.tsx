import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InstanceOverlay, {
  isSwipeInteractiveTarget,
} from '@/pages/Pokemon/features/instances/InstanceOverlay';

vi.mock('@/components/OverlayPortal', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overlay-portal">{children}</div>
  ),
}));

vi.mock('@/components/WindowOverlay', () => ({
  default: ({
    children,
    className = '',
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => (
    <div data-testid="window-overlay" className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/CloseButton', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/CaughtInstance', () => ({
  default: ({
    pokemon,
    onPreviewInstanceDataChange,
  }: {
    pokemon: { instanceData?: { original_trainer_name?: string | null } };
    onPreviewInstanceDataChange?: (patch: {
      shadow?: boolean;
      purified?: boolean;
      lucky?: boolean;
    }) => void;
  }) => (
    <div data-testid="caught-instance">
      {pokemon.instanceData?.original_trainer_name ?? 'none'}
      <button
        type="button"
        onClick={() => onPreviewInstanceDataChange?.({ shadow: false, purified: true, lucky: false })}
      >
        preview-purified
      </button>
    </div>
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/TradeInstance', () => ({
  default: ({ compactListingView }: { compactListingView?: boolean }) => (
    <div
      data-testid="trade-instance"
      data-compact-listing={String(compactListingView)}
    />
  ),
}));

vi.mock('@/features/trades/preferences/TradePreferenceHandoff', () => ({
  default: () => <div data-testid="trade-preference-handoff" />,
}));

vi.mock('@/features/trades/proposal/CatalogTradeLauncherPanel', () => ({
  default: () => <div data-testid="trade-details" />,
}));

vi.mock('@/features/trades/proposal/CatalogWantedLauncherPanel', () => ({
  default: ({
    wantedPokemon,
  }: {
    wantedPokemon: { instanceData?: { instance_id?: string | null } };
  }) => (
    <div
      data-testid="wanted-details"
      data-draft-instance-id={wantedPokemon.instanceData?.instance_id ?? 'none'}
    />
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/components/Trade/TradeTargetsPanel', () => ({
  default: ({ isEditable, summaryMode }: { isEditable: boolean; summaryMode?: boolean }) => (
    <div
      data-testid="own-trade-targets"
      data-editable={String(isEditable)}
      data-summary={String(summaryMode)}
    />
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/components/Wanted/WantedDetails', () => ({
  default: ({ isEditable, summaryMode }: { isEditable: boolean; summaryMode?: boolean }) => (
    <div
      data-testid="own-wanted-targets"
      data-editable={String(isEditable)}
      data-summary={String(summaryMode)}
    />
  ),
}));

vi.mock('@/pages/Pokemon/features/instances/WantedInstance', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');

  return {
    default: ({
      pokemon,
      compactListingView,
    }: {
      pokemon: { instanceData?: { instance_id?: string | null } };
      compactListingView?: boolean;
    }) => {
      const [draftInstanceId] = ReactActual.useState(
        () => pokemon.instanceData?.instance_id ?? 'none',
      );

      return (
        <div
          data-testid="wanted-instance"
          data-draft-instance-id={draftInstanceId}
          data-compact-listing={String(compactListingView)}
        >
          {draftInstanceId}
        </div>
      );
    },
  };
});

function makePokemon(overrides: Record<string, unknown> = {}) {
  return {
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variant_id: '0001-default',
    variantType: 'default',
    currentImage: '/images/1.png',
    image_url: '/images/1.png',
    image_url_shadow: '/images/1-shadow.png',
    image_url_shiny: '/images/1-shiny.png',
    image_url_shiny_shadow: '/images/1-shiny-shadow.png',
    instanceData: {},
    costumes: [],
    ...overrides,
  } as unknown as React.ComponentProps<typeof InstanceOverlay>['pokemon'];
}

function renderOverlay(
  tagFilter: string,
  pokemonOverrides: Record<string, unknown> = {},
  isEditable = false,
) {
  render(
    <InstanceOverlay
      pokemon={makePokemon(pokemonOverrides)}
      onClose={vi.fn()}
      variants={[]}
      tagFilter={tagFilter}
      lists={{}}
      instances={{}}
      sortType="name"
      sortMode="ascending"
      isEditable={isEditable}
      username="ash"
    />,
  );
}

describe('InstanceOverlay', () => {
  it('shows read-only targets and the preference handoff for the owner trade listing', () => {
    renderOverlay('trade', { instanceData: { instance_id: 'trade-1' } }, true);

    expect(screen.getByTestId('own-trade-targets')).toHaveAttribute(
      'data-editable',
      'false',
    );
    expect(screen.getByTestId('trade-instance')).toHaveAttribute(
      'data-compact-listing',
      'true',
    );
    expect(screen.getByTestId('own-trade-targets')).toHaveAttribute('data-summary', 'true');
    expect(screen.getByTestId('trade-preference-handoff')).toBeInTheDocument();
    expect(screen.queryByTestId('trade-details')).not.toBeInTheDocument();
  });

  it('shows read-only offers and the preference handoff for the owner wanted listing', () => {
    renderOverlay('wanted', { instanceData: { instance_id: 'wanted-1' } }, true);

    expect(screen.getByTestId('own-wanted-targets')).toHaveAttribute(
      'data-editable',
      'false',
    );
    expect(screen.getByTestId('wanted-instance')).toHaveAttribute(
      'data-compact-listing',
      'true',
    );
    expect(screen.getByTestId('own-wanted-targets')).toHaveAttribute('data-summary', 'true');
    expect(screen.getByTestId('trade-preference-handoff')).toBeInTheDocument();
    expect(screen.queryByTestId('wanted-details')).not.toBeInTheDocument();
  });

  it('uses stacked trade layout below 768px and side-by-side at 768px and above', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 767,
    });

    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const { rerender } = render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );

    expect(document.querySelector('.overlay-row.other-overlays-row')).toHaveClass('column-layout');

    window.innerWidth = 768;
    fireEvent(window, new Event('resize'));

    await waitFor(() =>
      expect(document.querySelector('.overlay-row.other-overlays-row')).not.toHaveClass('column-layout'),
    );

    rerender(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );
  });

  it('renders caught overlay when tag filter is caught', () => {
    renderOverlay('caught');
    expect(screen.getByTestId('caught-instance')).toBeInTheDocument();
  });

  it('renders the Wanted overlay for a Most Wanted tag result', () => {
    renderOverlay('Most Wanted', {
      instanceData: {
        instance_id: 'most-wanted-1',
        is_wanted: true,
        most_wanted: true,
      },
    });

    expect(screen.getByTestId('wanted-instance')).toBeInTheDocument();
    expect(screen.getByTestId('wanted-details')).toBeInTheDocument();
    expect(screen.queryByTestId('caught-instance')).not.toBeInTheDocument();
    expect(document.querySelector('.instance-overlay')).toHaveClass('wanted-mode');
  });

  it('renders trade details and proposal in one unified window', () => {
    renderOverlay('trade');
    expect(screen.getByTestId('trade-instance')).toBeInTheDocument();
    expect(screen.getByTestId('trade-details')).toBeInTheDocument();
    expect(screen.getAllByTestId('window-overlay')).toHaveLength(1);
  });

  it('renders the type background layer for trade overlays too', () => {
    renderOverlay('trade', {
      type1_name: 'Fire',
    });

    const background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    const backgroundLayer = document.querySelector('.io-bg') as HTMLDivElement | null;
    const motionShell = document.querySelector('.instance-motion-shell');
    expect(background).not.toBeNull();
    expect(background?.getAttribute('src')).toContain('bg_fire.png');
    expect(motionShell?.contains(background)).toBe(false);
    expect(backgroundLayer?.style.getPropertyValue('--io-bg-base-scale')).toBe('1.06');
    expect(backgroundLayer?.style.getPropertyValue('--io-bg-transition-opacity')).toBe('0.58');
    expect(backgroundLayer?.style.getPropertyValue('--io-bg-transition-scale')).toBe('1.09');
  });

  it('renders type and wanted-lucky backgrounds behind wanted overlays', () => {
    const { unmount } = render(
      <InstanceOverlay
        pokemon={makePokemon({
          type1_name: 'Grass',
          instanceData: { instance_id: 'wanted-1', is_wanted: true },
        })}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="wanted"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable
        username="ash"
      />,
    );

    let background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(background?.getAttribute('src')).toContain('bg_grass.png');
    expect(document.querySelector('.instance-overlay')).toHaveClass('wanted-mode');
    unmount();

    renderOverlay('wanted', {
      type1_name: 'Grass',
      instanceData: {
        instance_id: 'wanted-2',
        is_wanted: true,
        pref_lucky: true,
      },
    });
    background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(background?.getAttribute('src')).toContain('bg_lucky.png');
  });

  it('falls back to pokemon status when tag filter is unknown', () => {
    renderOverlay('unknown-filter', {
      instanceData: { status: 'wanted' },
    });
    expect(screen.getByTestId('wanted-details')).toBeInTheDocument();
    expect(screen.getByTestId('wanted-instance')).toBeInTheDocument();
  });

  it('falls back to top-level pokemon status when instance status is absent', () => {
    renderOverlay('unknown-filter', {
      status: 'trade',
    });

    expect(screen.getByTestId('trade-instance')).toBeInTheDocument();
    expect(screen.getByTestId('trade-details')).toBeInTheDocument();
  });

  it('remounts wanted panes when the active wanted instance changes', () => {
    const firstPokemon = makePokemon({
      instanceData: {
        instance_id: 'wanted-1',
        status: 'wanted',
      },
    });
    const secondPokemon = makePokemon({
      pokemon_id: 2,
      variant_id: '0002-default',
      instanceData: {
        instance_id: 'wanted-2',
        status: 'wanted',
      },
    });

    const { rerender } = render(
      <InstanceOverlay
        pokemon={firstPokemon}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="wanted"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );

    expect(screen.getByTestId('wanted-details')).toHaveAttribute(
      'data-draft-instance-id',
      'wanted-1',
    );

    rerender(
      <InstanceOverlay
        pokemon={secondPokemon}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="wanted"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );

    expect(screen.getByTestId('wanted-details')).toHaveAttribute(
      'data-draft-instance-id',
      'wanted-2',
    );
  });

  it('uses shadow background before lucky or type backgrounds', () => {
    renderOverlay('caught', {
      type1_name: 'Water',
      instanceData: { shadow: true, lucky: true, purified: false },
    });

    const background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(background).not.toBeNull();
    expect(background?.getAttribute('src')).toContain('bg_shadow.png');
  });

  it('uses variantType type fallback when explicit type fields are absent', () => {
    renderOverlay('trade', {
      type1_name: undefined,
      variantType: 'type_bug',
    });

    const background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(background).not.toBeNull();
    expect(background?.getAttribute('src')).toContain('bg_bug.png');
  });

  it('uses non-shadow type background for purified pokemon even when shadow flag exists', () => {
    renderOverlay('caught', {
      type1_name: 'Psychic',
      instanceData: { shadow: true, purified: true },
    });

    const background = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(background).not.toBeNull();
    expect(background?.getAttribute('src')).toContain('bg_psychic.png');
  });

  it('updates caught background immediately from preview patch before save', () => {
    renderOverlay('caught', {
      type1_name: 'Psychic',
      instanceData: { shadow: true, purified: false },
    });

    const initialBackground = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(initialBackground?.getAttribute('src')).toContain('bg_shadow.png');

    fireEvent.click(screen.getByRole('button', { name: 'preview-purified' }));

    const updatedBackground = document.querySelector('.io-bg-img') as HTMLImageElement | null;
    expect(updatedBackground?.getAttribute('src')).toContain('bg_psychic.png');
  });

  it('treats buttons and nested icon elements as interactive swipe targets', () => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    const range = document.createElement('input');
    range.type = 'range';
    const wrapper = document.createElement('div');
    wrapper.className = 'mirror';

    button.appendChild(image);
    wrapper.appendChild(document.createElement('img'));
    document.body.appendChild(button);
    document.body.appendChild(range);
    document.body.appendChild(wrapper);

    try {
      expect(isSwipeInteractiveTarget(button)).toBe(true);
      expect(isSwipeInteractiveTarget(image)).toBe(true);
      expect(isSwipeInteractiveTarget(wrapper.firstElementChild)).toBe(true);
      expect(isSwipeInteractiveTarget(range)).toBe(true);
    } finally {
      button.remove();
      range.remove();
      wrapper.remove();
    }
  });

  it('hydrates open overlay instance data from latest instances map without reopening', () => {
    const pokemon = makePokemon({
      instanceData: {
        instance_id: 'instance-1',
        original_trainer_name: null,
      },
    });

    const { rerender } = render(
      <InstanceOverlay
        pokemon={pokemon}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="caught"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );

    expect(screen.getByTestId('caught-instance')).toHaveTextContent('none');

    const latestInstances = {
      'instance-1': {
        instance_id: 'instance-1',
        original_trainer_name: 'PokePete35',
      },
    } as unknown as React.ComponentProps<typeof InstanceOverlay>['instances'];

    rerender(
      <InstanceOverlay
        pokemon={pokemon}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="caught"
        lists={{}}
        instances={latestInstances}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
      />,
    );

    expect(screen.getByTestId('caught-instance')).toHaveTextContent('PokePete35');
  });

  it('shows only next arrow on first pokemon and navigates forward on arrow click', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="caught"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Previous Pokemon' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Pokemon' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next Pokemon' }));
    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
  });

  it('shows trade navigation arrows and navigates forward on arrow click', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Previous Pokemon' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Pokemon' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next Pokemon' }));
    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
    expect(screen.getByTestId('trade-details')).toBeInTheDocument();
  });

  it('navigates forward when swiping left on caught overlay', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="caught"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    const overlay = document.querySelector('.instance-overlay') as HTMLElement | null;
    expect(overlay).not.toBeNull();

    fireEvent.mouseDown(overlay as HTMLElement, {
      button: 0,
      clientX: 260,
      clientY: 220,
    });
    fireEvent.mouseMove(overlay as HTMLElement, {
      clientX: 190,
      clientY: 222,
    });
    fireEvent.mouseUp(overlay as HTMLElement, {
      clientX: 120,
      clientY: 218,
    });

    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
  });

  it('navigates forward when swiping left on trade overlay', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    const overlay = document.querySelector('.instance-overlay') as HTMLElement | null;
    expect(overlay).not.toBeNull();

    fireEvent.mouseDown(overlay as HTMLElement, {
      button: 0,
      clientX: 260,
      clientY: 220,
    });
    fireEvent.mouseMove(overlay as HTMLElement, {
      clientX: 190,
      clientY: 222,
    });
    fireEvent.mouseUp(overlay as HTMLElement, {
      clientX: 120,
      clientY: 218,
    });

    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
    expect(screen.getByTestId('trade-details')).toBeInTheDocument();
  });

  it('navigates forward when swiping left from the trade details window', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    const tradeDetailsWindow = document.querySelector('.trade-details-window') as HTMLElement | null;
    expect(tradeDetailsWindow).not.toBeNull();

    fireEvent.mouseDown(tradeDetailsWindow as HTMLElement, {
      button: 0,
      clientX: 260,
      clientY: 220,
    });
    fireEvent.mouseMove(tradeDetailsWindow as HTMLElement, {
      clientX: 180,
      clientY: 224,
    });
    fireEvent.mouseUp(tradeDetailsWindow as HTMLElement, {
      clientX: 120,
      clientY: 224,
    });

    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
  });

  it('locks trade overlay into horizontal swipe mode during a horizontal drag', () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } })]}
      />,
    );

    const overlay = document.querySelector('.instance-overlay') as HTMLElement | null;
    expect(overlay).not.toBeNull();

    fireEvent.mouseDown(overlay as HTMLElement, {
      button: 0,
      clientX: 260,
      clientY: 220,
    });
    fireEvent.mouseMove(overlay as HTMLElement, {
      clientX: 208,
      clientY: 228,
    });

    expect(overlay).toHaveClass('is-horizontal-swiping');

    fireEvent.mouseUp(overlay as HTMLElement, {
      clientX: 208,
      clientY: 228,
    });

    expect(overlay).not.toHaveClass('is-horizontal-swiping');
  });

  it('navigates trade after axis locks horizontal even with extra vertical drift', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    const tradeDetailsWindow = document.querySelector('.trade-details-window') as HTMLElement | null;
    expect(tradeDetailsWindow).not.toBeNull();

    fireEvent.mouseDown(tradeDetailsWindow as HTMLElement, {
      button: 0,
      clientX: 300,
      clientY: 220,
    });
    fireEvent.mouseMove(tradeDetailsWindow as HTMLElement, {
      clientX: 238,
      clientY: 258,
    });
    fireEvent.mouseUp(tradeDetailsWindow as HTMLElement, {
      clientX: 228,
      clientY: 286,
    });

    await waitFor(() => expect(onNavigatePokemon).toHaveBeenCalledWith(p2));
  });

  it('does not navigate trade when a drag resolves as vertical scrolling', async () => {
    const p1 = makePokemon({ variant_id: '0001-default', instanceData: { instance_id: 'i-1' } });
    const p2 = makePokemon({ variant_id: '0002-default', instanceData: { instance_id: 'i-2' } });
    const onNavigatePokemon = vi.fn();

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="trade"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
        onNavigatePokemon={onNavigatePokemon}
      />,
    );

    const tradeDetailsWindow = document.querySelector('.trade-details-window') as HTMLElement | null;
    expect(tradeDetailsWindow).not.toBeNull();

    fireEvent.mouseDown(tradeDetailsWindow as HTMLElement, {
      button: 0,
      clientX: 300,
      clientY: 220,
    });
    fireEvent.mouseMove(tradeDetailsWindow as HTMLElement, {
      clientX: 294,
      clientY: 260,
    });
    fireEvent.mouseUp(tradeDetailsWindow as HTMLElement, {
      clientX: 230,
      clientY: 330,
    });

    await waitFor(() => expect(onNavigatePokemon).not.toHaveBeenCalled());
  });

  it('remounts caught instance state when navigating to a different pokemon', async () => {
    const p1 = makePokemon({
      variant_id: '0001-default',
      instanceData: {
        instance_id: 'i-1',
        original_trainer_name: 'TrainerOne',
      },
    });
    const p2 = makePokemon({
      variant_id: '0002-default',
      instanceData: {
        instance_id: 'i-2',
        original_trainer_name: 'TrainerTwo',
      },
    });

    render(
      <InstanceOverlay
        pokemon={p1}
        onClose={vi.fn()}
        variants={[]}
        tagFilter="caught"
        lists={{}}
        instances={{}}
        sortType="name"
        sortMode="ascending"
        isEditable={false}
        username="ash"
        navigationPokemons={[p1, p2]}
      />,
    );

    expect(screen.getByTestId('caught-instance')).toHaveTextContent('TrainerOne');

    fireEvent.click(screen.getByRole('button', { name: 'Next Pokemon' }));

    await waitFor(() =>
      expect(screen.getByTestId('caught-instance')).toHaveTextContent('TrainerTwo'),
    );
    expect(screen.getByTestId('caught-instance')).not.toHaveTextContent('TrainerOne');
  });
});
