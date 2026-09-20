import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';
import type {
  NativePokedexManualRegistration,
  NativePokedexRegistrationFacets,
} from '../features/tools/nativePokedexModel';
import { openNativeDatabase } from './nativeDatabase';

type RegistrationRow = {
  entry_id: string;
  facets_json: string;
  registration_id: string;
};

type RegistrationDatabase = {
  execAsync(source: string): Promise<void>;
  getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>;
  runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>;
};

type OpenRegistrationDatabase = () => Promise<RegistrationDatabase>;

const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for Pokédex registrations.');
  return normalized;
};

const parseFacets = (value: string): NativePokedexRegistrationFacets => {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as NativePokedexRegistrationFacets
      : {};
  } catch {
    return {};
  }
};

const defaultOpenDatabase: OpenRegistrationDatabase = openNativeDatabase;

export const createNativePokedexRegistrationStore = (
  openDatabase: OpenRegistrationDatabase = defaultOpenDatabase,
) => {
  let databasePromise: Promise<RegistrationDatabase> | null = null;
  const getDatabase = (): Promise<RegistrationDatabase> => {
    if (!databasePromise) {
      databasePromise = openDatabase().then(async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS pokedex_manual_registrations (
            user_id TEXT NOT NULL,
            registration_id TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            facets_json TEXT NOT NULL,
            saved_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, registration_id)
          );
          CREATE INDEX IF NOT EXISTS idx_pokedex_manual_registrations_user
            ON pokedex_manual_registrations (user_id);
        `);
        return database;
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    }
    return databasePromise;
  };

  const read = async (userId: string): Promise<NativePokedexManualRegistration[]> => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<RegistrationRow>(
      `SELECT registration_id, entry_id, facets_json
       FROM pokedex_manual_registrations
       WHERE user_id = ?
       ORDER BY registration_id`,
      [normalizeUserId(userId)],
    );
    return rows.map((row) => ({
      registrationId: row.registration_id,
      entryId: row.entry_id,
      facets: parseFacets(row.facets_json),
    }));
  };

  const register = async (
    userId: string,
    registrations: NativePokedexManualRegistration[],
  ): Promise<void> => {
    if (registrations.length === 0) return;
    const database = await getDatabase();
    const normalizedUserId = normalizeUserId(userId);
    for (const registration of registrations) {
      await database.runAsync(
        `INSERT INTO pokedex_manual_registrations
           (user_id, registration_id, entry_id, facets_json, saved_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, registration_id) DO UPDATE SET
           entry_id = excluded.entry_id,
           facets_json = excluded.facets_json,
           saved_at = excluded.saved_at`,
        [normalizedUserId, registration.registrationId, registration.entryId, JSON.stringify(registration.facets), Date.now()],
      );
    }
  };

  const unregister = async (userId: string, registrationIds: string[]): Promise<void> => {
    if (registrationIds.length === 0) return;
    const database = await getDatabase();
    const normalizedUserId = normalizeUserId(userId);
    for (const registrationId of new Set(registrationIds)) {
      await database.runAsync(
        `DELETE FROM pokedex_manual_registrations
         WHERE user_id = ? AND registration_id = ?`,
        [normalizedUserId, registrationId],
      );
    }
  };

  return { read, register, unregister };
};

export const nativePokedexRegistrationStore = createNativePokedexRegistrationStore();
