import { fireEvent, render, screen } from '@testing-library/react-native';
import { NativeCatalogDetailScreen } from '../../../src/screens/NativeCatalogDetailScreen';

const row = {
  id: '0006-shiny_gigantamax',
  pokemonId: 6,
  pokedexNumber: 6,
  name: 'Shiny Gigantamax Charizard',
  imageUri: 'https://pokegonexus.com/images/charizard.png',
  locationBackgroundUri: null,
  maxKind: 'gigantamax' as const,
  purified: false,
  lucky: false,
  typeIconUris: ['https://pokegonexus.com/images/types/fire.png'],
  status: 'caught' as const,
  source: 'catalog' as const,
  cp: null,
  favorite: false,
  mostWanted: false,
};

describe('NativeCatalogDetailScreen', () => {
  it('shows the selected variant and exposes all three collection destinations', () => {
    const onAdd = jest.fn();
    render(
      <NativeCatalogDetailScreen
        error={null}
        isLoading={false}
        isSaving={false}
        notice={null}
        onAdd={onAdd}
        onBack={jest.fn()}
        row={row}
      />,
    );

    expect(screen.getByText('Shiny Gigantamax Charizard')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Caught' }));
    fireEvent.press(screen.getByRole('button', { name: 'For Trade' }));
    fireEvent.press(screen.getByRole('button', { name: 'Wanted' }));
    expect(onAdd.mock.calls).toEqual([['caught'], ['trade'], ['wanted']]);
  });

  it('keeps success feedback visible in the same workflow', () => {
    render(
      <NativeCatalogDetailScreen
        error={null}
        isLoading={false}
        isSaving={false}
        notice="Pokémon added. Receiver accepted the change."
        onAdd={jest.fn()}
        onBack={jest.fn()}
        row={row}
      />,
    );
    expect(screen.getByText('Pokémon added. Receiver accepted the change.')).toBeTruthy();
  });
});
