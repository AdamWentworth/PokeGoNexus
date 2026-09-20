import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import type { NativeCollectionSnapshot } from '../../../../src/services/collectionApi';
import { nativeCollectionQueryKeys } from '../../../../src/features/collection/collectionQueries';
import { useNativeFavoriteMutation } from '../../../../src/features/collection/useNativeFavoriteMutation';
import { persistNativeFavoriteMutation } from '../../../../src/features/collection/nativeFavoriteMutation';

jest.mock('../../../../src/services/useNativeApiClients', () => ({
  useNativeApiClients: () => ({ receiver: { post: jest.fn() } }),
}));

jest.mock('../../../../src/storage/nativeCollectionOutbox', () => ({
  nativeCollectionOutbox: {},
}));

jest.mock('../../../../src/features/collection/nativeFavoriteMutation', () => ({
  persistNativeFavoriteMutation: jest.fn(),
}));

const mockRefreshStatus = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../src/features/collection/NativeCollectionSyncProvider', () => ({
  useNativeCollectionSync: () => ({ refreshStatus: mockRefreshStatus }),
}));

const mockedPersist = persistNativeFavoriteMutation as jest.MockedFunction<
  typeof persistNativeFavoriteMutation
>;

describe('useNativeFavoriteMutation', () => {
  it('projects the durable queued snapshot into the user-isolated query cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    const queryKey = nativeCollectionQueryKeys.snapshot('user-1');
    const original = {
      instance_id: 'instance-1', pokemon_id: 1, variant_id: '1',
      favorite: false, last_update: 100,
    };
    queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, {
      instances: { 'instance-1': original as never },
      catalog: [],
    });
    mockedPersist.mockImplementationOnce(async (options) => {
      const updated = { ...original, favorite: true, last_update: 101 } as never;
      const mutation = {
        collectionKey: 'instance-1',
        previous: original as never,
        updated,
        batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [updated] },
      };
      await options.onQueued?.(mutation);
      return {
        mutation,
        syncState: 'acknowledged',
        message: 'Receiver accepted it.',
      };
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useNativeFavoriteMutation('user-1', 'instance-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(queryClient.getQueryData<NativeCollectionSnapshot>(queryKey)
      ?.instances['instance-1']?.favorite).toBe(true);
    expect(mockRefreshStatus).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
