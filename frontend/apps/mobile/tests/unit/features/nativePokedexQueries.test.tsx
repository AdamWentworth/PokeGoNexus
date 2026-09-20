import type { NativePokedexManualRegistration } from '../../../src/features/tools/nativePokedexModel';
import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { nativePokedexRegistrationStore } from '../../../src/storage/nativePokedexRegistrations';
import {
  nativePokedexRegistrationScope, useNativePokedexRegistrationMutation,
  useNativePokedexRegistrationsQuery,
} from '../../../src/features/tools/nativePokedexQueries';

jest.mock('../../../src/storage/nativePokedexRegistrations', () => ({
  nativePokedexRegistrationStore: { read: jest.fn(), register: jest.fn(), unregister: jest.fn() },
}));

it('loads and updates guest marks separately from account registrations', async () => {
  const records = new Map<string, NativePokedexManualRegistration[]>();
  jest.mocked(nativePokedexRegistrationStore.read).mockImplementation(async (scope) => records.get(scope) ?? []);
  jest.mocked(nativePokedexRegistrationStore.register).mockImplementation(async (scope, registrations) => { records.set(scope, registrations); });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(({ userId }: { userId: string | null }) => ({
    query: useNativePokedexRegistrationsQuery(userId),
    mutation: useNativePokedexRegistrationMutation(userId),
  }), { wrapper, initialProps: { userId: null } });
  await waitFor(() => expect(view.result.current.query.data).toEqual([]));
  const registration = { entryId: '0001-default', registrationId: '0001-default', facets: {} };
  await act(async () => { await view.result.current.mutation.mutateAsync({ registrations: [registration], registered: true }); });
  await waitFor(() => expect(view.result.current.query.data).toEqual([registration]));
  expect(nativePokedexRegistrationStore.register).toHaveBeenCalledWith(nativePokedexRegistrationScope(null), [registration]);
  view.rerender({ userId: 'user-1' });
  await waitFor(() => expect(view.result.current.query.data).toEqual([]));
  view.rerender({ userId: null });
  await waitFor(() => expect(view.result.current.query.data).toEqual([registration]));
  view.unmount();
  client.clear();
});
