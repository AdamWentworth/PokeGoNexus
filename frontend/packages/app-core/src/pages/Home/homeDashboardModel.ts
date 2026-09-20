import type { Trade } from '@/features/trades/store/useTradeStore';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { summarizeActiveCollection } from '@pokemongonexus/shared-domain/instances';

export interface HomeCollectionSummary {
  caught: number;
  favorites: number;
  forTrade: number;
  wanted: number;
  mostWanted: number;
}

export interface HomeTradeSummary {
  needsResponse: number;
  readyToConfirm: number;
  waiting: number;
  completed: number;
  active: number;
}

export interface HomeOnboardingTask {
  id: 'collection' | 'wanted' | 'trade' | 'connect';
  title: string;
  description: string;
  action: string;
  to: string;
  complete: boolean;
}

export interface HomeOnboardingProgress {
  completed: number;
  total: number;
  tasks: HomeOnboardingTask[];
}

const normalizedStatus = (trade: Trade): string =>
  String(trade.trade_status ?? '').toLowerCase();

const isCurrentUser = (
  candidate: string | null | undefined,
  username: string,
): boolean => candidate?.toLowerCase() === username.toLowerCase();

export const summarizeHomeCollection = (
  instances: Record<string, PokemonInstance>,
): HomeCollectionSummary => summarizeActiveCollection(instances);

export const summarizeHomeTrades = (
  trades: Record<string, Trade>,
  username: string,
): HomeTradeSummary => {
  const summary: HomeTradeSummary = {
    needsResponse: 0,
    readyToConfirm: 0,
    waiting: 0,
    completed: 0,
    active: 0,
  };

  Object.values(trades).forEach((trade) => {
    const status = normalizedStatus(trade);

    if (status === 'completed') {
      summary.completed += 1;
      return;
    }

    if (status === 'proposed') {
      summary.active += 1;
      if (isCurrentUser(trade.username_accepting, username)) {
        summary.needsResponse += 1;
      } else if (isCurrentUser(trade.username_proposed, username)) {
        summary.waiting += 1;
      }
      return;
    }

    if (status !== 'pending') return;

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
  });

  return summary;
};

export const getRecentHomeInstances = (
  instances: Record<string, PokemonInstance>,
  limit = 4,
): PokemonInstance[] =>
  Object.entries(instances)
    .filter(([, instance]) => !instance.disabled && (instance.is_caught || instance.is_wanted))
    .sort(([, left], [, right]) => {
      const updated = Number(right.last_update ?? 0) - Number(left.last_update ?? 0);
      if (updated !== 0) return updated;
      return String(right.date_added ?? '').localeCompare(String(left.date_added ?? ''));
    })
    .slice(0, limit)
    .map(([instanceId, instance]) => ({
      ...instance,
      instance_id: instance.instance_id || instanceId,
    }));

export const buildHomeOnboardingProgress = (
  collection: HomeCollectionSummary,
  connectionCount: number,
): HomeOnboardingProgress => {
  const tasks: HomeOnboardingTask[] = [
    {
      id: 'collection',
      title: 'Add your first Pokémon',
      description: 'Begin with something you have caught or already want.',
      action: 'Open Pokémon',
      to: '/pokemon',
      complete: collection.caught + collection.wanted > 0,
    },
    {
      id: 'wanted',
      title: 'Create a Wanted listing',
      description: 'Tell the app what you are looking for and which details matter.',
      action: 'Open wishlist',
      to: '/pokemon?filter=wanted',
      complete: collection.wanted > 0,
    },
    {
      id: 'trade',
      title: 'List a Pokémon For Trade',
      description: 'Choose an eligible caught Pokémon you would offer another trainer.',
      action: 'Open collection',
      to: '/pokemon?filter=trade',
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
