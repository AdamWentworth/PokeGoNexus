import React from 'react';

import MapResultPopup, { type MapResultPopupItem } from './MapResultPopup';
import {
  getMapPopupImageUrl,
  getMapPopupPokemonDisplayName,
} from './mapPopupHelpers';

type CaughtPopupProps = {
  item: MapResultPopupItem;
  navigateToUserCatalog: (
    username: string,
    instanceId: string,
    instanceData: string,
  ) => void;
  navigateToUserProfile: (username: string) => void;
  onClose: () => void;
};

const CaughtPopup: React.FC<CaughtPopupProps> = ({
  item,
  navigateToUserCatalog,
  navigateToUserProfile,
  onClose,
}) => (
  <MapResultPopup
    imageUrl={getMapPopupImageUrl(item)}
    item={item}
    kind="caught"
    onClose={onClose}
    onViewListing={() =>
      navigateToUserCatalog(item.username, item.instance_id, 'Caught')
    }
    onViewTrainer={() => navigateToUserProfile(item.username)}
    pokemonDisplayName={getMapPopupPokemonDisplayName(item)}
  />
);

export default CaughtPopup;
