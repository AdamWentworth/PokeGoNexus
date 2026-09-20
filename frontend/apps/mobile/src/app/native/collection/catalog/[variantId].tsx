import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSession } from '../../../../auth/NativeSessionContext';
import { runtimeConfig } from '../../../../config/runtimeConfig';
import { buildNativeCatalogRows } from '../../../../features/collection/collectionModel';
import { useNativeCollectionSnapshotQuery } from '../../../../features/collection/collectionQueries';
import { useNativeCatalogAddition } from '../../../../features/collection/useNativeCatalogAddition';
import { NativeCatalogDetailScreen } from '../../../../screens/NativeCatalogDetailScreen';
import { NativeProtectedSessionGate } from '../../../../components/NativeProtectedSessionGate';
import { NativeCatalogFormPicker } from '../../../../features/collection/NativeCatalogFormPicker';
import { isNativeCatalogFormVariant } from '../../../../features/collection/nativeCatalogFormModel';
import type { NativeCatalogOrganizerRequest } from '../../../../features/collection/nativeCatalogMutation';

export default function NativeCatalogDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ variantId?: string | string[] }>();
  const session = useNativeSession();
  const insets = useSafeAreaInsets();
  const [formRequest, setFormRequest] = useState<NativeCatalogOrganizerRequest | null>(null);
  const variantId = Array.isArray(params.variantId)
    ? params.variantId[0] ?? ''
    : params.variantId ?? '';
  const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const mutation = useNativeCatalogAddition(session.user?.user_id ?? '', variantId);
  const row = useMemo(() => {
    if (!snapshotQuery.data) return null;
    return buildNativeCatalogRows(
      snapshotQuery.data.catalog,
      runtimeConfig.api.frontendAppUrl,
    ).find((candidate) => candidate.id === variantId) ?? null;
  }, [snapshotQuery.data, variantId]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening Pokémon…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !session.user) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Fcollection" />;
  }

  if (formRequest && snapshotQuery.data) return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <NativeCatalogFormPicker assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        catalog={snapshotQuery.data.catalog} instances={snapshotQuery.data.instances}
        request={formRequest} isSaving={mutation.isPending}
        error={mutation.error instanceof Error ? mutation.error.message : null}
        onCancel={() => setFormRequest(null)}
        onConfirm={async (request) => {
          await mutation.mutateAsync(request);
          setFormRequest(null);
        }} />
    </View>
  );

  return (
    <NativeCatalogDetailScreen
      error={mutation.error instanceof Error
        ? mutation.error.message
        : snapshotQuery.error instanceof Error ? snapshotQuery.error.message : null}
      isLoading={snapshotQuery.isPending}
      isSaving={mutation.isPending}
      notice={mutation.data?.message ?? null}
      onAdd={(destination) => {
        if (destination === 'caught' && isNativeCatalogFormVariant(variantId)) {
          mutation.reset();
          setFormRequest({ variantIds: [variantId], destination });
        } else mutation.mutate(destination);
      }}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/native/collection')}
      row={row}
    />
  );
}
