import type { PokemonInstance } from '@/types/pokemonInstance';
import type { Move } from '@/types/pokemonSubTypes';
import {
  getPokemonMovePower,
  getPokemonShadowMoveBonus,
  type PokemonMoveDamageMode,
} from '@pokemongonexus/shared-domain/moves';

export type FusionMoveSource = 'base' | 'fusion' | 'fusion_missing';
export type DamageMode = PokemonMoveDamageMode;
export type MoveSlot = 'fast' | 'charged1' | 'charged2';

export type MovesSelection = {
  fastMove: number | null;
  chargedMove1: number | null;
  chargedMove2: number | null;
};

export type MovesPokemon = {
  moves?: Move[];
  fusion?: Array<{ name?: string; fusion_id?: number | null; moves?: Move[] }>;
  instanceData?: Partial<PokemonInstance>;
};

export type MovePoolState = {
  fastMoves: Move[];
  chargedMoves: Move[];
  fusionId: number | null;
  hasMissingFusionMoves: boolean;
  disableMoveEditing: boolean;
};

export const FRUSTRATION_MOVE_ID = 228;
export const RETURN_MOVE_ID = 229;

export const getInitialMoveSelection = (
  instanceData: Partial<PokemonInstance> | undefined,
): MovesSelection => ({
  fastMove: instanceData?.fast_move_id ?? null,
  chargedMove1: instanceData?.charged_move1_id ?? null,
  chargedMove2: instanceData?.charged_move2_id ?? null,
});

const normalizeFusionForm = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const resolveMovesFusionId = ({
  allMoves,
  fusionEntries,
  fusionForm,
}: {
  allMoves: Move[];
  fusionEntries: MovesPokemon['fusion'];
  fusionForm?: string | null;
}): number | null => {
  const normalizedFusionForm = normalizeFusionForm(fusionForm);
  const entries = Array.isArray(fusionEntries) ? fusionEntries : [];
  if (!normalizedFusionForm) return null;

  const fusionIdFromName =
    entries.find((entry) => (entry.name ?? '').trim().toLowerCase() === normalizedFusionForm)
      ?.fusion_id ?? null;
  const fusionIdFromNumericForm =
    normalizedFusionForm && /^\d+$/.test(normalizedFusionForm)
      ? Number(normalizedFusionForm)
      : null;
  const fusionIdsFromMoves = Array.from(
    new Set(
      allMoves
        .map((move) => move.fusion_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  );
  const inferredFusionId = fusionIdsFromMoves.length === 1 ? fusionIdsFromMoves[0] : null;

  return (
    fusionIdFromName ??
    (typeof fusionIdFromNumericForm === 'number' ? fusionIdFromNumericForm : null) ??
    inferredFusionId
  );
};

export const hasMissingFusionMovePool = (
  isFused: boolean,
  fusionMoveSource: FusionMoveSource,
): boolean => isFused && fusionMoveSource === 'fusion_missing';

export const allowMoveForFusion = ({
  move,
  fusionMoveSource,
  hasMissingFusionMoves,
  fusionId,
}: {
  move: Move;
  fusionMoveSource: FusionMoveSource;
  hasMissingFusionMoves: boolean;
  fusionId: number | null;
}): boolean => {
  if (fusionMoveSource === 'fusion') return true;
  if (hasMissingFusionMoves) return false;
  if (!fusionId) return move.fusion_id == null;
  if (move.fusion_id == null) return true;
  return move.fusion_id === fusionId;
};

export const makeSpecialMove = (id: number, name: string): Move => ({
  move_id: id,
  name,
  type: 'Normal',
  type_id: 0,
  raid_power: 0,
  pvp_power: 0,
  raid_energy: 0,
  pvp_energy: 0,
  raid_cooldown: 0,
  pvp_turns: 0,
  is_fast: 0,
  type_name: 'Normal',
  legacy: false,
  fusion_id: null,
  shadow: null,
  purified: null,
  apex: null,
});

export const buildMovePools = ({
  allMoves,
  fusionEntries,
  fusionForm,
  fusionMoveSource,
  isFused,
  isShadow,
  isPurified,
  editMode,
}: {
  allMoves: Move[];
  fusionEntries: MovesPokemon['fusion'];
  fusionForm?: string | null;
  fusionMoveSource: FusionMoveSource;
  isFused: boolean;
  isShadow: boolean;
  isPurified: boolean;
  editMode: boolean;
}): MovePoolState => {
  const fusionId = resolveMovesFusionId({ allMoves, fusionEntries, fusionForm });
  const hasMissingFusionMoves = hasMissingFusionMovePool(isFused, fusionMoveSource);
  const isAllowed = (move: Move) =>
    allowMoveForFusion({
      move,
      fusionMoveSource,
      hasMissingFusionMoves,
      fusionId,
    });

  const fastMoves = allMoves.filter((move) => move.is_fast === 1 && isAllowed(move));
  const chargedMoves = allMoves.filter((move) => move.is_fast === 0 && isAllowed(move));

  if (isShadow && !chargedMoves.some((move) => move.move_id === FRUSTRATION_MOVE_ID)) {
    chargedMoves.push(makeSpecialMove(FRUSTRATION_MOVE_ID, 'Frustration'));
  }
  if (isPurified && !chargedMoves.some((move) => move.move_id === RETURN_MOVE_ID)) {
    chargedMoves.push(makeSpecialMove(RETURN_MOVE_ID, 'Return'));
  }

  return {
    fastMoves,
    chargedMoves,
    fusionId,
    hasMissingFusionMoves,
    disableMoveEditing: editMode && hasMissingFusionMoves,
  };
};

export const getMoveById = (
  id: number | null,
  allMoves: Move[],
  chargedMoves: Move[],
): Move | null =>
  id != null
    ? allMoves.find((move) => move.move_id === id) ??
      chargedMoves.find((move) => move.move_id === id) ??
      null
    : null;

export const getPowerValue = getPokemonMovePower;

export const getShadowBonusValue = getPokemonShadowMoveBonus;

export const reconcileShadowPurifiedMoves = ({
  selection,
  isShadow,
  isPurified,
}: {
  selection: MovesSelection;
  isShadow: boolean;
  isPurified: boolean;
}): { selection: MovesSelection; dirty: boolean } => {
  const next = { ...selection };
  let dirty = false;

  const replace = (from: number, to: number) => {
    if (next.chargedMove1 === from) {
      next.chargedMove1 = to;
      dirty = true;
    }
    if (next.chargedMove2 === from) {
      next.chargedMove2 = to;
      dirty = true;
    }
  };

  if (isPurified && !isShadow) replace(FRUSTRATION_MOVE_ID, RETURN_MOVE_ID);
  if (isShadow && !isPurified) replace(RETURN_MOVE_ID, FRUSTRATION_MOVE_ID);

  const clearIfInvalid = (id: number | null) =>
    id != null && !isShadow && !isPurified && (id === FRUSTRATION_MOVE_ID || id === RETURN_MOVE_ID);

  if (clearIfInvalid(next.chargedMove1)) {
    next.chargedMove1 = null;
    dirty = true;
  }
  if (clearIfInvalid(next.chargedMove2)) {
    next.chargedMove2 = null;
    dirty = true;
  }

  return { selection: next, dirty };
};

export const reconcileUnavailableMoves = ({
  selection,
  fastMoves,
  chargedMoves,
  hasMissingFusionMoves,
}: {
  selection: MovesSelection;
  fastMoves: Move[];
  chargedMoves: Move[];
  hasMissingFusionMoves: boolean;
}): { selection: MovesSelection; dirty: boolean } => {
  if (hasMissingFusionMoves) {
    return { selection, dirty: false };
  }

  const next = { ...selection };
  let dirty = false;
  const fastSet = new Set(fastMoves.map((move) => move.move_id));
  const chargedSet = new Set(chargedMoves.map((move) => move.move_id));

  if (next.fastMove != null && !fastSet.has(next.fastMove)) {
    next.fastMove = null;
    dirty = true;
  }
  if (next.chargedMove1 != null && !chargedSet.has(next.chargedMove1)) {
    next.chargedMove1 = null;
    dirty = true;
  }
  if (next.chargedMove2 != null && !chargedSet.has(next.chargedMove2)) {
    next.chargedMove2 = null;
    dirty = true;
  }
  if (
    next.chargedMove1 != null &&
    next.chargedMove2 != null &&
    next.chargedMove1 === next.chargedMove2
  ) {
    next.chargedMove2 = null;
    dirty = true;
  }

  return { selection: next, dirty };
};

export const filterMoveOptions = ({
  moves,
  slot,
  chargedMove1,
  chargedMove2,
  isShadow,
  isPurified,
}: {
  moves: Move[];
  slot: MoveSlot;
  chargedMove1: number | null;
  chargedMove2: number | null;
  isShadow: boolean;
  isPurified: boolean;
}): Move[] =>
  moves.filter((move) => {
    if (slot === 'charged1' && move.move_id === chargedMove2) return false;
    if (slot === 'charged2' && move.move_id === chargedMove1) return false;
    if (move.shadow === 1 && !isShadow) return false;
    if (move.purified === 1 && !isPurified) return false;
    return true;
  });

export const findSecondChargedMove = (
  chargedMoves: Move[],
  chargedMove1: number | null,
): Move | null =>
  chargedMoves.find(
    (move) =>
      move.move_id !== chargedMove1 &&
      move.move_id !== FRUSTRATION_MOVE_ID &&
      move.move_id !== RETURN_MOVE_ID,
  ) ?? null;

export const parseSelectedMoveId = (value: string): number | null => Number(value) || null;

export const shouldRenderMoves = ({
  editMode,
  selection,
  hasMissingFusionMoves,
}: {
  editMode: boolean;
  selection: MovesSelection;
  hasMissingFusionMoves: boolean;
}): boolean =>
  editMode ||
  Boolean(selection.fastMove || selection.chargedMove1 || selection.chargedMove2) ||
  hasMissingFusionMoves;
