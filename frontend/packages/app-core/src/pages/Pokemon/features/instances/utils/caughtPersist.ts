import type { PokemonInstance } from '@/types/pokemonInstance';
import {
  buildInstanceChanges,
  type FusionState,
  type IVs,
  type MegaData,
  type MovesState,
} from './buildInstanceChanges';
import { collectInstanceRefCandidates } from '@pokemongonexus/shared-domain/instances';

export type CaughtComputedValues = {
  cp?: number | null;
  level?: number | null;
  ivs?: IVs;
};

type ResolveCaughtPersistValuesArgs = {
  cp: string;
  level: number | null;
  ivs: IVs;
  newComputedValues: CaughtComputedValues;
};

type BuildCaughtPersistPatchMapArgs = {
  instanceId: string;
  nickname: string | null;
  isLucky: boolean;
  isTraded: boolean;
  isFavorite: boolean;
  gender: string | null;
  weight: number | null;
  height: number | null;
  computedCP: number | null;
  computedLevel: number | null;
  computedIvs: IVs;
  moves: MovesState;
  locationCaught: string | null;
  dateCaught: string | null;
  originalTrainerName: string | null;
  originalTrainerId: string | null;
  tradedDate: string | null;
  pokeball: string | null;
  selectedBackgroundId: number | null;
  megaData: MegaData;
  crown: boolean;
  fusion: FusionState;
  isShadow: boolean;
  isPurified: boolean;
  maxAttack: string | number | '';
  maxGuard: string | number | '';
  maxSpirit: string | number | '';
  originalFusedWith: string | null;
  allInstances?: Record<string, Partial<PokemonInstance>> | null;
};

const findInstanceKeysByRef = ({
  allInstances,
  instanceRef,
}: {
  allInstances?: Record<string, Partial<PokemonInstance>> | null;
  instanceRef: string | null;
}): string[] => {
  if (!allInstances || !instanceRef) return [];

  const refs = new Set(collectInstanceRefCandidates(instanceRef).map((value) => value.toLowerCase()));
  if (refs.size === 0) return [];
  const keys: string[] = [];

  for (const [key, row] of Object.entries(allInstances)) {
    const keyRefs = collectInstanceRefCandidates(key).map((value) => value.toLowerCase());
    const rowInstanceId =
      typeof row?.instance_id === 'string' && row.instance_id.length > 0 ? row.instance_id : null;
    const rowRefs = collectInstanceRefCandidates(rowInstanceId).map((value) => value.toLowerCase());

    const matches = [...keyRefs, ...rowRefs].some((candidate) => refs.has(candidate));
    if (matches) keys.push(key);
  }

  return keys;
};

const findLinkedPartnerKeys = ({
  allInstances,
  instanceId,
}: {
  allInstances?: Record<string, Partial<PokemonInstance>> | null;
  instanceId: string;
}): string[] => {
  if (!allInstances || !instanceId) return [];
  const refs = new Set(collectInstanceRefCandidates(instanceId).map((value) => value.toLowerCase()));
  const keys: string[] = [];

  for (const [key, row] of Object.entries(allInstances)) {
    if (!row) continue;

    const fusedWith = typeof row.fused_with === 'string' ? row.fused_with : null;
    if (!fusedWith) continue;

    const fusedWithRefs = collectInstanceRefCandidates(fusedWith).map((value) => value.toLowerCase());
    const pointsToCurrent = fusedWithRefs.some((candidate) => refs.has(candidate));
    if (!pointsToCurrent) continue;

    if (row.is_fused === true || row.disabled === true) {
      keys.push(key);
    }
  }

  return keys;
};

export const resolveCaughtPersistValues = ({
  cp,
  level,
  ivs,
  newComputedValues,
}: ResolveCaughtPersistValuesArgs) => {
  const computedCP = newComputedValues.cp ?? (cp !== '' ? Number(cp) : null);
  const computedLevel = newComputedValues.level ?? level;
  const computedIvs = newComputedValues.ivs ?? ivs;
  return { computedCP, computedLevel, computedIvs };
};

export const buildCaughtPersistPatchMap = ({
  instanceId,
  nickname,
  isLucky,
  isTraded,
  isFavorite,
  gender,
  weight,
  height,
  computedCP,
  computedLevel,
  computedIvs,
  moves,
  locationCaught,
  dateCaught,
  originalTrainerName,
  originalTrainerId,
  tradedDate,
  pokeball,
  selectedBackgroundId,
  megaData,
  crown,
  fusion,
  isShadow,
  isPurified,
  maxAttack,
  maxGuard,
  maxSpirit,
  originalFusedWith,
  allInstances,
}: BuildCaughtPersistPatchMapArgs): Record<string, Partial<PokemonInstance>> => {
  const patchMap = buildInstanceChanges({
    instanceId,
    nickname,
    isLucky,
    isTraded,
    isFavorite,
    gender,
    weight,
    height,
    computedCP,
    computedLevel,
    moves,
    ivs: computedIvs,
    locationCaught,
    dateCaught,
    originalTrainerName,
    originalTrainerId,
    tradedDate,
    pokeball,
    selectedBackgroundId,
    megaData,
    crown,
    fusion,
    isShadow,
    isPurified,
    maxAttack,
    maxGuard,
    maxSpirit,
  }) as Record<string, Partial<PokemonInstance>>;

  const partnerKeysToRelease = new Set<string>();
  if (originalFusedWith && originalFusedWith !== fusion.fusedWith) {
    const mappedPartnerKeys = findInstanceKeysByRef({
      allInstances,
      instanceRef: originalFusedWith,
    });
    if (mappedPartnerKeys.length > 0) {
      for (const key of mappedPartnerKeys) partnerKeysToRelease.add(key);
    } else {
      partnerKeysToRelease.add(originalFusedWith);
    }
  }

  // Safety: if we are unfusing and the current row has missing/legacy one-sided links,
  // release any rows that still point to this instance.
  if (!fusion.is_fused) {
    for (const key of findLinkedPartnerKeys({ allInstances, instanceId })) {
      partnerKeysToRelease.add(key);
    }
  }

  for (const partnerKey of partnerKeysToRelease) {
    patchMap[partnerKey] = {
      disabled: false,
      fused_with: null,
      is_fused: false,
      fusion_form: null,
    };
  }

  if (fusion.fusedWith && fusion.is_fused) {
    const mappedPartnerKeys = findInstanceKeysByRef({
      allInstances,
      instanceRef: fusion.fusedWith,
    });
    const partnerKeysToDisable =
      mappedPartnerKeys.length > 0 ? mappedPartnerKeys : [fusion.fusedWith];

    for (const partnerKey of partnerKeysToDisable) {
      patchMap[partnerKey] = {
        ...(patchMap[partnerKey] ?? {}),
        disabled: true,
        fused_with: instanceId,
        is_fused: true,
        fusion_form: fusion.fusion_form,
      };
    }
  }

  return patchMap;
};
