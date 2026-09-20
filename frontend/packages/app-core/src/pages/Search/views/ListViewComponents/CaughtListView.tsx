import React from 'react';
import CP from '../../../../components/pokemonComponents/CP';
import IV from '../../../../components/pokemonComponents/IV';
import MoveDisplay from '../../../../components/pokemonComponents/MoveDisplay';
import { URLSelect } from '../../utils/URLSelect';
import getPokemonDisplayName from '../../utils/getPokemonDisplayName';
import PokemonResultVisual, {
  toPokemonResultGender,
} from './PokemonResultVisual';
import SearchResultRow from './SearchResultRow';
import { formatDateOnlySafe } from './wantedListViewHelpers';

type CaughtListItem = {
  username?: string;
  instance_id?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  cp?: number;
  lucky?: boolean;
  dynamax?: boolean;
  gigantamax?: boolean;
  gender?: string;
  weight?: number;
  height?: number;
  fast_move_id?: number | null;
  charged_move1_id?: number | null;
  charged_move2_id?: number | null;
  attack_iv?: number | null;
  defense_iv?: number | null;
  stamina_iv?: number | null;
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
  [key: string]: unknown;
};

type CaughtListViewProps = {
  item: CaughtListItem;
};

const CaughtListView: React.FC<CaughtListViewProps> = ({ item }) => {
  const imageUrl = URLSelect(
    item.pokemonInfo as Parameters<typeof URLSelect>[0],
    item as Parameters<typeof URLSelect>[1],
  );
  const pokemonDisplayName = item.pokemonInfo
    ? getPokemonDisplayName(item as Parameters<typeof getPokemonDisplayName>[0])
    : 'Unknown Pokemon';
  const onCPChange = () => {};
  const onIvChange = () => {};
  const genderValue = toPokemonResultGender(item.gender);

  return (
    <SearchResultRow
      username={item.username}
      instanceId={item.instance_id}
      distance={item.distance}
      navigationInstanceData="Caught"
      pokemonDisplayName={pokemonDisplayName}
    >
      <div className="card search-result-listing-summary">
        {item.pokemonInfo && (
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
        )}

        <details className="search-result-details-disclosure">
          <summary>Pokémon details</summary>
          <div className="search-result-caught-details">
            <div className="weight-height-move-container">
              {typeof item.weight === 'number' && item.weight > 0 && (
                <div className="weight-height">
                  <strong>{item.weight} kg</strong>
                  <span>Weight</span>
                </div>
              )}
              {typeof item.height === 'number' && item.height > 0 && (
                <div className="weight-height">
                  <strong>{item.height} m</strong>
                  <span>Height</span>
                </div>
              )}
            </div>

            <MoveDisplay
              fastMoveId={item.fast_move_id ?? null}
              chargedMove1Id={item.charged_move1_id ?? null}
              chargedMove2Id={item.charged_move2_id ?? null}
              moves={item.pokemonInfo?.moves}
            />

            <IV
              ivs={{
                Attack: item.attack_iv ?? null,
                Defense: item.defense_iv ?? null,
                Stamina: item.stamina_iv ?? null,
              }}
              onIvChange={onIvChange}
            />

            {(item.location_caught || item.date_caught) && (
              <dl className="search-result-metadata">
                {item.location_caught ? (
                  <div>
                    <dt>Caught in</dt>
                    <dd>{item.location_caught}</dd>
                  </div>
                ) : null}
                {item.date_caught ? (
                  <div>
                    <dt>Caught on</dt>
                    <dd>{formatDateOnlySafe(item.date_caught, 'Unknown')}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </div>
        </details>
      </div>
    </SearchResultRow>
  );
};

export default React.memo(CaughtListView);
