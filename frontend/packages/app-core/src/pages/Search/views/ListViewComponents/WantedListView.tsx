import React, { useMemo } from 'react';
import CP from '@/components/pokemonComponents/CP';
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
import {
  formatWantedDate,
  getWantedTradeEntries,
  hasWantedAdditionalDetails,
  type MatchedPokemon,
  type WantedListItem,
} from './wantedListViewHelpers';

type WantedListViewProps = {
  item: WantedListItem;
  findPokemonByKey: (
    keyOrInstanceId?: string | null,
    instanceLike?: Record<string, unknown> | null,
  ) => MatchedPokemon | null;
};

const WantedListView: React.FC<WantedListViewProps> = ({ item, findPokemonByKey }) => {
  const tradeEntries = useMemo<LinkedPokemonGridEntry[]>(() => {
    return getWantedTradeEntries(item.trade_list).reduce<LinkedPokemonGridEntry[]>(
      (gridEntries, [tradeInstanceId, tradeListPokemon]) => {
        const matchedPokemon = findPokemonByKey(tradeInstanceId, tradeListPokemon);
        if (!matchedPokemon) return gridEntries;
        gridEntries.push({
          id: tradeInstanceId,
          currentImage: matchedPokemon.currentImage,
          name: matchedPokemon.name,
          form: matchedPokemon.form,
          dynamax: tradeListPokemon.dynamax,
          gigantamax: tradeListPokemon.gigantamax,
          match: tradeListPokemon.match,
        });
        return gridEntries;
      },
      [],
    );
  }, [findPokemonByKey, item.trade_list]);
  const imageUrl = URLSelect(
    item.pokemonInfo as Parameters<typeof URLSelect>[0],
    item as Parameters<typeof URLSelect>[1],
  );
  const pokemonDisplayName = item.pokemonInfo
    ? getPokemonDisplayName(item as Parameters<typeof getPokemonDisplayName>[0])
    : 'Unknown Pokemon';
  const onCPChange = () => {};
  const genderValue = toPokemonResultGender(item.gender);
  const hasAdditionalDetails = hasWantedAdditionalDetails(item);

  return (
    <SearchResultRow
      className="wanted-list-view"
      username={item.username}
      instanceId={item.instance_id}
      distance={item.distance}
      navigationInstanceData="Wanted"
      pokemonDisplayName={pokemonDisplayName}
      rightColumn={
        tradeEntries.length > 0 ? (
          <LinkedPokemonGrid
            title="Trainer can offer"
            sectionClassName="trade-list-section"
            gridClassName="trade-list"
            containerClassName="trade-pokemon-container"
            imageClassName="trade-pokemon-image"
            entries={tradeEntries}
          />
        ) : undefined
      }
    >
      <div className="card search-result-listing-summary">
        <PokemonResultVisual
          imageUrl={imageUrl}
          pokemonDisplayName={pokemonDisplayName}
          genderValue={genderValue}
          lucky={item.pref_lucky}
          dynamax={item.dynamax}
          gigantamax={item.gigantamax}
          wrapLuckyBackdrop
          beforeImage={
            typeof item.cp === 'number' && item.cp > 0 ? (
              <CP cp={item.cp} editMode={false} onCPChange={onCPChange} />
            ) : null
          }
        />

        {hasAdditionalDetails ? (
          <details className="search-result-details-disclosure">
            <summary>Wanted conditions</summary>
            <PokemonResultDetails
              friendshipLevel={item.friendship_level}
              prefLucky={Boolean(item.pref_lucky)}
              weight={item.weight}
              height={item.height}
              wantedSizePreferences={item.wanted_size_preferences}
              fastMoveId={item.fast_move_id}
              chargedMove1Id={item.charged_move1_id}
              chargedMove2Id={item.charged_move2_id}
              moves={item.pokemonInfo?.moves}
              locationCaught={item.location_caught}
              dateCaught={item.date_caught}
              formatDate={formatWantedDate}
            />
          </details>
        ) : null}
      </div>
    </SearchResultRow>
  );
};

export default React.memo(WantedListView);
