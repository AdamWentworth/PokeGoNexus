import type { MobileSessionUser } from '@pokemongonexus/shared-contracts/auth';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { TrainerProfile } from '@pokemongonexus/shared-contracts/users';
import {
  buildNativeTrainerProfileSavePlan,
  createNativeTrainerProfileDraft,
  NativeTrainerProfileValidationError,
} from '../../../../src/features/social/nativeTrainerProfileEditorModel';

const profile = {
  user: {
    user_id: 'user-1',
    username: 'AdamZilla',
    pokemonGoName: 'AdamGo',
    team: 'Mystic',
    trainer_level: 50,
    total_xp: 123456,
    pogo_started_on: '2016-07-06T00:00:00Z',
    app_joined_at: '2026-01-01',
  },
  trainer_titles: ['shiny-hunter'],
  location: 'Burnaby, BC',
  trainer_code: '123456789012',
  stats: { caught: 1, for_trade: 1, wanted: 1, favorites: 1, registered: 1 },
  highlights: [{ instance_id: 'one' }, { instance_id: 'two' }],
  viewer: { relationship: 'self', can_view_profile: true, can_view_collection: true },
} as TrainerProfile<PokemonInstance>;

const sessionUser: MobileSessionUser = {
  user_id: 'user-1',
  username: 'AdamZilla',
  email: 'adam@example.invalid',
  pokemonGoName: 'AdamGo',
  trainerCode: '123456789012',
  location: 'Burnaby, BC',
  allowLocation: false,
};

describe('native trainer profile editor model', () => {
  it('creates a stable draft and avoids an unnecessary authentication write', () => {
    const draft = createNativeTrainerProfileDraft(profile);
    expect(draft).toMatchObject({
      trainerTitles: ['shiny-hunter'],
      trainerLevel: '50',
      totalXp: '123456',
      startedOn: '2016-07-06',
      highlightInstanceIds: ['one', 'two'],
    });
    expect(buildNativeTrainerProfileSavePlan(draft, sessionUser)).toEqual({
      authUpdate: null,
      profileUpdate: {
        trainer_titles: ['shiny-hunter'],
        pokemonGoName: 'AdamGo',
        trainer_code: '123456789012',
        team: 'Mystic',
        location: 'Burnaby, BC',
        trainer_level: 50,
        total_xp: 123456,
        pogo_started_on: '2016-07-06',
        highlight_instance_ids: ['one', 'two'],
      },
    });
  });

  it('does not treat presentation spacing in the session trainer code as an identity change', () => {
    const draft = createNativeTrainerProfileDraft(profile);
    const formattedSession = {
      ...sessionUser,
      trainerCode: '1234 5678 9012',
    };
    draft.trainerLevel = '49';

    expect(buildNativeTrainerProfileSavePlan(draft, formattedSession)).toEqual(
      expect.objectContaining({
        authUpdate: null,
        profileUpdate: expect.objectContaining({ trainer_level: 49 }),
      }),
    );
  });

  it('normalizes identity values and explicitly clears them in auth', () => {
    const draft = createNativeTrainerProfileDraft(profile);
    draft.pokemonGoName = '';
    draft.trainerCode = '';
    draft.location = '';
    const plan = buildNativeTrainerProfileSavePlan(draft, sessionUser);
    expect(plan.authUpdate).toEqual({
      pokemonGoName: null,
      trainerCode: null,
      location: null,
    });
    expect(plan.profileUpdate).toMatchObject({
      pokemonGoName: '',
      trainer_code: '',
      location: '',
    });
  });

  it.each([
    ['trainerCode', '123', 'exactly 12 digits'],
    ['trainerLevel', '81', 'between 1 and 80'],
    ['totalXp', '-1', 'whole number'],
    ['startedOn', '2026-02-31', 'valid date'],
  ] as const)('rejects an invalid %s', (field, value, message) => {
    const draft = createNativeTrainerProfileDraft(profile);
    draft[field] = value;
    expect(() => buildNativeTrainerProfileSavePlan(draft, sessionUser)).toThrow(message);
  });

  it('rejects duplicate titles and highlights with field context', () => {
    const draft = createNativeTrainerProfileDraft(profile);
    draft.trainerTitles = ['shiny-hunter', 'shiny-hunter'];
    try {
      buildNativeTrainerProfileSavePlan(draft, sessionUser);
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(NativeTrainerProfileValidationError);
      expect((error as NativeTrainerProfileValidationError).field).toBe('trainerTitles');
    }

    draft.trainerTitles = [];
    draft.highlightInstanceIds = ['one', 'one'];
    expect(() => buildNativeTrainerProfileSavePlan(draft, sessionUser)).toThrow('unique');
  });
});
