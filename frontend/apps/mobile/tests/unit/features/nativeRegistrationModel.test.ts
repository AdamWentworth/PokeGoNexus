import {
  buildNativeRegistrationRequest,
  createNativeRegistrationDraft,
  validateNativePassword,
  validateNativeRegistrationStep,
} from '../../../src/features/auth/nativeRegistrationModel';

describe('nativeRegistrationModel', () => {
  it('enforces the same account and password rules as web registration', () => {
    const draft = createNativeRegistrationDraft();
    expect(validateNativeRegistrationStep(draft, 0)).toMatch(/Username/);
    expect(validateNativePassword('weak')).toMatch(/8/);
    expect(validateNativePassword('Strong_password_42')).toMatch(/symbol/);
    expect(validateNativePassword('Strong_password_42!')).toBeNull();
  });

  it('normalizes optional trainer details for the auth API', () => {
    const request = buildNativeRegistrationRequest({
      ...createNativeRegistrationDraft(),
      allowLocation: true,
      coordinates: null,
      email: ' MISTY@EXAMPLE.COM ',
      location: ' Cerulean City ',
      password: 'Strong_password_42!',
      pokemonGoName: ' MistyGO ',
      trainerCode: '1234 5678 9012',
      username: ' Misty ',
    });
    expect(request).toEqual({
      allowLocation: true,
      coordinates: null,
      email: 'misty@example.com',
      location: 'Cerulean City',
      password: 'Strong_password_42!',
      pokemonGoName: 'MistyGO',
      trainerCode: '123456789012',
      username: 'Misty',
    });
  });
});
