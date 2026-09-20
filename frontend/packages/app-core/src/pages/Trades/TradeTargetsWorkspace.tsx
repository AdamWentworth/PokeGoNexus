import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { useSearchParams } from 'react-router';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useModal } from '@/contexts/ModalContext';
import PokemonLocationBackground from '@/features/pokemonDisplay/PokemonLocationBackground';
import { getFilteredPokemonsByOwnership } from '@/hooks/filtering/usePokemonOwnershipFilter';
import TradeTargetsPanel from '@/pages/Pokemon/features/instances/components/Trade/TradeTargetsPanel';
import WantedDetails from '@/pages/Pokemon/features/instances/components/Wanted/WantedDetails';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

import './TradeTargetsWorkspace.css';

type TargetMode = 'trade' | 'wanted';
type TargetPokemon = PokemonVariant & { instanceData: PokemonInstance };
type BooleanMap = Record<string, boolean>;
type MaxKind = 'dynamax' | 'gigantamax' | null;

const getInstanceId = (pokemon: TargetPokemon): string =>
  String(pokemon.instanceData.instance_id ?? '');

const getMaxKind = (pokemon: TargetPokemon): MaxKind => {
  const variantType = Array.isArray(pokemon.variantType)
    ? pokemon.variantType.join(' ')
    : String(pokemon.variantType ?? '');
  if (pokemon.instanceData.gigantamax || variantType.includes('gigantamax')) {
    return 'gigantamax';
  }
  if (pokemon.instanceData.dynamax || variantType.includes('dynamax')) {
    return 'dynamax';
  }
  return null;
};

const TradePreferencePokemonImage = ({
  pokemon,
  className = '',
}: {
  pokemon: TargetPokemon;
  className?: string;
}) => {
  const maxKind = getMaxKind(pokemon);
  return (
    <span className={`trade-preference-pokemon-image ${className}`.trim()}>
      <PokemonLocationBackground pokemon={pokemon} />
      {pokemon.currentImage ? (
        <img
          src={pokemon.currentImage}
          alt=""
          className="trade-preference-pokemon-sprite"
        />
      ) : null}
      {maxKind ? (
        <img
          src={`/images/${maxKind}.png`}
          alt={maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          className="trade-preference-max-badge"
        />
      ) : null}
    </span>
  );
};

const sortByPokedexNumber = (pokemon: TargetPokemon[]): TargetPokemon[] =>
  [...pokemon].sort((left, right) =>
    left.pokedex_number - right.pokedex_number ||
    left.name.localeCompare(right.name) ||
    left.variant_id.localeCompare(right.variant_id) ||
    getInstanceId(left).localeCompare(getInstanceId(right)));

const toBooleanMap = (value: Record<string, unknown> | null | undefined): BooleanMap =>
  Object.fromEntries(
    Object.entries(value ?? {}).filter((entry): entry is [string, boolean] =>
      typeof entry[1] === 'boolean'),
  );

const toTradeTargetsPokemon = (
  pokemon: TargetPokemon,
): ComponentProps<typeof TradeTargetsPanel>['pokemon'] => ({
  ...pokemon,
  instanceData: {
    ...pokemon.instanceData,
    not_wanted_list: toBooleanMap(pokemon.instanceData.not_wanted_list),
    wanted_filters: toBooleanMap(pokemon.instanceData.wanted_filters),
  },
});

const toWantedDetailsPokemon = (
  pokemon: TargetPokemon,
): ComponentProps<typeof WantedDetails>['pokemon'] => ({
  ...pokemon,
  instanceData: {
    ...pokemon.instanceData,
    not_trade_list: toBooleanMap(pokemon.instanceData.not_trade_list),
    trade_filters: toBooleanMap(pokemon.instanceData.trade_filters),
  },
});

const normalizeLinkedPokemon = (
  value: Record<string, unknown>,
): TargetPokemon | null => {
  const instanceData = (
    value.instanceData && typeof value.instanceData === 'object'
      ? value.instanceData
      : value.ownershipStatus
  );
  if (!instanceData || typeof instanceData !== 'object') return null;
  const instance = instanceData as PokemonInstance;
  if (!instance.instance_id) return null;
  return {
    ...(value as unknown as PokemonVariant),
    instanceData: instance,
  };
};

function TradeTargetsWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instances = useInstancesStore((state) => state.instances);
  const tags = useTagsStore((state) => state.tags);
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);
  const requestedMode: TargetMode =
    searchParams.get('mode') === 'wanted' ? 'wanted' : 'trade';
  const requestedInstanceId = searchParams.get('instance');
  const [mode, setMode] = useState<TargetMode>(requestedMode);
  const [selectedPokemon, setSelectedPokemon] = useState<TargetPokemon | null>(null);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const { confirm } = useModal();

  const tradePokemon = useMemo(
    () => sortByPokedexNumber(
      getFilteredPokemonsByOwnership(
        variants,
        instances,
        'trade',
        tags,
      ) as TargetPokemon[],
    ),
    [instances, tags, variants],
  );
  const wantedPokemon = useMemo(
    () => sortByPokedexNumber(
      getFilteredPokemonsByOwnership(
        variants,
        instances,
        'wanted',
        tags,
      ) as TargetPokemon[],
    ),
    [instances, tags, variants],
  );
  const visiblePokemon = mode === 'trade' ? tradePokemon : wantedPokemon;
  const pickerPokemon = pickerQuery.trim()
    ? visiblePokemon.filter((pokemon) =>
        `${pokemon.name} ${pokemon.instanceData.nickname ?? ''} ${pokemon.pokedex_number}`
          .toLocaleLowerCase()
          .includes(pickerQuery.trim().toLocaleLowerCase()))
    : visiblePokemon;

  useEffect(() => {
    setMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    setSelectedPokemon((current) => {
      if (requestedInstanceId) {
        const requested = visiblePokemon.find(
          (pokemon) => getInstanceId(pokemon) === requestedInstanceId,
        );
        if (requested) return requested;
      }
      if (current) {
        const currentId = getInstanceId(current);
        const refreshed = visiblePokemon.find(
          (pokemon) => getInstanceId(pokemon) === currentId,
        );
        if (refreshed) return refreshed;
      }
      return visiblePokemon[0] ?? null;
    });
  }, [requestedInstanceId, visiblePokemon]);

  const updatePreferenceLocation = (
    nextMode: TargetMode,
    instanceId?: string,
  ) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('section', 'preferences');
        next.set('mode', nextMode);
        if (instanceId) next.set('instance', instanceId);
        else next.delete('instance');
        return next;
      },
      { replace: true },
    );
  };

  const openLinkedPokemon = (
    nextMode: TargetMode,
    value: Record<string, unknown>,
  ) => {
    const normalized = normalizeLinkedPokemon(value);
    if (!normalized) return;
    setMode(nextMode);
    updatePreferenceLocation(nextMode);
    setSelectedPokemon(normalized);
    setMobilePickerOpen(false);
    setPickerQuery('');
  };

  const canLeaveDraft = async (): Promise<boolean> => {
    if (!isEditingPreferences) return true;
    return confirm('Discard your unsaved trade preference changes?');
  };

  const changeMode = async (nextMode: TargetMode) => {
    if (nextMode === mode || !(await canLeaveDraft())) return;
    setIsEditingPreferences(false);
    setMode(nextMode);
    setMobilePickerOpen(false);
    setPickerQuery('');
  };

  const choosePokemon = async (pokemon: TargetPokemon) => {
    if (
      (selectedPokemon &&
        getInstanceId(pokemon) === getInstanceId(selectedPokemon))
      || !(await canLeaveDraft())
    ) return;
    setIsEditingPreferences(false);
    setSelectedPokemon(pokemon);
    updatePreferenceLocation(mode, getInstanceId(pokemon));
    setMobilePickerOpen(false);
    setPickerQuery('');
  };

  useEffect(() => {
    if (!isEditingPreferences) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditingPreferences]);

  if (variantsLoading) {
    return <p className="trade-targets-state">Loading your trade preferences…</p>;
  }

  return (
    <section
      className={`trade-targets-workspace preference-mode-${mode}`}
    >
      <header className="trade-targets-heading">
        <div>
          <h1 id="trade-preferences-heading">Trade Preferences</h1>
          <p>Choose acceptable matches for each For Trade and Wanted Pokémon.</p>
        </div>
        <div className="trade-target-mode" aria-label="Target list type">
          <button
            type="button"
            className={mode === 'trade' ? 'active' : ''}
            onClick={() => changeMode('trade')}
          >
            For Trade ({tradePokemon.length})
          </button>
          <button
            type="button"
            className={mode === 'wanted' ? 'active' : ''}
            onClick={() => changeMode('wanted')}
          >
            Wanted ({wantedPokemon.length})
          </button>
        </div>
      </header>

      {visiblePokemon.length === 0 ? (
        <p className="trade-targets-state">
          {mode === 'trade'
            ? 'Mark a Pokémon as For Trade to choose its Wanted Pokémon here.'
            : 'Add a Wanted Pokémon to choose its eligible For Trade Pokémon here.'}
        </p>
      ) : (
        <div className="trade-targets-layout">
          {selectedPokemon ? (
            <button
              type="button"
              className="trade-target-mobile-picker"
              aria-expanded={mobilePickerOpen}
              aria-controls="trade-target-entry-picker"
              onClick={() => {
                setMobilePickerOpen((open) => !open);
                setPickerQuery('');
              }}
            >
              <span className="trade-target-mobile-picker__pokemon">
                <TradePreferencePokemonImage pokemon={selectedPokemon} />
                <span>
                  <strong>{selectedPokemon.name}</strong>
                  <small>
                    #{String(selectedPokemon.pokedex_number).padStart(4, '0')}
                    {selectedPokemon.instanceData.nickname
                      ? ` · ${selectedPokemon.instanceData.nickname}`
                      : ''}
                  </small>
                </span>
              </span>
              <span className="trade-target-mobile-picker__action">
                {mobilePickerOpen ? 'Close' : 'Change'}
              </span>
            </button>
          ) : null}

          <nav
            id="trade-target-entry-picker"
            className={`trade-target-entry-list ${mobilePickerOpen ? 'is-open' : ''}`}
            aria-label={`${mode} Pokémon`}
          >
            <div className="trade-target-mobile-picker-panel">
              <div>
                <strong>
                  Choose {mode === 'trade' ? 'For Trade' : 'Wanted'} Pokémon
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    setMobilePickerOpen(false);
                    setPickerQuery('');
                  }}
                >
                  Close
                </button>
              </div>
              <input
                type="search"
                aria-label={`Search ${mode} Pokémon`}
                placeholder="Search by name, nickname, or number"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
              />
            </div>
            {pickerPokemon.map((pokemon) => {
              const instanceId = getInstanceId(pokemon);
              return (
                <button
                  type="button"
                  key={instanceId}
                  className={
                    selectedPokemon && getInstanceId(selectedPokemon) === instanceId
                      ? 'active'
                      : ''
                  }
                  onClick={() => choosePokemon(pokemon)}
                >
                  <TradePreferencePokemonImage pokemon={pokemon} />
                  <span>
                    <strong>{pokemon.name}</strong>
                    <small>
                      #{String(pokemon.pokedex_number).padStart(4, '0')}
                      {pokemon.instanceData.nickname
                        ? ` · ${pokemon.instanceData.nickname}`
                        : ''}
                    </small>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="trade-target-editor">
            {selectedPokemon ? (
              <div className="trade-target-selection-summary">
                <TradePreferencePokemonImage
                  pokemon={selectedPokemon}
                  className="trade-target-selection-summary__image"
                />
                <div>
                  <span>{mode === 'trade' ? 'Trading away' : 'Looking for'}</span>
                  <h2>{selectedPokemon.name}</h2>
                  <p>
                    #{String(selectedPokemon.pokedex_number).padStart(4, '0')}
                    {selectedPokemon.instanceData.nickname
                      ? ` · ${selectedPokemon.instanceData.nickname}`
                      : ''}
                  </p>
                </div>
              </div>
            ) : null}
            {selectedPokemon && mode === 'trade' ? (
              <TradeTargetsPanel
                key={`trade:${getInstanceId(selectedPokemon)}`}
                pokemon={toTradeTargetsPokemon(selectedPokemon)}
                lists={tags}
                instances={instances}
                sortType="number"
                sortMode="ascending"
                openTradeTargetOverlay={(pokemon) => openLinkedPokemon('wanted', pokemon)}
                variants={variants}
                isEditable
                onEditingChange={setIsEditingPreferences}
              />
            ) : null}
            {selectedPokemon && mode === 'wanted' ? (
              <WantedDetails
                key={`wanted:${getInstanceId(selectedPokemon)}`}
                pokemon={toWantedDetailsPokemon(selectedPokemon)}
                lists={tags}
                instances={instances}
                sortType="number"
                sortMode="ascending"
                openTradeOverlay={(pokemon) => openLinkedPokemon('trade', pokemon)}
                variants={variants}
                isEditable
                onEditingChange={setIsEditingPreferences}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default TradeTargetsWorkspace;
