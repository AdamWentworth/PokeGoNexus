// hooks/useBackgrounds.ts
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import { backgroundMatchesVariant } from '@/utils/backgroundCostume';

export function useBackgrounds(
  backgrounds: VariantBackground[],
  variantType?: string,
  locationCard?: string | number | null,
) {
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<VariantBackground | null>(null);

  const selectableBackgrounds = useMemo(() => {
    return backgrounds.filter((background) =>
      backgroundMatchesVariant(background, variantType),
    );
  }, [backgrounds, variantType]);

  useEffect(() => {
    if (locationCard === null || locationCard === undefined) {
      setSelectedBackground(null);
      return;
    }

    const id = parseInt(String(locationCard), 10);
    const background = selectableBackgrounds.find(
      (candidate) => candidate.background_id === id,
    );
    setSelectedBackground(background ?? null);
  }, [locationCard, selectableBackgrounds]);

  const handleBackgroundSelect = useCallback(
    (background: VariantBackground | null) => {
      const validBackground =
        background && backgroundMatchesVariant(background, variantType)
          ? background
          : null;
      setSelectedBackground(validBackground);
      setShowBackgrounds(false);
    },
    [variantType],
  );

  return {
    showBackgrounds,
    setShowBackgrounds,
    selectedBackground,
    handleBackgroundSelect,
    selectableBackgrounds,
  };
}
