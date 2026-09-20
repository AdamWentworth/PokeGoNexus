import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useNativeSession } from '../../../auth/NativeSessionContext';
import { runtimeConfig } from '../../../config/runtimeConfig';
import { buildNativeCollectionRows } from '../../../features/collection/collectionModel';
import { useNativeForeignCollectionQuery } from '../../../features/collection/collectionQueries';
import { useNativeTrainerProfileQuery } from '../../../features/social/socialQueries';
import { buildNativeTradeBoardModel } from '../../../features/tradeBoard/nativeTradeBoardModel';
import { NativeTradeBoardScreen } from '../../../screens/NativeTradeBoardScreen';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativePublicTradeBoardRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const session = useNativeSession();
  const username = firstParam(params.username).trim();
  const [generatedAt] = useState(() => new Date().toISOString());
  const viewerId = session.user?.user_id ?? null;
  const collectionQuery = useNativeForeignCollectionQuery(viewerId, username);
  const profileQuery = useNativeTrainerProfileQuery(viewerId, username);
  const success = collectionQuery.data?.type === 'success' ? collectionQuery.data : null;
  const rows = useMemo(() => success ? buildNativeCollectionRows(
    success.instances,
    success.catalog,
    runtimeConfig.api.frontendAppUrl,
  ) : [], [success]);
  const model = useMemo(() => {
    if (!success || !username) return null;
    const canonicalUsername = success.username || username;
    return buildNativeTradeBoardModel({
      boardUrl: `${runtimeConfig.api.frontendAppUrl.replace(/\/$/, '')}/trade-board/${encodeURIComponent(canonicalUsername)}`,
      generatedAt,
      instances: success.instances,
      pokemonGoName: profileQuery.data?.user.pokemonGoName,
      rows,
      username: canonicalUsername,
    });
  }, [generatedAt, profileQuery.data?.user.pokemonGoName, rows, success, username]);
  const resultError = collectionQuery.error instanceof Error
    ? collectionQuery.error.message
    : collectionQuery.data?.type === 'forbidden'
      ? collectionQuery.data.message
      : collectionQuery.data?.type === 'not-found'
        ? 'This trainer could not be found.'
        : null;
  const errorKind = collectionQuery.data?.type === 'forbidden'
    ? 'private' as const
    : collectionQuery.data?.type === 'not-found'
      ? 'not-found' as const
      : 'error' as const;

  return (
    <NativeTradeBoardScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      editable={false}
      error={resultError}
      errorKind={errorKind}
      isLoading={collectionQuery.isPending}
      model={model}
      onBack={() => router.replace('/native')}
      onOpenCreateBoard={() => router.push(session.user ? '/native/search' : '/native/register')}
      onOpenHelp={() => router.push('/native/info/help')}
      onOpenProfile={() => router.push({
        pathname: '/native/profile/[username]',
        params: { username },
      })}
      onOpenCollection={() => router.push({
        pathname: '/native/collection/trainer/[username]',
        params: { username },
      })}
      onOpenTradeListings={() => router.push({
        pathname: '/native/collection/trainer/[username]',
        params: { username, filter: 'trade' },
      })}
      onOpenWantedListings={() => router.push({
        pathname: '/native/collection/trainer/[username]',
        params: { username, filter: 'wanted' },
      })}
      onSearchTrainers={() => router.push({ pathname: '/native/search', params: { mode: 'trainers' } })}
      onRetry={() => {
        void collectionQuery.refetch();
        void profileQuery.refetch();
      }}
      ownerUsername={username}
      signedIn={Boolean(session.user)}
    />
  );
}
