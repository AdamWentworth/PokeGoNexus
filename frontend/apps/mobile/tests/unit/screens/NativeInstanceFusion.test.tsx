import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { NativeInstanceDetail } from '../../../src/features/collection/collectionModel';
import { NativeInstanceDetailScreen } from '../../../src/screens/NativeInstanceDetailScreen';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../../src/services/locationApi', () => ({ getNativeLocationSuggestions: jest.fn() }));

const baseMove = { id: 1, name: 'Confusion', kind: 'fast' as const, legacy: false, typeName: 'Psychic' };
const fusionMove = { id: 2, name: 'Moongeist Beam', kind: 'charged' as const, legacy: false, typeName: 'Ghost' };
const row: NativeInstanceDetail['row'] = {
  id: 'necrozma', pokemonId: 800, pokedexNumber: 800, name: 'Necrozma', imageUri: '/base.png',
  typeIconUris: ['/images/types/psychic.png'], locationBackgroundUri: null, maxKind: null,
  purified: false, lucky: false, status: 'caught', cp: null, favorite: false, mostWanted: false,
};
const detail: NativeInstanceDetail = {
  row, traits: [], stats: [], ivs: [], moves: [], provenance: [], preferences: [],
  baseStats: { attack: 223, defense: 173, stamina: 186 },
  baseMoveOptions: [baseMove], moveOptions: [baseMove],
  baseTypeIconUris: row.typeIconUris,
  baseBackgroundOptions: [{ id: 10, name: 'Base sky', imageUri: '/base-bg.png' }],
  backgroundOptions: [{ id: 10, name: 'Base sky', imageUri: '/base-bg.png' }],
  appearanceImageUris: { base: '/base.png', shadow: null, purified: '/base.png' },
  instance: {
    pokemon_id: 800, is_caught: true, is_fused: false, fusion: { 1: true },
    fast_move_id: 1, attack_iv: 15, defense_iv: 14, stamina_iv: 13, level: 40,
  } as unknown as NonNullable<NativeInstanceDetail['instance']>,
  fusionOptions: [{
    id: 2, name: 'Dawn Wings Necrozma', imageUri: '/fused.png',
    moveOptions: [baseMove, fusionMove], stats: { attack: 277, defense: 220, stamina: 200 },
    typeIconUris: ['/images/types/psychic.png', '/images/types/ghost.png'], partnerPokemonId: 792,
    partnerRows: [
      { ...row, id: 'lunala-1', name: 'Lunala', speciesName: 'Lunala', cp: 3000, level: 30, imageUri: '/lunala.png' },
      { ...row, id: 'lunala-2', name: 'Moon', speciesName: 'Lunala', cp: 4000, level: 40, imageUri: '/shiny-lunala.png', backgroundName: 'Moon sky', locationBackgroundUri: '/moon-bg.png' },
    ],
    backgroundOptions: [{ id: 12, name: 'Fusion sky', imageUri: '/fusion-bg.png' }],
    partnerBackgroundIds: { 'lunala-1': null, 'lunala-2': 21 },
    comboBackgrounds: [{ ownBackgroundId: 12, partnerBackgroundId: 21, option: { id: 99, name: 'Combined', imageUri: '/combo-bg.png' } }],
  }],
};

const mount = (data = detail) => {
  const onSaveDetails = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  render(<NativeInstanceDetailScreen detail={data} isLoading={false} error={null} cachedAt={null}
    movesWarning={null} saveNotice={null} saveError={null} isSaving={false}
    onRetry={jest.fn()} onBack={onBack} onToggleFavorite={jest.fn()} onSaveDetails={onSaveDetails} />);
  return { onSaveDetails, onBack };
};
const edit = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Edit Pokémon' }));
  await waitFor(() => expect(screen.getByLabelText('Pokémon inline identity editor')).toBeTruthy());
};

it('keeps fusion read-only until editing and cancels partner selection without changing the draft', async () => {
  const { onSaveDetails } = mount();
  expect(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' })).toBeDisabled();
  await edit();
  fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
  expect(screen.getByText('Select Fusion Partner')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Moon, CP 4000, level 40, Moon sky' })).toBeTruthy();
  fireEvent.press(screen.getByTestId('native-fusion-partner-lunala-2'));
  fireEvent.press(screen.getByRole('button', { name: 'Cancel fusion' }));
  expect(screen.queryByRole('button', { name: 'Separate' })).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' })); });
  expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({ is_fused: false, fused_with: null, fast_move_id: 1, fusion: { 1: true } }));
});

it('previews the selected partner combination and preserves registration history on save', async () => {
  const { onSaveDetails } = mount();
  await edit();
  fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
  fireEvent.press(screen.getByTestId('native-fusion-partner-lunala-2'));
  expect(screen.queryByRole('button', { name: 'Separate' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Fuse' }));
  expect(screen.getByRole('button', { name: 'Separate' })).toBeEnabled();
  expect(screen.getByTestId('native-instance-types-psychic-ghost')).toBeTruthy();
  expect(screen.getByLabelText('Combat Power').props.value).not.toBe('2867');
  fireEvent.press(screen.getByRole('button', { name: 'Choose location background' }));
  fireEvent.press(screen.getByRole('button', { name: 'Use Fusion sky background' }));
  expect(screen.getByTestId('native-location-backdrop-image', { includeHiddenElements: true }).props.src.uri).toBe('/combo-bg.png');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' })); });
  expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({ is_fused: true, fused_with: 'lunala-2', fusion_form: 'Dawn Wings Necrozma', fusion: { 1: true, 2: true }, fast_move_id: 1, location_card: '12' }));
});

it('separates a saved fusion into its actual base image, types, CP, moves and backgrounds', async () => {
  const fusedDetail: NativeInstanceDetail = {
    ...detail, activeFusionId: 2,
    row: { ...row, imageUri: '/fused.png', typeIconUris: detail.fusionOptions![0].typeIconUris! },
    moveOptions: [baseMove, fusionMove], backgroundOptions: detail.fusionOptions![0].backgroundOptions,
    instance: { ...detail.instance!, is_fused: true, fusion_form: '2', fused_with: 'lunala-2', fusion: { 1: true, 2: true }, charged_move1_id: 2, location_card: '12' },
  };
  const { onSaveDetails, onBack } = mount(fusedDetail);
  expect(screen.getByRole('button', { name: 'Separate' })).toBeDisabled();
  await edit();
  fireEvent.press(screen.getByRole('button', { name: 'Separate' }));
  expect(screen.getByLabelText('Combat Power').props.value).toBe('2867');
  expect(screen.getByTestId('native-instance-types-psychic')).toBeTruthy();
  expect(screen.getByLabelText('Necrozma').props.source[0].uri).toBe('/base.png');
  fireEvent.press(screen.getByRole('button', { name: 'Choose charged move' }));
  expect(screen.queryByText('Moongeist Beam')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close charged move selector' }));
  fireEvent.press(screen.getByRole('button', { name: 'Choose location background' }));
  expect(screen.getByRole('button', { name: 'Use Base sky background' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Use Fusion sky background' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close background selector' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
  expect(screen.getByTestId('native-fusion-partner-lunala-2')).toBeSelected();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel fusion' }));
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onSaveDetails).not.toHaveBeenCalled();
});

it('explains missing partners without creating a fused draft', async () => {
  const { onSaveDetails } = mount({ ...detail, fusionOptions: [{ ...detail.fusionOptions![0], partnerRows: [] }] });
  await edit();
  fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
  expect(screen.getByText('No available caught partner for Dawn Wings Necrozma.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Fuse' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel fusion' }));
  expect(onSaveDetails).not.toHaveBeenCalled();
});

it('preserves saved moves and disables move editing when the fusion learnset is missing', async () => {
  const { onSaveDetails } = mount({
    ...detail, fusionOptions: [{ ...detail.fusionOptions![0], moveOptions: [] }],
  });
  await edit();
  fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fuse' }));
  expect(screen.getByText(/Fusion moves are unavailable/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose fast move' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Choose charged move' })).toBeDisabled();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' })); });
  expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({ fast_move_id: 1 }));
});
