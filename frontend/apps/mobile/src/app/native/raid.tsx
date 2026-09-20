import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { hydrateNativeToolCatalog } from '../../features/tools/nativeBattleModels';
import { useNativeMovesDataQuery, useNativeRaidDataQuery, useNativeToolCatalogQuery } from '../../features/tools/nativeToolQueries';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeRaidScreen } from '../../screens/NativeRaidScreen';

export default function NativeRaidRoute() {
  const router = useRouter(); const session = useNativeSession(); const [menu, setMenu] = useState(false);
  const catalogQuery = useNativeToolCatalogQuery(); const movesQuery = useNativeMovesDataQuery(); const raidQuery = useNativeRaidDataQuery(); const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const catalog = useMemo(() => hydrateNativeToolCatalog(catalogQuery.data ?? [], movesQuery.data ?? [], raidQuery.data ?? []), [catalogQuery.data, movesQuery.data, raidQuery.data]);
  const error = [catalogQuery.error, movesQuery.error, raidQuery.error, snapshotQuery.error].find((value): value is Error => value instanceof Error)?.message ?? null;
  const navigate = (path: string) => { setMenu(false); const destination = resolveNativeActionMenuDestination(path, '/raid'); if (destination.kind === 'current') return; if (destination.kind === 'native') { router.push(destination.pathname); return; } router.push({ pathname: '/web', params: { path: destination.path } }); };
  return <><NativeRaidScreen assetBaseUrl={runtimeConfig.api.frontendAppUrl} catalog={catalog} error={error} instances={snapshotQuery.data?.instances} isLoading={catalogQuery.isPending || movesQuery.isPending || raidQuery.isPending || Boolean(session.user && snapshotQuery.isPending)} onBack={() => router.canGoBack() ? router.back() : router.replace('/native')} onMethodology={() => router.push('/native/raid-methodology')} onOpenPokemon={(entry) => {
    if (entry.sourceInstanceId) {
      router.push({ pathname: '/native/collection/[instanceId]', params: { instanceId: entry.sourceInstanceId } });
      return;
    }
    const variantId = entry.variantId ?? `${String(entry.pokemonId).padStart(4, '0')}-default`;
    router.push({ pathname: '/native/pokedex/[variantId]', params: { variantId } });
  }} onRetry={() => { void catalogQuery.refetch(); void movesQuery.refetch(); void raidQuery.refetch(); if (session.user) void snapshotQuery.refetch(); }} ownerKey={session.user?.user_id ?? 'signed-out-device'} signedIn={Boolean(session.user)} /><NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={() => setMenu(true)} />{menu ? <NativeActionMenu assetBaseUrl={runtimeConfig.api.frontendAppUrl} onClose={() => setMenu(false)} onNavigate={navigate} visible /> : null}</>;
}
