import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { parseTradeVariantReference } from '@pokemongonexus/shared-domain/trade-proposal-candidates';
import { useNativeSession } from '../../../../../auth/NativeSessionContext';
import {
  buildNativeInstanceDetail,
} from '../../../../../features/collection/collectionModel';
import {
  useNativeForeignCollectionQuery,
  useNativeCollectionSnapshotQuery,
  useNativePokemonMovesQuery,
} from '../../../../../features/collection/collectionQueries';
import {
  navigateNativeInstanceSibling,
} from '../../../../../features/collection/nativeInstanceNavigationContext';
import { useNativeInstanceNavigationData } from '../../../../../features/collection/useNativeInstanceNavigationData';
import { useNativePokemonOrganizerMutation } from '../../../../../features/collection/useNativePokemonOrganizerMutation';
import { NativeTradeProposalSheet } from '../../../../../features/trades/NativeTradeProposalSheet';
import {
  buildNativeTradeProposalSelection,
  type NativeTradeProposalSelection,
} from '../../../../../features/trades/nativeTradeProposalModel';
import {
  useNativeCreateTradeProposal,
  useNativeTradesQuery,
} from '../../../../../features/trades/tradeQueries';
import { runtimeConfig } from '../../../../../config/runtimeConfig';
import { NativeInstanceDetailScreen } from '../../../../../screens/NativeInstanceDetailScreen';
import { NativeProtectedSessionGate } from '../../../../../components/NativeProtectedSessionGate';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeForeignInstanceRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    instanceId?: string | string[];
    username?: string | string[];
  }>();
  const session = useNativeSession();
  const userId = session.user?.user_id ?? null;
  const username = firstParam(params.username).trim();
  const instanceId = firstParam(params.instanceId).trim();
  const foreignQuery = useNativeForeignCollectionQuery(
    userId,
    username,
  );
  const movesQuery = useNativePokemonMovesQuery(Boolean(username));
  const ownedQuery = useNativeCollectionSnapshotQuery(userId);
  const tradesQuery = useNativeTradesQuery(userId);
  const organizerMutation = useNativePokemonOrganizerMutation(userId ?? 'signed-out');
  const proposalMutation = useNativeCreateTradeProposal(userId ?? 'signed-out');
  const [proposalTargetId, setProposalTargetId] = useState<string | null>(null);
  const success = foreignQuery.data?.type === 'success' ? foreignQuery.data : null;
  const { detail, neighbors } = useNativeInstanceNavigationData({
    snapshot: success,
    moves: movesQuery.data,
    instanceId,
    assetBaseUrl: runtimeConfig.api.frontendAppUrl,
    sameStatusOnly: true,
  });
  const selectedTargetDetail = useMemo(() => (
    success && proposalTargetId
      ? buildNativeInstanceDetail(
          success.instances,
          success.catalog,
          movesQuery.data ?? [],
          proposalTargetId,
          runtimeConfig.api.frontendAppUrl,
        )
      : null
  ), [movesQuery.data, proposalTargetId, success]);
  const proposalSelection = useMemo<NativeTradeProposalSelection | null>(() => {
    if (!proposalTargetId || !detail || !selectedTargetDetail) return null;
    if (ownedQuery.error) {
      return {
        kind: 'invalid',
        message: ownedQuery.error instanceof Error
          ? ownedQuery.error.message
          : 'Your collection could not be checked.',
      };
    }
    if (tradesQuery.error) {
      return {
        kind: 'invalid',
        message: tradesQuery.error instanceof Error
          ? tradesQuery.error.message
          : 'Your active trades could not be checked.',
      };
    }
    if (!ownedQuery.data || !tradesQuery.data) return null;
    return buildNativeTradeProposalSelection({
      listing: detail,
      selectedTarget: selectedTargetDetail,
      ownedInstances: ownedQuery.data.instances,
      activeTrades: tradesQuery.data.trades,
      parseVariantId: parseTradeVariantReference,
    });
  }, [
    detail,
    ownedQuery.data,
    ownedQuery.error,
    proposalTargetId,
    selectedTargetDetail,
    tradesQuery.data,
    tradesQuery.error,
  ]);
  const offeredDetails = useMemo(() => {
    if (proposalSelection?.kind !== 'proposalReady' || !ownedQuery.data) return [];
    return proposalSelection.offeredInstances.flatMap((instance) => {
      const instanceId = instance.instance_id;
      if (!instanceId) return [];
      const candidate = buildNativeInstanceDetail(
        ownedQuery.data.instances,
        ownedQuery.data.catalog,
        movesQuery.data ?? [],
        instanceId,
        runtimeConfig.api.frontendAppUrl,
      );
      return candidate ? [candidate] : [];
    });
  }, [movesQuery.data, ownedQuery.data, proposalSelection]);
  const caughtDetails = useMemo(() => {
    if (proposalSelection?.kind !== 'needsTradeSelection' || !ownedQuery.data) return [];
    return proposalSelection.caughtInstances.flatMap((instance) => {
      const instanceId = instance.instance_id;
      if (!instanceId) return [];
      const candidate = buildNativeInstanceDetail(
        ownedQuery.data.instances,
        ownedQuery.data.catalog,
        movesQuery.data ?? [],
        instanceId,
        runtimeConfig.api.frontendAppUrl,
      );
      return candidate ? [candidate] : [];
    });
  }, [movesQuery.data, ownedQuery.data, proposalSelection]);
  const resultError = foreignQuery.error instanceof Error
    ? foreignQuery.error.message
    : foreignQuery.data?.type === 'forbidden'
      ? foreignQuery.data.message
      : foreignQuery.data?.type === 'not-found'
        ? 'This trainer could not be found.'
        : !foreignQuery.isPending && success && !detail
          ? 'This listing is no longer available.'
          : null;

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening trade listing…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  const navigateToSibling = (nextInstanceId: string) => {
    navigateNativeInstanceSibling(router, nextInstanceId);
  };
  const returnToCatalog = () => {
    if (router.canGoBack()) router.back();
    else router.replace({
      pathname: '/native/collection/trainer/[username]',
      params: { username: success?.username ?? username, filter: detail?.row.status ?? 'caught' },
    });
  };
  const closeProposal = () => setProposalTargetId(null);
  const markForTrade = async (candidateInstanceId: string) => {
    await organizerMutation.mutateAsync({
      operation: 'update',
      instanceIds: [candidateInstanceId],
      forTrade: true,
    });
  };

  return (
    <>
    <NativeInstanceDetailScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      cachedAt={null}
      canEdit={false}
      detail={detail}
      error={resultError}
      isLoading={foreignQuery.isPending}
      isSaving={false}
      movesWarning={movesQuery.error instanceof Error
        ? 'Move names are temporarily unavailable. The rest of this Pokémon is still current.'
        : null}
      onBack={returnToCatalog}
      onNext={neighbors.nextId ? () => navigateToSibling(neighbors.nextId!) : undefined}
      onOpenTarget={session.user ? setProposalTargetId : undefined}
      onPrevious={neighbors.previousId ? () => navigateToSibling(neighbors.previousId!) : undefined}
      onRetry={() => void Promise.all([foreignQuery.refetch(), movesQuery.refetch()])}
      onToggleFavorite={() => undefined}
      saveError={null}
      saveNotice={null}
    />
    {session.user ? <NativeTradeProposalSheet
      key={`${proposalTargetId ?? 'closed'}:${proposalSelection?.kind ?? 'preparing'}`}
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      caughtDetails={caughtDetails}
      currentTrainerInstances={ownedQuery.data?.instances ?? {}}
      isMarkingForTrade={organizerMutation.isPending}
      isPreparing={Boolean(
        proposalTargetId
          && !proposalSelection
          && (ownedQuery.isPending || tradesQuery.isPending),
      )}
      onClose={closeProposal}
      onMarkForTrade={markForTrade}
      onSubmit={(proposal) => proposalMutation.mutateAsync(proposal)}
      offeredDetails={offeredDetails}
      partnerInstances={success?.instances ?? {}}
      partnerUsername={success?.username ?? username}
      selection={proposalSelection}
    /> : null}
    </>
  );
}
