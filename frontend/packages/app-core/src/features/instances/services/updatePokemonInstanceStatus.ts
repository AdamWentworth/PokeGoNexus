// src/features/instances/services/updatePokemonInstanceStatus.ts
import { generateUUID, validateUUID } from '@/utils/PokemonIDUtils';
import { createScopedLogger } from '@/utils/logger';
import { createNewInstanceData } from '../utils/createNewInstanceData';
import { updateRegistrationStatus } from '../utils/updateRegistrationStatus';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { InstanceStatus, Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { FAVORITE_TO_TRADE_ERROR } from '@pokemongonexus/shared-domain/instances';

const log = createScopedLogger('updatePokemonInstanceStatus');

/**
 * Updates status flags for a Pokemon instance.
 * target may be an instance UUID or a variant_id (e.g. "0583-shiny").
 *
 * Returns the instance_id that was updated/created, or null on abort.
 */
export function updatePokemonInstanceStatus(
  target: string,
  newStatus: InstanceStatus, // "Caught" | "Trade" | "Wanted" | "Missing"
  variants: PokemonVariant[],
  instances: Instances,
  onAlert?: (message: string) => void,
): string | null {
  const isUuid = validateUUID(target);

  let instanceId: string | null = null;
  let variantKey: string | null = null;
  let instance: PokemonInstance | undefined;

  if (isUuid) {
    instanceId = target;
    instance = instances[instanceId];
    variantKey = instance?.variant_id ?? null;
  } else {
    variantKey = target; // treating input as variant_id

    // Try to reuse a placeholder of the same variant (baseline row)
    for (const [id, row] of Object.entries(instances)) {
      if (
        row.variant_id === variantKey &&
        !row.registered &&
        !row.is_wanted &&
        !row.is_for_trade &&
        !row.is_caught
      ) {
        instanceId = id;
        break;
      }
    }

    instance = instanceId ? instances[instanceId] : undefined;
  }

  const variantData = variants.find((v) => v.variant_id === variantKey) ?? null;
  if (!variantData) {
    log.error('No variant for', variantKey);
    return null;
  }

  if (!instanceId) {
    instanceId = generateUUID();
    const base = createNewInstanceData(variantData);
    base.instance_id = instanceId;
    instances[instanceId] = base;
    instance = base;
  }

  if (!instance) {
    log.error('No instance resolved for target', target);
    return null;
  }

  // Derive some flags from variantKey
  const vkey = (variantKey ?? '').toLowerCase();
  if (instance.pokemon_id === 2301 || instance.pokemon_id === 2302) {
    instance.purified = vkey.includes('default');
  }
  instance.dynamax = vkey.includes('dynamax');
  instance.gigantamax = vkey.includes('gigantamax');

  // Constraints for moving into Trade/Wanted
  if (newStatus === 'Trade' || newStatus === 'Wanted') {
    const isFusionPokemon = [2270, 2271].includes(instance.pokemon_id);

    if (instance.lucky || instance.shadow || instance.is_mega || instance.mega || isFusionPokemon) {
      const message = `Cannot move ${variantKey} to ${newStatus} as it is ${
        instance.lucky
          ? 'lucky'
          : instance.shadow
            ? 'shadow'
            : instance.is_mega || instance.mega
              ? 'mega'
              : 'a fusion Pokemon'
      }.`;
      onAlert?.(message);
      log.debug('Update blocked due to special status');
      return instanceId;
    }
  }

  if (newStatus === 'Trade' && instance.favorite) {
    onAlert?.(FAVORITE_TO_TRADE_ERROR);
    log.debug('Update blocked because favorite Pokémon cannot be listed For Trade');
    return instanceId;
  }

  switch (newStatus) {
    case 'Caught':
      instance.is_caught = true;
      instance.is_for_trade = false;
      instance.is_wanted = false;
      instance.most_wanted = false;
      instance.wanted_tags = [];
      instance.trade_tags = [];
      instance.registered = true;
      break;

    case 'Trade':
      instance.is_caught = true; // caught but flagged for trade
      instance.is_for_trade = true;
      instance.is_wanted = false;
      instance.most_wanted = false;
      instance.wanted_tags = [];
      instance.registered = true;
      break;

    case 'Wanted':
      if (instance.is_caught) {
        const newId = generateUUID();
        const wantedClone: PokemonInstance = {
          ...instance,
          instance_id: newId,
          is_wanted: true,
          is_caught: false,
          is_for_trade: false,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
          favorite: false,
          most_wanted: false,
          registered: true, // wanted entries are considered registered for tags logic
          last_update: Date.now(),
        };
        instances[newId] = wantedClone;
        updateRegistrationStatus(wantedClone, instances);
        updateRegistrationStatus(instance, instances);
        return newId;
      }

      instance.is_wanted = true;
      instance.is_caught = false;
      instance.is_for_trade = false;
      instance.caught_tags = [];
      instance.trade_tags = [];
      instance.favorite = false;
      {
        const anyCaught = Object.values(instances).some(
          (d) => d.variant_id === variantKey && d.is_caught,
        );
        instance.registered =
          instance.is_caught || instance.is_for_trade || instance.is_wanted || anyCaught;
      }
      return instanceId;

    case 'Missing': // baseline / not registered
      instance.is_caught = false;
      instance.is_for_trade = false;
      instance.is_wanted = false;
      instance.most_wanted = false;
      instance.favorite = false;
      instance.caught_tags = [];
      instance.trade_tags = [];
      instance.wanted_tags = [];
      instance.registered = false;
      break;
  }

  // Registered when any of the "visible" states are set
  instance.registered =
    instance.is_caught ||
    instance.is_for_trade ||
    instance.is_wanted ||
    !!instance.registered;

  updateRegistrationStatus(instance, instances);
  return instanceId;
}
