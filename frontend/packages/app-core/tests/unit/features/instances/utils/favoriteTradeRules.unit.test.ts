import { describe, expect, it } from 'vitest';
import {
  FAVORITE_TO_TRADE_ERROR,
  TRADE_TO_FAVORITE_ERROR,
  enforceFavoriteTradeInvariant,
  getFavoriteTradeConflict,
} from '@pokemongonexus/shared-domain/instances';

describe('favorite and For Trade invariant', () => {
  it('rejects listing a favorite Pokémon For Trade', () => {
    expect(
      getFavoriteTradeConflict(
        { favorite: true, is_for_trade: false },
        { is_for_trade: true },
      ),
    ).toBe(FAVORITE_TO_TRADE_ERROR);
  });

  it('rejects favoriting a Pokémon already listed For Trade', () => {
    expect(
      getFavoriteTradeConflict(
        { favorite: false, is_for_trade: true },
        { favorite: true },
      ),
    ).toBe(TRADE_TO_FAVORITE_ERROR);
  });

  it('repairs legacy conflicts according to the preferred state', () => {
    const preferTrade = { favorite: true, is_for_trade: true };
    const preferFavorite = { favorite: true, is_for_trade: true };

    enforceFavoriteTradeInvariant(preferTrade, 'trade');
    enforceFavoriteTradeInvariant(preferFavorite, 'favorite');

    expect(preferTrade).toEqual({ favorite: false, is_for_trade: true });
    expect(preferFavorite).toEqual({ favorite: true, is_for_trade: false });
  });
});
