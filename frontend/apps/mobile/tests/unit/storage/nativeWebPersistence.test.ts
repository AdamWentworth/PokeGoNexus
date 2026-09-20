import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionSyncUpdate } from '../../../src/services/collectionSyncApi';
import { createNativeCollectionCache } from '../../../src/storage/nativeCollectionCache.web';
import { createNativeCollectionOutbox } from '../../../src/storage/nativeCollectionOutbox.web';
import { createNativePokedexRegistrationStore } from '../../../src/storage/nativePokedexRegistrations.web';

const syncUpdate = (): NativeCollectionSyncUpdate => ({
  attack_iv: null,
  caught_tags: [],
  charged_move1_id: null,
  charged_move2_id: null,
  costume_id: null,
  cp: 500,
  crown: false,
  date_added: '2026-08-28T00:00:00.000Z',
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
  instance_id: 'web-instance-1',
  is_caught: true,
  is_for_trade: false,
  is_fused: false,
  is_mega: false,
  is_traded: false,
  is_wanted: false,
  last_update: 1_788_000_000_000,
  level: 20,
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
  shiny: true,
  stamina_iv: null,
  trade_filters: null,
  trade_tags: [],
  traded_date: null,
  variant_id: '0001-shiny',
  wanted_filters: null,
  wanted_tags: [],
  weight: null,
});

describe('native web persistence adapters', () => {
  it('persists a collection snapshot across adapter instances', async () => {
    const userId = `web-cache-${Date.now()}`;
    const first = createNativeCollectionCache();
    const second = createNativeCollectionCache();
    const instance = syncUpdate() as PokemonInstance;
    const instanceId = String(instance.instance_id);

    await first.write(userId, {
      catalog: [],
      instances: { [instanceId]: instance },
    }, 1234);

    await expect(second.read(userId)).resolves.toEqual(expect.objectContaining({
      savedAt: 1234,
      snapshot: expect.objectContaining({
        instances: expect.objectContaining({
          [instanceId]: expect.objectContaining({ variant_id: '0001-shiny' }),
        }),
      }),
    }));
  });

  it('retains outbox state changes until acknowledged rows are removed', async () => {
    const userId = `web-outbox-${Date.now()}`;
    const outbox = createNativeCollectionOutbox();
    const batch = {
      location: null,
      pokemonUpdates: [syncUpdate()],
      sync_batch_id: 'web-batch-1',
    };

    await outbox.queue(userId, batch, 100);
    await outbox.markAttemptFailed(userId, batch.sync_batch_id, 'offline', 150);
    await expect(outbox.list(userId, 'pending')).resolves.toEqual([
      expect.objectContaining({ attemptCount: 1, lastError: 'offline', state: 'pending' }),
    ]);

    await outbox.markAcknowledged(userId, batch.sync_batch_id, 200);
    await expect(outbox.list(userId, 'acknowledged')).resolves.toHaveLength(1);
    await outbox.removeAcknowledged(userId, [batch.sync_batch_id]);
    await expect(outbox.list(userId)).resolves.toEqual([]);
  });

  it('persists and removes manual Pokédex registrations', async () => {
    const userId = `web-pokedex-${Date.now()}`;
    const first = createNativePokedexRegistrationStore();
    const second = createNativePokedexRegistrationStore();
    const registration = {
      entryId: '0001-shiny',
      facets: { lucky: true as const },
      registrationId: '0001-shiny|lucky:true',
    };

    await first.register(userId, [registration]);
    await expect(second.read(userId)).resolves.toEqual([registration]);
    await second.unregister(userId, [registration.registrationId]);
    await expect(first.read(userId)).resolves.toEqual([]);
  });
});
