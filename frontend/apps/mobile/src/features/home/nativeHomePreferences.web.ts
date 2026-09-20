const actionMenuHintKey = (userId: string | null): string => (
  `pokegonexus-native-home-action-menu-hint:${userId ?? 'guest'}`
);

const onboardingKey = (ownerKey: string): string => (
  `pokegonexus-home-onboarding:${ownerKey}`
);

const getItem = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const setItem = (key: string, value: string): void => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // A blocked storage API should not make Home unusable.
  }
};

export const isNativeHomeActionMenuHintDismissed = async (
  userId: string | null,
): Promise<boolean> => getItem(actionMenuHintKey(userId)) === 'dismissed';

export const dismissNativeHomeActionMenuHint = async (
  userId: string | null,
): Promise<void> => setItem(actionMenuHintKey(userId), 'dismissed');

export const isNativeHomeOnboardingDismissed = async (
  ownerKey: string,
): Promise<boolean> => getItem(onboardingKey(ownerKey)) === 'dismissed';

export const dismissNativeHomeOnboarding = async (
  ownerKey: string,
): Promise<void> => setItem(onboardingKey(ownerKey), 'dismissed');
