export const MOBILE_EXPERIENCE_MODES = ['webview', 'native-preview'] as const;

export type MobileExperienceMode = (typeof MOBILE_EXPERIENCE_MODES)[number];

export const NATIVE_PREVIEW_ENTRY_PATH = '/native' as const;

export const resolveMobileExperienceMode = (
  value: unknown,
): MobileExperienceMode =>
  value === 'native-preview' ? 'native-preview' : 'webview';
