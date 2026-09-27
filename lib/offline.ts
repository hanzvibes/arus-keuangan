const DATABASE = "arus-device-cache";
const STORE = "state";
const PENDING = "pending";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); if (!request.result.objectStoreNames.contains(PENDING)) request.result.createObjectStore(PENDING, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => { db.close(); resolve((request.result as T) ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function write(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export const readSnapshot = <T>() => read<T>("snapshot");
export const writeSnapshot = (value: unknown) => write("snapshot", value);

export async function readQueue<T>(): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PENDING, "readonly").objectStore(PENDING).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as T[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function enqueueTransaction(value: { id: string }) { return changeQueue(store => store.put(value)); }
export async function removeQueuedTransaction(id: string) { return changeQueue(store => store.delete(id)); }

async function changeQueue(change: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING, "readwrite");
    change(transaction.objectStore(PENDING));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearDeviceCache() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Tutup tab Arus lain lalu coba lagi."));
  });
  if ("caches" in window) {
    for (const key of await caches.keys()) if (key.startsWith("arus-shell-")) await caches.delete(key);
  }
}
