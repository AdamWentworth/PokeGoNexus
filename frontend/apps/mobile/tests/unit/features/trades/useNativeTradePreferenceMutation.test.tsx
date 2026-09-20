import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import type { NativeCollectionSnapshot } from '../../../../src/services/collectionApi';
import { nativeCollectionQueryKeys } from '../../../../src/features/collection/collectionQueries';
import { persistNativeTradePreferenceMutation } from '../../../../src/features/trades/nativeTradePreferencesMutation';
import { useNativeTradePreferenceMutation } from '../../../../src/features/trades/useNativeTradePreferenceMutation';

jest.mock('../../../../src/services/useNativeApiClients', () => ({
  useNativeApiClients: () => ({ receiver: { post: jest.fn() } }),
}));

jest.mock('../../../../src/storage/nativeCollectionOutbox', () => ({
  nativeCollectionOutbox: {},
}));

jest.mock('../../../../src/features/trades/nativeTradePreferencesMutation', () => ({
  persistNativeTradePreferenceMutation: jest.fn(),
}));

const mockRefreshStatus = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../src/features/collection/NativeCollectionSyncProvider', () => ({
  useNativeCollectionSync: () => ({ refreshStatus: mockRefreshStatus }),
}));

const mockedPersist = persistNativeTradePreferenceMutation as jest.MockedFunction<
  typeof persistNativeTradePreferenceMutation
>;

describe('useNativeTradePreferenceMutation', () => {
  it('projects every queued reciprocal update and mirror creation into the user cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    const queryKey = nativeCollectionQueryKeys.snapshot('user-1');
    queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, {
      catalog: [],
      instances: {
        sourceKey: {
          instance_id: 'source-id',
          pokemon_id: 1,
          variant_id: '0001-shiny',
          is_for_trade: true,
          last_update: 100,
        } as never,
      },
    });
    mockedPersist.mockImplementationOnce(async (options) => {
      const source = {
        instance_id: 'source-id',
        pokemon_id: 1,
        variant_id: '0001-shiny',
        is_for_trade: true,
        mirror: true,
        last_update: 101,
      } as never;
      const mirror = {
        instance_id: 'mirror-id',
        pokemon_id: 1,
        variant_id: '0001-shiny',
        is_wanted: true,
        last_update: 101,
      } as never;
      await options.onQueued?.([source, mirror]);
      return {
        message: 'Trade preferences saved.',
        mirrorCreation: mirror,
        mutations: [],
        syncState: 'acknowledged',
        updates: [source, mirror],
      };
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useNativeTradePreferenceMutation('user-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        filteredOutIds: [],
        filters: {},
        manuallyExcludedIds: [],
        mirror: true,
        mode: 'trade',
        selectedInstanceId: 'source-id',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    const cached = queryClient.getQueryData<NativeCollectionSnapshot>(queryKey);
    expect(cached?.instances.sourceKey?.mirror).toBe(true);
    expect(cached?.instances['mirror-id']?.is_wanted).toBe(true);
    expect(mockRefreshStatus).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
