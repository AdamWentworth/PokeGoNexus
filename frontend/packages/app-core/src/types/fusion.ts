// src/types/fusion.ts

import { Fusion } from './pokemonSubTypes';
import type { PokemonVariant } from './pokemonVariants';

export type FusionSelectionResult =
  | { action: 'fuseThis'; instanceId: string }
  | { action: 'cancel'; instanceId: null };

export interface FusionSelectionData {
  baseKey: string;
  baseNumber: string;
  isShiny: boolean;
  fusionData: Fusion;
  leftCandidatesList: PokemonVariant[];
  rightCandidatesList: PokemonVariant[];
  resolve: (value: FusionSelectionResult) => void;
  reject: (reason?: unknown) => void;
  error?: string | null;
}
