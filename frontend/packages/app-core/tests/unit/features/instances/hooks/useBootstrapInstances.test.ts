import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  loadInstances: vi.fn(),
  checkBatchedUpdates: vi.fn(),
}));

vi.mock('@/features/instances/services/loadInstances', () => ({
  loadInstances: mocks.loadInstances,
}));

vi.mock('@/stores/BatchedUpdates/checkBatchedUpdates', () => ({
  checkBatchedUpdates: mocks.checkBatchedUpdates,
}));

import { useBootstrapInstances } from '@/features/instances/hooks/useBootstrapInstances';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useBootstrapInstances', () => {
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

    useAuthStore.setState({
      isLoggedIn: false,
      user: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  function setReadyVariants() {
    useVariantsStore.setState({
      variants: [{ variant_id: '0001-default', pokemon_id: 1 } as any],
      variantsLoading: false,
    });
  }

  it('loads instances, hydrates store, and clears loading', async () => {
    setReadyVariants();

    const loaded = {
      'id-1': { instance_id: 'id-1', variant_id: '0001-default', pokemon_id: 1 },
    } as any;

    mocks.loadInstances.mockResolvedValue(loaded);

    const hydrateSpy = vi.spyOn(useInstancesStore.getState(), 'hydrateInstances');

    renderHook(() => useBootstrapInstances());

    await waitFor(() => {
      expect(mocks.loadInstances).toHaveBeenCalled();
    });

    expect(mocks.loadInstances).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ variant_id: '0001-default' }),
      ]),
      false,
    );

    expect(hydrateSpy).toHaveBeenCalledWith(loaded);
    expect(useInstancesStore.getState().instancesLoading).toBe(false);
  });

  it('triggers batched updates check when user is logged in', async () => {
    setReadyVariants();
    useAuthStore.setState({ isLoggedIn: true } as any);

    mocks.loadInstances.mockResolvedValue({} as any);

    renderHook(() => useBootstrapInstances());

    await waitFor(() => {
      expect(mocks.loadInstances).toHaveBeenCalled();
    });

    expect(mocks.loadInstances).toHaveBeenCalledWith(expect.any(Array), true);
    expect(mocks.checkBatchedUpdates).toHaveBeenCalledWith(
      useInstancesStore.getState().periodicUpdates,
    );
  });

  it('logs error and still clears loading when load fails', async () => {
    setReadyVariants();

    const err = new Error('boom');
    mocks.loadInstances.mockRejectedValue(err);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useBootstrapInstances());

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[useBootstrapInstances]',
        'Bootstrap failed:',
        err,
      );
    });

    expect(useInstancesStore.getState().instancesLoading).toBe(false);
  });

  it('does not load instances when disabled', async () => {
    setReadyVariants();

    renderHook(() => useBootstrapInstances(false));
    await Promise.resolve();

    expect(mocks.loadInstances).not.toHaveBeenCalled();
    expect(useInstancesStore.getState().instancesLoading).toBe(true);
  });
});
