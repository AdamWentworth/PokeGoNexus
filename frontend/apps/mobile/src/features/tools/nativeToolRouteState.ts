import type { MaxBattleTier } from '@pokemongonexus/app-core/max-battle-simulation';

import {
  NATIVE_BATTLE_TYPES,
  type NativeBattleType,
  type NativeMaxRole,
  type NativeRosterScope,
} from './nativeBattleModels';
import type {
  NativeRankingCategory,
  NativeRankingCollectionFilter,
  NativeRankingMode,
} from './nativeRankingsModel';

type RouteParam = string | string[] | undefined;

const firstParam = (value: RouteParam): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

const normalizedParam = (value: RouteParam): string => (
  firstParam(value).trim().toLocaleLowerCase()
);

const MAX_ROLES: readonly NativeMaxRole[] = ['damage', 'tank', 'healing'];
const MAX_TIERS: readonly MaxBattleTier[] = [
  'one-star',
  'two-star',
  'three-star',
  'legendary',
  'gigantamax',
];
const RANKING_CATEGORIES: readonly NativeRankingCategory[] = [
  'all',
  'shiny',
  'costume',
  'shadow',
  'max',
];
const RANKING_COLLECTION_FILTERS: readonly NativeRankingCollectionFilter[] = [
  'all',
  'owned',
  'trade',
  'wanted',
  'missing',
];

export type NativeMaxView = 'rankings' | 'bosses';

export type NativeMaxRouteState = {
  bossId: string;
  difficulty: MaxBattleTier | null;
  role: NativeMaxRole;
  scope: NativeRosterScope;
  selectedType: NativeBattleType | '';
  trainerCount: number | null;
  view: NativeMaxView;
};

export const parseNativeMaxRouteState = (
  params: {
    boss?: RouteParam;
    difficulty?: RouteParam;
    role?: RouteParam;
    scope?: RouteParam;
    trainers?: RouteParam;
    type?: RouteParam;
    view?: RouteParam;
  },
  signedIn: boolean,
): NativeMaxRouteState => {
  const requestedRole = normalizedParam(params.role);
  const requestedType = normalizedParam(params.type);
  const requestedDifficulty = normalizedParam(params.difficulty);
  const requestedTrainers = Number(firstParam(params.trainers));

  return {
    bossId: firstParam(params.boss).trim(),
    difficulty: MAX_TIERS.includes(requestedDifficulty as MaxBattleTier)
      ? requestedDifficulty as MaxBattleTier
      : null,
    role: MAX_ROLES.includes(requestedRole as NativeMaxRole)
      ? requestedRole as NativeMaxRole
      : 'damage',
    scope: !signedIn || normalizedParam(params.scope) === 'catalog'
      ? 'catalog'
      : 'owned',
    selectedType: NATIVE_BATTLE_TYPES.includes(requestedType as NativeBattleType)
      ? requestedType as NativeBattleType
      : '',
    trainerCount: Number.isFinite(requestedTrainers) && requestedTrainers > 0
      ? Math.round(requestedTrainers)
      : null,
    view: normalizedParam(params.view) === 'bosses' ? 'bosses' : 'rankings',
  };
};

export type NativeRankingsRouteState = {
  category: NativeRankingCategory;
  collectionFilter: NativeRankingCollectionFilter;
  mode: NativeRankingMode;
  query: string;
};

export const parseNativeRankingsRouteState = (
  params: {
    category?: RouteParam;
    collection?: RouteParam;
    search?: RouteParam;
    view?: RouteParam;
  },
  signedIn: boolean,
): NativeRankingsRouteState => {
  const mode: NativeRankingMode = normalizedParam(params.view) === 'rarest'
    ? 'rarest'
    : 'wanted';
  const requestedCategory = normalizedParam(params.category);
  const requestedCollection = normalizedParam(params.collection);
  const category = RANKING_CATEGORIES.includes(requestedCategory as NativeRankingCategory)
    ? requestedCategory as NativeRankingCategory
    : 'all';

  return {
    category: mode === 'wanted' && category === 'shadow' ? 'all' : category,
    collectionFilter: signedIn
      && RANKING_COLLECTION_FILTERS.includes(requestedCollection as NativeRankingCollectionFilter)
      ? requestedCollection as NativeRankingCollectionFilter
      : 'all',
    mode,
    query: firstParam(params.search),
  };
};
