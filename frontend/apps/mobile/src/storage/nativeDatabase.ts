import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';

const DATABASE_NAME = 'pokegonexus-native.db';

export type NativeDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params?: SQLiteBindParams): Promise<T[]>;
};

// These failures reject native argument conversion before any SQL executes.
// Never replay execute/finalize failures: a write could already have committed.
const rejectedBeforeExecution = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /Call to function 'NativeDatabase\.(prepareAsync|execAsync)' has been rejected/.test(error.message)
    && error.message.includes('Cannot use shared object that was already released')
    && error.message.includes('The 1st argument cannot be cast');
};

export const createNativeDatabase = (
  openConnection: () => Promise<NativeDatabase>,
): (() => Promise<NativeDatabase>) => {
  let connectionPromise: Promise<NativeDatabase> | null = null;

  const getConnection = (): Promise<NativeDatabase> => {
    if (!connectionPromise) {
      const pending = openConnection().catch((error) => {
        if (connectionPromise === pending) connectionPromise = null;
        throw error;
      });
      connectionPromise = pending;
    }
    return connectionPromise;
  };

  const execute = async <T>(operation: (database: NativeDatabase) => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt += 1) {
      const pending = getConnection();
      const database = await pending;
      try {
        return await operation(database);
      } catch (error) {
        if (!rejectedBeforeExecution(error)) throw error;
        // A late failure on the old handle must not invalidate its replacement.
        if (connectionPromise === pending) connectionPromise = null;
        if (attempt > 0) throw error;
      }
    }
  };

  // Stores retain this stable facade, so recovery reaches every cached store.
  const database: NativeDatabase = {
    execAsync: (source) => execute((connection) => connection.execAsync(source)),
    runAsync: (source, params) => execute((connection) => connection.runAsync(source, params)),
    getFirstAsync: <T>(source: string, params: SQLiteBindParams) => (
      execute((connection) => connection.getFirstAsync<T>(source, params))
    ),
    getAllAsync: <T>(source: string, params?: SQLiteBindParams) => (
      execute((connection) => connection.getAllAsync<T>(source, params))
    ),
  };
  return async () => {
    await getConnection();
    return database;
  };
};

/** All stores share one owned connection; recovery reopens the existing file. */
export const openNativeDatabase = createNativeDatabase(() => (
  SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true })
));
