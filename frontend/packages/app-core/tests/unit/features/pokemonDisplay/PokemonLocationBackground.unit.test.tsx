import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PokemonLocationBackground, {
  resolvePokemonLocationBackground,
} from '@/features/pokemonDisplay/PokemonLocationBackground';

const pokemon = {
  backgrounds: [
    {
      background_id: 12,
      image_url: '/images/backgrounds/osaka.png',
      name: 'Osaka',
      costume_id: 0,
      date: '',
      location: 'Osaka',
    },
    {
      background_id: 24,
      image_url: '/images/backgrounds/london.png',
      name: 'London',
      costume_id: 0,
      date: '',
      location: 'London',
    },
  ],
  instanceData: {
    location_card: '24',
  },
};

describe('PokemonLocationBackground', () => {
  it('resolves the background selected by the instance location card', () => {
    expect(resolvePokemonLocationBackground(pokemon)?.name).toBe('London');

    const { container } = render(<PokemonLocationBackground pokemon={pokemon} />);
    expect(container.querySelector('.pokemon-location-background')).toHaveAttribute(
      'src',
      '/images/backgrounds/london.png',
    );
  });

  it('renders nothing when the instance has no selected special background', () => {
    render(
      <PokemonLocationBackground
        pokemon={{ ...pokemon, instanceData: { location_card: null } }}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
