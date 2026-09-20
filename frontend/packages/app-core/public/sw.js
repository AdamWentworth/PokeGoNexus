/* sw.js - lean: network batching only (no IndexedDB writes) */

let RECEIVER_API_URL = null;
let RECEIVER_BATCHED_UPDATES_PATH = '/batchedUpdates';
let DEBUG_SW = true; // can be toggled via SET_CONFIG
let IS_LOGGED_IN = false; // <-- NEW

/* ------------------------------- Logging --------------------------------- */
function log(tag, obj) {
  if (!DEBUG_SW) return;
  try {
    console.log(`[SW] ${tag}`, obj ?? '');
  } catch {}
}

/* ---------------------------- Config from app ---------------------------- */
self.addEventListener('message', (event) => {
  const { type, payload, action, data } = event.data || {};

  // Config (e.g., { type: 'SET_CONFIG', payload: { RECEIVER_API_URL, DEBUG_SW, IS_LOGGED_IN } })
  if (type === 'SET_CONFIG' && payload) {
    if (payload.RECEIVER_API_URL) RECEIVER_API_URL = payload.RECEIVER_API_URL;
    if (payload.RECEIVER_BATCHED_UPDATES_PATH) {
      RECEIVER_BATCHED_UPDATES_PATH = payload.RECEIVER_BATCHED_UPDATES_PATH;
    }
    if (typeof payload.DEBUG_SW === 'boolean') DEBUG_SW = payload.DEBUG_SW;
    if (typeof payload.IS_LOGGED_IN === 'boolean') IS_LOGGED_IN = payload.IS_LOGGED_IN; // <-- NEW
    log('Config', {
      RECEIVER_API_URL,
      RECEIVER_BATCHED_UPDATES_PATH,
      DEBUG_SW,
      IS_LOGGED_IN,
    });
    return;
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Auth state updates (explicit)
  // e.g., { type: 'AUTH_STATE', payload: { isLoggedIn: true/false } }
  if (type === 'AUTH_STATE' && payload) {
    if (typeof payload.isLoggedIn === 'boolean') {
      IS_LOGGED_IN = payload.isLoggedIn;
      log('AuthState', { IS_LOGGED_IN });
    }
    return;
  }

  if (!action) return;

  const operation = (async () => {
    try {
      switch (action) {
        case 'sendBatchedUpdatesToBackend':
          await sendBatchedUpdatesToBackend(data);
          break;

        // Intentionally unsupported
        case 'syncData':
        case 'syncLists':
          log('skip', { action, reason: 'SW no longer writes IndexedDB' });
          break;

        default:
          log('Unknown action', action);
      }
    } catch (err) {
      console.error('[SW] Action failed:', action, err);
    }
  })();

  // Mobile browsers may stop an idle worker immediately after this handler
  // returns. Keep it alive until any queued writes have reached the receiver.
  event.waitUntil(operation);
});

/* -------------------------- Lifecycle (no cache) ------------------------- */
self.addEventListener('install', () => {
  log('install', { waitingForActivation: Boolean(self.registration.active) });
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* ------------------------------ Fetch passthru --------------------------- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Leave APK streaming, completion, and resume to the browser's downloader.
  // This also covers older pages that still link to the GitHub release asset.
  if (url.pathname.startsWith('/downloads/') || /\.apk$/i.test(url.pathname)) return;
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        log('fetch passthru failed', {
          url: event.request.url,
          message: err?.message || String(err),
        });
        throw err;
      })
    );
  } else {
    event.respondWith(
      fetch(event.request).catch((err) => {
        log('fetch passthru failed', {
          url: event.request.url,
          message: err?.message || String(err),
        });
        // Propagate network/CORS failures to the app instead of returning a fake 200.
        throw err;
      })
    );
  }
});

/* =========================================================================
   updatesDB for network batching (plain IDB API)
   ========================================================================= */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openUpdatesDB() {
  return new Promise((resolve, reject) => {
    // Open the installed schema version. The application owns migrations, and
    // asking for an older hard-coded version fails with VersionError.
    const req = indexedDB.open('updatesDB');
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;
      const ensureStore = (storeName, keyPath) => {
        if (db.objectStoreNames.contains(storeName)) {
          const existing = tx.objectStore(storeName);
          if (existing.keyPath === keyPath) return;
          db.deleteObjectStore(storeName);
        }
        db.createObjectStore(storeName, { keyPath });
      };

      ensureStore('batchedPokemonUpdates', 'instance_id');
      ensureStore('acknowledgedPokemonUpdates', 'instance_id');
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore(db, storeName) {
  const tx = db.transaction([storeName], 'readonly');
  const store = tx.objectStore(storeName);
  const req = store.getAll();
  const result = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  return result;
}

async function deleteSentUpdates(db, sentUpdates) {
  const tx = db.transaction(
    ['batchedPokemonUpdates', 'acknowledgedPokemonUpdates'],
    'readwrite',
  );
  const store = tx.objectStore('batchedPokemonUpdates');
  const acknowledged = tx.objectStore('acknowledgedPokemonUpdates');
  for (const sent of sentUpdates) {
    const current = await new Promise((resolve, reject) => {
      const req = store.get(sent.instance_id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (Number(current?.last_update ?? 0) === Number(sent.last_update ?? 0)) {
      acknowledged.put(sent);
      store.delete(sent.instance_id);
    }
  }
  await txDone(tx);
}

async function batchIDFor(updates) {
  const signature = updates
    .map((update) => `${update.instance_id}:${Number(update.last_update ?? 0)}`)
    .sort()
    .join('|');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(signature),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

function reportSyncStatus(pendingCount, status, error) {
  sendMessageToClients({
    type: 'POKEMON_SYNC_STATUS',
    payload: { pendingCount, status, error: error || null },
  });
}

function normalizeBatchedUpdateRequest(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      location: Object.prototype.hasOwnProperty.call(data, 'location') ? data.location : null,
      isLoggedIn:
        typeof data.isLoggedIn === 'boolean' ? data.isLoggedIn : null,
      receiverApiUrl:
        typeof data.receiverApiUrl === 'string' ? data.receiverApiUrl : null,
      receiverBatchedUpdatesPath:
        typeof data.receiverBatchedUpdatesPath === 'string'
          ? data.receiverBatchedUpdatesPath
          : null,
    };
  }

  return {
    location: data ?? null,
    isLoggedIn: null,
    receiverApiUrl: null,
    receiverBatchedUpdatesPath: null,
  };
}

/* =========================================================================
   Message handlers
   ========================================================================= */
async function sendBatchedUpdatesToBackend(data) {
  let db = null;

  try {
    const request = normalizeBatchedUpdateRequest(data);
    if (typeof request.isLoggedIn === 'boolean') {
      IS_LOGGED_IN = request.isLoggedIn;
      log('AuthState(sync)', { IS_LOGGED_IN });
    }
    if (request.receiverApiUrl) {
      RECEIVER_API_URL = request.receiverApiUrl;
    }
    if (request.receiverBatchedUpdatesPath) {
      RECEIVER_BATCHED_UPDATES_PATH = request.receiverBatchedUpdatesPath;
    }

    if (!IS_LOGGED_IN) {
      log('batchedUpdates:skip', { reason: 'not logged in' });
      return;
    }

    db = await openUpdatesDB();
    const pokemonUpdates = await getAllFromStore(db, 'batchedPokemonUpdates');

    const hasPokemon = Array.isArray(pokemonUpdates) && pokemonUpdates.length > 0;

    if (!hasPokemon) {
      log('batchedUpdates:none', {});
      return;
    }

    if (!RECEIVER_API_URL) {
      log('batchedUpdates:skip', { reason: 'RECEIVER_API_URL not set' });
      return;
    }

    const payload = {
      sync_batch_id: await batchIDFor(pokemonUpdates),
      location: request.location || null,
      pokemonUpdates,
    };
    reportSyncStatus(pokemonUpdates.length, 'sending');
    log('batchedUpdates:POST', { payload });

    const targetPath = RECEIVER_BATCHED_UPDATES_PATH.startsWith('/')
      ? RECEIVER_BATCHED_UPDATES_PATH
      : `/${RECEIVER_BATCHED_UPDATES_PATH}`;
    const res = await fetch(`${RECEIVER_API_URL}${targetPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await deleteSentUpdates(db, pokemonUpdates);
    const remaining = await getAllFromStore(db, 'batchedPokemonUpdates');
    const awaitingCommit = await getAllFromStore(db, 'acknowledgedPokemonUpdates');
    reportSyncStatus(remaining.length + awaitingCommit.length, 'reconciling');
    log('batchedUpdates:acknowledged', {
      sent: pokemonUpdates.length,
      remaining: remaining.length,
      awaitingCommit: awaitingCommit.length,
    });
  } catch (err) {
    let pendingCount = 0;
    if (db) {
      try {
        pendingCount = (await getAllFromStore(db, 'batchedPokemonUpdates')).length;
      } catch {}
    }
    reportSyncStatus(pendingCount, 'error', err?.message || String(err));
    console.error('[SW] sendBatchedUpdatesToBackend failed:', err);
  } finally {
    db?.close();
  }
}

/* ------------------------------- Utilities ------------------------------- */
function sendMessageToClients(msg) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((c) => c.postMessage(msg));
  });
}
