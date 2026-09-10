import * as Crypto from 'expo-crypto';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildPokemonCatalogEntries,
  type PokemonCatalogEntry,
} from '@pokemongonexus/shared-domain/catalog';
import { createNativeCollectionSyncBatch } from '../../services/collectionSyncApi';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { sendPendingNativeCollectionBatches } from './collectionSyncCoordinator';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import { normalizeNativeInstance, normalizeNativeTagIds } from './nativeInstanceNormalization';
import {
  isNativeCatalogFormCandidate,
  resolveNativeCatalogForm,
  type NativeCatalogCopyChoice,
  type NativeCatalogForm,
  type NativeCatalogFormChoice,
} from './nativeCatalogFormModel';

export type NativeCatalogDestination = 'caught' | 'trade' | 'wanted';

export type NativeCatalogOrganizerRequest = {
  variantIds: string[];
  destination: NativeCatalogDestination;
  customTagIds?: string[];
  favorite?: boolean;
  mostWanted?: boolean;
  formChoices?: Record<string, NativeCatalogFormChoice>;
};

/** Preserve legacy collection keys without rescanning the collection per addition. */
export const mergeNativeCatalogInstances = (
  current: Record<string, PokemonInstance>,
  updates: PokemonInstance[],
): Record<string, PokemonInstance> => {
  const keysById = new Map<string, string>();
  for (const [key, instance] of Object.entries(current)) {
    const id = instance.instance_id || key;
    if (!keysById.has(id)) keysById.set(id, key);
  }
  const merged = { ...current };
  for (const instance of updates) {
    if (!instance.instance_id) continue;
    const key = current[instance.instance_id] ? instance.instance_id
      : keysById.get(instance.instance_id) ?? instance.instance_id;
    merged[key] = instance;
  }
  return merged;
};

const variantSuffix = (entry: PokemonCatalogEntry): string =>
  entry.id.slice(entry.id.indexOf('-') + 1).toLowerCase();

export const createNativeInstanceFromCatalogEntry = ({
  entry,
  pokemon,
  destination,
  instanceId,
  now = Date.now(),
}: {
  entry: PokemonCatalogEntry;
  pokemon: BasePokemon;
  destination: NativeCatalogDestination;
  instanceId: string;
  now?: number;
}): PokemonInstance => {
  const suffix = variantSuffix(entry);
  const shiny = suffix.includes('shiny');
  const shadow = suffix.includes('shadow');
  const isMega = suffix.startsWith('mega') || suffix.startsWith('shiny_mega')
    || suffix === 'primal' || suffix === 'shiny_primal';
  const isFused = suffix.startsWith('fusion_') || suffix.startsWith('shiny_fusion_');
  if (destination !== 'caught' && (shadow || isMega || isFused)) {
    const reason = shadow ? 'Shadow' : isMega ? 'Mega or Primal' : 'fusion';
    throw new Error(`${reason} Pokémon cannot be added to ${destination === 'trade' ? 'For Trade' : 'Wanted'}.`);
  }
  if (isMega || isFused) {
    throw new Error('Choose the Pokémon for this Mega, Primal, or fusion form before adding it.');
  }

  const costume = pokemon.costumes?.find((candidate) =>
    entry.id === `${String(pokemon.pokemon_id).padStart(4, '0')}-${candidate.name}_default`
    || entry.id === `${String(pokemon.pokemon_id).padStart(4, '0')}-${candidate.name}_shiny`
    || entry.id === `${String(pokemon.pokemon_id).padStart(4, '0')}-shadow_${candidate.name}_default`
    || entry.id === `${String(pokemon.pokemon_id).padStart(4, '0')}-shadow_${candidate.name}_shiny`);
  const crownId = suffix.includes('crown_')
    ? Number.parseInt(suffix.split('crown_')[1] ?? '', 10)
    : Number.NaN;
  const crown = Number.isFinite(crownId)
    ? pokemon.crownForms?.find((candidate) => candidate.id === crownId)
    : undefined;

  return {
    instance_id: instanceId,
    variant_id: entry.id,
    pokemon_id: entry.pokemonId,
    nickname: null,
    cp: null,
    level: null,
    attack_iv: null,
    defense_iv: null,
    stamina_iv: null,
    shiny,
    costume_id: costume?.costume_id ?? null,
    lucky: false,
    shadow,
    purified: false,
    fast_move_id: null,
    charged_move1_id: null,
    charged_move2_id: null,
    weight: null,
    height: null,
    gender: null,
    mega: false,
    mega_form: null,
    is_mega: false,
    dynamax: suffix.includes('dynamax'),
    gigantamax: suffix.includes('gigantamax'),
    crown: Boolean(crown),
    max_attack: null,
    max_guard: null,
    max_spirit: null,
    is_fused: false,
    fusion: null,
    fusion_form: crown?.display_form ?? null,
    fused_with: null,
    is_traded: false,
    traded_date: null,
    original_trainer_id: null,
    original_trainer_name: null,
    is_caught: destination !== 'wanted',
    is_for_trade: destination === 'trade',
    is_wanted: destination === 'wanted',
    most_wanted: false,
    caught_tags: [],
    trade_tags: [],
    wanted_tags: [],
    not_trade_list: {},
    not_wanted_list: {},
    trade_filters: {},
    wanted_filters: {},
    wanted_size_preferences: null,
    mirror: false,
    pref_lucky: false,
    friendship_level: null,
    registered: true,
    favorite: false,
    disabled: false,
    pokeball: null,
    location_card: null,
    location_caught: null,
    date_caught: null,
    date_added: new Date(now).toISOString(),
    last_update: now,
    gps: null,
  };
};

type CollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'queue' | 'list' | 'markAttemptFailed' | 'markAcknowledged' | 'removeAcknowledged'
>;

export const persistNativeCatalogAdditions = async ({
  userId,
  snapshot,
  request,
  outbox,
  receiverClient,
  onQueued,
  instanceIds,
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  request: NativeCatalogOrganizerRequest;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (instances: PokemonInstance[]) => Promise<void> | void;
  instanceIds?: string[];
  syncBatchId?: string;
  now?: number;
}) => {
  const requestedIds = [...new Set(request.variantIds.filter(Boolean))];
  if (requestedIds.length === 0) throw new Error('Select at least one Pokémon.');
  if (request.destination === 'trade' && request.favorite) {
    throw new Error('Favorite Pokémon cannot be listed For Trade.');
  }
  if (request.destination !== 'wanted' && request.mostWanted) {
    throw new Error('Most Wanted is only available for wanted Pokémon.');
  }
  const entriesById = new Map(
    buildPokemonCatalogEntries(snapshot.catalog).map((entry) => [entry.id, entry]),
  );
  const pokemonById = new Map(
    snapshot.catalog.map((pokemon) => [pokemon.pokemon_id, pokemon]),
  );
  const tagIds = [...new Set((request.customTagIds ?? []).filter(Boolean))];
  const instances: PokemonInstance[] = [];
  const usedKeys = new Set<string>();
  let createdCount = 0;
  const createCopy = (entry: PokemonCatalogEntry, pokemon: BasePokemon): PokemonInstance => {
    const index = createdCount++;
    return createNativeInstanceFromCatalogEntry({
      entry, pokemon, destination: request.destination,
      instanceId: instanceIds?.[index] ?? Crypto.randomUUID(), now: now + index,
    });
  };
  const chooseCopy = (
    choice: NativeCatalogCopyChoice,
    form: NativeCatalogForm,
    side: 'base' | 'partner',
  ): PokemonInstance => {
    if (choice.kind === 'existing') {
      const key = resolveInstanceCollectionKey(snapshot.instances, choice.instanceId);
      const previous = key ? snapshot.instances[key] : null;
      if (!key || !previous || !isNativeCatalogFormCandidate(previous, form, side)) {
        throw new Error('A selected Pokémon is no longer available for this form. Choose another copy.');
      }
      if (usedKeys.has(key)) throw new Error('Choose a different Pokémon for each form and fusion partner.');
      usedKeys.add(key);
      return {
        ...normalizeNativeInstance(previous),
        instance_id: previous.instance_id || key,
        last_update: Math.max(now, (previous.last_update || 0) + 1),
      };
    }
    const pokemon = side === 'partner' && form.kind === 'fusion' ? form.partner : form.pokemon;
    const shiny = side === 'base' && form.shiny;
    const baseId = `${String(pokemon.pokemon_id).padStart(4, '0')}-${shiny ? 'shiny' : 'default'}`;
    const base = entriesById.get(baseId);
    if (!base) throw new Error(`The base form of ${pokemon.name} is unavailable.`);
    return createCopy(base, pokemon);
  };
  for (const variantId of requestedIds) {
    const entry = entriesById.get(variantId);
    if (!entry) throw new Error(`The selected Pokémon variant ${variantId} is no longer available.`);
    const pokemon = pokemonById.get(entry.pokemonId);
    if (!pokemon) throw new Error(`The selected Pokémon ${entry.name} is no longer in the catalog.`);
    const form = resolveNativeCatalogForm(snapshot.catalog, variantId);
    let instance: PokemonInstance;
    let partner: PokemonInstance | null = null;
    if (form) {
      if (request.destination !== 'caught') throw new Error('Mega, Primal, and fusion Pokémon can only be added to Caught.');
      const choice = request.formChoices?.[variantId];
      if (!choice || choice.kind !== form.kind) throw new Error('Choose the Pokémon for each Mega, Primal, or fusion form.');
      instance = chooseCopy(choice.base, form, 'base');
      if (form.kind === 'mega') {
        instance = { ...instance, mega: true, is_mega: true, mega_form: form.mega.form ?? null };
      } else if (choice.kind === 'fusion') {
        partner = chooseCopy(choice.partner, form, 'partner');
        instance = {
          ...instance, is_fused: true, fused_with: partner.instance_id!,
          fusion_form: form.fusion.name,
          fusion: { ...instance.fusion, [form.fusion.fusion_id!]: true },
        };
        partner = {
          ...partner, is_fused: true, disabled: true,
          fused_with: instance.instance_id!, fusion_form: form.fusion.name,
        };
      }
    } else {
      instance = createCopy(entry, pokemon);
    }
    instances.push({
      ...instance,
      favorite: request.destination === 'caught' && (Boolean(instance.favorite) || Boolean(request.favorite)),
      most_wanted: request.destination === 'wanted' && Boolean(request.mostWanted),
      caught_tags: request.destination === 'wanted' ? [] : [...new Set([...normalizeNativeTagIds(instance.caught_tags), ...tagIds])],
      wanted_tags: request.destination === 'wanted' ? tagIds : [],
    });
    if (partner) instances.push(partner);
  }
  const batch = createNativeCollectionSyncBatch({
    syncBatchId,
    location: null,
    updates: instances.map((instance) => ({
      ...instance,
      instance_id: instance.instance_id!,
    })),
  });
  await outbox.queue(userId, batch, now);
  await onQueued?.(instances);
  const sent = await sendPendingNativeCollectionBatches({ userId, outbox, receiverClient });
  return {
    instances,
    syncState: sent.failedBatchId ? 'pending' as const : 'acknowledged' as const,
    message: sent.failedBatchId
      ? `${requestedIds.length} Pokémon saved on this device. They will sync when Receiver is available.`
      : `${requestedIds.length} Pokémon saved. Receiver accepted the change.`,
  };
};

export const persistNativeCatalogAddition = async ({
  userId,
  snapshot,
  entry,
  destination,
  outbox,
  receiverClient,
  onQueued,
  instanceId = Crypto.randomUUID(),
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
  formChoices,
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  entry: PokemonCatalogEntry;
  destination: NativeCatalogDestination;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (instance: PokemonInstance) => Promise<void> | void;
  instanceId?: string;
  syncBatchId?: string;
  now?: number;
  formChoices?: NativeCatalogOrganizerRequest['formChoices'];
}) => {
  const result = await persistNativeCatalogAdditions({
    userId, snapshot, request: { variantIds: [entry.id], destination, formChoices },
    outbox, receiverClient, instanceIds: [instanceId], syncBatchId, now,
    onQueued: async (instances) => { for (const instance of instances) await onQueued?.(instance); },
  });
  return {
    instance: result.instances[0]!,
    syncState: result.syncState,
    message: result.message,
  };
};
