const LEGACY_DATABASE = "arus-device-cache";
const DATABASE_PREFIX = "arus-device-cache:";
const STORE = "state";
const PENDING = "pending";
const migrations = new Map<string, Promise<void>>();

function databaseName(userId: string) {
  if (!userId) throw new Error("User offline tidak tersedia.");
  return DATABASE_PREFIX + userId;
}

function openNamedDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
      if (!request.result.objectStoreNames.contains(PENDING)) {
        request.result.createObjectStore(PENDING, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Tutup tab Arus lain lalu coba lagi."));
  });
}

async function migrateLegacyCache(userId: string) {
  let created = false;
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DATABASE, 2);
    request.onupgradeneeded = event => {
      created = event.oldVersion === 0;
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
      if (!request.result.objectStoreNames.contains(PENDING)) {
        request.result.createObjectStore(PENDING, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (created) {
    legacy.close();
    await deleteDatabase(LEGACY_DATABASE);
    return;
  }

  const snapshot = await new Promise<unknown | null>((resolve, reject) => {
    const request = legacy.transaction(STORE, "readonly").objectStore(STORE).get("snapshot");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  const pending = await new Promise<Array<{ id: string }>>((resolve, reject) => {
    const request = legacy.transaction(PENDING, "readonly").objectStore(PENDING).getAll();
    request.onsuccess = () => resolve(request.result as Array<{ id: string }>);
    request.onerror = () => reject(request.error);
  });
  legacy.close();

  const scoped = await openNamedDatabase(databaseName(userId));
  await new Promise<void>((resolve, reject) => {
    const transaction = scoped.transaction([STORE, PENDING], "readwrite");
    if (snapshot !== null) transaction.objectStore(STORE).put(snapshot, "snapshot");
    for (const item of pending) transaction.objectStore(PENDING).put(item);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  scoped.close();

  await deleteDatabase(LEGACY_DATABASE);
}

async function ensureUserDatabase(userId: string) {
  let migration = migrations.get(userId);
  if (!migration) {
    migration = migrateLegacyCache(userId).catch(error => {
      migrations.delete(userId);
      throw error;
    });
    migrations.set(userId, migration);
  }
  await migration;
}

async function openDatabase(userId: string) {
  await ensureUserDatabase(userId);
  return openNamedDatabase(databaseName(userId));
}

async function read<T>(userId: string, key: string): Promise<T | null> {
  const db = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as T) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function write(userId: string, key: string, value: unknown): Promise<void> {
  const db = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export const readSnapshot = <T>(userId: string) => read<T>(userId, "snapshot");
export const writeSnapshot = (userId: string, value: unknown) => write(userId, "snapshot", value);

export async function readQueue<T>(userId: string): Promise<T[]> {
  const db = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const request = db.transaction(PENDING, "readonly").objectStore(PENDING).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as T[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function enqueueTransaction(userId: string, value: { id: string }) {
  return changeQueue(userId, store => store.put(value));
}

export async function removeQueuedTransaction(userId: string, id: string) {
  return changeQueue(userId, store => store.delete(id));
}

async function changeQueue(
  userId: string,
  change: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  const db = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING, "readwrite");
    change(transaction.objectStore(PENDING));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function clearDeviceCache(userId: string) {
  migrations.delete(userId);
  await deleteDatabase(databaseName(userId));

  // Remove any pre-user-scoping cache that may still exist after an interrupted migration.
  await deleteDatabase(LEGACY_DATABASE).catch(() => {});

  if ("caches" in window) {
    for (const key of await caches.keys()) {
      if (key.startsWith("arus-shell-")) await caches.delete(key);
    }
  }
}
