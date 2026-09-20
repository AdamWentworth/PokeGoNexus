import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionRow, NativeTagSummary } from '../../../../src/features/collection/collectionModel';
import { NativePokemonOrganizerSheet } from '../../../../src/features/collection/NativePokemonOrganizerSheet';

const row = (patch: Partial<NativeCollectionRow> = {}): NativeCollectionRow => ({
  id: 'caught-1',
  pokemonId: 1,
  pokedexNumber: 1,
  name: 'Shiny Bulbasaur',
  imageUri: null,
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  source: 'instance',
  cp: 500,
  favorite: false,
  mostWanted: false,
  ...patch,
});

const instance = (patch: Partial<PokemonInstance> = {}): PokemonInstance => ({
  instance_id: 'caught-1',
  variant_id: '0001-shiny',
  pokemon_id: 1,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  favorite: false,
  most_wanted: false,
  caught_tags: [],
  wanted_tags: [],
  registered: true,
  disabled: false,
  lucky: false,
  shadow: false,
  mega: false,
  is_mega: false,
  is_fused: false,
  ...patch,
} as unknown as PokemonInstance);

const customTag = (parent: 'caught' | 'wanted', id: string, name: string): NativeTagSummary => ({
  key: `custom:${id}`,
  parent,
  name,
  color: parent === 'caught' ? '#7c3aed' : '#e11d48',
  tone: 'custom',
  rows: [],
});

const renderSheet = ({
  selectedRow = row(),
  selectedInstance = instance(),
  onApply = jest.fn().mockResolvedValue(undefined),
  onCreateTag,
}: {
  selectedRow?: NativeCollectionRow;
  selectedInstance?: PokemonInstance;
  onApply?: jest.Mock;
  onCreateTag?: jest.Mock;
} = {}) => {
  const view = render(
    <NativePokemonOrganizerSheet
      error={null}
      instances={{ [selectedRow.id]: selectedInstance }}
      inventoryTags={[customTag('caught', 'shadow-shinies', 'Shadow Shinies')]}
      isSaving={false}
      onApply={onApply}
      onClose={jest.fn()}
      onCreateTag={onCreateTag}
      rows={[selectedRow]}
      visible
      wishlistTags={[customTag('wanted', 'priority', 'Priority')]}
    />,
  );
  return { ...view, onApply };
};

describe('NativePokemonOrganizerSheet', () => {
  it('applies built-in and custom labels to an existing caught instance', async () => {
    const { onApply } = renderSheet();

    fireEvent.press(screen.getByText('Favorite'));
    fireEvent.press(screen.getByText('Shadow Shinies'));
    fireEvent.press(screen.getByRole('button', { name: 'Apply to 1' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({
      operation: 'update',
      instanceIds: ['caught-1'],
      favorite: true,
      caughtTagChanges: { 'shadow-shinies': true },
      wantedTagChanges: {},
    }));
  });

  it('creates a Wanted copy without changing the caught source', async () => {
    const { onApply } = renderSheet();

    fireEvent.press(screen.getByText('Create Wanted copy'));
    expect(screen.getByRole('header', { name: 'Create Wanted copies' })).toBeTruthy();
    fireEvent.press(screen.getByText('Most Wanted'));
    fireEvent.press(screen.getByText('Priority'));
    fireEvent.press(screen.getByRole('button', { name: 'Create 1 Wanted copy' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({
      operation: 'clone-wanted',
      instanceIds: ['caught-1'],
      mostWanted: true,
      customTagIds: ['priority'],
    }));
  });

  it('requires a distinct confirmation stage before removing an instance', async () => {
    const { onApply } = renderSheet();

    fireEvent.press(screen.getByText('Transfer selected'));
    expect(screen.getByRole('header', { name: 'Transfer Pokémon' })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Transfer selected' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({
      operation: 'remove',
      instanceIds: ['caught-1'],
    }));
  });

  it('creates, selects, and applies a new tag without waiting for a snapshot refresh', async () => {
    const onCreateTag = jest.fn().mockResolvedValue({
      tag_id: 'new-tag', parent: 'caught', name: 'Raid catches', color: '#2563eb', sort: 0,
    });
    const { onApply } = renderSheet({ onCreateTag });

    fireEvent.press(screen.getByRole('button', { name: 'New inventory tag' }));
    expect(screen.getByLabelText('New Inventory tag')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Tag name'), 'Raid catches');
    fireEvent.press(screen.getByText('Create tag'));

    await waitFor(() => expect(onCreateTag).toHaveBeenCalledWith({
      parent: 'caught', name: 'Raid catches', color: '#2563EB',
    }));
    expect(screen.getByText('Raid catches')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Apply to 1' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({
      operation: 'update',
      instanceIds: ['caught-1'],
      caughtTagChanges: { 'new-tag': true },
      wantedTagChanges: {},
    }));
  });
});
