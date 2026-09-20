import {
  calculatePokemonCombatPower,
  validatePokemonCombatDetails,
  type PokemonCombatStats,
  type PokemonCombatValidation,
} from '@pokemongonexus/shared-domain/combat-power';
import type { NativeInstanceDetail } from './collectionModel';

export type NativeCombatDraft = {
  attackIv: string;
  cp: string;
  crowned: boolean;
  crownForm: string | null;
  defenseIv: string;
  fused: boolean;
  fusionId: number | null;
  level: string;
  megaEnabled: boolean;
  megaForm: string | null;
  staminaIv: string;
};

const optionalNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const resolveNativeCombatStats = (
  detail: NativeInstanceDetail,
  draft: NativeCombatDraft,
): PokemonCombatStats | null => {
  const transformed = draft.fused
    ? detail.fusionOptions?.find((option) => option.id === draft.fusionId)?.stats
    : draft.crowned
      ? detail.crownOptions?.find((option) => option.form === draft.crownForm)?.stats
      : draft.megaEnabled
        ? detail.megaOptions?.find((option) => option.form === draft.megaForm)?.stats
        : null;
  const stats = transformed ?? detail.baseStats;
  if (!stats || Object.values(stats).some((value) => !Number.isFinite(value))) return null;
  return stats;
};

export const calculateNativeDraftCp = (
  detail: NativeInstanceDetail,
  draft: NativeCombatDraft,
): number | null => {
  const stats = resolveNativeCombatStats(detail, draft);
  if (!stats) return null;
  const level = optionalNumber(draft.level);
  const attack = optionalNumber(draft.attackIv);
  const defense = optionalNumber(draft.defenseIv);
  const stamina = optionalNumber(draft.staminaIv);
  if (level == null || attack == null || defense == null || stamina == null) return null;
  return calculatePokemonCombatPower(stats, { attack, defense, stamina }, level);
};

export const validateNativeCombatDraft = (
  detail: NativeInstanceDetail,
  draft: NativeCombatDraft,
): PokemonCombatValidation => {
  const stats = resolveNativeCombatStats(detail, draft);
  if (!stats) {
    return {
      errors: { general: 'Combat stats are unavailable for this Pokémon form.' },
      computed: {},
    };
  }
  return validatePokemonCombatDetails({
    cp: optionalNumber(draft.cp),
    level: optionalNumber(draft.level),
    ivs: {
      attack: optionalNumber(draft.attackIv) ?? undefined,
      defense: optionalNumber(draft.defenseIv) ?? undefined,
      stamina: optionalNumber(draft.staminaIv) ?? undefined,
    },
  }, stats);
};

export const firstNativeCombatError = (
  validation: PokemonCombatValidation,
): string | null => (
  validation.errors.level
  ?? validation.errors.cp
  ?? validation.errors.ivs
  ?? validation.errors.general
  ?? null
);
