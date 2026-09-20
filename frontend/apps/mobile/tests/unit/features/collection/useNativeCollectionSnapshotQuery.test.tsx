import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  getCachedNativeCollectionSnapshot,
  getReconciledNativeCollectionSnapshot,
} from '../../../../src/services/collectionApi';
import { useNativeCollectionSnapshotQuery } from '../../../../src/features/collection/collectionQueries';

jest.mock('../../../../src/services/collectionApi', () => ({
  getCachedNativeCollectionSnapshot: jest.fn(),
  getNativePokemonMoves: jest.fn(),
  getReconciledNativeCollectionSnapshot: jest.fn(),
}));

jest.mock('../../../../src/services/useNativeApiClients', () => ({
  useNativeApiClients: () => ({ pokemon: {}, users: {} }),
}));

jest.mock('../../../../src/storage/nativeCollectionCache', () => ({
  nativeCollectionCache: {},
}));

jest.mock('../../../../src/storage/nativeCollectionOutbox', () => ({
  nativeCollectionOutbox: {},
}));

const mockedCachedSnapshot = jest.mocked(getCachedNativeCollectionSnapshot);
const mockedNetworkSnapshot = jest.mocked(getReconciledNativeCollectionSnapshot);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const snapshot = (source: 'cache' | 'network', cachedAt: number | null) => ({
  cachedAt,
  catalog: [],
  instances: {},
  source,
});

describe('useNativeCollectionSnapshotQuery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('paints a durable snapshot while the canonical network refresh continues', async () => {
    const network = deferred<ReturnType<typeof snapshot>>();
    mockedNetworkSnapshot.mockReturnValue(network.promise);
    mockedCachedSnapshot.mockResolvedValue(snapshot('cache', 1234));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const view = renderHook(
      () => useNativeCollectionSnapshotQuery('user-1'),
      { wrapper },
    );

    await waitFor(() => expect(view.result.current.data?.source).toBe('cache'));
    expect(view.result.current.isFetching).toBe(true);

    act(() => network.resolve(snapshot('network', null)));
    await waitFor(() => expect(view.result.current.data?.source).toBe('network'));
    view.unmount();
    client.clear();
  });

  it('never lets a slower SQLite read overwrite a completed network response', async () => {
    const cache = deferred<ReturnType<typeof snapshot> | null>();
    mockedCachedSnapshot.mockReturnValue(cache.promise);
    mockedNetworkSnapshot.mockResolvedValue(snapshot('network', null));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const view = renderHook(
      () => useNativeCollectionSnapshotQuery('user-1'),
      { wrapper },
    );
    await waitFor(() => expect(view.result.current.data?.source).toBe('network'));

    act(() => cache.resolve(snapshot('cache', 1234)));
    await act(async () => Promise.resolve());
    expect(view.result.current.data?.source).toBe('network');
    view.unmount();
    client.clear();
  });

  it('skips a SQLite decode when React Query already has the collection', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(
      ['native', 'collection', 'user-1', 'snapshot'],
      snapshot('network', null),
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const view = renderHook(
      () => useNativeCollectionSnapshotQuery('user-1'),
      { wrapper },
    );
    expect(view.result.current.data?.source).toBe('network');
    expect(mockedCachedSnapshot).not.toHaveBeenCalled();
    view.unmount();
    client.clear();
  });
});
