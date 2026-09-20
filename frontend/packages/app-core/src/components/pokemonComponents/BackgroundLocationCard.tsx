import React, { useEffect, useMemo, useState } from 'react';
import './BackgroundLocationCard.css';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import {
  backgroundMatchesVariant,
  backgroundMatchesCostume,
  normalizeCostumeId,
  type CostumeReference,
} from '@/utils/backgroundCostume';

type Props = {
  pokemon?: {
    variantType?: string;
    backgrounds?: VariantBackground[];
  };
  onSelectBackground?: (background: VariantBackground | null) => void;
  selectedCostumeId?: number | null;
  filterBackground?: (background: VariantBackground) => boolean;
  costumeOptions?: CostumeReference[];
  showCostumePairing?: boolean;
  title?: string;
  containerClassName?: string;
  itemClassName?: string;
  selectedItemClassName?: string;
};

const getNormalizedText = (value: string | null | undefined): string => String(value ?? '').trim();

const getBackgroundTitle = (background: VariantBackground): string =>
  getNormalizedText(background.name) || 'Unknown Background';

const getBackgroundLocationLabel = (background: VariantBackground): string =>
  getNormalizedText(background.location) || getBackgroundTitle(background);

const BackgroundLocationCard: React.FC<Props> = ({
  pokemon,
  onSelectBackground,
  selectedCostumeId,
  filterBackground,
  costumeOptions = [],
  showCostumePairing = false,
  title = 'Select Background',
  containerClassName = 'background-location-card',
  itemClassName = 'background-item',
  selectedItemClassName = 'selected',
}) => {
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedBackgroundId(null);
  }, [pokemon]);

  const handleBackgroundSelect = (background: VariantBackground | null) => {
    setSelectedBackgroundId(background?.background_id ?? null);
    onSelectBackground?.(background);
  };

  const selectableBackgrounds = useMemo(() => {
    if (!pokemon?.backgrounds) return [];

    const defaultFilter = (background: VariantBackground) => {
      if (selectedCostumeId !== undefined) {
        return backgroundMatchesCostume(background, selectedCostumeId);
      }
      return backgroundMatchesVariant(background, pokemon.variantType);
    };

    return pokemon.backgrounds.filter(filterBackground ?? defaultFilter);
  }, [filterBackground, pokemon, selectedCostumeId]);

  const selectedBackground = useMemo(
    () =>
      selectableBackgrounds.find((background) => background.background_id === selectedBackgroundId) ??
      null,
    [selectableBackgrounds, selectedBackgroundId],
  );

  return (
    <div className={containerClassName}>
      <div className="background-location-card__header">
        <h3>{title}</h3>
      </div>

      <div className="background-list" role="list">
        <button
          type="button"
          className={`${itemClassName} ${selectedBackgroundId == null ? selectedItemClassName : ''}`.trim()}
          onClick={() => handleBackgroundSelect(null)}
        >
          <div className="background-card-button background-card-button--none">
            <span className="none-option">None</span>
            <span className="background-card-subtitle">No location card</span>
          </div>
        </button>

        {selectableBackgrounds.map((background) => {
          const backgroundTitle = getBackgroundTitle(background);
          const backgroundLocationLabel = getBackgroundLocationLabel(background);
          const showLocationLabel =
            backgroundLocationLabel.length > 0 &&
            backgroundLocationLabel.toLowerCase() !== backgroundTitle.toLowerCase();
          const backgroundCostumeId = normalizeCostumeId(background.costume_id);
          const backgroundCostumeName = costumeOptions.find(
            (costume) => normalizeCostumeId(costume.costume_id) === backgroundCostumeId,
          )?.name;

          return (
            <button
              key={`${background.background_id}:${backgroundCostumeId ?? 'none'}`}
              type="button"
              className={`${itemClassName} ${
                selectedBackgroundId === background.background_id ? selectedItemClassName : ''
              }`.trim()}
              onClick={() => handleBackgroundSelect(background)}
            >
              <div className="background-card-button">
                <div className="background-card-media">
                  <img src={background.image_url} alt={backgroundTitle} />
                </div>

                <div className="background-info">
                  <div className="background-card-title">{backgroundTitle}</div>
                  {showCostumePairing ? (
                    <div className="background-card-costume">
                      {backgroundCostumeId === null
                        ? 'No costume'
                        : backgroundCostumeName ?? `Costume #${backgroundCostumeId}`}
                    </div>
                  ) : null}
                  {showLocationLabel ? (
                    <div className="background-card-subtitle">{backgroundLocationLabel}</div>
                  ) : null}
                  {getNormalizedText(background.date) ? (
                    <div className="background-card-date">{background.date}</div>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedBackground ? (
        <div className="selected-background background-selection-summary">
          <div className="background-selection-summary__label">Selected Background</div>
          <div className="background-selection-summary__title">
            {getBackgroundTitle(selectedBackground)}
          </div>
          <div className="background-selection-summary__meta">
            {getBackgroundLocationLabel(selectedBackground)}
          </div>
          <img
            src={selectedBackground.image_url}
            alt={getBackgroundTitle(selectedBackground)}
          />
        </div>
      ) : null}
    </div>
  );
};

export default BackgroundLocationCard;
