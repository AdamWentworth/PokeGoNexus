import type { PokemonInstance } from '@/types/pokemonInstance';
import type { VariantBackground } from '@/types/pokemonSubTypes';

import './PokemonLocationBackground.css';

type BackgroundPokemon = {
  backgrounds?: VariantBackground[];
  instanceData?: Partial<PokemonInstance>;
};

export const resolvePokemonLocationBackground = (
  pokemon?: BackgroundPokemon | null,
): VariantBackground | null => {
  const rawId = pokemon?.instanceData?.location_card;
  if (rawId == null || rawId === '') return null;

  const backgroundId = Number(rawId);
  if (!Number.isFinite(backgroundId)) return null;

  return (
    pokemon?.backgrounds?.find(
      (background) => Number(background.background_id) === backgroundId,
    ) ?? null
  );
};

const PokemonLocationBackground = ({
  pokemon,
}: {
  pokemon?: BackgroundPokemon | null;
}) => {
  const background = resolvePokemonLocationBackground(pokemon);
  if (!background?.image_url) return null;

  return (
    <img
      src={background.image_url}
      alt=""
      aria-hidden="true"
      className="pokemon-location-background"
    />
  );
};

export default PokemonLocationBackground;
