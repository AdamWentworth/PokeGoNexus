import type { Move } from "../../../types/pokemonSubTypes";

export const HIDDEN_POWER_TYPES = [
  { name: "bug", typeId: 1 },
  { name: "dark", typeId: 2 },
  { name: "dragon", typeId: 3 },
  { name: "electric", typeId: 4 },
  { name: "fighting", typeId: 6 },
  { name: "fire", typeId: 7 },
  { name: "flying", typeId: 8 },
  { name: "ghost", typeId: 9 },
  { name: "grass", typeId: 10 },
  { name: "ground", typeId: 11 },
  { name: "ice", typeId: 12 },
  { name: "poison", typeId: 14 },
  { name: "psychic", typeId: 15 },
  { name: "rock", typeId: 16 },
  { name: "steel", typeId: 17 },
  { name: "water", typeId: 18 },
] as const;

const isBaseHiddenPower = (move: Move): boolean =>
  move.name.trim().toLowerCase() === "hidden power";

const formatHiddenPowerName = (typeName: string): string =>
  `Hidden Power (${typeName.charAt(0).toUpperCase()}${typeName.slice(1)})`;

/**
 * The catalog stores Hidden Power as Normal because its actual type belongs to
 * an individual Pokemon. Rankings model every legal roll without mutating the
 * catalog move or exposing Normal/Fairy rolls that cannot occur in Pokemon GO.
 */
export const expandHiddenPowerFastMoves = (moves: Move[]): Move[] =>
  moves.flatMap((move) => {
    if (!isBaseHiddenPower(move)) return [move];

    return HIDDEN_POWER_TYPES.map(({ name, typeId }) => ({
      ...move,
      name: formatHiddenPowerName(name),
      type_id: typeId,
      type_name: name,
      type: name,
    }));
  });
