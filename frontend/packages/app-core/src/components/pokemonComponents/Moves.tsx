// Moves.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Moves.css';

import type { Move } from '@/types/pokemonSubTypes';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { resolveAssetUrl } from '@/utils/assetUrl';
import { buildPokemonMoveTypeIconPath } from '@pokemongonexus/shared-domain/moves';
import {
  buildMovePools,
  filterMoveOptions,
  findSecondChargedMove,
  getInitialMoveSelection,
  getMoveById as getMoveByIdFromPools,
  getPowerValue,
  getShadowBonusValue,
  parseSelectedMoveId,
  reconcileShadowPurifiedMoves,
  reconcileUnavailableMoves,
  shouldRenderMoves,
  type DamageMode,
  type FusionMoveSource,
  type MoveSlot,
  type MovesPokemon,
} from './movesState';

type VariantWithOptionalInstance = MovesPokemon;

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */
export interface MovesProps {
  pokemon: VariantWithOptionalInstance;
  editMode: boolean;
  onMovesChange: (moves: {
    fastMove: number | null;
    chargedMove1: number | null;
    chargedMove2: number | null;
  }) => void;
  isShadow: boolean;
  isPurified: boolean;
  fusionMoveSource?: FusionMoveSource;
  isFused?: boolean;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const Moves: React.FC<MovesProps> = ({
  pokemon,
  editMode,
  onMovesChange,
  isShadow,
  isPurified,
  fusionMoveSource = 'base',
  isFused = false,
}) => {
  const allMoves = useMemo(() => pokemon.moves ?? [], [pokemon.moves]);
  const instanceData: Partial<PokemonInstance> = pokemon.instanceData ?? {};
  const onMovesChangeRef = useRef(onMovesChange);
  const modeToggleRef = useRef<HTMLDivElement>(null);
  const raidTabRef = useRef<HTMLButtonElement>(null);
  const pvpTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onMovesChangeRef.current = onMovesChange;
  }, [onMovesChange]);

  /* local state mirrors instanceData so UI can edit it -------------- */
  const [fastMove, setFastMove] = useState<number | null>(
    getInitialMoveSelection(instanceData).fastMove,
  );
  const [chargedMove1, setChargedMove1] = useState<number | null>(
    getInitialMoveSelection(instanceData).chargedMove1,
  );
  const [chargedMove2, setChargedMove2] = useState<number | null>(
    getInitialMoveSelection(instanceData).chargedMove2,
  );
  const [damageMode, setDamageMode] = useState<DamageMode>('raid');
  const damageModeIndex = damageMode === 'raid' ? 0 : 1;
  const [underlineLeft, setUnderlineLeft] = useState(0);

  const {
    fastMoves,
    chargedMoves,
    hasMissingFusionMoves,
    disableMoveEditing,
  } = useMemo(
    () =>
      buildMovePools({
        allMoves,
        fusionEntries: pokemon.fusion,
        fusionForm: pokemon.instanceData?.fusion_form,
        fusionMoveSource,
        isFused,
        isShadow,
        isPurified,
        editMode,
      }),
    [
      allMoves,
      editMode,
      fusionMoveSource,
      isFused,
      isPurified,
      isShadow,
      pokemon.fusion,
      pokemon.instanceData?.fusion_form,
    ],
  );

  /* sync prop → state when `pokemon` object changes ----------------- */
  useEffect(() => {
    setFastMove(pokemon.instanceData?.fast_move_id ?? null);
    setChargedMove1(pokemon.instanceData?.charged_move1_id ?? null);
    setChargedMove2(pokemon.instanceData?.charged_move2_id ?? null);
  }, [
    pokemon.instanceData?.fast_move_id,
    pokemon.instanceData?.charged_move1_id,
    pokemon.instanceData?.charged_move2_id,
  ]);

  useEffect(() => {
    const updateUnderline = () => {
      const toggleEl = modeToggleRef.current;
      const activeTabEl = damageMode === 'raid' ? raidTabRef.current : pvpTabRef.current;
      if (!toggleEl || !activeTabEl) return;

      const toggleRect = toggleEl.getBoundingClientRect();
      const tabRect = activeTabEl.getBoundingClientRect();
      const tabCenter = tabRect.left + tabRect.width / 2;
      setUnderlineLeft(tabCenter - toggleRect.left);
    };

    updateUnderline();
    window.addEventListener('resize', updateUnderline);
    return () => window.removeEventListener('resize', updateUnderline);
  }, [damageMode]);

  /* shadow / purified swap logic ------------------------------------ */
  useEffect(() => {
    const { selection: updated, dirty } = reconcileShadowPurifiedMoves({
      selection: { fastMove, chargedMove1, chargedMove2 },
      isShadow,
      isPurified,
    });

    if (dirty) {
      setChargedMove1(updated.chargedMove1);
      setChargedMove2(updated.chargedMove2);
      onMovesChangeRef.current(updated);
    }
  }, [chargedMove1, chargedMove2, fastMove, isPurified, isShadow]);

  const getMoveById = (id: number | null): Move | null =>
    getMoveByIdFromPools(id, allMoves, chargedMoves);

  const renderPowerValue = (move: Move | null, mode: DamageMode) => {
    if (!move) return <span className="move-power-base">-</span>;

    const power = getPowerValue(move, mode);
    if (power == null) return <span className="move-power-base">-</span>;

    if (!isShadow) return <span className="move-power-base">{power}</span>;

    return (
      <>
        <span className="move-power-base">{power}</span>
        <span className="move-power-bonus">+{getShadowBonusValue(power)}</span>
      </>
    );
  };

  const renderShadowBonusRow = (moveId: number | null) => {
    if (!isShadow) return null;
    const move = getMoveById(moveId);
    if (!move) return null;

    return (
      <div className="move-shadow-bonus-row">
        <span className="move-shadow-icon-badge">
          <img
            src={resolveAssetUrl('/media/images/shadow_icon.png')}
            alt=""
            aria-hidden="true"
            className="move-shadow-icon"
          />
        </span>
        <span className="move-shadow-bonus-text">SHADOW BONUS</span>
      </div>
    );
  };

  useEffect(() => {
    const { selection: next, dirty } = reconcileUnavailableMoves({
      selection: { fastMove, chargedMove1, chargedMove2 },
      fastMoves,
      chargedMoves,
      hasMissingFusionMoves,
    });

    if (dirty) {
      setFastMove(next.fastMove);
      setChargedMove1(next.chargedMove1);
      setChargedMove2(next.chargedMove2);
      onMovesChangeRef.current(next);
    }
  }, [chargedMove1, chargedMove2, chargedMoves, fastMove, fastMoves, hasMissingFusionMoves]);

  /* event handlers -------------------------------------------------- */
  const handleMoveChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    slot: MoveSlot,
  ) => {
    const id = parseSelectedMoveId(e.target.value);
    if (slot === 'fast') {
      setFastMove(id);
      onMovesChange({ fastMove: id, chargedMove1, chargedMove2 });
    } else if (slot === 'charged1') {
      setChargedMove1(id);
      onMovesChange({ fastMove, chargedMove1: id, chargedMove2 });
    } else {
      setChargedMove2(id);
      onMovesChange({ fastMove, chargedMove1, chargedMove2: id });
    }
  };

  const addSecondChargedMove = () => {
    const available = findSecondChargedMove(chargedMoves, chargedMove1);
    if (available) {
      setChargedMove2(available.move_id);
      onMovesChange({
        fastMove,
        chargedMove1,
        chargedMove2: available.move_id,
      });
    }
  };

  /* option + info render helpers ----------------------------------- */
  const renderMoveOptions = (
    moves: Move[],
    selectedId: number | null,
    slot: MoveSlot,
    mode: DamageMode,
  ) => {
    const filtered = filterMoveOptions({
      moves,
      slot,
      chargedMove1,
      chargedMove2,
      isShadow,
      isPurified,
    });

    const move = getMoveById(selectedId);

    return (
      <div className="move-option-container">
        {move ? (
          <img
            src={buildPokemonMoveTypeIconPath(move.type)}
            alt={move.type}
            className="type-icon"
          />
        ) : (
          <span className="no-type-icon" />
        )}

        <select
          value={selectedId ?? ''}
          onChange={(e) => handleMoveChange(e, slot)}
          className="move-select"
          disabled={disableMoveEditing}
        >
          <option value="">Unselected move</option>
          {filtered.map((m) => (
            <option
              key={m.move_id}
              value={m.move_id}
              style={m.legacy ? { fontWeight: 'bold' } : undefined}
            >
              {m.name}
              {m.legacy ? '*' : ''}
            </option>
          ))}
        </select>
        <span className="move-power-value">{renderPowerValue(move, mode)}</span>
      </div>
    );
  };

  const renderMoveInfo = (id: number | null, mode: DamageMode) => {
    const move = getMoveById(id);
    if (!move)
      return <span className="unselected-move">Unselected move</span>;

    return (
      <div className="move-info">
        <div className="move-left">
          <img
            src={buildPokemonMoveTypeIconPath(move.type)}
            alt={move.type}
            className="type-icon"
          />
          <span
            className="move-name"
            style={move.legacy ? { fontWeight: 'bold' } : undefined}
          >
            {move.name}
            {move.legacy ? '*' : ''}
          </span>
        </div>
        <span className="move-power-value">{renderPowerValue(move, mode)}</span>
      </div>
    );
  };

  const renderMovesPage = (mode: DamageMode) => (
    <>
      <div className="move-section">
        {editMode
          ? renderMoveOptions(fastMoves, fastMove, 'fast', mode)
          : renderMoveInfo(fastMove, mode)}
      </div>
      {renderShadowBonusRow(fastMove)}
      <div className="move-section">
        {editMode
          ? renderMoveOptions(chargedMoves, chargedMove1, 'charged1', mode)
          : renderMoveInfo(chargedMove1, mode)}
      </div>
      {renderShadowBonusRow(chargedMove1)}
      <div className="move-section">
        {chargedMove2 ? (
          editMode
            ? renderMoveOptions(chargedMoves, chargedMove2, 'charged2', mode)
            : renderMoveInfo(chargedMove2, mode)
        ) : editMode ? (
          <button
            onClick={addSecondChargedMove}
            className="icon-button add-move-button"
            disabled={disableMoveEditing}
            aria-label="Add second charged move"
          >
            <span className="move-add-icon">+</span>
          </button>
        ) : null}
      </div>
      {renderShadowBonusRow(chargedMove2)}
    </>
  );

  if (
    !shouldRenderMoves({
      editMode,
      selection: { fastMove, chargedMove1, chargedMove2 },
      hasMissingFusionMoves,
    })
  ) {
    return null;
  }

  return (
    <div className={`moves-container ${editMode ? 'editable' : ''}`}>
      {hasMissingFusionMoves ? (
        <div className="moves-fusion-warning" role="status">
          Fusion moves unavailable. Refresh pokemon data.
        </div>
      ) : null}
      <div
        ref={modeToggleRef}
        className="moves-mode-toggle"
        role="tablist"
        aria-label="Move battle mode"
      >
        <button
          ref={raidTabRef}
          type="button"
          role="tab"
          aria-selected={damageMode === 'raid'}
          className={`moves-mode-button ${damageMode === 'raid' ? 'active' : ''}`}
          onClick={() => setDamageMode('raid')}
        >
          Gyms &amp; Raids
        </button>
        <button
          ref={pvpTabRef}
          type="button"
          role="tab"
          aria-selected={damageMode === 'pvp'}
          className={`moves-mode-button ${damageMode === 'pvp' ? 'active' : ''}`}
          onClick={() => setDamageMode('pvp')}
        >
          Trainer Battles
        </button>
        <span
          className="moves-mode-underline"
          style={{ left: underlineLeft }}
          aria-hidden="true"
        />
      </div>
      <div className="moves-pages-viewport">
        <div
          className="moves-pages-track"
          style={{ transform: `translateX(-${damageModeIndex * 50}%)` }}
        >
          <div className="moves-page" role="tabpanel" aria-hidden={damageMode !== 'raid'}>
            {renderMovesPage('raid')}
          </div>
          <div className="moves-page" role="tabpanel" aria-hidden={damageMode !== 'pvp'}>
            {renderMovesPage('pvp')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Moves;
