import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { calculateTradeCost } from '@pokemongonexus/shared-domain/trade-cost';
import {
  countTradeActivity,
  tradeMatchesActivityFilter,
} from '@pokemongonexus/shared-domain/trade-activity';
import {
  parseTradeVariantReference,
  prepareTradeCandidateSets,
  resolveTradeCandidateDecision,
} from '@pokemongonexus/shared-domain/trade-proposal-candidates';

const UUID_SUFFIX = /_[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const parseVariantId = (input: string) => ({
  baseKey: input.replace(UUID_SUFFIX, ''),
});

const instance = (
  overrides: Partial<PokemonInstance> = {},
): PokemonInstance => ({
  instance_id: 'mine-1',
  variant_id: '0006-default',
  pokemon_id: 6,
  is_caught: true,
  is_for_trade: true,
  lucky: false,
  ...overrides,
} as PokemonInstance);

describe('shared native trade domain', () => {
  it('uses the same candidate lockouts as the canonical web proposal flow', () => {
    const lucky = instance({ instance_id: 'lucky-1', lucky: true, is_for_trade: false });
    const sets = prepareTradeCandidateSets(
      { variant_id: '0006-default' },
      [lucky],
      parseVariantId,
    );

    expect(resolveTradeCandidateDecision(
      { variant_id: '0006-default' },
      sets.selectedBaseKey,
      sets.caughtInstances,
      sets.tradeableInstances,
      [],
    )).toEqual({ kind: 'onlyTradeLocked' });
  });

  it('excludes a For Trade copy already committed to a proposal', () => {
    const offered = instance();
    const sets = prepareTradeCandidateSets(
      { variant_id: '0006-default' },
      [offered],
      parseVariantId,
    );

    expect(resolveTradeCandidateDecision(
      { variant_id: '0006-default' },
      sets.selectedBaseKey,
      sets.caughtInstances,
      sets.tradeableInstances,
      [{
        trade_status: 'proposed',
        pokemon_instance_id_user_proposed: offered.instance_id,
      }],
    )).toEqual({ kind: 'noAvailableTradeable' });
  });

  it('uses Best Friends pricing at five hearts while remote remains independent', () => {
    const result = calculateTradeCost({
      friendshipLevel: 5,
      receivedPokemon: {
        variant_id: '0150-default',
        rarity: 'Legendary',
      },
      offeredInstance: instance({ shiny: false }),
      currentTrainerInstances: {},
      partnerInstances: {},
      parseVariantId,
    });

    expect(result).toEqual({
      stardustCost: 40_000,
      isSpecialTrade: true,
      isRegisteredTrade: false,
    });
  });

  it('resolves registration from variant ids when native maps are UUID-keyed', () => {
    const result = calculateTradeCost({
      friendshipLevel: 5,
      receivedPokemon: { variant_id: '0150-default', rarity: 'Legendary' },
      offeredInstance: instance({ instance_id: 'mine-uuid', variant_id: '0006-default' }),
      currentTrainerInstances: {
        'native-owned-uuid': instance({
          instance_id: 'native-owned-uuid',
          variant_id: '0150-default',
          registered: true,
        }),
      },
      partnerInstances: {
        'native-partner-uuid': instance({
          instance_id: 'native-partner-uuid',
          variant_id: '0006-default',
          registered: true,
        }),
      },
      parseVariantId,
    });

    expect(result).toEqual({
      stardustCost: 800,
      isSpecialTrade: true,
      isRegisteredTrade: true,
    });
  });

  it('removes only a trailing instance UUID from a variant reference', () => {
    expect(parseTradeVariantReference(
      '0006-gigantamax_55cee90d-855b-4bd9-8d4a-667c1bc37934',
    )).toEqual({ baseKey: '0006-gigantamax' });
    expect(parseTradeVariantReference('0006-gigantamax')).toEqual({
      baseKey: '0006-gigantamax',
    });
  });

  it('groups the canonical five activity stages without leaking deleted rows', () => {
    const trades = [
      { trade_status: 'proposed', username_accepting: 'Me', username_proposed: 'A' },
      { trade_status: 'proposed', username_accepting: 'B', username_proposed: 'Me' },
      { trade_status: 'pending', username_accepting: 'Me', username_proposed: 'C' },
      { trade_status: 'completed', username_accepting: 'D', username_proposed: 'Me' },
      { trade_status: 'cancelled', username_accepting: 'Me', username_proposed: 'E' },
      { trade_status: 'denied', username_accepting: 'F', username_proposed: 'Me' },
      { trade_status: 'deleted', username_accepting: 'Me', username_proposed: 'G' },
    ];

    expect(countTradeActivity(trades, 'Me')).toEqual({
      Accepting: 1,
      Proposed: 1,
      Pending: 1,
      Completed: 1,
      Cancelled: 2,
    });
    expect(tradeMatchesActivityFilter(trades[0], 'Accepting', 'Me')).toBe(true);
    expect(tradeMatchesActivityFilter(trades[0], 'Proposed', 'Me')).toBe(false);
  });
});
