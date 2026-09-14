import { getPokemonGenders } from '@pokemongonexus/shared-domain/pokemon-gender';
import { resolvePokemonActiveFusionEntry } from '@pokemongonexus/shared-domain/pokemon-display';
import * as Crypto from 'expo-crypto';
import type {
  PokemonInstance,
  WantedSizePreferences,
} from '@pokemongonexus/shared-contracts/instances';
import {
  normalizeInstanceToken,
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { createNativeCollectionSyncBatch } from '../../services/collectionSyncApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { sendPendingNativeCollectionBatches } from './collectionSyncCoordinator';
import {
  createNativeCollectionMutation,
  type NativeCollectionMutation,
} from './collectionMutationModel';

type CollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'queue' | 'list' | 'markAttemptFailed' | 'markAcknowledged' | 'removeAcknowledged'
>;

export type NativeInstanceDetailPatch = Partial<Pick<
  PokemonInstance,
  | 'attack_iv'
  | 'charged_move1_id'
  | 'charged_move2_id'
  | 'cp'
  | 'crown'
  | 'date_caught'
  | 'defense_iv'
  | 'fast_move_id'
  | 'favorite'
  | 'friendship_level'
  | 'fused_with'
  | 'fusion'
  | 'fusion_form'
  | 'gender'
  | 'height'
  | 'is_fused'
  | 'is_mega'
  | 'is_traded'
  | 'level'
  | 'lucky'
  | 'location_card'
  | 'location_caught'
  | 'mega'
  | 'mega_form'
  | 'max_attack'
  | 'max_guard'
  | 'max_spirit'
  | 'most_wanted'
  | 'nickname'
  | 'original_trainer_id'
  | 'original_trainer_name'
  | 'pokeball'
  | 'pref_lucky'
  | 'purified'
  | 'shadow'
  | 'stamina_iv'
  | 'traded_date'
  | 'wanted_size_preferences'
  | 'weight'
>>;

const assertNullableFinite = (
  label: string,
  value: number | null | undefined,
  minimum: number,
  maximum: number,
): void => {
  if (value == null) return;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
};

const assertNullableInteger = (
  label: string,
  value: number | null | undefined,
  minimum: number,
  maximum: number,
): void => {
  assertNullableFinite(label, value, minimum, maximum);
  if (value != null && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
};

const normalizeNullableText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined || value === null) return value;
  const normalized = value.trim();
  return normalized || null;
};

const normalizeMaxMoveLevel = (
  label: string,
  value: string | number | null | undefined,
  minimum: number,
): number | null | undefined => {
  if (value === undefined || value === null || value === '') return value === '' ? null : value;
  const normalized = typeof value === 'number' ? value : Number(value);
  assertNullableInteger(label, normalized, minimum, 3);
  return normalized;
};

const normalizeWantedSizePreferences = (
  value: WantedSizePreferences | null | undefined,
): WantedSizePreferences | null | undefined => {
  if (value === undefined || value === null) return value;
  const categories = new Set(['XXS', 'XS', 'XL', 'XXL']);
  for (const [label, range] of Object.entries(value)) {
    if (!range) continue;
    if (!categories.has(range.category)) throw new Error(`${label} size preference is invalid.`);
    if (range.min != null && !Number.isFinite(range.min)) throw new Error(`${label} minimum is invalid.`);
    if (range.max != null && !Number.isFinite(range.max)) throw new Error(`${label} maximum is invalid.`);
  }
  return value;
};

export const normalizeNativeInstanceDetailPatch = (
  patch: NativeInstanceDetailPatch,
): NativeInstanceDetailPatch => {
  assertNullableInteger('CP', patch.cp, 10, 100_000);
  assertNullableFinite('Level', patch.level, 1, 51);
  if (patch.level != null && Math.round(patch.level * 2) !== patch.level * 2) {
    throw new Error('Level must use half-level steps.');
  }
  assertNullableInteger('Attack IV', patch.attack_iv, 0, 15);
  assertNullableInteger('Defense IV', patch.defense_iv, 0, 15);
  assertNullableInteger('HP IV', patch.stamina_iv, 0, 15);
  assertNullableFinite('Weight', patch.weight, 0, 100_000);
  assertNullableFinite('Height', patch.height, 0, 10_000);
  assertNullableInteger('Friendship', patch.friendship_level, 0, 5);
  assertNullableInteger('Fast move', patch.fast_move_id, 1, Number.MAX_SAFE_INTEGER);
  assertNullableInteger('Charged move', patch.charged_move1_id, 1, Number.MAX_SAFE_INTEGER);
  assertNullableInteger('Second charged move', patch.charged_move2_id, 1, Number.MAX_SAFE_INTEGER);
  const maxAttack = normalizeMaxMoveLevel('Max Attack', patch.max_attack, 1);
  const maxGuard = normalizeMaxMoveLevel('Max Guard', patch.max_guard, 0);
  const maxSpirit = normalizeMaxMoveLevel('Max Spirit', patch.max_spirit, 0);

  const nickname = normalizeNullableText(patch.nickname);
  if (nickname && nickname.length > 12) throw new Error('Nickname must be 12 characters or fewer.');
  const gender = normalizeNullableText(patch.gender);
  if (gender && !['Male', 'Female', 'Genderless'].includes(gender)) {
    throw new Error('Gender selection is invalid.');
  }
  const pokeball = normalizeNullableText(patch.pokeball);
  if (pokeball && ![
    'poke_ball',
    'great_ball',
    'ultra_ball',
    'premier_ball',
    'master_ball',
    'safari_ball',
    'beast_ball',
  ].includes(pokeball)) {
    throw new Error('Poké Ball selection is invalid.');
  }
  if (patch.lucky && patch.is_traded === false) {
    throw new Error('Lucky Pokémon are always traded.');
  }
  if (patch.shadow && patch.purified) {
    throw new Error('A Pokémon cannot be Shadow and Purified at the same time.');
  }
  if (patch.is_fused === true && (!patch.fused_with || !patch.fusion_form)) {
    throw new Error('Choose a fusion partner before saving this form.');
  }
  if (patch.is_fused === true && (patch.shadow || patch.purified || patch.is_mega || patch.crown)) {
    throw new Error('Fusion cannot be combined with Shadow, Purified, Mega, or Crowned state.');
  }

  const appearanceInvariant = patch.shadow === true
    ? {
        shadow: true,
        purified: false,
        lucky: false,
        is_traded: false,
        is_mega: false,
        mega_form: null,
        crown: false,
        is_fused: false,
        fused_with: null,
        fusion_form: null,
      }
    : patch.purified === true
      ? { shadow: false, purified: true }
      : {};
  const megaInvariant = patch.is_mega === true
    ? { is_mega: true, mega: true }
    : patch.is_mega === false
      ? { is_mega: false, mega_form: null }
      : {};
  const fusionInvariant = patch.is_fused === true
    ? {
        is_fused: true,
        shadow: false,
        purified: false,
        is_mega: false,
        mega_form: null,
        crown: false,
      }
    : patch.is_fused === false
      ? {
        is_fused: false,
        fused_with: null,
        fusion_form: patch.crown ? patch.fusion_form ?? null : null,
      }
      : {};

  return {
    ...patch,
    max_attack: maxAttack,
    max_guard: maxGuard,
    max_spirit: maxSpirit,
    nickname,
    gender,
    original_trainer_id: normalizeNullableText(patch.original_trainer_id),
    original_trainer_name: normalizeNullableText(patch.original_trainer_name),
    fused_with: normalizeNullableText(patch.fused_with),
    fusion_form: normalizeNullableText(patch.fusion_form),
    pokeball,
    location_card: normalizeNullableText(patch.location_card),
    location_caught: normalizeNullableText(patch.location_caught),
    date_caught: normalizeNullableText(patch.date_caught),
    traded_date: normalizeNullableText(patch.traded_date),
    wanted_size_preferences: normalizeWantedSizePreferences(patch.wanted_size_preferences),
    ...appearanceInvariant,
    ...megaInvariant,
    ...fusionInvariant,
  };
};

export const persistNativeInstanceDetailMutation = async ({
  userId,
  snapshot,
  requestedInstanceId,
  patch,
  outbox,
  receiverClient,
  onQueued,
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
  sendImmediately = true,
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  requestedInstanceId: string;
  patch: NativeInstanceDetailPatch;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (mutation: NativeCollectionMutation) => Promise<void> | void;
  syncBatchId?: string;
  now?: number;
  /** Tests and non-UI callers may await Receiver; the native editor queues first and syncs in background. */
  sendImmediately?: boolean;
}) => {
  const normalizedPatch = normalizeNativeInstanceDetailPatch(patch);
  const mutation = createNativeCollectionMutation({
    instances: snapshot.instances,
    requestedInstanceId,
    patch: normalizedPatch,
    syncBatchId,
    now,
  });
  // Leave historical records alone on unrelated edits, but reject a new
  // impossible value before anything reaches the outbox or Receiver.
  if (normalizedPatch.gender !== undefined && normalizedPatch.gender !== mutation.previous.gender) {
    const species = snapshot.catalog.find((pokemon) => pokemon.pokemon_id === mutation.previous.pokemon_id);
    const allowed = getPokemonGenders(species?.gender_rate, Boolean(mutation.previous.is_wanted));
    if (normalizedPatch.gender != null && !allowed.some((gender) => gender === normalizedPatch.gender)) {
      throw new Error('This gender is not available for this Pokémon.');
    }
    if (normalizedPatch.gender == null && allowed.length === 1) {
      throw new Error('This Pokémon has a fixed gender.');
    }
  }
  const companionPatches = new Map<string, Partial<PokemonInstance>>();
  const mainRef = mutation.updated.instance_id;
  const mainToken = normalizeInstanceToken(mainRef);
  const previousPartnerKey = mutation.previous.fused_with
    ? resolveInstanceCollectionKey(snapshot.instances, mutation.previous.fused_with)
    : null;
  const desiredPartnerKey = normalizedPatch.is_fused === true && normalizedPatch.fused_with
    ? resolveInstanceCollectionKey(snapshot.instances, normalizedPatch.fused_with)
    : null;

  if (normalizedPatch.is_fused !== undefined) {
    if (previousPartnerKey && previousPartnerKey !== desiredPartnerKey) {
      companionPatches.set(previousPartnerKey, {
        disabled: false,
        fused_with: null,
        is_fused: false,
        fusion_form: null,
      });
    }
    if (normalizedPatch.is_fused === false) {
      for (const [key, candidate] of Object.entries(snapshot.instances)) {
        if (!candidate.fused_with) continue;
        if (normalizeInstanceToken(candidate.fused_with) !== mainToken) continue;
        companionPatches.set(key, {
          disabled: false,
          fused_with: null,
          is_fused: false,
          fusion_form: null,
        });
      }
    }
    if (normalizedPatch.is_fused === true) {
      if (!mutation.previous.is_caught || mutation.previous.is_for_trade || mutation.previous.is_wanted || mutation.previous.disabled) {
        throw new Error('Only an available caught Pokémon can be fused.');
      }
      if (!desiredPartnerKey) throw new Error('The selected fusion partner is no longer in your collection.');
      if (desiredPartnerKey === mutation.collectionKey) throw new Error('A Pokémon cannot fuse with itself.');
      const partner = snapshot.instances[desiredPartnerKey];
      const fusionDefinition = resolvePokemonActiveFusionEntry({
        isFused: true,
        fusionForm: normalizedPatch.fusion_form,
        // Registration history is not the active form. Resolve the explicit
        // choice first, using the same identity rules as the displayed form.
        fusionEntries: snapshot.catalog
          .find((pokemon) => pokemon.pokemon_id === mutation.previous.pokemon_id)
          ?.fusion.filter((candidate) => candidate.base_pokemon_id1 === mutation.previous.pokemon_id),
        storedFusion: normalizedPatch.fusion,
      });
      if (!fusionDefinition) {
        throw new Error('The selected fusion form is not available for this Pokémon.');
      }
      if (partner?.pokemon_id !== fusionDefinition.base_pokemon_id2) {
        throw new Error(`This fusion requires ${fusionDefinition.name}'s matching partner.`);
      }
      const alreadyLinked = normalizeInstanceToken(partner?.fused_with) === mainToken;
      if (!partner?.is_caught) throw new Error('The selected fusion partner is not caught.');
      if (!alreadyLinked && partner.is_for_trade) {
        throw new Error('Remove the fusion partner from For Trade before fusing.');
      }
      if (!alreadyLinked && (partner.disabled || partner.is_fused)) {
        throw new Error('The selected fusion partner is already committed to another form.');
      }
      companionPatches.set(desiredPartnerKey, {
        disabled: true,
        fused_with: mainRef,
        is_fused: true,
        fusion_form: normalizedPatch.fusion_form ?? null,
      });
    }
  }

  const companionMutations = [...companionPatches.entries()].flatMap(([key, companionPatch]) => {
    const previous = snapshot.instances[key];
    const changed = previous && Object.entries(companionPatch).some(
      ([field, value]) => !Object.is(previous[field], value),
    );
    if (!changed) return [];
    return [createNativeCollectionMutation({
      instances: snapshot.instances,
      requestedInstanceId: key,
      patch: companionPatch,
      syncBatchId,
      now,
    })];
  });
  const batch = createNativeCollectionSyncBatch({
    syncBatchId,
    location: null,
    updates: [mutation.updated, ...companionMutations.map((entry) => entry.updated)],
  });
  await outbox.queue(userId, batch, now);
  for (const queuedMutation of [mutation, ...companionMutations]) {
    await onQueued?.(queuedMutation);
  }
  if (!sendImmediately) {
    return {
      mutation,
      companionMutations,
      syncState: 'pending' as const,
      message: 'Pokémon details saved.',
    };
  }
  const sent = await sendPendingNativeCollectionBatches({ userId, outbox, receiverClient });
  return {
    mutation,
    companionMutations,
    syncState: sent.failedBatchId ? 'pending' as const : 'acknowledged' as const,
    message: sent.failedBatchId
      ? 'Details saved on this device. They will sync when Receiver is available.'
      : 'Pokémon details saved. Receiver accepted the update.',
  };
};
