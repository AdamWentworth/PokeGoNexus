import React, { useMemo } from 'react';
import CP from '../../../../components/pokemonComponents/CP';
import { URLSelect } from '../../utils/URLSelect';
import getPokemonDisplayName from '../../utils/getPokemonDisplayName';
import LinkedPokemonGrid, {
  type LinkedPokemonGridEntry,
} from './LinkedPokemonGrid';
import PokemonResultVisual, {
  toPokemonResultGender,
} from './PokemonResultVisual';
import PokemonResultDetails from './PokemonResultDetails';
import SearchResultRow from './SearchResultRow';
import { formatDateOnlySafe } from './wantedListViewHelpers';

type TradeListWantedEntry = {
  dynamax?: boolean;
  gigantamax?: boolean;
  match?: boolean;
  form?: string;
  name?: string;
  [key: string]: unknown;
};

type TradeListItem = {
  username?: string;
  instance_id?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  cp?: number | null;
  lucky?: boolean;
  dynamax?: boolean;
  gigantamax?: boolean;
  gender?: string;
  weight?: number | null;
  height?: number | null;
  fast_move_id?: number | null;
  charged_move1_id?: number | null;
  charged_move2_id?: number | null;
  location_caught?: string;
  date_caught?: string;
  pokemonInfo?: {
    name?: string;
    moves?: Array<{
      move_id: number;
      name: string;
      type: string;
      type_name: string;
      legacy?: boolean;
    }> | null;
    [key: string]: unknown;
  };
  wanted_list?: Record<string, TradeListWantedEntry> | null;
  [key: string]: unknown;
};

type MatchedPokemon = {
  currentImage?: string;
  name?: string;
  form?: string | null;
};

type TradeListViewProps = {
  item: TradeListItem;
  findPokemonByKey: (
    keyOrInstanceId?: string | null,
    instanceLike?: Record<string, unknown> | null,
  ) => MatchedPokemon | null;
};

const TradeListView: React.FC<TradeListViewProps> = ({ item, findPokemonByKey }) => {
  const imageUrl = URLSelect(
    item.pokemonInfo as Parameters<typeof URLSelect>[0],
    item as Parameters<typeof URLSelect>[1],
  );
  const pokemonDisplayName = item.pokemonInfo
    ? getPokemonDisplayName(item as Parameters<typeof getPokemonDisplayName>[0])
    : 'Unknown Pokemon';
  const onCPChange = () => {};
  const genderValue = toPokemonResultGender(item.gender);

  const hasAdditionalDetails = Boolean(
    item.weight ||
    item.height ||
    item.fast_move_id ||
    item.charged_move1_id ||
    item.charged_move2_id ||
    item.location_caught ||
    item.date_caught,
  );

  const wantedEntries = useMemo<LinkedPokemonGridEntry[]>(() => {
    return Object.entries(item.wanted_list ?? {}).reduce<LinkedPokemonGridEntry[]>(
      (entries, [wantedInstanceId, wantedListPokemon]) => {
        if (!wantedListPokemon) return entries;
        const matchedPokemon = findPokemonByKey(wantedInstanceId, wantedListPokemon);
        if (!matchedPokemon) return entries;
        entries.push({
          id: wantedInstanceId,
          currentImage: matchedPokemon.currentImage,
          name: matchedPokemon.name,
          form: matchedPokemon.form,
          dynamax: wantedListPokemon.dynamax,
          gigantamax: wantedListPokemon.gigantamax,
          match: wantedListPokemon.match,
        });
        return entries;
      },
      [],
    );
  }, [findPokemonByKey, item.wanted_list]);

  return (
    <SearchResultRow
      className="trade-list-view"
      username={item.username}
      instanceId={item.instance_id}
      distance={item.distance}
      navigationInstanceData="Trade"
      pokemonDisplayName={pokemonDisplayName}
      rightColumn={
        wantedEntries.length > 0 ? (
          <LinkedPokemonGrid
            title="Trainer wants"
            sectionClassName="wanted-list-section"
            gridClassName="wanted-list"
            containerClassName="wanted-pokemon-container"
            imageClassName="wanted-pokemon-image"
            entries={wantedEntries}
          />
        ) : undefined
      }
    >
      <div className="card search-result-listing-summary">
        <PokemonResultVisual
          imageUrl={imageUrl}
          pokemonDisplayName={pokemonDisplayName}
          genderValue={genderValue}
          lucky={item.lucky}
          dynamax={item.dynamax}
          gigantamax={item.gigantamax}
          beforeImage={
            typeof item.cp === 'number' && item.cp > 0 ? (
              <CP cp={item.cp} editMode={false} onCPChange={onCPChange} />
            ) : null
          }
        />

        {hasAdditionalDetails ? (
          <details className="search-result-details-disclosure">
            <summary>Listing details</summary>
            <PokemonResultDetails
              weight={item.weight}
              height={item.height}
              fastMoveId={item.fast_move_id}
              chargedMove1Id={item.charged_move1_id}
              chargedMove2Id={item.charged_move2_id}
              moves={item.pokemonInfo?.moves}
              locationCaught={item.location_caught}
              dateCaught={item.date_caught}
              formatDate={formatDateOnlySafe}
            />
          </details>
        ) : null}
      </div>
    </SearchResultRow>
  );
};

export default React.memo(TradeListView);
