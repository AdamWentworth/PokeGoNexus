import {
  calculatePokemonCombatPower,
  getPokemonCpMultiplier,
  getPokemonLevelArcProgress,
  isValidPokemonLevel,
  validatePokemonCombatDetails,
} from '@pokemongonexus/shared-domain/combat-power';
import type { NativeInstanceDetail } from '../../../../src/features/collection/collectionModel';
import {
  calculateNativeDraftCp,
  firstNativeCombatError,
  resolveNativeCombatStats,
  validateNativeCombatDraft,
  type NativeCombatDraft,
} from '../../../../src/features/collection/nativeCombatPower';

const detail = {
  baseStats: { attack: 223, defense: 173, stamina: 186 },
  megaOptions: [{
    form: 'x',
    imageUri: null,
    label: 'Mega X',
    primal: false,
    stats: { attack: 273, defense: 213, stamina: 186 },
  }],
  crownOptions: [{
    form: 'Crowned',
    imageUri: null,
    label: 'Crowned',
    stats: { attack: 332, defense: 240, stamina: 192 },
  }],
  fusionOptions: [{
    id: 2,
    imageUri: null,
    moveOptions: [],
    name: 'Fusion',
    stats: { attack: 277, defense: 220, stamina: 200 },
    partnerPokemonId: 1,
    partnerRows: [],
    backgroundOptions: [],
    partnerBackgroundIds: {},
    comboBackgrounds: [],
  }],
} as unknown as NativeInstanceDetail;

const draft = (patch: Partial<NativeCombatDraft> = {}): NativeCombatDraft => ({
  attackIv: '15',
  cp: '2867',
  crowned: false,
  crownForm: null,
  defenseIv: '14',
  fused: false,
  fusionId: null,
  level: '40',
  megaEnabled: false,
  megaForm: null,
  staminaIv: '13',
  ...patch,
});

describe('shared Pokémon combat rules', () => {
  it('uses the canonical half-level multiplier curve and CP formula', () => {
    expect(getPokemonCpMultiplier(40)).toBe(0.79030001);
    expect(isValidPokemonLevel(40.5)).toBe(true);
    expect(isValidPokemonLevel(40.25)).toBe(false);
    expect(calculatePokemonCombatPower(
      detail.baseStats!,
      { attack: 15, defense: 14, stamina: 13 },
      40,
    )).toBe(2867);
    expect(getPokemonLevelArcProgress(40)).toBeCloseTo(0.9405, 3);
    expect(getPokemonLevelArcProgress(50)).toBe(1);
    expect(getPokemonLevelArcProgress(51)).toBe(1);
  });

  it('rejects impossible levels and incomplete IV appraisals', () => {
    expect(validatePokemonCombatDetails({ level: 40.25, cp: 2500 }, detail.baseStats!).errors.level)
      .toContain('0.5 increments');
    expect(validatePokemonCombatDetails({
      level: 40,
      ivs: { attack: 15 },
    }, detail.baseStats!).errors.ivs).toContain('all three IVs');
  });
});

describe('native combat form parity', () => {
  it('recalculates CP from the active base, Mega, Crown, and Fusion stats', () => {
    expect(calculateNativeDraftCp(detail, draft())).toBe(2867);
    expect(resolveNativeCombatStats(detail, draft({ megaEnabled: true, megaForm: 'x' })))
      .toEqual({ attack: 273, defense: 213, stamina: 186 });
    expect(calculateNativeDraftCp(detail, draft({ megaEnabled: true, megaForm: 'x' })))
      .not.toBe(2867);
    expect(resolveNativeCombatStats(detail, draft({ crowned: true, crownForm: 'Crowned' })))
      .toEqual({ attack: 332, defense: 240, stamina: 192 });
    expect(resolveNativeCombatStats(detail, draft({ fused: true, fusionId: 2 })))
      .toEqual({ attack: 277, defense: 220, stamina: 200 });
  });

  it('returns a visible save error for an invalid native combat draft', () => {
    const validation = validateNativeCombatDraft(detail, draft({ level: '52' }));
    expect(firstNativeCombatError(validation)).toContain('1–51');
  });
});
