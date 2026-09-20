import { useEffect, useMemo } from 'react';
import type { PokemonMovesChunk } from '@pokemongonexus/shared-contracts/pokemon';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { runAfterNativeUiInteractions } from '../../interaction/nativeUiInteractionScheduler';
import { buildNativeCollectionRows, buildNativeInstanceDetail } from './collectionModel';
import { resolveNativeInstanceNeighbors } from './nativeInstanceNavigationContext';
import { prefetchNativeInstanceArtwork } from './nativeInstanceArtwork';

const EMPTY_MOVES: PokemonMovesChunk = [];

export const useNativeInstanceNavigationData = ({
  snapshot,
  moves = EMPTY_MOVES,
  instanceId,
  assetBaseUrl,
  sameStatusOnly = false,
}: {
  snapshot: Pick<NativeCollectionSnapshot, 'instances' | 'catalog'> | null | undefined;
  moves?: PokemonMovesChunk;
  instanceId: string;
  assetBaseUrl: string;
  sameStatusOnly?: boolean;
}) => {
  const detail = useMemo(() => snapshot && instanceId ? buildNativeInstanceDetail(
    snapshot.instances, snapshot.catalog, moves, instanceId, assetBaseUrl,
  ) : null, [assetBaseUrl, instanceId, moves, snapshot]);
  const status = sameStatusOnly ? detail?.row.status : null;
  // The collection order is unchanged when selecting another instance.
  const fallbackIds = useMemo(() => snapshot ? buildNativeCollectionRows(
    snapshot.instances, snapshot.catalog, assetBaseUrl,
  ).filter((row) => !status || row.status === status).map((row) => row.id) : [], [
    assetBaseUrl, snapshot, status,
  ]);
  const neighbors = useMemo(() => resolveNativeInstanceNeighbors({
    instanceId, fallbackIds,
  }), [fallbackIds, instanceId]);

  useEffect(() => {
    if (!snapshot) return undefined;
    const scheduled = runAfterNativeUiInteractions(() => {
      for (const siblingId of [neighbors.previousId, neighbors.nextId]) {
        if (!siblingId) continue;
        const sibling = buildNativeInstanceDetail(
          snapshot.instances, snapshot.catalog, moves, siblingId, assetBaseUrl,
        );
        if (sibling) void prefetchNativeInstanceArtwork(sibling, assetBaseUrl);
      }
    });
    return scheduled.cancel;
  }, [assetBaseUrl, moves, neighbors.nextId, neighbors.previousId, snapshot]);

  return { detail, neighbors };
};
