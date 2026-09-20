import type { NativePokedexManualRegistration } from '../features/tools/nativePokedexModel';
import { readNativeWebValue, writeNativeWebValue } from './nativeWebStorage';

const REGISTRATION_KEY_PREFIX = 'pokegonexus.native.pokedex-registrations.';
const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for Pokédex registrations.');
  return normalized;
};

const storageKey = (userId: string): string => (
  `${REGISTRATION_KEY_PREFIX}${encodeURIComponent(normalizeUserId(userId))}`
);

const read = async (userId: string): Promise<NativePokedexManualRegistration[]> => {
  const key = storageKey(userId);
  const value = await readNativeWebValue('pokedex-registrations', key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as NativePokedexManualRegistration[] : [];
  } catch {
    return [];
  }
};

const write = async (
  userId: string,
  registrations: NativePokedexManualRegistration[],
): Promise<void> => {
  const key = storageKey(userId);
  const value = JSON.stringify(registrations);
  await writeNativeWebValue('pokedex-registrations', key, value);
};

export const createNativePokedexRegistrationStore = () => ({
  read: async (userId: string): Promise<NativePokedexManualRegistration[]> => (
    (await read(userId)).sort((left, right) => left.registrationId.localeCompare(right.registrationId))
  ),
  register: async (
    userId: string,
    registrations: NativePokedexManualRegistration[],
  ): Promise<void> => {
    const byId = new Map((await read(userId)).map((registration) => [registration.registrationId, registration]));
    registrations.forEach((registration) => byId.set(registration.registrationId, registration));
    await write(userId, [...byId.values()]);
  },
  unregister: async (userId: string, registrationIds: string[]): Promise<void> => {
    const removed = new Set(registrationIds);
    await write(userId, (await read(userId)).filter(({ registrationId }) => !removed.has(registrationId)));
  },
});

export const nativePokedexRegistrationStore = createNativePokedexRegistrationStore();
