import { usersContract } from '@pokemongonexus/shared-contracts/users';
import { searchNativeTrainers } from '../../../src/services/trainerSearchApi';

describe('searchNativeTrainers', () => {
  it('searches by the canonical trainer autocomplete endpoint', async () => {
    const client = { get: jest.fn().mockResolvedValue([
      { username: 'AdamZilla', pokemonGoName: 'AdamGo', team: 'Mystic', trainer_level: 50 },
    ]) };

    await expect(searchNativeTrainers(client, '  adam  ')).resolves.toEqual([
      { username: 'AdamZilla', pokemonGoName: 'AdamGo', team: 'Mystic', trainer_level: 50 },
    ]);
    expect(client.get).toHaveBeenCalledWith(usersContract.endpoints.autocompleteTrainers('adam'));
  });

  it('does not request queries shorter than two characters', async () => {
    const client = { get: jest.fn() };
    await expect(searchNativeTrainers(client, ' a ')).resolves.toEqual([]);
    expect(client.get).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads and removes case-insensitive duplicates', async () => {
    const client = { get: jest.fn().mockResolvedValue([
      { username: 'Trainer' },
      { username: 'trainer', pokemonGoName: 'Duplicate' },
    ]) };
    await expect(searchNativeTrainers(client, 'tr')).resolves.toEqual([{ username: 'Trainer' }]);

    client.get.mockResolvedValueOnce([{ pokemonGoName: 'Missing username' }]);
    await expect(searchNativeTrainers(client, 'bad')).rejects.toThrow('invalid');
  });
});
