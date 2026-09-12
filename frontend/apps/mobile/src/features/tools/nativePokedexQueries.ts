import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativePokedexManualRegistration } from './nativePokedexModel';
import { nativePokedexRegistrationStore } from '../../storage/nativePokedexRegistrations';

// A separate local scope keeps guest marks isolated from every signed-in account.
export const nativePokedexRegistrationScope = (userId: string | null): string => userId ?? 'guest:local-pokedex';

export const nativePokedexQueryKeys = {
  registrations: (userId: string) => ['native', 'pokedex', userId, 'registrations'] as const,
};

export const useNativePokedexRegistrationsQuery = (userId: string | null) => useQuery({
  queryKey: nativePokedexQueryKeys.registrations(nativePokedexRegistrationScope(userId)),
  queryFn: () => nativePokedexRegistrationStore.read(nativePokedexRegistrationScope(userId)),
  staleTime: Number.POSITIVE_INFINITY,
});

export const useNativePokedexRegistrationMutation = (userId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ registrations, registered }: { registrations: NativePokedexManualRegistration[]; registered: boolean }) => {
      const scope = nativePokedexRegistrationScope(userId);
      if (registered) await nativePokedexRegistrationStore.register(scope, registrations);
      else await nativePokedexRegistrationStore.unregister(scope, registrations.map(({ registrationId }) => registrationId));
      return scope;
    },
    onSuccess: (scope) => queryClient.invalidateQueries({ queryKey: nativePokedexQueryKeys.registrations(scope) }),
  });
};
