import { stripDiacritics } from '@pokemongonexus/shared-contracts/domain';
import {
  locationContract,
  type LocationBase,
  type LocationResponse,
  type LocationSuggestion,
} from '@pokemongonexus/shared-contracts/location';
import {
  createNativeLocationApiClient,
  type NativeLocationApiClient,
} from './nativeApiClients';

export const formatNativeLocationSuggestions = (
  payload: unknown,
): LocationSuggestion[] => {
  if (!Array.isArray(payload)) return [];

  return payload.slice(0, 5).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const location = candidate as LocationBase;
    const displayName = [
      location.name || location.city,
      location.state_or_province,
      location.country,
    ]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(', ');

    return displayName ? [{ ...location, displayName }] : [];
  });
};

export const getNativeLocationSuggestions = async (
  userInput: string,
  client: NativeLocationApiClient = createNativeLocationApiClient(),
): Promise<LocationSuggestion[]> => {
  const query = stripDiacritics(userInput.trim());
  if (query.length < 3) return [];

  const payload = await client.get<unknown>(locationContract.endpoints.autocomplete, {
    query: { query },
  });
  return formatNativeLocationSuggestions(payload);
};

export const getNativeLocationOptions = async (
  latitude: number,
  longitude: number,
  client: NativeLocationApiClient = createNativeLocationApiClient(),
): Promise<LocationSuggestion[]> => {
  const payload = await client.get<LocationResponse>(locationContract.endpoints.reverse, {
    query: { lat: latitude, lon: longitude },
  });
  return formatNativeLocationSuggestions(payload.locations ?? []);
};
