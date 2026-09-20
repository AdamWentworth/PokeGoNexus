import { useQuery } from '@tanstack/react-query';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { getNativeAccountSecurity } from '../../services/nativeAccountSecurityApi';

export const nativeAccountSecurityQueryKeys = {
  root: ['native', 'account-security'] as const,
  detail: (userId: string) => [...nativeAccountSecurityQueryKeys.root, userId] as const,
};

export const useNativeAccountSecurityQuery = (userId: string | null) => {
  const clients = useNativeApiClients();
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () => getNativeAccountSecurity(clients.auth),
    queryKey: nativeAccountSecurityQueryKeys.detail(userId ?? 'signed-out'),
    staleTime: 30_000,
  });
};
