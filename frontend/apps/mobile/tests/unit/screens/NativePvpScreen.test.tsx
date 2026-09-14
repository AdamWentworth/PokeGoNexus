import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type {
  BasePokemon,
  PokemonPvPRankingEntry,
  PokemonPvPRankingsPayload,
} from '@pokemongonexus/shared-contracts/pokemon';
import { NativePvpScreen } from '../../../src/screens/NativePvpScreen';

const buff = { attackerAttack: 0, attackerDefense: 0, targetAttack: 0, targetDefense: 0, chance: 0 };
const entry = (id: string, name: string, pokemonId: number, attack: number): PokemonPvPRankingEntry => ({
  rank: pokemonId,
  sourceRank: pokemonId,
  speciesId: id,
  name,
  pokemonId,
  variantKind: 'pokemon',
  imageUrl: `/${pokemonId}.png`,
  types: ['grass'],
  moveset: [
    { id: `${id}-fast`, name: 'Vine Whip', type: 'grass', kind: 'fast', power: 5, energyGain: 8, energyCost: 0, turns: 2, buff },
    { id: `${id}-charged`, name: 'Power Whip', type: 'grass', kind: 'charged', power: 90, energyGain: 0, energyCost: 50, turns: 1, buff },
  ],
  score: 95 - pokemonId,
  rating: 700 - pokemonId,
  categoryScores: [91, 90, 89, 88, 87, 86],
  matchups: [],
  counters: [],
  moveUsage: [],
  recommendedLevel: 20,
  attackIv: 0,
  defenseIv: 15,
  staminaIv: 15,
  battleAttack: attack,
  battleDefense: 120,
  battleHp: 125,
});

const bulbasaur = entry('bulbasaur', 'Bulbasaur', 1, 121);
const ivysaur = entry('ivysaur', 'Ivysaur', 2, 119);
const venusaur = entry('venusaur', 'Venusaur', 3, 117);
const payload = {
  source: {
    name: 'PvPoke',
    version: 'test',
    url: 'https://github.com/pvpoke/pvpoke',
    license: 'MIT',
    importedAt: '2026-07-23T00:00:00Z',
    metadata: {},
  },
  leagues: {
    great: { key: 'great', label: 'Great', cpLimit: 1500, entries: [bulbasaur, ivysaur, venusaur] },
    ultra: { key: 'ultra', label: 'Ultra', cpLimit: 2500, entries: [] },
    master: { key: 'master', label: 'Master', cpLimit: null, entries: [] },
  },
  formats: [],
} as PokemonPvPRankingsPayload;
const catalog = [
  {
    pokemon_id: 1,
    name: 'Bulbasaur',
    pokedex_number: 1,
    attack: 118,
    defense: 111,
    stamina: 128,
    image_url: '/1.png',
    image_url_shiny: '/1-shiny.png',
    type1_name: 'Grass',
    type2_name: 'Poison',
    moves: [
      { move_id: 1, name: 'Vine Whip', type_name: 'grass', is_fast: 1, pvp_power: 5, pvp_energy: 8, pvp_turns: 2 },
      { move_id: 2, name: 'Power Whip', type_name: 'grass', is_fast: 0, pvp_power: 90, pvp_energy: -50, pvp_turns: 1 },
    ],
    fusion: [],
    crownForms: [{
      id: 11,
      base_pokemon_id: 1,
      crown_pokemon_id: 1001,
      display_form: 'Test Crown',
      name: 'Bulbasaur',
      attack: 130,
      defense: 125,
      stamina: 140,
      type_1_id: 12,
      type1_name: 'Grass',
      type2_name: 'Poison',
      image_url: '/1-crown.png',
    }],
  },
] as unknown as BasePokemon[];

const renderScreen = () => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
    <NativePvpScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onMethodology={jest.fn()} onRetry={jest.fn()} payload={payload} signedIn={false} />
  </SafeAreaProvider>,
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('NativePvpScreen', () => {
  it('matches the web roster default and keeps the signed-out personal roster unavailable', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /All Pokémon/ }).props.accessibilityState).toMatchObject({ disabled: false, selected: true });
    expect(screen.getByRole('button', { name: /My Pokémon/ }).props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    expect(screen.getByText('3 ranked')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PvPoke' })).toBeTruthy();
  });

  it('exposes all four PvP workspaces without a web fallback', async () => {
    renderScreen();
    expect(screen.getByText('PvP Rankings')).toBeTruthy();
    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search PvP rankings'), 'Bulbasaur');
    fireEvent.press(screen.getByLabelText('Show details for Bulbasaur'));
    expect(screen.getByText('Role profile')).toBeTruthy();
    expect(screen.getByText('Stat product')).toBeTruthy();
    fireEvent.press(screen.getByText('Team Builder'));
    expect(screen.getByText('THREE-POKÉMON TEAM')).toBeTruthy();
    expect(screen.getByText('0 / 3')).toBeTruthy();
    expect(screen.getByLabelText('Search Team Builder Pokémon')).toBeTruthy();
    expect(screen.getByLabelText('Select Lead with Ivysaur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Select Lead with Bulbasaur'));
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByLabelText('Edit Lead, Bulbasaur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Select Safe Swap with Ivysaur'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByLabelText('Edit Safe Swap, Ivysaur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Select Closer with Venusaur'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(await screen.findByText('FIELD COVERAGE')).toBeTruthy();
    expect(screen.getByText('SHARED LOSSES')).toBeTruthy();
    expect(screen.getByText('ROLE TESTS')).toBeTruthy();
    fireEvent.press(screen.getByText('Battle Lab'));
    expect(screen.getByText('Simulate a focused matchup')).toBeTruthy();
    expect(screen.queryByText(/web simulator/i)).toBeNull();
    fireEvent.press(screen.getByText('IV Rank'));
    expect(screen.getByText('Find the strongest IV spread for this league')).toBeTruthy();
    fireEvent.press(screen.getByText('Bulbasaur'));
    expect(screen.getByText('APPRAISAL IVS')).toBeTruthy();
    expect(screen.getByText('RANK 1 SPREAD')).toBeTruthy();
    fireEvent.press(screen.getByText('Team Builder'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByLabelText('Edit Lead, Bulbasaur')).toBeTruthy();
    expect(screen.getByLabelText('Edit Safe Swap, Ivysaur')).toBeTruthy();
    fireEvent.press(screen.getByText('Rankings'));
    expect(screen.getByLabelText('Search PvP rankings').props.value).toBe('Bulbasaur');
    expect(screen.getByText('Role profile')).toBeTruthy();
  });

  it('paints pending feedback before running shared battle mechanics', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Battle Lab'));
    fireEvent.press(screen.getByLabelText('Run battle'));
    expect(screen.getByText('Simulating…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Simulated result')).toBeTruthy());
    expect(screen.getByText(/wins|draw/i)).toBeTruthy();
    expect(screen.getAllByText(/rating/)).toHaveLength(2);
  });

  it('uses and locally evaluates the actual caught copy in rankings and IV Rank', async () => {
    const onCatalogNeeded = jest.fn();
    const onOwnedDataNeeded = jest.fn();
    const instances = { leafy: {
      instance_id: 'leafy',
      variant_id: '0001-default',
      pokemon_id: 1,
      is_caught: true,
      disabled: false,
      cp: 1477,
      level: 40,
      attack_iv: 0,
      defense_iv: 15,
      stamina_iv: 15,
      fast_move_id: 1,
      charged_move1_id: 2,
      charged_move2_id: null,
      nickname: 'Leafy',
      favorite: true,
    }} as never;
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativePvpScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} instances={instances} onBack={jest.fn()} onCatalogNeeded={onCatalogNeeded} onMethodology={jest.fn()} onOwnedDataNeeded={onOwnedDataNeeded} onRetry={jest.fn()} payload={payload} signedIn />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: /My Pokémon/ }));
    expect(onCatalogNeeded).toHaveBeenCalledTimes(1);
    expect(onOwnedDataNeeded).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Leafy')).toBeTruthy();
    expect(screen.getByText(/1 fully detailed from 1 caught/)).toBeTruthy();
    expect(await screen.findByText(/evaluated locally against 3 meta opponents/)).toBeTruthy();
    fireEvent.press(screen.getByText('IV Rank'));
    expect(screen.getByText(/1 eligible for Great League/)).toBeTruthy();
    expect(screen.getAllByText(/Leafy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0\/15\/15 IV/)).toBeTruthy();
  });

  it('offers exact crowned forms in the IV Rank catalog', () => {
    const onCatalogNeeded = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativePvpScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onCatalogNeeded={onCatalogNeeded} onMethodology={jest.fn()} onRetry={jest.fn()} payload={payload} signedIn={false} />
      </SafeAreaProvider>,
    );
    expect(onCatalogNeeded).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('IV Rank'));
    expect(onCatalogNeeded).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Test Crown Bulbasaur')).toBeTruthy();
    fireEvent.press(screen.getByText('Test Crown Bulbasaur'));
    expect(screen.getByLabelText('grass and poison')).toBeTruthy();
    expect(screen.getByText('RANK 1 SPREAD')).toBeTruthy();
  });

  it('runs a switch-aware three-on-three team battle locally', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Battle Lab'));
    fireEvent.press(screen.getByText('Team battle'));
    expect(screen.getByText('Switching')).toBeTruthy();
    expect(screen.getByText('Current 45-second battle clock')).toBeTruthy();
    expect(screen.getByLabelText('Edit Side A Lead: Bulbasaur')).toBeTruthy();
    expect(screen.getByLabelText('Edit Opponent Lead: Ivysaur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Run team battle'));
    expect(await screen.findByText('SWITCH-AWARE 3V3 RESULT')).toBeTruthy();
    expect(screen.getByText(/Side A wins|Opponent wins|Team battle ends in a draw/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Test meta teams'));
    expect(await screen.findByText('ROLE-BALANCED META FIELD')).toBeTruthy();
    expect(screen.getByText(/^[0-9]+-[0-9]+-[0-9]+$/)).toBeTruthy();
  });

  it('matches the Vite cup disclosure and paginates the same 50-row ranking window', () => {
    const largeEntries = [bulbasaur, ivysaur, venusaur, ...Array.from({ length: 57 }, (_, offset) => {
      const rank = offset + 4;
      return {
        ...bulbasaur,
        rank,
        sourceRank: rank,
        speciesId: `meta-pokemon-${rank}`,
        name: `Meta Pokémon ${rank}`,
        score: 96 - rank * 0.5,
      };
    })];
    const largePayload = {
      ...payload,
      leagues: {
        ...payload.leagues,
        great: { ...payload.leagues.great, entries: largeEntries },
      },
      formats: [{
        key: 'jungle-cup',
        label: 'Jungle Cup',
        league: 'great' as const,
        cup: 'Jungle',
        cpLimit: 1500,
        rules: ['Only selected Jungle types'],
        mechanics: 'current-2026' as const,
        entries: largeEntries.slice(0, 20),
      }],
    };
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativePvpScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onMethodology={jest.fn()} onRetry={jest.fn()} payload={largePayload} signedIn={false} />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('60 ranked')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show next 10 PvP rankings'));
    expect(screen.queryByLabelText('Show next 10 PvP rankings')).toBeNull();
    fireEvent.press(screen.getByLabelText('Current PvP cup'));
    fireEvent.press(screen.getByText('Jungle Cup'));
    expect(screen.getByText('20 ranked')).toBeTruthy();
    expect(screen.queryByText('Only selected Jungle types')).toBeNull();
    fireEvent.press(screen.getByLabelText('Format rules'));
    expect(screen.getByText('Only selected Jungle types')).toBeTruthy();
  });

  it('opens Battle Lab with the exact team and opponent selected from matchup evidence', async () => {
    const seededEntries = [bulbasaur, ivysaur, venusaur].map((candidate) => ({
      ...candidate,
      counters: [{ speciesId: 'ivysaur', rating: 300 }],
    }));
    const seededPayload = {
      ...payload,
      leagues: {
        ...payload.leagues,
        great: { ...payload.leagues.great, entries: seededEntries },
      },
    };
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativePvpScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onMethodology={jest.fn()} onRetry={jest.fn()} payload={seededPayload} persistTeamBuilder={false} signedIn={false} />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByText('Team Builder'));
    fireEvent.press(screen.getByLabelText('Select Lead with Bulbasaur'));
    fireEvent.press(screen.getByLabelText('Select Safe Swap with Ivysaur'));
    fireEvent.press(screen.getByLabelText('Select Closer with Venusaur'));
    await screen.findByText('FIELD COVERAGE');
    fireEvent.press(screen.getByLabelText('Published matchup evidence'));
    fireEvent.press(screen.getByLabelText('Test Ivysaur in Battle Lab'));

    expect(screen.getByRole('button', { name: 'Team battle' }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByLabelText('Edit Side A Lead: Bulbasaur')).toBeTruthy();
    expect(screen.getByLabelText('Edit Opponent Lead: Ivysaur')).toBeTruthy();
  });
});
