export type NativeWebStoreName = 'collection-cache' | 'collection-outbox' | 'pokedex-registrations';

const DATABASE_NAME = 'pokegonexus-native-web';
const DATABASE_VERSION = 1;
const STORE_NAMES: NativeWebStoreName[] = [
  'collection-cache',
  'collection-outbox',
  'pokedex-registrations',
];

const memoryFallback = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | null = null;

const memoryKey = (store: NativeWebStoreName, key: string): string => `${store}:${key}`;

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolvePromise, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      STORE_NAMES.forEach((name) => {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name);
        }
      });
    };
    request.onsuccess = () => resolvePromise(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open native web storage.'));
    request.onblocked = () => reject(new Error('Native web storage upgrade is blocked.'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
};

const transactionFinished = (transaction: IDBTransaction): Promise<void> => (
  new Promise((resolvePromise, reject) => {
    transaction.oncomplete = () => resolvePromise();
    transaction.onerror = () => reject(transaction.error ?? new Error('Native web storage failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Native web storage was aborted.'));
  })
);

export const readNativeWebValue = async (
  store: NativeWebStoreName,
  key: string,
): Promise<string | null> => {
  const fallback = memoryFallback.get(memoryKey(store, key)) ?? null;
  try {
    const database = await openDatabase();
    return await new Promise<string | null>((resolvePromise, reject) => {
      const request = database.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolvePromise(
        typeof request.result === 'string' ? request.result : fallback,
      );
      request.onerror = () => reject(request.error ?? new Error('Native web storage read failed.'));
    });
  } catch {
    return fallback;
  }
};

export const writeNativeWebValue = async (
  store: NativeWebStoreName,
  key: string,
  value: string,
): Promise<void> => {
  memoryFallback.set(memoryKey(store, key), value);
  try {
    const database = await openDatabase();
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value, key);
    await transactionFinished(transaction);
  } catch {
    // Embedded previews and strict browser modes may block IndexedDB. The
    // session fallback keeps the current native-web run operational without
    // weakening SQLite persistence on Android or iOS.
  }
};

export const deleteNativeWebValue = async (
  store: NativeWebStoreName,
  key: string,
): Promise<void> => {
  memoryFallback.delete(memoryKey(store, key));
  try {
    const database = await openDatabase();
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).delete(key);
    await transactionFinished(transaction);
  } catch {
    // The in-memory copy is already removed.
  }
};
