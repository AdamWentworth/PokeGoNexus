import React, { useEffect, useMemo, useRef } from 'react';
import { FaCheckCircle, FaSearch } from 'react-icons/fa';
import './ListView.base.css';
import CaughtListView from './ListViewComponents/CaughtListView';
import TradeListView from './ListViewComponents/TradeListView';
import WantedListView from './ListViewComponents/WantedListView';
import { findVariantForInstance } from '../utils/findVariantForInstance';
import { normalizeOwnershipMode } from '../utils/ownershipMode';
import { RenderProfiler } from '@/components/dev/RenderProfiler';

import type { PokemonVariant } from '@/types/pokemonVariants';

type ListViewItem = Record<string, unknown>;

type ListViewProps = {
  data: ListViewItem[];
  instanceData: 'caught' | 'trade' | 'wanted' | string;
  hasSearched: boolean;
  pokemonCache: PokemonVariant[] | null;
  scrollToTopTrigger: number;
};

const ListView: React.FC<ListViewProps> = ({
  data,
  instanceData,
  hasSearched,
  pokemonCache,
  scrollToTopTrigger,
}) => {
  const ownershipMode = normalizeOwnershipMode(instanceData as Parameters<
    typeof normalizeOwnershipMode
  >[0]);
  const listViewRef = useRef<HTMLDivElement | null>(null);
  const pokemonVariants = useMemo<PokemonVariant[]>(
    () => pokemonCache ?? [],
    [pokemonCache],
  );

  useEffect(() => {
    if (listViewRef.current && typeof listViewRef.current.scrollTo === 'function') {
      listViewRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, [scrollToTopTrigger]);

  const findPokemonByKey = (
    keyOrInstanceId?: string | null,
    instanceLike?: Parameters<typeof findVariantForInstance>[2],
  ) => findVariantForInstance(pokemonVariants, keyOrInstanceId, instanceLike);

  if (!hasSearched && data.length === 0) {
    return (
      <div className="no-data-container">
        <span className="no-data-container__icon" aria-hidden="true">
          <FaSearch />
        </span>
        <span>Community listings</span>
        <h2>Find your next Pokémon</h2>
        <p>Choose a Pokémon and listing type above to discover nearby trainers.</p>
      </div>
    );
  }

  if (hasSearched && data.length === 0) {
    return (
      <div className="no-data-container">
        <span className="no-data-container__icon" aria-hidden="true">
          <FaSearch />
        </span>
        <span>No matches yet</span>
        <h2>No listings fit these filters</h2>
        <p>Try a larger distance, fewer variant details, or another listing type.</p>
      </div>
    );
  }

  const resultTypeLabel =
    ownershipMode === 'trade'
      ? 'For Trade listings'
      : ownershipMode === 'wanted'
        ? 'Wanted listings'
        : 'Caught Pokémon';

  return (
    <section aria-label="Pokémon search results" className="search-results-region">
      <header className="search-results-heading">
        <div>
          <span className="search-results-heading__complete">
            <FaCheckCircle aria-hidden="true" />
            Search complete
          </span>
          <h2>{resultTypeLabel}</h2>
        </div>
        <strong>
          {data.length} {data.length === 1 ? 'result' : 'results'}
        </strong>
      </header>

      <div className="list-view-container" ref={listViewRef}>
        {data.map((item, index) => {
          const instanceId =
            typeof item.instance_id === 'string' && item.instance_id
              ? item.instance_id
              : `${ownershipMode}-${index}`;
          if (ownershipMode === 'caught') {
            return (
              <RenderProfiler key={instanceId} id="Search.CaughtListRow">
                <CaughtListView item={item} />
              </RenderProfiler>
            );
          }
          if (ownershipMode === 'trade') {
            return (
              <RenderProfiler key={instanceId} id="Search.TradeListRow">
                <TradeListView item={item} findPokemonByKey={findPokemonByKey} />
              </RenderProfiler>
            );
          }
          if (ownershipMode === 'wanted') {
            return (
              <RenderProfiler key={instanceId} id="Search.WantedListRow">
                <WantedListView item={item} findPokemonByKey={findPokemonByKey} />
              </RenderProfiler>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
};

export default React.memo(ListView);
