import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';
import type { NativeCollectionRow } from '../collection/collectionModel';
import { homeExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import { summarizeActiveCollection } from '@pokemongonexus/shared-domain/instances';

export type NativeHomeCollectionSummary = {
  caught: number;
  favorites: number;
  forTrade: number;
  wanted: number;
  mostWanted: number;
};

export type NativeHomeTradeSummary = {
  needsResponse: number;
  readyToConfirm: number;
  waiting: number;
  completed: number;
  active: number;
};

export type NativeHomeOnboardingTask = {
  id: 'collection' | 'wanted' | 'trade' | 'connect';
  title: string;
  description: string;
  action: string;
  to: string;
  complete: boolean;
};

export type NativeHomeOnboardingProgress = {
  completed: number;
  total: number;
  tasks: NativeHomeOnboardingTask[];
};

export const EMPTY_NATIVE_HOME_COLLECTION: NativeHomeCollectionSummary = {
  caught: 0,
  favorites: 0,
  forTrade: 0,
  wanted: 0,
  mostWanted: 0,
};

export const EMPTY_NATIVE_HOME_TRADES: NativeHomeTradeSummary = {
  needsResponse: 0,
  readyToConfirm: 0,
  waiting: 0,
  completed: 0,
  active: 0,
};

const isCurrentUser = (
  candidate: string | null | undefined,
  username: string,
): boolean => candidate?.toLocaleLowerCase() === username.toLocaleLowerCase();

export const summarizeNativeHomeCollection = (
  instances: Record<string, PokemonInstance>,
): NativeHomeCollectionSummary => summarizeActiveCollection(instances);

export const summarizeNativeHomeTrades = (
  trades: TradeRecord[],
  username: string,
): NativeHomeTradeSummary => trades.reduce<NativeHomeTradeSummary>((summary, trade) => {
  const status = String(trade.trade_status ?? '').toLocaleLowerCase();

  if (status === 'completed') {
    summary.completed += 1;
    return summary;
  }

  if (status === 'proposed') {
    summary.active += 1;
    if (isCurrentUser(trade.username_accepting, username)) summary.needsResponse += 1;
    if (isCurrentUser(trade.username_proposed, username)) summary.waiting += 1;
    return summary;
  }

  if (status !== 'pending') return summary;

  summary.active += 1;
  const proposedUser = isCurrentUser(trade.username_proposed, username);
  const acceptingUser = isCurrentUser(trade.username_accepting, username);
  const currentUserConfirmed = proposedUser
    ? trade.user_proposed_completion_confirmed === true
    : acceptingUser
      ? trade.user_accepting_completion_confirmed === true
      : true;

  if (currentUserConfirmed) summary.waiting += 1;
  else summary.readyToConfirm += 1;
  return summary;
}, { ...EMPTY_NATIVE_HOME_TRADES });

const instanceTimestamp = (instance: PokemonInstance): number => {
  const lastUpdate = Number(instance.last_update ?? 0);
  if (Number.isFinite(lastUpdate) && lastUpdate > 0) return lastUpdate;
  const dateAdded = Date.parse(String(instance.date_added ?? ''));
  return Number.isFinite(dateAdded) ? dateAdded : 0;
};

export const selectNativeHomeRecentRows = (
  rows: NativeCollectionRow[],
  instances: Record<string, PokemonInstance>,
  limit = 4,
): NativeCollectionRow[] => rows
  .filter((row) => row.source !== 'catalog' && Boolean(instances[row.id]))
  .sort((left, right) => (
    instanceTimestamp(instances[right.id]!) - instanceTimestamp(instances[left.id]!)
  ))
  .slice(0, Math.max(0, limit));

export const buildNativeHomeOnboardingProgress = (
  collection: NativeHomeCollectionSummary,
  connectionCount: number,
): NativeHomeOnboardingProgress => {
  const tasks: NativeHomeOnboardingTask[] = [
    {
      id: 'collection',
      title: 'Add your first Pokémon',
      description: 'Begin with something you have caught or already want.',
      action: 'Open Pokémon',
      to: homeExperienceParityContract.collectionPath,
      complete: collection.caught + collection.wanted > 0,
    },
    {
      id: 'wanted',
      title: 'Create a Wanted listing',
      description: 'Tell the app what you are looking for and which details matter.',
      action: 'Open wishlist',
      to: homeExperienceParityContract.collectionSummaryPaths.wanted,
      complete: collection.wanted > 0,
    },
    {
      id: 'trade',
      title: 'List a Pokémon For Trade',
      description: 'Choose an eligible caught Pokémon you would offer another trainer.',
      action: 'Open collection',
      to: homeExperienceParityContract.collectionSummaryPaths.trade,
      complete: collection.forTrade > 0,
    },
    {
      id: 'connect',
      title: 'Make your first connection',
      description: 'Find a trainer, add a friend, or begin a trade proposal.',
      action: 'Find trainers',
      to: '/search',
      complete: connectionCount > 0,
    },
  ];

  return {
    completed: tasks.filter((task) => task.complete).length,
    total: tasks.length,
    tasks,
  };
};
