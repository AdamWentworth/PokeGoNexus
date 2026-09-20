import { describe, expect, it } from 'vitest';

import {
  buildHomeOnboardingProgress,
  getRecentHomeInstances,
  summarizeHomeCollection,
  summarizeHomeTrades,
} from '@/pages/Home/homeDashboardModel';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { Trade } from '@/features/trades/store/useTradeStore';

const instance = (overrides: Partial<PokemonInstance> = {}): PokemonInstance => ({
  attack_iv: null,
  caught_tags: [],
  charged_move1_id: null,
  charged_move2_id: null,
  costume_id: null,
  cp: null,
  crown: false,
  date_added: '2026-08-20T00:00:00.000Z',
  date_caught: null,
  defense_iv: null,
  disabled: false,
  dynamax: false,
  fast_move_id: null,
  favorite: false,
  friendship_level: null,
  fused_with: null,
  fusion: null,
  fusion_form: null,
  gender: null,
  gigantamax: false,
  height: null,
  is_caught: false,
  is_for_trade: false,
  is_fused: false,
  is_mega: false,
  is_traded: false,
  is_wanted: false,
  last_update: 0,
  level: null,
  location_card: null,
  location_caught: null,
  lucky: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  mega: false,
  mega_form: null,
  mirror: false,
  most_wanted: false,
  nickname: null,
  not_trade_list: null,
  not_wanted_list: null,
  original_trainer_id: null,
  original_trainer_name: null,
  pokeball: null,
  pokemon_id: 1,
  pref_lucky: false,
  purified: false,
  registered: true,
  shadow: false,
  shiny: false,
  stamina_iv: null,
  trade_filters: null,
  trade_tags: [],
  traded_date: null,
  variant_id: '0001-default',
  wanted_filters: null,
  wanted_tags: [],
  weight: null,
  ...overrides,
});

describe('home dashboard model', () => {
  it('keeps caught and wanted hierarchy counts accurate', () => {
    const summary = summarizeHomeCollection({
      caught: instance({ is_caught: true }),
      favorite: instance({ is_caught: true, favorite: true }),
      trade: instance({ is_caught: true, is_for_trade: true }),
      wanted: instance({ is_wanted: true }),
      mostWanted: instance({ is_wanted: true, most_wanted: true }),
    });

    expect(summary).toEqual({
      caught: 3,
      favorites: 1,
      forTrade: 1,
      wanted: 2,
      mostWanted: 1,
    });
  });

  it('separates trade actions from states waiting on another trainer', () => {
    const trades: Record<string, Trade> = {
      incoming: { trade_status: 'proposed', username_accepting: 'AdamZilla' },
      sent: { trade_status: 'proposed', username_proposed: 'AdamZilla' },
      confirm: {
        trade_status: 'pending',
        username_proposed: 'AdamZilla',
        user_proposed_completion_confirmed: false,
      },
      waiting: {
        trade_status: 'pending',
        username_accepting: 'AdamZilla',
        user_accepting_completion_confirmed: true,
      },
      done: { trade_status: 'completed' },
      closed: { trade_status: 'cancelled' },
    };

    expect(summarizeHomeTrades(trades, 'adamzilla')).toEqual({
      needsResponse: 1,
      readyToConfirm: 1,
      waiting: 2,
      completed: 1,
      active: 4,
    });
  });

  it('returns only recent caught or wanted instances with stable ids', () => {
    const recent = getRecentHomeInstances({
      ignored: instance({ last_update: 50 }),
      oldest: instance({ is_caught: true, last_update: 1 }),
      newest: instance({ is_wanted: true, last_update: 3 }),
      middle: instance({ instance_id: 'server-id', is_caught: true, last_update: 2 }),
    }, 2);

    expect(recent.map((entry) => entry.instance_id)).toEqual(['newest', 'server-id']);
  });

  it('derives setup milestones from authoritative collection and connection data', () => {
    const collection = summarizeHomeCollection({
      trade: instance({ is_caught: true, is_for_trade: true }),
      wanted: instance({ is_wanted: true }),
    });

    const progress = buildHomeOnboardingProgress(collection, 0);

    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(4);
    expect(progress.tasks.map(({ id, complete }) => [id, complete])).toEqual([
      ['collection', true],
      ['wanted', true],
      ['trade', true],
      ['connect', false],
    ]);
    expect(buildHomeOnboardingProgress(collection, 1).completed).toBe(4);
  });
});
