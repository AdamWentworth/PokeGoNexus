import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { RelatedInstanceRecord } from '@pokemongonexus/shared-contracts/trades';
import { buildNativeTradeActivityRows } from '../../../../src/features/trades/nativeTradeActivityRows';

const instance = (
  id: string,
  shiny: boolean,
): PokemonInstance & RelatedInstanceRecord => ({
  instance_id: id,
  variant_id: shiny ? '0006-shiny' : '0006-default',
  pokemon_id: 6,
  shiny,
  is_caught: true,
  is_for_trade: true,
  is_wanted: false,
  disabled: false,
} as PokemonInstance & RelatedInstanceRecord);

const catalog = [{
  pokemon_id: 6,
  pokedex_number: 6,
  name: 'Charizard',
  attack: 223,
  defense: 173,
  stamina: 186,
  image_url: '/images/charizard.png',
  image_url_shiny: '/images/charizard-shiny.png',
  costumes: [],
  megaEvolutions: [],
  fusion: [],
  max: [],
}] as unknown as BasePokemon[];

describe('native trade activity rows', () => {
  it('hydrates both Pokémon from the authoritative related-instance envelope', () => {
    const rows = buildNativeTradeActivityRows({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      currentUsername: 'AdamZilla',
      moves: [],
      envelope: {
        trades: [{
          trade_id: 'trade-1',
          trade_status: 'proposed',
          username_proposed: 'AdamZilla',
          username_accepting: 'OtherTrainer',
          pokemon_instance_id_user_proposed: 'mine',
          pokemon_instance_id_user_accepting: 'theirs',
          trade_friendship_level: 'Best',
        }],
        related_instances: {
          mine: instance('mine', false),
          theirs: instance('theirs', true),
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].currentUserPokemon?.row).toMatchObject({
      id: 'mine',
      name: 'Charizard',
      imageUri: 'https://pokegonexus.com/images/charizard.png',
    });
    expect(rows[0].partnerPokemon?.row).toMatchObject({
      id: 'theirs',
      name: 'Shiny Charizard',
      imageUri: 'https://pokegonexus.com/images/charizard-shiny.png',
    });
  });

  it('drops malformed or unrelated records without breaking valid activity', () => {
    const rows = buildNativeTradeActivityRows({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      currentUsername: 'AdamZilla',
      moves: [],
      envelope: {
        trades: [
          {
            trade_id: 'not-mine',
            trade_status: 'pending',
            username_proposed: 'TrainerOne',
            username_accepting: 'TrainerTwo',
            pokemon_instance_id_user_proposed: 'mine',
            pokemon_instance_id_user_accepting: 'theirs',
          },
          {
            trade_id: 'deleted',
            trade_status: 'deleted',
            username_proposed: 'AdamZilla',
            username_accepting: 'TrainerTwo',
            pokemon_instance_id_user_proposed: 'mine',
            pokemon_instance_id_user_accepting: 'theirs',
          },
        ],
        related_instances: {
          mine: instance('mine', false),
          theirs: instance('theirs', true),
        },
      },
    });

    expect(rows).toEqual([]);
  });
});
