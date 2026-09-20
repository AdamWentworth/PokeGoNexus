import { fireEvent, render } from '@testing-library/react-native';
import { NativeTrainerSearchScreen } from '../../../src/screens/NativeTrainerSearchScreen';

describe('NativeTrainerSearchScreen', () => {
  const baseProps = {
    entries: [],
    onOpenCatalog: jest.fn(),
    onOpenProfile: jest.fn(),
    onQueryChange: jest.fn(),
    onSubmit: jest.fn(),
    query: '',
  };

  beforeEach(() => jest.clearAllMocks());

  it('explains that both Nexus and Pokémon GO names are searchable', () => {
    const screen = render(<NativeTrainerSearchScreen {...baseProps} />);
    expect(screen.getByText('Search by their Nexus username or Pokémon GO name.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Username or Pokémon GO name')).toBeTruthy();
  });

  it('renders canonical trainer identity and opens either destination', () => {
    const onOpenCatalog = jest.fn();
    const onOpenProfile = jest.fn();
    const screen = render(
      <NativeTrainerSearchScreen
        {...baseProps}
        entries={[{
          username: 'AdamZilla',
          pokemonGoName: 'AdamGo',
          team: 'Mystic',
          trainer_level: 50,
        }]}
        onOpenCatalog={onOpenCatalog}
        onOpenProfile={onOpenProfile}
        hasSearched
        query="adam"
      />,
    );
    expect(screen.getByText('Nexus · @AdamZilla')).toBeTruthy();
    expect(screen.getByText('Pokémon GO · AdamGo')).toBeTruthy();
    expect(screen.getByText('Team Mystic')).toBeTruthy();
    expect(screen.getByText('Level 50')).toBeTruthy();
    fireEvent.press(screen.getByText('View Pokémon'));
    fireEvent.press(screen.getByText('View profile  →'));
    expect(onOpenCatalog).toHaveBeenCalledWith('AdamZilla');
    expect(onOpenProfile).toHaveBeenCalledWith('AdamZilla');
  });

  it('renders immediate loading, error, empty, and clear behavior', () => {
    const onQueryChange = jest.fn();
    const screen = render(
      <NativeTrainerSearchScreen
        {...baseProps}
        isLoading
        onQueryChange={onQueryChange}
        query="adam"
      />,
    );
    expect(screen.getByText('Searching trainers')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear trainer search'));
    expect(onQueryChange).toHaveBeenCalledWith('');

    screen.rerender(
      <NativeTrainerSearchScreen {...baseProps} error="Search offline." hasSearched query="adam" />,
    );
    expect(screen.getByText('Trainer search couldn’t be completed')).toBeTruthy();
    expect(screen.getByText('Search offline.')).toBeTruthy();

    screen.rerender(<NativeTrainerSearchScreen {...baseProps} hasSearched query="adam" />);
    expect(screen.getByText('No trainers found')).toBeTruthy();
  });

  it('matches Vite submit and pre-search states', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <NativeTrainerSearchScreen {...baseProps} onSubmit={onSubmit} query="a" />,
    );

    expect(screen.getByText('Enter one more character to search.')).toBeTruthy();
    expect(screen.queryByText('Find people you know')).toBeNull();
    expect(screen.queryByText('No trainers found')).toBeNull();
    expect(screen.getByRole('button', { name: 'Search trainers' }).props.accessibilityState)
      .toEqual({ disabled: true });

    screen.rerender(
      <NativeTrainerSearchScreen {...baseProps} onSubmit={onSubmit} query="adam" />,
    );
    expect(screen.queryByText('No trainers found')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Search trainers' }));
    expect(onSubmit).toHaveBeenCalledWith('adam');
  });
});
