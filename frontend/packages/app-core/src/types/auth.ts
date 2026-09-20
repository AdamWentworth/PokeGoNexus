// auth.ts

import type { Coordinates } from './location';
import type {
  AuthUser,
  LoginResponse as SharedLoginResponse,
  RefreshTokenResponse,
} from '@shared-contracts/auth';

export type User = AuthUser;
export type RefreshTokenPayload = RefreshTokenResponse;
export type LoginResponse = SharedLoginResponse;

export interface GenericPayload {
  [key: string]: unknown;
}

export interface LoginFormValues extends GenericPayload {
  username: string;
  password: string;
}

export interface RegisterFormValues extends GenericPayload {
  username: string;
  email: string;
  password: string;
  trainerCode: string;
  pokemonGoName: string;
  locationInput: string;
  coordinates: Coordinates | null;
  allowLocation: boolean;
  pokemonGoNameDisabled: boolean;
}

export interface RegisterFormErrors {
  [key: string]: string;
}

export interface FormErrors {
  [key: string]: string;
}
