import * as SecureStore from 'expo-secure-store';
import {
  dismissNativeHomeActionMenuHint,
  dismissNativeHomeOnboarding,
  isNativeHomeActionMenuHintDismissed,
  isNativeHomeOnboardingDismissed,
} from '../../../../src/features/home/nativeHomePreferences';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);

describe('native home preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue('dismissed');
    mockedSecureStore.setItemAsync.mockResolvedValue(undefined);
  });

  it('uses only Expo SecureStore-safe keys for guest and trainer preferences', async () => {
    await expect(isNativeHomeActionMenuHintDismissed(null)).resolves.toBe(true);
    await expect(isNativeHomeOnboardingDismissed('user:id/with spaces')).resolves.toBe(true);
    await dismissNativeHomeActionMenuHint('user-1');
    await dismissNativeHomeOnboarding('user:id/with spaces');

    const keys = [
      ...mockedSecureStore.getItemAsync.mock.calls,
      ...mockedSecureStore.setItemAsync.mock.calls,
    ].map(([key]) => key);
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      expect(key).toMatch(/^[a-zA-Z0-9._-]+$/);
      expect(key).not.toContain(':');
    }
    expect(keys).toContain('pokegonexus-home-onboarding.user_id_with_spaces');
  });
});
