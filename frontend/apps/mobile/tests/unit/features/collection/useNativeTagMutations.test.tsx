import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useNativeTagMutations } from '../../../../src/features/collection/useNativeTagMutations';

jest.mock('../../../../src/services/useNativeApiClients', () => ({
  useNativeApiClients: () => ({ users: { delete: jest.fn(), patch: jest.fn(), post: jest.fn() } }),
}));

describe('useNativeTagMutations', () => {
  it('keeps tag command identities stable across route bookkeeping rerenders', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useNativeTagMutations('user-1'), { wrapper });
    const initial = hook.result.current;

    hook.rerender({});

    expect(hook.result.current.createTag).toBe(initial.createTag);
    expect(hook.result.current.updateTag).toBe(initial.updateTag);
    expect(hook.result.current.deleteTag).toBe(initial.deleteTag);
    expect(hook.result.current.saveOrder).toBe(initial.saveOrder);
    queryClient.clear();
  });
});
