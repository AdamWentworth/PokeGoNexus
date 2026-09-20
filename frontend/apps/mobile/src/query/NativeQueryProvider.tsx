import {
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNativeSession } from '../auth/NativeSessionContext';
import { createNativeQueryClient } from './nativeQueryClient';

export const shouldClearNativeSessionCache = (
  previousUserId: string | null,
  nextUserId: string | null,
  status: ReturnType<typeof useNativeSession>['status'],
): boolean =>
  Boolean(
    previousUserId
      && (status === 'signed-out' || (nextUserId && previousUserId !== nextUserId)),
  );

const NativeSessionCacheBoundary = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const { status, user } = useNativeSession();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const nextUserId = user?.user_id ?? null;
    if (shouldClearNativeSessionCache(previousUserId.current, nextUserId, status)) {
      queryClient.clear();
    }
    previousUserId.current = nextUserId;
  }, [queryClient, status, user?.user_id]);

  return children;
};

export const NativeQueryProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createNativeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <NativeSessionCacheBoundary>{children}</NativeSessionCacheBoundary>
    </QueryClientProvider>
  );
};
