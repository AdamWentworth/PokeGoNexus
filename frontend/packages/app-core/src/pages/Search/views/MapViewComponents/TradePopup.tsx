import React from 'react';

import MapResultPopup, { type MapResultPopupItem } from './MapResultPopup';
import type { MapPopupLinkedEntry } from './MapPopupLinkedPokemonList';
import {
  getMapPopupImageUrl,
  getMapPopupPokemonDisplayName,
} from './mapPopupHelpers';

type MatchedPokemon = {
  currentImage?: string;
  name?: string;
  form?: string | null;
};

type TradePopupItem = MapResultPopupItem & {
  wanted_list?: Record<string, MapPopupLinkedEntry> | null;
};

type TradePopupProps = {
  item: TradePopupItem;
  navigateToUserCatalog: (
    username: string,
    instanceId: string,
    instanceData: string,
  ) => void;
  navigateToUserProfile: (username: string) => void;
  findPokemonByKey: (
    keyOrInstanceId?: string | null,
    instanceLike?: Record<string, unknown> | null,
  ) => MatchedPokemon | null;
  onClose: () => void;
};

const TradePopup: React.FC<TradePopupProps> = ({
  item,
  navigateToUserCatalog,
  navigateToUserProfile,
  findPokemonByKey,
  onClose,
}) => (
  <MapResultPopup
    findPokemonByKey={findPokemonByKey}
    imageUrl={getMapPopupImageUrl(item)}
    item={item}
    kind="trade"
    onClose={onClose}
    onViewListing={() =>
      navigateToUserCatalog(item.username, item.instance_id, 'Trade')
    }
    onViewTrainer={() => navigateToUserProfile(item.username)}
    pokemonDisplayName={getMapPopupPokemonDisplayName(item)}
    relatedEntries={item.wanted_list}
    relatedTitle="Trainer wants"
  />
);

export default TradePopup;
