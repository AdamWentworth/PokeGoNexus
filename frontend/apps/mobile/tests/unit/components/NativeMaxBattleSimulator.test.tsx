import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import { NativeMaxBattleSimulator } from '../../../src/components/tools/NativeMaxBattleSimulator';
import {
  buildNativeMaxRoleCandidates,
  buildNativeMaxVariants,
} from '../../../src/features/tools/nativeBattleModels';

const fast = {
  move_id: 1,
  name: 'Vine Whip',
  raid_power: 10,
  raid_energy: 8,
  raid_cooldown: 1,
  is_fast: 1,
  type_name: 'grass',
  type: 'grass',
} as Move;
const charged = {
  ...fast,
  move_id: 2,
  name: 'Power Whip',
  raid_power: 90,
  raid_energy: -50,
  raid_cooldown: 2.5,
  is_fast: 0,
} as Move;
const catalog = [
  {
    pokemon_id: 1,
    name: 'Bulbasaur',
    pokedex_number: 1,
    attack: 118,
    defense: 111,
    stamina: 128,
    available: 1,
    cp40: 1000,
    cp50: 1200,
    type1_name: 'grass',
    type2_name: 'poison',
    image_url: '/1.png',
    moves: [fast, charged],
    max: [{ pokemon_id: 1, dynamax: 1, gigantamax: 0, dynamax_release_date: null, gigantamax_release_date: null }],
  },
  {
    pokemon_id: 2,
    name: 'Ivysaur',
    pokedex_number: 2,
    attack: 151,
    defense: 143,
    stamina: 155,
    available: 1,
    cp40: 1700,
    cp50: 1900,
    type1_name: 'grass',
    type2_name: 'poison',
    image_url: '/2.png',
    moves: [fast, charged],
    max: [{ pokemon_id: 2, dynamax: 1, gigantamax: 0, dynamax_release_date: null, gigantamax_release_date: null }],
  },
] as BasePokemon[];

describe('NativeMaxBattleSimulator', () => {
  it('models trainers, execution modes, difficulty, and advanced details', async () => {
    const boss = buildNativeMaxVariants(catalog)[0];
    const candidates = buildNativeMaxRoleCandidates({
      bossVariant: boss,
      catalog,
      scope: 'catalog',
    });
    render(
      <NativeMaxBattleSimulator
        assetBaseUrl="https://pokegonexus.com"
        boss={boss}
        candidates={candidates}
        rosterScope="catalog"
      />,
    );

    expect(screen.getByText('More help needed')).toBeTruthy();
    expect(screen.getByLabelText('2 Trainers')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add one Trainer'));
    expect(screen.getByLabelText('3 Trainers')).toBeTruthy();

    fireEvent.press(screen.getByText('Advanced setup'));
    await screen.findByText('Stress test');
    fireEvent.press(screen.getByText('Stress test'));
    expect(screen.getByText('Miss orbs and targeted dodges against the hardest legal moveset.')).toBeTruthy();

    fireEvent.press(screen.getByText(/Two-star Max/));
    expect(screen.getByLabelText('1 Trainers')).toBeTruthy();

    expect(screen.getByText('LOBBY DAMAGE')).toBeTruthy();
    expect(screen.getAllByText(/Catalog entries use level 50/).length).toBeGreaterThan(0);
  });

  it('supports direct party selection, custom boss HP, reset, and route callbacks', async () => {
    const boss = buildNativeMaxVariants(catalog)[0];
    const candidates = buildNativeMaxRoleCandidates({
      bossVariant: boss,
      catalog,
      scope: 'catalog',
    });
    const onDifficultyChange = jest.fn();
    const onTrainerCountChange = jest.fn();
    render(
      <NativeMaxBattleSimulator
        assetBaseUrl="https://pokegonexus.com"
        boss={boss}
        candidates={candidates}
        onDifficultyChange={onDifficultyChange}
        onTrainerCountChange={onTrainerCountChange}
        rosterScope="catalog"
      />,
    );

    const alternateDamage = candidates.damage[1];
    expect(alternateDamage).toBeDefined();
    fireEvent.press(screen.getByLabelText(/Damage team member,/));
    expect(screen.getByText('Choose Damage team member')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Select ${alternateDamage.displayName} for Damage`));
    expect(screen.getByLabelText(`Damage team member, ${alternateDamage.displayName}. Choose another recommendation.`)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add one Trainer'));
    expect(onTrainerCountChange).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByText('Advanced setup'));
    await screen.findByText(/Two-star Max/);
    fireEvent.press(screen.getByText(/Two-star Max/));
    expect(onDifficultyChange).toHaveBeenCalledWith('two-star');
    expect(onTrainerCountChange).toHaveBeenCalledWith(null);

    fireEvent.press(screen.getByText('Stress test'));
    fireEvent.changeText(screen.getByLabelText('Boss HP estimate'), '12000');
    expect(screen.getByDisplayValue('12000')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reset recommendations'));
    expect(screen.getByText('Collect scheduled meter orbs and dodge targeted warnings.')).toBeTruthy();
    expect(screen.queryByDisplayValue('12000')).toBeNull();
  });
});
