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

async function migrateLegacyCache() {
  // The legacy database predates per-user ownership. Reassigning it to whichever
  // user logs in first can expose another user's financial snapshot or queue.
  await deleteDatabase(LEGACY_DATABASE);
}

async function ensureUserDatabase(userId: string) {
  let migration = migrations.get(userId);
  if (!migration) {
    migration = migrateLegacyCache().catch(error => {
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
export const readReceiptDrafts = <T>(userId: string) => read<T[]>(userId, "receipt-drafts");
export const writeReceiptDrafts = (userId: string, drafts: unknown[]) => write(userId, "receipt-drafts", drafts);

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

export async function clearAppShellCache() {
  if ("caches" in window) {
    for (const key of await caches.keys()) {
      if (key.startsWith("arus-shell-")) await caches.delete(key);
    }
  }
}

export async function clearDeviceCache(userId: string) {
  migrations.delete(userId);
  await deleteDatabase(databaseName(userId));

  // Remove any pre-user-scoping cache that may still exist after an interrupted migration.
  await deleteDatabase(LEGACY_DATABASE).catch(() => {});
  await clearAppShellCache();
}
