import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useNativeSession } from '../../../auth/NativeSessionContext';
import { buildNativePokedexEntries, mergeNativePokedexSpecies } from '../../../features/tools/nativePokedexModel';
import { hydrateNativeToolCatalog } from '../../../features/tools/nativeBattleModels';
import {
  useNativePokedexRegistrationMutation,
  useNativePokedexRegistrationsQuery,
} from '../../../features/tools/nativePokedexQueries';
import { useNativeMovesDataQuery, useNativePokedexSpeciesQuery, useNativeToolCatalogQuery } from '../../../features/tools/nativeToolQueries';
import { useNativeCollectionSnapshotQuery } from '../../../features/collection/collectionQueries';
import { runtimeConfig } from '../../../config/runtimeConfig';
import { NativeRouteActionMenu } from '../../../components/NativeRouteActionMenu';
import { NativePokedexDetailScreen } from '../../../screens/NativePokedexDetailScreen';

export default function NativePokedexDetailRoute() {
  const router = useRouter();
  const session = useNativeSession();
  const params = useLocalSearchParams<{ gender?: string | string[]; variantId?: string | string[] }>();
  const variantId = Array.isArray(params.variantId) ? params.variantId[0] ?? '' : params.variantId ?? '';
  const genderParam = Array.isArray(params.gender) ? params.gender[0] : params.gender;
  const initialGender = genderParam === 'Male' || genderParam === 'Female' ? genderParam : undefined;
  const query = useNativeToolCatalogQuery();
  const movesQuery = useNativeMovesDataQuery();
  const speciesQuery = useNativePokedexSpeciesQuery();
  const userId = session.user?.user_id ?? null;
  const snapshotQuery = useNativeCollectionSnapshotQuery(userId);
  const registrationsQuery = useNativePokedexRegistrationsQuery(userId);
  const mutation = useNativePokedexRegistrationMutation(userId);
  const hydratedCatalog = useMemo(
    () => hydrateNativeToolCatalog(query.data ?? [], movesQuery.data ?? []),
    [movesQuery.data, query.data],
  );
  const mergedCatalog = useMemo(() => mergeNativePokedexSpecies(
    hydratedCatalog,
    speciesQuery.data ?? [],
  ), [hydratedCatalog, speciesQuery.data]);
  const entries = useMemo(() => buildNativePokedexEntries(
    mergedCatalog,
    snapshotQuery.data?.instances ?? {},
    registrationsQuery.data ?? [],
  ), [mergedCatalog, registrationsQuery.data, snapshotQuery.data?.instances]);
  const entry = useMemo(() => entries.find(({ id }) => id === variantId) ?? null, [entries, variantId]);
  const pokemon = mergedCatalog.find(({ pokemon_id }) => pokemon_id === entry?.pokemonId) ?? null;
  return (
    <>
      <NativePokedexDetailScreen
        allEntries={entries}
        allPokemon={mergedCatalog}
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        entry={entry}
        error={[query.error, movesQuery.error, speciesQuery.error, snapshotQuery.error, registrationsQuery.error, mutation.error].find((value): value is Error => value instanceof Error)?.message ?? null}
        isLoading={query.isPending || movesQuery.isPending || speciesQuery.isPending || (registrationsQuery.isPending || Boolean(userId && snapshotQuery.isPending))}
        isSaving={mutation.isPending}
        initialGender={initialGender}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native/pokedex')}
        onOpenEntry={(selected, gender) => router.replace({ pathname: '/native/pokedex/[variantId]', params: { variantId: selected.id, gender: gender ?? '' } })}
        onSetRegistrations={(registrations, registered) => mutation.mutate({ registrations, registered })}
        onToggleRegistration={(registration, registered) => mutation.mutate({ registrations: [registration], registered })}
        pokemon={pokemon}
      />
      <NativeRouteActionMenu currentPath="/pokedex" signedIn={Boolean(session.user)} />
    </>
  );
}
