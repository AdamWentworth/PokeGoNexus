import type { TrainerProfile } from '@pokemongonexus/shared-contracts/users';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { buildNativeTrainerProfileModel } from '../../../../src/features/social/nativeTrainerProfileModel';

describe('buildNativeTrainerProfileModel', () => {
  it.each(['2016-07-06', '2016-07-06T00:00:00Z', '2016-07-06T00:00:00+14:00'])(
    'keeps the trainer start calendar date from %s across device time zones',
    (startedOn) => {
      const profile = {
        user: { user_id: 'user-1', username: 'Trainer', pogo_started_on: startedOn, app_joined_at: '2026-01-02T00:00:00Z' },
        trainer_titles: [],
        highlights: [],
        stats: { caught: 0, for_trade: 0, wanted: 0, favorites: 0, registered: 0 },
        viewer: { relationship: 'self', can_view_profile: true, can_view_collection: true },
      } as TrainerProfile<PokemonInstance>;

      expect(buildNativeTrainerProfileModel(profile).startedLabel).toBe('Jul 6, 2016');
    },
  );

  it('preserves the canonical trainer identity, stats, titles, and viewer permissions', () => {
    const profile = {
      user: {
        user_id: 'user-1',
        username: 'AdamZilla',
        pokemonGoName: 'AdamGo',
        team: 'Mystic',
        trainer_level: 50,
        total_xp: 123456,
        pogo_started_on: '2016-07-06',
        app_joined_at: '2026-01-02T00:00:00Z',
      },
      trainer_titles: ['shiny-hunter'],
      location: 'Burnaby, British Columbia, Canada',
      trainer_code: '123456789012',
      stats: { caught: 10, for_trade: 4, wanted: 3, favorites: 2, registered: 800 },
      highlights: [{ instance_id: 'featured-1' }],
      viewer: {
        relationship: 'friend',
        friendship_id: 'friendship-1',
        can_view_profile: true,
        can_view_collection: true,
      },
    } as TrainerProfile<PokemonInstance>;

    const model = buildNativeTrainerProfileModel(profile);
    expect(model).toMatchObject({
      userId: 'user-1',
      username: 'AdamZilla',
      pokemonGoName: 'AdamGo',
      avatarLabel: 'A',
      team: 'mystic',
      teamLabel: 'Team Mystic',
      trainerLevel: 50,
      totalXpLabel: '123,456 XP',
      startedLabel: 'Jul 6, 2016',
      locationLabel: 'Burnaby, British Columbia, Canada',
      trainerCodeLabel: '1234 5678 9012',
      relationship: 'friend',
      friendshipId: 'friendship-1',
      canViewCollection: true,
    });
    expect(model.titles).toEqual([expect.objectContaining({ label: 'Shiny Hunter' })]);
    expect(model.stats.map(({ label, value }) => [label, value])).toEqual([
      ['Registered', 800],
      ['Caught', 10],
      ['For trade', 4],
      ['Wanted', 3],
      ['Favorites', 2],
    ]);
    expect(model.highlights).toHaveLength(1);
  });
});
