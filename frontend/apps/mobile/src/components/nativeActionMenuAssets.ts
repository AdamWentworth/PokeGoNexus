import { actionMenuExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

export const NATIVE_ACTION_MENU_DESTINATIONS = (
  actionMenuExperienceParityContract.primaryDestinations
);

export const NATIVE_ACTION_MENU_ASSET_PATHS = [
  '/images/btn_action_menu.png',
  ...NATIVE_ACTION_MENU_DESTINATIONS.map((destination) => destination.icon),
  '/images/profile-icon.png',
  '/images/btn_settings.png',
  '/images/register-icon.png',
  '/images/login-icon.png',
  '/images/close-button.png',
  '/images/close-button-light.png',
] as const;

export const toNativeActionMenuAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);
