import {
  filterTradePreferenceCandidates,
  TRADE_PREFERENCE_RULE_KEYS,
  type TradePreferenceCandidate,
  type TradePreferenceRuleKey,
} from '@pokemongonexus/shared-domain/trade-preferences';

type PokemonList = Record<string, TradePreferenceCandidate>;
type FilterFn = (pokemonList: PokemonList) => PokemonList;

const filters = Object.fromEntries(
  TRADE_PREFERENCE_RULE_KEYS.map((rule) => [
    rule,
    (pokemonList: PokemonList) => filterTradePreferenceCandidates(
      pokemonList,
      'trade-offers',
      { [rule]: true },
    ),
  ]),
) as Record<TradePreferenceRuleKey, FilterFn>;

export default filters;
