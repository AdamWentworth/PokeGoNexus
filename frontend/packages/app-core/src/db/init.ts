// init.ts

import {
  openDB,
  IDBPDatabase,
  IDBPTransaction,
  IDBPObjectStore,
} from 'idb';
import {
  DB_VERSION,
  VARIANTS_DB_NAME, INSTANCES_DB_NAME, TAGS_DB_NAME,
  TRADES_DB_NAME,   UPDATES_DB_NAME,
  REGISTRATIONS_DB_NAME,
  VARIANTS_STORE, INSTANCES_STORE,
  POKEMON_TRADES_STORE, RELATED_INSTANCES_STORE,
  REGISTRATIONS_STORE, MANUAL_POKEDEX_REGISTRATIONS_STORE,
  BATCHED_POKEMON_UPDATES_STORE,
  ACKNOWLEDGED_POKEMON_UPDATES_STORE,
  TAG_DEFS_STORE, INSTANCE_TAGS_STORE,
  SYSTEM_CHILDREN_STORE,
} from './constants';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('db.init');

interface Doc { [k: string]: unknown; }

type IndexNamesLike = ArrayLike<string> & {
  contains?: (name: string) => boolean;
};

/** normalize index presence check across DOMStringList / string[] */
function storeHasIndex<S extends string>(
  store: IDBPObjectStore<Doc, ArrayLike<string>, S, 'versionchange'>,
  name: string
) {
  const names = store.indexNames as unknown as IndexNamesLike | null | undefined;
  if (!names) return false;
  if (typeof names.contains === 'function') {
    return names.contains(name);
  }
  return Array.from(names).includes(name);
}

/** init factory with typed upgrade callback */
function makeInit(
  dbName: string,
  upgrade: (
    db: IDBPDatabase<Doc>,
    oldV: number,
    newV: number | null,
    tx: IDBPTransaction<Doc, ArrayLike<string>, 'versionchange'>,
    ev?: IDBVersionChangeEvent
  ) => void
) {
  let ref: IDBPDatabase<Doc> | null = null;
  return async () => {
    if (ref) return ref;
    try {
      ref = await openDB<Doc>(dbName, DB_VERSION, { upgrade });
    } catch (err) {
      log.error(`${dbName} init failed:`, err);
      ref = null;
    }
    return ref;
  };
}

export const initVariantsDB = makeInit(VARIANTS_DB_NAME, (db) => {
  if (!db.objectStoreNames.contains(VARIANTS_STORE)) {
    db.createObjectStore(VARIANTS_STORE, { keyPath: 'variant_id' });
  }
});

export const initInstancesDB = makeInit(INSTANCES_DB_NAME, (db) => {
  if (!db.objectStoreNames.contains(INSTANCES_STORE)) {
    db.createObjectStore(INSTANCES_STORE, { keyPath: 'instance_id' });
  }
});

/** Tags DB: single instanceTags store + per-tag indexes (no user_id anywhere) */
export const initTagsDB = makeInit(TAGS_DB_NAME, (db, _oldV, _newV, tx) => {
  // --- tag definitions ---
  if (!db.objectStoreNames.contains(TAG_DEFS_STORE)) {
    const s = db.createObjectStore(TAG_DEFS_STORE, { keyPath: 'tag_id' });
    s.createIndex('by_parent', 'parent');
  } else {
    const s = tx.objectStore(TAG_DEFS_STORE);
    if (!storeHasIndex(s, 'by_parent')) s.createIndex('by_parent', 'parent');
  }

  // --- instance tag memberships (ONE store) ---
  const it =
    !db.objectStoreNames.contains(INSTANCE_TAGS_STORE)
      ? db.createObjectStore(INSTANCE_TAGS_STORE, { keyPath: 'key' }) // `${tag_id}:${instance_id}`
      : tx.objectStore(INSTANCE_TAGS_STORE);

  const ensureIndex = <S extends string>(
    store: IDBPObjectStore<Doc, ArrayLike<string>, S, 'versionchange'>,
    name: string,
    keyPath: string
  ) => {
    if (!storeHasIndex(store, name)) store.createIndex(name, keyPath);
  };

  // general indexes
  ensureIndex(it, 'by_tag', 'tag_id');
  ensureIndex(it, 'by_instance', 'instance_id');

  // ✅ per-system-tag indexes
  ensureIndex(it, 'by_caught',      'caught_iid');
  ensureIndex(it, 'by_trade',       'trade_iid');
  ensureIndex(it, 'by_wanted',      'wanted_iid');
  ensureIndex(it, 'by_favorite',    'favorite_iid');
  ensureIndex(it, 'by_most_wanted', 'most_wanted_iid');

  // --- lean snapshot ---
  if (!db.objectStoreNames.contains(SYSTEM_CHILDREN_STORE)) {
    db.createObjectStore(SYSTEM_CHILDREN_STORE, { keyPath: 'key' });
  }
});

export const initTradesDB = makeInit(TRADES_DB_NAME, (db) => {
  if (!db.objectStoreNames.contains(POKEMON_TRADES_STORE)) {
    db.createObjectStore(POKEMON_TRADES_STORE, { keyPath: 'trade_id' });
  }
  if (!db.objectStoreNames.contains(RELATED_INSTANCES_STORE)) {
    db.createObjectStore(RELATED_INSTANCES_STORE, { keyPath: 'instance_id' });
  }
});

export const initUpdatesDB = makeInit(UPDATES_DB_NAME, (db, _oldV, _newV, tx) => {
  const ensureStore = (storeName: string, keyPath: string) => {
    if (db.objectStoreNames.contains(storeName)) {
      const existing = tx.objectStore(storeName);
      if (existing.keyPath === keyPath) return;
      db.deleteObjectStore(storeName);
    }

    db.createObjectStore(storeName, { keyPath });
  };

  ensureStore(BATCHED_POKEMON_UPDATES_STORE, 'instance_id');
  ensureStore(ACKNOWLEDGED_POKEMON_UPDATES_STORE, 'instance_id');
  if (db.objectStoreNames.contains('batchedTradeUpdates')) {
    db.deleteObjectStore('batchedTradeUpdates');
  }
});

export const initRegistrationsDB = makeInit(REGISTRATIONS_DB_NAME, (db) => {
  if (!db.objectStoreNames.contains(REGISTRATIONS_STORE)) {
    db.createObjectStore(REGISTRATIONS_STORE, { keyPath: 'variant_id' });
  }
  if (!db.objectStoreNames.contains(MANUAL_POKEDEX_REGISTRATIONS_STORE)) {
    db.createObjectStore(MANUAL_POKEDEX_REGISTRATIONS_STORE, { keyPath: 'registration_id' });
  }
});
