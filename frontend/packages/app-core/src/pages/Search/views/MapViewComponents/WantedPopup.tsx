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

type WantedPopupItem = MapResultPopupItem & {
  trade_list?: Record<string, MapPopupLinkedEntry> | null;
};

type WantedPopupProps = {
  item: WantedPopupItem;
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

const WantedPopup: React.FC<WantedPopupProps> = ({
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
    kind="wanted"
    onClose={onClose}
    onViewListing={() =>
      navigateToUserCatalog(item.username, item.instance_id, 'Wanted')
    }
    onViewTrainer={() => navigateToUserProfile(item.username)}
    pokemonDisplayName={getMapPopupPokemonDisplayName(item)}
    relatedEntries={item.trade_list}
    relatedTitle="Trainer can offer"
  />
);

export default WantedPopup;
