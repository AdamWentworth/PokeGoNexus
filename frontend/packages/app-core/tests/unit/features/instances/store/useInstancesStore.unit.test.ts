import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  periodicFn: vi.fn(),
  makeUpdateStatus: vi.fn(),
  makeUpdateDetails: vi.fn(),
  mergeInstancesData: vi.fn(),
  replaceInstancesData: vi.fn(),
}));

vi.mock('@/stores/BatchedUpdates/periodicUpdates', () => ({
  periodicUpdates: vi.fn(() => mocks.periodicFn),
}));

vi.mock('@/features/instances/actions/updateInstanceStatus', () => ({
  updateInstanceStatus: mocks.makeUpdateStatus,
}));

vi.mock('@/features/instances/actions/updateInstanceDetails', () => ({
  updateInstanceDetails: mocks.makeUpdateDetails,
}));

vi.mock('@/features/instances/utils/mergeInstancesData', () => ({
  mergeInstancesData: mocks.mergeInstancesData,
}));

vi.mock('@/features/instances/storage/instancesStorage', () => ({
  replaceInstancesData: mocks.replaceInstancesData,
}));

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useInstancesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useInstancesStore.setState({
      instances: {},
      foreignInstances: null,
      instancesLoading: true,
    });

    useVariantsStore.setState({
      variants: [],
      variantsLoading: false,
      isRefreshing: false,
    });

    useAuthStore.setState({ user: null } as any);

    mocks.mergeInstancesData.mockImplementation((current: any, incoming: any) => ({
      ...current,
      ...incoming,
    }));

    mocks.replaceInstancesData.mockResolvedValue(undefined);

    mocks.makeUpdateStatus.mockImplementation((_data: any, setData: any) => {
      return async () => {
        setData((prev: any) => ({
          ...prev,
          instances: {
            ...prev.instances,
            'new-id': {
              variant_id: '0001-default',
              pokemon_id: 1,
              is_caught: true,
              is_for_trade: false,
              is_wanted: false,
              registered: true,
            },
          },
        }));
      };
    });

    mocks.makeUpdateDetails.mockImplementation((_data: any, setData: any) => {
      return async () => {
        setData((prev: any) => ({
          ...prev,
          instances: {
            ...prev.instances,
            'new-id': {
              ...(prev.instances['new-id'] || {}),
              nickname: 'patched',
            },
          },
        }));
      };
    });
  });

  it('hydrates and resets local instances state', () => {
    useInstancesStore.getState().hydrateInstances({
      a: { variant_id: '0001-default', pokemon_id: 1 } as any,
    });

    expect(useInstancesStore.getState().instancesLoading).toBe(false);
    expect(useInstancesStore.getState().instances).toHaveProperty('a');

    useInstancesStore.getState().resetInstances();
    expect(useInstancesStore.getState().instances).toEqual({});
    expect(useInstancesStore.getState().instancesLoading).toBe(true);
  });

  it('sets and resets foreign instances', () => {
    useInstancesStore.getState().setForeignInstances({
      f1: { variant_id: '0001-default', pokemon_id: 1 } as any,
    });
    expect(useInstancesStore.getState().foreignInstances).toHaveProperty('f1');

    useInstancesStore.getState().resetForeignInstances();
    expect(useInstancesStore.getState().foreignInstances).toBeNull();
  });

  it('setInstances merges incoming data and persists authoritative snapshot', async () => {
    useAuthStore.setState({ user: { username: 'ash' } } as any);

    useInstancesStore.getState().hydrateInstances({
      a: { variant_id: '0001-default', pokemon_id: 1 } as any,
    });

    await useInstancesStore.getState().setInstances({
      b: { variant_id: '0002-default', pokemon_id: 2 } as any,
    });

    expect(mocks.mergeInstancesData).toHaveBeenCalledWith(
      expect.objectContaining({ a: expect.any(Object) }),
      expect.objectContaining({ b: expect.any(Object) }),
      'ash',
    );

    expect(useInstancesStore.getState().instances).toEqual(
      expect.objectContaining({
        a: expect.any(Object),
        b: expect.any(Object),
      }),
    );

    expect(mocks.replaceInstancesData).toHaveBeenCalledTimes(1);
  });

  it('setInstances is a no-op for empty incoming payload', async () => {
    const beforeMergeCalls = mocks.mergeInstancesData.mock.calls.length;
    const beforeReplaceCalls = mocks.replaceInstancesData.mock.calls.length;
    await useInstancesStore.getState().setInstances({});

    expect(mocks.mergeInstancesData.mock.calls.length).toBe(beforeMergeCalls);
    expect(mocks.replaceInstancesData.mock.calls.length).toBe(beforeReplaceCalls);
  });

  it('applies authoritative ownership transfers by adding incoming and removing outgoing instances', async () => {
    useAuthStore.setState({ user: { user_id: 'user-1', username: 'ash' } } as any);
    useInstancesStore.getState().hydrateInstances({
      outgoing: { variant_id: '0001-default', pokemon_id: 1, user_id: 'user-1' } as any,
      retained: { variant_id: '0004-default', pokemon_id: 4, user_id: 'user-1' } as any,
    });

    await useInstancesStore.getState().applyAuthoritativeInstanceChanges({
      outgoing: { variant_id: '0001-default', pokemon_id: 1, user_id: 'user-2' } as any,
      incoming: { variant_id: '0007-default', pokemon_id: 7, user_id: 'user-1' } as any,
    });

    expect(useInstancesStore.getState().instances).toEqual({
      retained: expect.objectContaining({ pokemon_id: 4 }),
      incoming: expect.objectContaining({ pokemon_id: 7, user_id: 'user-1' }),
    });
    expect(mocks.replaceInstancesData).toHaveBeenCalledWith(
      expect.not.objectContaining({ outgoing: expect.anything() }),
      expect.any(Number),
    );
  });

  it('updateInstanceStatus delegates to action factory and triggers periodic sync', async () => {
    useVariantsStore.setState({
      variants: [{ variant_id: '0001-default', pokemon_id: 1 } as any],
      variantsLoading: false,
      isRefreshing: false,
    });

    await useInstancesStore.getState().updateInstanceStatus('0001-default', 'Caught');

    expect(mocks.makeUpdateStatus).toHaveBeenCalledTimes(1);
    expect(mocks.periodicFn).toHaveBeenCalledTimes(1);
    expect(useInstancesStore.getState().instances).toHaveProperty('new-id');
  });

  it('updateInstanceDetails delegates to action factory and triggers periodic sync', async () => {
    await useInstancesStore.getState().updateInstanceDetails('new-id', { nickname: 'foo' } as any);

    expect(mocks.makeUpdateDetails).toHaveBeenCalledTimes(1);
    expect(mocks.periodicFn).toHaveBeenCalledTimes(1);
    expect((useInstancesStore.getState().instances as any)['new-id']).toMatchObject({
      nickname: 'patched',
    });
  });
});
