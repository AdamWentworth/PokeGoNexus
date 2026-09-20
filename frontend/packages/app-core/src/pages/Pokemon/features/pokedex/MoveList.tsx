// MoveList.tsx

import React from 'react';
import './MoveList.css';

// Types
import type { Move } from '@/types/pokemonSubTypes';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { buildPokemonMoveTypeIconPath } from '@pokemongonexus/shared-domain/moves';

export interface MoveListProps {
  moves: Move[];
  pokemon: PokemonVariant;
}

const getTypeIconPath = buildPokemonMoveTypeIconPath;

const formatMoveName = (name?: string | null, isLegacy?: boolean): React.ReactNode => {
  const safeName = String(name ?? '').trim() || 'Unknown Move';
  return isLegacy ? <strong>{safeName}*</strong> : safeName;
};

const MoveList: React.FC<MoveListProps> = ({ moves, pokemon }) => {
  // Determine fusionId from variantType if this is a fusion variant
  const fusionId: number | null =
    pokemon.variantType?.startsWith('fusion_')
      ? parseInt(pokemon.variantType.split('fusion_')[1], 10)
      : null;

  // Filter moves: if move.fusion_id is defined, only include if it matches fusionId
  const filteredMoves = moves.filter(move =>
    typeof move.fusion_id === 'number' ? move.fusion_id === fusionId : true
  );

  const fastAttacks = filteredMoves.filter(move => move.is_fast === 1);
  const chargedAttacks = filteredMoves.filter(move => move.is_fast === 0);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  return (
    <div className="column moves-column" onClick={handleClick}>
      <h1>Moves</h1>

      {fastAttacks.length > 0 && (
        <>
          <h2>Fast Attacks</h2>
          <table className="moves-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>PvP</th>
                <th>Raid</th>
              </tr>
            </thead>
            <tbody>
              {fastAttacks.map(move => (
                <tr key={`fast-${move.move_id}`}>
                  <td>
                    <img
                      className="type-icon"
                      src={getTypeIconPath(move.type_name ?? move.type)}
                      alt={`${move.type_name ?? move.type ?? 'Unknown'} type`}
                    />
                  </td>
                  <td>{formatMoveName(move.name, move.legacy)}</td>
                  <td>{move.pvp_power}</td>
                  <td>{move.raid_power}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {chargedAttacks.length > 0 && (
        <>
          <h2>Charged Attacks</h2>
          <table className="moves-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>PvP</th>
                <th>Raid</th>
              </tr>
            </thead>
            <tbody>
              {chargedAttacks.map(move => (
                <tr key={`charged-${move.move_id}`}>
                  <td>
                    <img
                      className="type-icon"
                      src={getTypeIconPath(move.type_name ?? move.type)}
                      alt={`${move.type_name ?? move.type ?? 'Unknown'} type`}
                    />
                  </td>
                  <td>{formatMoveName(move.name, move.legacy)}</td>
                  <td>{move.pvp_power}</td>
                  <td>{move.raid_power}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default React.memo(MoveList);
