import { ApiClientError } from '@pokemongonexus/shared-api-client';
import { QueryClient } from '@tanstack/react-query';

export const shouldRetryNativeQuery = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (failureCount >= 1) return false;
  if (error instanceof ApiClientError && error.status < 500) return false;
  return true;
};

export const createNativeQueryClient = (): QueryClient => new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      retry: shouldRetryNativeQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
