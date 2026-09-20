import type { BasePokemon, PokemonMovesChunk } from '@pokemongonexus/shared-contracts/pokemon';
import type { TradesEnvelope } from '@pokemongonexus/shared-contracts/trades';
import {
  buildNativeInstanceDetail,
  type NativeInstanceDetail,
} from '../collection/collectionModel';
import { normalizeNativeInstances } from '../collection/nativeInstanceNormalization';
import {
  buildNativeTradeActivityModel,
  type NativeTradeActivityModel,
} from './nativeTradeActivityModel';

export type NativeTradeActivityRow = {
  currentUserPokemon: NativeInstanceDetail | null;
  model: NativeTradeActivityModel;
  partnerPokemon: NativeInstanceDetail | null;
};

export const buildNativeTradeActivityRows = ({
  assetOrigin,
  catalog,
  currentUsername,
  envelope,
  moves,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  currentUsername: string;
  envelope: TradesEnvelope;
  moves: PokemonMovesChunk;
}): NativeTradeActivityRow[] => {
  const relatedInstances = normalizeNativeInstances(envelope.related_instances);
  return envelope.trades.flatMap<NativeTradeActivityRow>((trade) => {
    const model = buildNativeTradeActivityModel(trade, currentUsername);
    if (!model) return [];
    return [{
      model,
      currentUserPokemon: buildNativeInstanceDetail(
        relatedInstances,
        catalog,
        moves,
        model.currentUserInstanceId,
        assetOrigin,
      ),
      partnerPokemon: buildNativeInstanceDetail(
        relatedInstances,
        catalog,
        moves,
        model.partnerInstanceId,
        assetOrigin,
      ),
    }];
  });
};
