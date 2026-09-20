import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useNativeSession } from '../../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../../config/runtimeConfig';
import { useNativeCollectionSnapshotQuery } from '../../../features/collection/collectionQueries';
import { buildNativePokedexEntries, mergeNativePokedexSpecies } from '../../../features/tools/nativePokedexModel';
import {
  useNativePokedexRegistrationMutation,
  useNativePokedexRegistrationsQuery,
} from '../../../features/tools/nativePokedexQueries';
import { useNativePokedexSpeciesQuery, useNativeToolCatalogQuery } from '../../../features/tools/nativeToolQueries';
import { resolveNativeActionMenuDestination } from '../../../navigation/nativeActionMenuNavigation';
import { NativePokedexScreen } from '../../../screens/NativePokedexScreen';

export default function NativePokedexRoute() {
  const router = useRouter();
  const isFocused = usePathname() === '/native/pokedex';
  const session = useNativeSession();
  const catalogQuery = useNativeToolCatalogQuery();
  const speciesQuery = useNativePokedexSpeciesQuery();
  const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const registrationsQuery = useNativePokedexRegistrationsQuery(session.user?.user_id ?? null);
  const registrationMutation = useNativePokedexRegistrationMutation(session.user?.user_id ?? null);
  const [menu, setMenu] = useState(false);
  const mergedCatalog = useMemo(() => mergeNativePokedexSpecies(
    catalogQuery.data ?? [],
    speciesQuery.data ?? [],
  ), [catalogQuery.data, speciesQuery.data]);
  const entries = useMemo(() => buildNativePokedexEntries(
    mergedCatalog,
    snapshotQuery.data?.instances ?? {},
    registrationsQuery.data ?? [],
  ), [mergedCatalog, registrationsQuery.data, snapshotQuery.data?.instances]);
  const navigate = (path: string) => {
    setMenu(false);
    const destination = resolveNativeActionMenuDestination(path, '/pokedex');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') { router.push(destination.pathname); return; }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };
  return <>
    <NativePokedexScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      entries={entries}
      error={[catalogQuery.error, speciesQuery.error, snapshotQuery.error, registrationsQuery.error]
        .find((value): value is Error => value instanceof Error)?.message ?? null}
      registrationError={registrationMutation.error?.message ?? null}
      onDismissRegistrationError={() => registrationMutation.reset()}
      isFocused={isFocused && !menu}
      isLoading={catalogQuery.isPending || speciesQuery.isPending || registrationsQuery.isPending
        || Boolean(session.user && snapshotQuery.isPending)}
      isSaving={registrationMutation.isPending}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/native')}
      onOpenEntry={(entry, facets) => router.push({
        pathname: '/native/pokedex/[variantId]',
        params: { variantId: entry.id, gender: facets?.gender ?? '' },
      })}
      onRetry={() => {
        void catalogQuery.refetch();
        void speciesQuery.refetch();
        void registrationsQuery.refetch();
        if (session.user) void snapshotQuery.refetch();
      }}
      onSetRegistrations={(registrations, registered) => registrationMutation.mutate({ registrations, registered })}
    />
    <NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={() => setMenu(true)} />
    {menu ? <NativeActionMenu assetBaseUrl={runtimeConfig.api.frontendAppUrl} onClose={() => setMenu(false)} onNavigate={navigate} visible /> : null}
  </>;
}
