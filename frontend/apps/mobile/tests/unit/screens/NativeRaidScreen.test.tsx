import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import { NativeRaidScreen } from '../../../src/screens/NativeRaidScreen';
import { buildNativeRaidAttackers } from '../../../src/features/tools/nativeBattleModels';
import { nativeRaidCatalog } from '../../nativeRaidFixtures';
jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn(), getItemAsync: jest.fn(() => new Promise(() => {})), setItemAsync: jest.fn() }));
const fast = { move_id: 1, name: 'Vine Whip', raid_power: 10, raid_energy: 8, raid_cooldown: 1, is_fast: 1, type_name: 'grass', type: 'grass' } as Move;
const charged = { ...fast, move_id: 2, name: 'Power Whip', raid_power: 90, raid_energy: -50, raid_cooldown: 2.5, is_fast: 0 } as Move;
const catalog = [{ pokemon_id: 1, name: 'Bulbasaur', pokedex_number: 1, attack: 118, defense: 111, stamina: 128, available: 1, cp40: 1000, cp50: 1200, type1_name: 'grass', type2_name: 'poison', image_url: '/1.png', moves: [fast, charged], raid_boss: [{ id: 1, pokemon_id: 1, name: 'Bulbasaur', form: 'Normal', type: 'one-star', boosted_weather: '', max_boosted_cp: 500, max_unboosted_cp: 400, min_boosted_cp: 300, min_unboosted_cp: 200, possible_shiny: 1, tier: '1' }] }] as BasePokemon[];
const renderRaid = (props: Partial<React.ComponentProps<typeof NativeRaidScreen>> = {}) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
    <NativeRaidScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onMethodology={jest.fn()} onOpenPokemon={jest.fn()} onRetry={jest.fn()} signedIn={false} {...props} />
  </SafeAreaProvider>,
);

const flushRaidCalculation = async () => {
  for (let step = 0; step < 6; step += 1) {
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
  }
};

describe('NativeRaidScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });
  it('switches to exact boss counters and opens methodology', () => {
    const onMethodology = jest.fn();
    renderRaid({ onMethodology });
    expect(screen.getByText('Raid Planner')).toBeTruthy();
    fireEvent.press(screen.getByText('Boss counters'));
    expect(screen.getByText('RAID BOSS')).toBeTruthy();
    expect(screen.getByLabelText('Find boss')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('How raid rankings work'));
    expect(onMethodology).toHaveBeenCalled();
  });
  it('supports type filters, all movesets, settings, and expanded metrics', () => {
    renderRaid();
    fireEvent.press(screen.getByLabelText('Grass'));
    expect(screen.getByText('Top Grass raid attackers')).toBeTruthy();
    fireEvent.press(screen.getByText('ALL MOVESETS'));
    expect(screen.getByText('ALL MOVESETS')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ranking settings'));
    expect(screen.getByText('Ranking conditions')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show all raid stats for Bulbasaur'));
    expect(screen.getAllByText('TDO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ER').length).toBeGreaterThan(0);
  });
  it('switches roster scope and preserves independent Vite-style row disclosures', () => {
    renderRaid({ catalog: nativeRaidCatalog, instances: {}, signedIn: true });
    expect(screen.getByText('Your top raid attackers')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MY POKÉMON 0' }).props.accessibilityHint).toContain('0 raid-ready entries from 0 caught.');
    expect(screen.queryByText(/raid-ready entries from/)).toBeNull();
    fireEvent.press(screen.getByText('ALL POKÉMON'));
    expect(screen.getByText('Top raid attackers')).toBeTruthy();
    const rows = buildNativeRaidAttackers({ catalog: nativeRaidCatalog }).slice(0, 2);
    for (const row of rows) fireEvent.press(screen.getByLabelText(`Show all raid stats for ${row.name}`));
    for (const row of rows) expect(screen.getByLabelText(`Hide all raid stats for ${row.name}`)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Grass'));
    expect(screen.getByText('Top Grass raid attackers')).toBeTruthy();
  });
  it('filters and sorts rankings through the same visible control states as Vite', () => {
    renderRaid({ catalog: nativeRaidCatalog });
    fireEvent.changeText(screen.getByLabelText('Search raid rankings'), 'Attacker 2');
    expect(screen.getByText('Attacker 2')).toBeTruthy();
    expect(screen.queryByText('Attacker 8')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Search raid rankings'), 'not-a-pokemon');
    expect(screen.getByText('No attackers match the current filters.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search raid rankings'), '');
    fireEvent.press(screen.getByLabelText('Sort by DPS'));
    expect(screen.getByLabelText('Sort by DPS, currently descending')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sort by DPS, currently descending'));
    expect(screen.getByLabelText('Sort by DPS, currently ascending')).toBeTruthy();
  });
  it('expands boss setup and simulates a custom raid party', async () => {
    renderRaid();
    fireEvent.press(screen.getByText('Boss counters'));
    await flushRaidCalculation();
    expect(screen.queryByText('Modeling raid timelines…')).toBeNull();
    fireEvent.press(screen.getByText('Attacker rankings'));
    fireEvent.press(screen.getByText('Boss counters'));
    expect(screen.queryByText('Modeling raid timelines…')).toBeNull();
    fireEvent.press(screen.getByLabelText('Raid setup'));
    expect(screen.getByText('BOSS HP')).toBeTruthy();
    expect(screen.getByText('COMFORTABLE')).toBeTruthy();
    expect(screen.getByText('Battle calibration')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Team estimate rules'));
    expect(screen.getByText(/Uses six distinct attackers/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ranking method'));
    fireEvent.press(screen.getByLabelText('Custom raid party'));
    expect(screen.getByLabelText('Trainer 1 battle team')).toBeTruthy();
    expect(screen.getByLabelText('Trainer 2 settings')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add Trainer'));
    fireEvent.press(screen.getByText('Simulate'));
    await act(async () => { jest.runOnlyPendingTimers(); });
    expect(screen.getByLabelText('Raid party result')).toBeTruthy();
    fireEvent.press(screen.getByText('◷  Log raid'));
    expect(screen.getByLabelText('trainers').props.value).toBe('3');
  });
  it('exposes canonical advanced boss controls inside Raid setup', async () => {
    renderRaid();
    fireEvent.press(screen.getByText('Boss counters'));
    await flushRaidCalculation();
    expect(screen.queryByLabelText('Ranking settings')).toBeNull();
    fireEvent.press(screen.getByLabelText('Raid setup'));
    fireEvent.press(screen.getByLabelText('Battle settings'));
    expect(screen.getByText('Dodging')).toBeTruthy();
    expect(screen.getByText('Boss behavior')).toBeTruthy();
    expect(screen.getByText('Monte Carlo distribution (32+ trials)')).toBeTruthy();
    fireEvent.press(screen.getByText('Shadow raid'));
    expect(screen.getByText('Shadow boss state')).toBeTruthy();
    expect(screen.getByText('Modeling raid timelines…')).toBeTruthy();
    fireEvent.press(screen.getByText('Party of 2'));
    expect(screen.getByText('Party Power timing')).toBeTruthy();
    fireEvent.press(screen.getByText('Save for strongest Charged Attack'));
    fireEvent.press(screen.getByText('Enraged'));
    expect(screen.getByText(/custom settings/)).toBeTruthy();
  });
});
