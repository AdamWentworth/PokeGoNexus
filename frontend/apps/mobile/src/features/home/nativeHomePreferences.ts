import * as SecureStore from 'expo-secure-store';

const secureStoreSegment = (value: string): string => (
  value.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'guest'
);

const actionMenuHintKey = (userId: string | null): string => (
  `pokegonexus-native-home-action-menu-hint.${secureStoreSegment(userId ?? 'guest')}`
);

const onboardingKey = (ownerKey: string): string => (
  `pokegonexus-home-onboarding.${secureStoreSegment(ownerKey)}`
);

export const isNativeHomeActionMenuHintDismissed = async (
  userId: string | null,
): Promise<boolean> => (
  await SecureStore.getItemAsync(actionMenuHintKey(userId)) === 'dismissed'
);

export const dismissNativeHomeActionMenuHint = async (
  userId: string | null,
): Promise<void> => {
  await SecureStore.setItemAsync(actionMenuHintKey(userId), 'dismissed');
};

export const isNativeHomeOnboardingDismissed = async (
  ownerKey: string,
): Promise<boolean> => (
  await SecureStore.getItemAsync(onboardingKey(ownerKey)) === 'dismissed'
);

export const dismissNativeHomeOnboarding = async (
  ownerKey: string,
): Promise<void> => {
  await SecureStore.setItemAsync(onboardingKey(ownerKey), 'dismissed');
};
