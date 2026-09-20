import {
  buildNativeTrainerSearchRows,
  normalizeNativeTrainerTeam,
} from '../../../src/features/search/trainerSearchModel';

describe('native trainer search model', () => {
  it('normalizes teams and preserves both trainer identities', () => {
    expect(normalizeNativeTrainerTeam('Team Valor')).toBe('valor');
    expect(normalizeNativeTrainerTeam('unknown')).toBe('neutral');
    expect(buildNativeTrainerSearchRows([{
      username: ' AdamZilla ',
      pokemonGoName: ' AdamGo ',
      team: 'Team Mystic',
      trainer_level: 50,
    }])).toEqual([{
      username: 'AdamZilla',
      pokemonGoName: 'AdamGo',
      team: 'mystic',
      teamLabel: 'Team Mystic',
      trainerLevel: 50,
      avatarLabel: 'A',
    }]);
  });
});
