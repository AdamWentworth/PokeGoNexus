import { createNativeInstanceFromCatalogEntry, persistNativeCatalogAdditions } from '../../../../src/features/collection/nativeCatalogMutation';
import type { NativeCatalogOrganizerRequest } from '../../../../src/features/collection/nativeCatalogMutation';
import { caughtCopy, formCatalog } from '../../../fixtures/nativeCatalogForms';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { persistNativeInstanceDetailMutation } from '../../../../src/features/collection/nativeInstanceDetailMutation';

const existing = (instanceId: string) => ({ kind: 'existing' as const, instanceId });
const run = (request: NativeCatalogOrganizerRequest, instances: Record<string, PokemonInstance> = {}) => {
  const outbox = { queue: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), markAttemptFailed: jest.fn(), markAcknowledged: jest.fn(), removeAcknowledged: jest.fn() };
  const onQueued = jest.fn();
  const promise = persistNativeCatalogAdditions({
    userId: 'owner', snapshot: { catalog: formCatalog, instances }, request, outbox,
    receiverClient: { post: jest.fn() }, onQueued, instanceIds: ['new-1', 'new-2', 'new-3'], syncBatchId: 'batch', now: 100,
  });
  return { promise, outbox, onQueued };
};

describe('catalog form additions', () => {
  it.each([['0006-mega_x', 6, 'X'], ['0383-primal', 383, null]] as const)(
    'evolves an existing copy for %s while retaining identity, stats, tags, and favorite', async (variantId, pokemonId, megaForm) => {
      const source = caughtCopy('owned', pokemonId);
      const { promise, outbox } = run({ variantIds: [variantId], destination: 'caught', customTagIds: ['new-tag'], formChoices: { [variantId]: { kind: 'mega', base: existing('owned') } } }, { legacyKey: source });
      const result = await promise;
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0]).toMatchObject({ instance_id: 'owned', variant_id: source.variant_id, cp: 3210, level: 40, attack_iv: 15, favorite: true, caught_tags: ['old-tag', 'new-tag'], mega: true, is_mega: true, mega_form: megaForm, last_update: 501 });
      expect(source.is_mega).toBe(false);
      expect(outbox.queue.mock.calls[0][1].pokemonUpdates).toHaveLength(1);
    });

  it('creates a shiny Mega base only when explicitly requested', async () => {
    const result = await run({ variantIds: ['0006-shiny_mega_x'], destination: 'caught', formChoices: { '0006-shiny_mega_x': { kind: 'mega', base: { kind: 'new' } } } }).promise;
    expect(result.instances[0]).toMatchObject({ instance_id: 'new-1', variant_id: '0006-shiny', shiny: true, is_mega: true, mega_form: 'X' });
  });

  it('links both existing fusion copies in one batch and preserves the partner’s data', async () => {
    const { promise, outbox } = run({ variantIds: ['0646-fusion_1'], destination: 'caught', customTagIds: ['fusion-tag'], formChoices: { '0646-fusion_1': { kind: 'fusion', base: existing('base'), partner: existing('partner') } } }, { base: caughtCopy('base', 646), partner: caughtCopy('partner', 644, { shiny: true }) });
    const result = await promise;
    expect(result.instances).toEqual([
      expect.objectContaining({ instance_id: 'base', cp: 3210, is_fused: true, fused_with: 'partner', fusion: { 1: true }, fusion_form: 'Black Kyurem', disabled: false, caught_tags: ['old-tag', 'fusion-tag'] }),
      expect.objectContaining({ instance_id: 'partner', cp: 3210, shiny: true, is_fused: true, fused_with: 'base', disabled: true, caught_tags: ['old-tag'] }),
    ]);
    expect(outbox.queue).toHaveBeenCalledTimes(1);
    expect(outbox.queue.mock.calls[0][1].pokemonUpdates).toHaveLength(2);
  });

  it('creates and links two base copies for a new shiny fusion', async () => {
    const result = await run({ variantIds: ['0646-shiny_fusion_1'], destination: 'caught', formChoices: { '0646-shiny_fusion_1': { kind: 'fusion', base: { kind: 'new' }, partner: { kind: 'new' } } } }).promise;
    expect(result.instances).toEqual([
      expect.objectContaining({ variant_id: '0646-shiny', shiny: true, instance_id: 'new-1', fused_with: 'new-2', is_fused: true }),
      expect.objectContaining({ variant_id: '0644-default', shiny: false, instance_id: 'new-2', fused_with: 'new-1', disabled: true }),
    ]);
  });

  it('supports an existing base and a newly created fusion partner', async () => {
    const result = await run({ variantIds: ['0646-fusion_1'], destination: 'caught', formChoices: { '0646-fusion_1': { kind: 'fusion', base: existing('base'), partner: { kind: 'new' } } } }, { base: caughtCopy('base', 646) }).promise;
    expect(result.instances.map((copy) => [copy.instance_id, copy.fused_with])).toEqual([['base', 'new-1'], ['new-1', 'base']]);
  });

  it('can unfuse a newly created pair through the existing detail workflow', async () => {
    const result = await run({ variantIds: ['0646-fusion_1'], destination: 'caught', formChoices: { '0646-fusion_1': { kind: 'fusion', base: { kind: 'new' }, partner: { kind: 'new' } } } }).promise;
    const outbox = { queue: jest.fn(), list: jest.fn().mockResolvedValue([]), markAttemptFailed: jest.fn(), markAcknowledged: jest.fn(), removeAcknowledged: jest.fn() };
    const unfused = await persistNativeInstanceDetailMutation({
      userId: 'owner', snapshot: { catalog: formCatalog, instances: Object.fromEntries(result.instances.map((instance) => [instance.instance_id!, instance])) },
      requestedInstanceId: 'new-1', patch: { is_fused: false }, outbox, receiverClient: { post: jest.fn() }, syncBatchId: 'unfuse', now: 600,
    });
    expect(unfused.mutation.updated).toMatchObject({ variant_id: '0646-default', is_fused: false, fused_with: null });
    expect(unfused.companionMutations[0].updated).toMatchObject({ variant_id: '0644-default', disabled: false, is_fused: false, fused_with: null });
  });

  it('retains both fusion records together when Receiver is offline', async () => {
    const queued: unknown[] = [];
    const outbox = {
      queue: jest.fn(async (_user, batch) => { queued.push({ userId: 'owner', batch, state: 'pending' }); }),
      list: jest.fn(async () => queued as never), markAttemptFailed: jest.fn(), markAcknowledged: jest.fn(), removeAcknowledged: jest.fn(),
    };
    const onQueued = jest.fn();
    const receiverClient = { post: jest.fn().mockRejectedValue(new Error('offline')) };
    const result = await persistNativeCatalogAdditions({
      userId: 'owner', snapshot: { catalog: formCatalog, instances: {} },
      request: { variantIds: ['0646-fusion_1'], destination: 'caught', formChoices: { '0646-fusion_1': { kind: 'fusion', base: { kind: 'new' }, partner: { kind: 'new' } } } },
      outbox, receiverClient, onQueued, instanceIds: ['a', 'b'], syncBatchId: 'offline-batch', now: 100,
    });
    expect(result.syncState).toBe('pending');
    expect(outbox.queue).toHaveBeenCalledTimes(1);
    expect(outbox.queue.mock.calls[0][1].pokemonUpdates).toHaveLength(2);
    expect(onQueued.mock.invocationCallOrder[0]).toBeLessThan(receiverClient.post.mock.invocationCallOrder[0]);
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith('owner', 'offline-batch', 'offline');
  });

  it.each([
    { is_for_trade: true }, { is_wanted: true }, { is_caught: false }, { is_fused: true },
    { disabled: true }, { shadow: true }, { purified: true }, { is_mega: true }, { crown: true }, { pokemon_id: 6 },
  ])('rejects stale/ineligible fusion choices before queueing any part of a mixed batch: %j', async (patch) => {
    const { promise, outbox, onQueued } = run({ variantIds: ['0006-default', '0646-fusion_1'], destination: 'caught', formChoices: { '0646-fusion_1': { kind: 'fusion', base: existing('base'), partner: existing('partner') } } }, { base: caughtCopy('base', 646), partner: caughtCopy('partner', 644, patch) });
    await expect(promise).rejects.toThrow('no longer available');
    expect(outbox.queue).not.toHaveBeenCalled(); expect(onQueued).not.toHaveBeenCalled();
  });

  it('rejects reusing the same caught copy for two selected forms', async () => {
    const { promise, outbox } = run({ variantIds: ['0006-mega_x', '0006-mega_y'], destination: 'caught', formChoices: {
      '0006-mega_x': { kind: 'mega', base: existing('owned') }, '0006-mega_y': { kind: 'mega', base: existing('owned') },
    } }, { owned: caughtCopy('owned', 6) });
    await expect(promise).rejects.toThrow('different Pokémon'); expect(outbox.queue).not.toHaveBeenCalled();
  });

  it.each(['0006-mega_x', '0646-fusion_1'])('requires a picker choice for %s and blocks the old single-instance shortcut', async (variantId) => {
    const { promise, outbox } = run({ variantIds: [variantId], destination: 'caught' });
    await expect(promise).rejects.toThrow('Choose the Pokémon'); expect(outbox.queue).not.toHaveBeenCalled();
    expect(() => createNativeInstanceFromCatalogEntry({ entry: { id: variantId } as never, pokemon: formCatalog[0], destination: 'caught', instanceId: 'bad' })).toThrow('Choose the Pokémon');
  });
});
