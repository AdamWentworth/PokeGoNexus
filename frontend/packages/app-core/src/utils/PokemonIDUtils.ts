// src/utils/PokemonIDUtils.ts
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import type { ParsedKeyParts } from '../types/keys';

export { determineVariantId } from './determineVariantId';

export function generateUUID(): string {
  return uuidv4();
}

export function validateUUID(uuid: string): boolean {
  return uuidValidate(uuid);
}

export function getKeyParts(key: string): ParsedKeyParts {
  const [idPart, variantPart] = key.split('-');
  const pokemonId = parseInt(idPart, 10);

  const parts: ParsedKeyParts = {
    pokemonId,
    costumeName: null,
    isShiny: key.includes('_shiny') || key.includes('-shiny'),
    isDefault: key.includes('_default') || key.includes('-default'),
    isShadow: key.includes('_shadow') || key.includes('-shadow'),
  };

  if (variantPart) {
    let name = variantPart;
    if (parts.isShiny) name = name.split('_shiny')[0];
    else if (parts.isDefault) name = name.split('_default')[0];
    else if (parts.isShadow) name = name.split('_shadow')[0];
    parts.costumeName = name;
  }

  return parts;
}

/** Parse a string that may be a pure variant_id or an instance_id ("{variant_id}_{uuid}") */
export function parseVariantId(input: string): {
  baseKey: string;
  hasUUID: boolean;
} {
  if (!input) {
    return { baseKey: '', hasUUID: false };
  }

  const keyParts = input.split('_');
  const lastPart = keyParts[keyParts.length - 1];
  const hasUUID = validateUUID(lastPart);

  if (hasUUID) keyParts.pop();

  const baseKey = keyParts.join('_');
  return {
    baseKey,
    hasUUID,
  };
}

/** Canonical variant key accessor. */
export function getVariantIdFrom(input: {
  variant_id?: string;
} | null | undefined): string {
  return String(input?.variant_id ?? '');
}

/** Preferred entity key for mutations: instance_id first, variant_id second. */
export function getEntityKeyFrom(input: {
  instance_id?: string | null;
  variant_id?: string;
  instanceData?: { instance_id?: string | null } | null;
} | null | undefined): string {
  return String(
    input?.instanceData?.instance_id ??
    input?.instance_id ??
    input?.variant_id ??
    '',
  );
}
