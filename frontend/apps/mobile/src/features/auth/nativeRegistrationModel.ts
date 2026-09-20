import type { MobileRegisterRequest } from '@pokemongonexus/shared-contracts/auth';
import type { Coordinates } from '@pokemongonexus/shared-contracts/location';

export type NativeRegistrationDraft = {
  allowLocation: boolean;
  confirmPassword: string;
  coordinates: Coordinates | null;
  email: string;
  location: string;
  password: string;
  pokemonGoName: string;
  useUsernameAsPokemonGoName: boolean;
  trainerCode: string;
  username: string;
};

export const createNativeRegistrationDraft = (): NativeRegistrationDraft => ({
  allowLocation: false,
  confirmPassword: '',
  coordinates: null,
  email: '',
  location: '',
  password: '',
  pokemonGoName: '',
  useUsernameAsPokemonGoName: false,
  trainerCode: '',
  username: '',
});

export const validateNativePassword = (password: string): string | null => {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add a lowercase letter.';
  if (!/\d/.test(password)) return 'Add a number.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Add a symbol.';
  return null;
};

export const validateNativeRegistrationStep = (
  draft: NativeRegistrationDraft,
  step: number,
): string | null => {
  if (step === 0) {
    if (!/^[A-Za-z0-9_]{3,15}$/.test(draft.username.trim())) {
      return 'Username must be 3–15 letters, numbers, or underscores.';
    }
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(draft.email.trim())) {
      return 'Enter a valid email address.';
    }
  }
  if (step === 1) {
    const passwordError = validateNativePassword(draft.password);
    if (passwordError) return passwordError;
    if (draft.password !== draft.confirmPassword) return 'Passwords do not match.';
  }
  if (step === 2) {
    const pokemonGoName = draft.pokemonGoName.trim();
    if (!draft.useUsernameAsPokemonGoName && pokemonGoName && !/^[A-Za-z0-9_]{4,15}$/.test(pokemonGoName)) {
      return 'Pokémon GO name must be 4–15 letters, numbers, or underscores.';
    }
    const trainerCode = draft.trainerCode.replace(/\s+/g, '');
    if (trainerCode && !/^\d{12}$/.test(trainerCode)) {
      return 'Trainer code must contain exactly 12 digits.';
    }
  }
  return null;
};

export const buildNativeRegistrationRequest = (
  draft: NativeRegistrationDraft,
): Omit<MobileRegisterRequest, 'device_id'> => ({
  allowLocation: draft.allowLocation,
  coordinates: draft.coordinates,
  email: draft.email.trim().toLocaleLowerCase(),
  location: draft.location.trim() || null,
  password: draft.password,
  pokemonGoName: draft.useUsernameAsPokemonGoName
    ? draft.username.trim()
    : draft.pokemonGoName.trim() || null,
  trainerCode: draft.trainerCode.replace(/\s+/g, '') || null,
  username: draft.username.trim(),
});
