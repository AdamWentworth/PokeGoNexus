import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativeCatalogFormPicker } from '../../../../src/features/collection/NativeCatalogFormPicker';
import { NativePokemonOrganizerSheet } from '../../../../src/features/collection/NativePokemonOrganizerSheet';
import { buildNativeCatalogRows } from '../../../../src/features/collection/collectionModel';
import { caughtCopy, formCatalog } from '../../../fixtures/nativeCatalogForms';

const copies = { charizard: caughtCopy('charizard', 6), base: caughtCopy('base', 646), partner: caughtCopy('partner', 644) };
const picker = (variantIds = ['0006-mega_x'], onConfirm = jest.fn().mockResolvedValue(undefined)) => {
  const onCancel = jest.fn();
  render(<NativeCatalogFormPicker assetBaseUrl="https://example.test" catalog={formCatalog} instances={copies}
    request={{ variantIds, destination: 'caught', favorite: true, customTagIds: ['chosen-tag'] }}
    error={null} isSaving={false} onCancel={onCancel} onConfirm={onConfirm} />);
  return { onCancel, onConfirm };
};

describe('NativeCatalogFormPicker', () => {
  it('shows real CP and IVs and waits for confirmation before selecting an existing Mega copy', async () => {
    const { onConfirm } = picker();
    expect(screen.getByText('IVs 15/14/13')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Charizard, CP 3210, level 40' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Mega Evolve' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ favorite: true, customTagIds: ['chosen-tag'], formChoices: { '0006-mega_x': { kind: 'mega', base: { kind: 'existing', instanceId: 'charizard' } } } })));
  });

  it('chooses existing fusion components and submits them together', async () => {
    const { onConfirm } = picker(['0646-fusion_1']);
    fireEvent.press(screen.getByRole('radio', { name: 'Kyurem, CP 3210, level 40' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Zekrom, CP 3210, level 40' }));
    fireEvent.press(screen.getByRole('button', { name: 'Fuse Selected Pokémon' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ formChoices: { '0646-fusion_1': { kind: 'fusion', base: { kind: 'existing', instanceId: 'base' }, partner: { kind: 'existing', instanceId: 'partner' } } } })));
  });

  it('cancels newly selected fusion copies without creating anything', () => {
    const { onConfirm, onCancel } = picker(['0646-fusion_1']);
    fireEvent.press(screen.getByRole('radio', { name: 'Create New Kyurem' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Create New Zekrom' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('collects multiple form choices before saving and reserves existing copies', async () => {
    const { onConfirm } = picker(['0006-mega_x', '0006-mega_y']);
    fireEvent.press(screen.getByRole('radio', { name: 'Charizard, CP 3210, level 40' }));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('radio', { name: 'Charizard, CP 3210, level 40' })).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Generate and Evolve New' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mega Evolve' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ formChoices: {
      '0006-mega_x': { kind: 'mega', base: { kind: 'existing', instanceId: 'charizard' } },
      '0006-mega_y': { kind: 'mega', base: { kind: 'new' } },
    } })));
  });

  it('prevents duplicate confirmation while saving and leaves failures reviewable', async () => {
    let reject!: (error: Error) => void;
    const onConfirm = jest.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    picker(['0006-mega_x'], onConfirm);
    fireEvent.press(screen.getByRole('radio', { name: 'Generate and Evolve New' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mega Evolve' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mega Evolve' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('Storage is unavailable')));
    expect(screen.getByText('Storage is unavailable')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Generate and Evolve New' }).props.accessibilityState.checked).toBe(true);
  });

  it('opens from the actual organizer Add action and cancellation returns to its choices', () => {
    const onApply = jest.fn();
    const rows = buildNativeCatalogRows(formCatalog, 'https://example.test').filter((row) => row.id === '0646-fusion_1');
    render(<NativePokemonOrganizerSheet assetBaseUrl="https://example.test" catalog={formCatalog} rows={rows}
      instances={copies} inventoryTags={[]} wishlistTags={[]} error={null} isSaving={false}
      visible onApply={onApply} onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add (1)' }));
    expect(screen.getByRole('header', { name: 'Black Kyurem' })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('header', { name: 'Add Pokémon' })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });
});
